-- Calqulate — dashboard migration.
--
-- Run AFTER schema.sql, in the Supabase SQL editor. Safe to re-run.
--
-- Adds what the rebuilt home screen actually reads or writes: body
-- measurements, saved daily scores, mission completion, streaks, and the goal
-- record. Tables nothing reads yet are deliberately left out — an empty table
-- with policies is maintenance cost with no payoff.

-- ---------------------------------------------------------------------------
-- Units
--
-- Every weight in this database is in POUNDS, matching the client. `units` is a
-- display preference only; changing it must never rewrite stored numbers.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists units text not null default 'lb'
    check (units in ('lb', 'kg'));

-- Existing rows predate the canonical-pounds rule and may hold kilograms.
-- Convert them once, then mark them so this never runs twice.
alter table public.profiles
  add column if not exists weights_normalised boolean not null default false;

update public.profiles
   set start_weight = start_weight * 2.2046226218,
       goal_weight  = goal_weight  * 2.2046226218,
       weights_normalised = true
 where weights_normalised = false
   and units = 'kg';

update public.profiles set weights_normalised = true where weights_normalised = false;

-- ---------------------------------------------------------------------------
-- body_measurements — body composition and tape measurements
-- ---------------------------------------------------------------------------
create table if not exists public.body_measurements (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  measured_at    timestamptz not null default now(),
  body_fat_pct   numeric check (body_fat_pct between 1 and 75),
  lean_mass_lb   numeric check (lean_mass_lb >= 0),
  fat_mass_lb    numeric check (fat_mass_lb >= 0),
  waist_in       numeric check (waist_in >= 0),
  neck_in        numeric check (neck_in >= 0),
  hip_in         numeric check (hip_in >= 0),
  water_pct      numeric check (water_pct between 0 and 100),
  source         text not null default 'manual',
  created_at     timestamptz not null default now()
);

create index if not exists body_measurements_user_time_idx
  on public.body_measurements (user_id, measured_at desc);

-- ---------------------------------------------------------------------------
-- metabolic_scores — one saved row per user per day
--
-- The client can always recompute a score from logs, so this exists for what
-- the client cannot do: server-side trend queries, weekly digests, and the
-- admin panel, without replaying every log.
-- ---------------------------------------------------------------------------
create table if not exists public.metabolic_scores (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  scored_on    date not null,
  total        smallint not null check (total between 0 and 100),
  band         text not null,
  -- Per-component points, e.g. {"medication":25,"protein":14,...}
  components   jsonb not null default '{}'::jsonb,
  available    smallint not null default 0,
  created_at   timestamptz not null default now(),
  unique (user_id, scored_on)
);

create index if not exists metabolic_scores_user_day_idx
  on public.metabolic_scores (user_id, scored_on desc);

-- ---------------------------------------------------------------------------
-- missions — the daily actions, and whether they were completed
-- ---------------------------------------------------------------------------
create table if not exists public.missions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  mission_on  date not null,
  -- Matches ScoreComponentId on the client: protein, hydration, activity, …
  component   text not null,
  title       text not null,
  points      smallint not null default 0,
  completed   boolean not null default false,
  completed_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, mission_on, component)
);

create index if not exists missions_user_day_idx
  on public.missions (user_id, mission_on desc);

-- ---------------------------------------------------------------------------
-- streaks — one row per user, updated as days are completed
-- ---------------------------------------------------------------------------
create table if not exists public.streaks (
  user_id        uuid primary key references public.profiles(id) on delete cascade,
  current_days   integer not null default 0,
  longest_days   integer not null default 0,
  last_logged_on date,
  xp             integer not null default 0,
  level          smallint not null default 1,
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- achievements — earned badges
-- ---------------------------------------------------------------------------
create table if not exists public.achievements (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  code       text not null,
  earned_at  timestamptz not null default now(),
  unique (user_id, code)
);

-- ---------------------------------------------------------------------------
-- goals — the weight target, kept as history so a changed goal is auditable
-- ---------------------------------------------------------------------------
create table if not exists public.goals (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  start_weight_lb numeric not null,
  goal_weight_lb  numeric not null,
  target_date    date,
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index if not exists goals_user_active_idx
  on public.goals (user_id) where active;

-- ---------------------------------------------------------------------------
-- coach_insights — what the coach told the user, and how they responded
--
-- Kept so we can measure whether an alert actually changed behaviour, which is
-- the only way to know if the coach is any good.
-- ---------------------------------------------------------------------------
create table if not exists public.coach_insights (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  status       text not null check (status in
                 ('on_track','watch','alert','celebrate','setup')),
  headline     text not null,
  detail       text not null,
  action       text,
  acted_on     boolean not null default false,
  shown_on     date not null default current_date,
  created_at   timestamptz not null default now(),
  unique (user_id, shown_on, status, headline)
);

create index if not exists coach_insights_user_time_idx
  on public.coach_insights (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security — same rule everywhere: you touch only your own rows
-- ---------------------------------------------------------------------------
alter table public.body_measurements enable row level security;
alter table public.metabolic_scores  enable row level security;
alter table public.missions          enable row level security;
alter table public.streaks           enable row level security;
alter table public.achievements      enable row level security;
alter table public.goals             enable row level security;
alter table public.coach_insights    enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'body_measurements','metabolic_scores','missions','achievements','goals','coach_insights'
  ] loop
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all
         using (auth.uid() = user_id or public.is_admin())
         with check (auth.uid() = user_id)', t);
  end loop;
end $$;

-- streaks is keyed by user_id rather than having one, so it needs its own policy.
drop policy if exists "own streak" on public.streaks;
create policy "own streak" on public.streaks
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Keeping the streak honest
--
-- Incrementing in the client would let a reinstall or a clock change inflate
-- it. This does the arithmetic in the database from the previous row.
-- ---------------------------------------------------------------------------
create or replace function public.touch_streak(p_user uuid, p_day date default current_date)
returns public.streaks
language plpgsql
security definer set search_path = public
as $$
declare
  row public.streaks;
begin
  insert into public.streaks (user_id, current_days, longest_days, last_logged_on, xp)
  values (p_user, 1, 1, p_day, 10)
  on conflict (user_id) do update
    set current_days = case
          when public.streaks.last_logged_on = p_day then public.streaks.current_days
          when public.streaks.last_logged_on = p_day - 1 then public.streaks.current_days + 1
          else 1
        end,
        last_logged_on = p_day,
        xp = public.streaks.xp + case when public.streaks.last_logged_on = p_day then 0 else 10 end,
        updated_at = now()
  returning * into row;

  update public.streaks
     set longest_days = greatest(longest_days, current_days),
         level = greatest(1, (xp / 500) + 1)
   where user_id = p_user
  returning * into row;

  return row;
end;
$$;
