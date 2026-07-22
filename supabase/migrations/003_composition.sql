-- Calqulate — Body Composition Engine migration.
--
-- Run after 002_dashboard.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Demographics the engine needs
--
-- Age drives the sarcopenia term; height supports BMI and lean-mass estimates;
-- a measured body fat percentage replaces the population prior and is what
-- lifts an estimate from "Moderate" to "High" confidence.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists birth_year   smallint check (birth_year between 1900 and 2100),
  add column if not exists sex          text check (sex in ('male', 'female', 'other')),
  add column if not exists height_cm    smallint check (height_cm between 100 and 260),
  add column if not exists body_fat_pct numeric check (body_fat_pct between 1 and 75);

-- Resistance training is logged separately from cardio: it is the single
-- strongest lever on muscle preservation and carries its own MPI weight.
alter table public.logs
  drop constraint if exists logs_kind_check;

alter table public.logs
  add constraint logs_kind_check check (kind in
    ('weight','water','meal','symptom','dose','photo','activity','strength','sleep'));

-- ---------------------------------------------------------------------------
-- composition_estimates — one row per weekly estimate
--
-- Stored rather than only computed so the trend of the estimate is itself
-- reviewable, and so a later model revision can be compared against what the
-- user was actually shown at the time.
-- ---------------------------------------------------------------------------
create table if not exists public.composition_estimates (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  estimated_on       date not null,
  fat_pct            smallint not null check (fat_pct between 0 and 100),
  lean_pct           smallint not null check (lean_pct between 0 and 100),
  confidence         smallint not null check (confidence between 0 and 100),
  mpi                smallint not null check (mpi between 0 and 100),
  /** Per-input 0-1 scores, e.g. {"protein":0.9,"strength":1,...} */
  scores             jsonb not null default '{}'::jsonb,
  /** Inputs that were missing, so a later review knows what was unknown. */
  missing            text[] not null default '{}',
  /** True when conservation of energy constrained the split. */
  energy_solved      boolean not null default false,
  /** False when body fat was a population prior. */
  body_fat_measured  boolean not null default false,
  weekly_change_lb   numeric,
  fat_change_lb      numeric,
  lean_change_lb     numeric,
  created_at         timestamptz not null default now(),
  unique (user_id, estimated_on)
);

create index if not exists composition_estimates_user_day_idx
  on public.composition_estimates (user_id, estimated_on desc);

alter table public.composition_estimates enable row level security;

drop policy if exists "own rows" on public.composition_estimates;
create policy "own rows" on public.composition_estimates
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);
