-- Calqulate — Supabase schema.
--
-- Run once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: everything is idempotent.
--
-- Security model
--   * Every table is row-level-secured. A user can only ever touch their own
--     rows, enforced by `auth.uid()` — not by the client asking nicely.
--   * Admins are identified by `profiles.is_admin`, set from the ADMIN_EMAILS
--     list at the bottom of this file. Admins can read everything, but the
--     admin panel still goes through the service-role key on the server.
--   * `is_pro` is written ONLY by the service role (the RevenueCat webhook).
--     A user cannot grant themselves Pro by updating their own profile — see
--     the trigger at the end.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- profiles — one row per auth user, created automatically on signup
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id              uuid primary key references auth.users on delete cascade,
  email           text not null,
  name            text default '',
  reason          text,
  medication      text,
  dose_mg         numeric,
  injection_day   smallint check (injection_day between 0 and 6),
  injection_hour  smallint not null default 9 check (injection_hour between 0 and 23),
  start_weight    numeric,
  goal_weight     numeric,
  units           text not null default 'lb' check (units in ('lb', 'kg')),
  theme           text not null default 'system' check (theme in ('system', 'light', 'dark')),
  notifications   boolean not null default false,
  reminder_time   text not null default '09:00',
  goals           jsonb not null default
                    '{"proteinG":100,"waterMl":2500,"steps":7000,"activityMin":30,"sleepHours":7}'::jsonb,
  onboarded       boolean not null default false,
  is_pro          boolean not null default false,
  pro_expires_at  timestamptz,
  is_admin        boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- logs — every weigh-in, meal, dose, symptom, activity and sleep entry
-- ---------------------------------------------------------------------------
create table if not exists public.logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in
                ('weight','water','meal','symptom','dose','photo','activity','sleep')),
  value       numeric not null,
  label       text,
  note        text,
  logged_at   timestamptz not null default now(),
  deleted_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- The hot query is "this user's entries of one kind, newest first".
create index if not exists logs_user_kind_time_idx
  on public.logs (user_id, kind, logged_at desc)
  where deleted_at is null;

-- ---------------------------------------------------------------------------
-- devices — FCM tokens for push
-- ---------------------------------------------------------------------------
create table if not exists public.devices (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  fcm_token   text not null unique,
  platform    text not null,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions — written by the RevenueCat webhook (service role only)
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid references public.profiles(id) on delete cascade,
  app_user_id         text not null,
  product_id          text,
  store               text,
  status              text not null,
  period_type         text,
  purchased_at        timestamptz,
  expires_at          timestamptz,
  revenuecat_event_id text unique,
  created_at          timestamptz not null default now()
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);

-- ---------------------------------------------------------------------------
-- webhook_events — raw RevenueCat payloads, for idempotency and replay
-- ---------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id          uuid primary key default uuid_generate_v4(),
  event_id    text not null unique,
  event_type  text not null,
  app_user_id text,
  payload     jsonb not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Supporting tables for the admin panel
-- ---------------------------------------------------------------------------
create table if not exists public.feature_flags (
  key             text primary key,
  description     text,
  enabled         boolean not null default false,
  rollout_percent smallint not null default 0 check (rollout_percent between 0 and 100),
  updated_at      timestamptz not null default now()
);

create table if not exists public.notifications (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  body        text not null,
  audience    text not null,
  sent_count  integer not null default 0,
  dry_run     boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.support_tickets (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid references public.profiles(id) on delete set null,
  subject    text not null,
  body       text not null,
  status     text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id         uuid primary key default uuid_generate_v4(),
  actor      text not null,
  action     text not null,
  target     text,
  meta       jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- New signups get a profile automatically
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Users may not promote themselves to Pro or admin
--
-- The client updates its own profile row for ordinary settings, so those two
-- columns are pinned to their previous values on any non-service-role write.
-- ---------------------------------------------------------------------------
create or replace function public.protect_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    new.is_pro         := old.is_pro;
    new.pro_expires_at := old.pro_expires_at;
    new.is_admin       := old.is_admin;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_protect_privileged on public.profiles;
create trigger profiles_protect_privileged
  before update on public.profiles
  for each row execute function public.protect_privileged_columns();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.logs            enable row level security;
alter table public.devices         enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.webhook_events  enable row level security;
alter table public.feature_flags   enable row level security;
alter table public.notifications   enable row level security;
alter table public.support_tickets enable row level security;
alter table public.audit_logs      enable row level security;

-- Admin check. SECURITY DEFINER so the policy can read `profiles` without
-- recursing back through the very policy it is being evaluated for.
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "own logs" on public.logs;
create policy "own logs" on public.logs
  for all using (auth.uid() = user_id or public.is_admin())
  with check (auth.uid() = user_id);

drop policy if exists "own devices" on public.devices;
create policy "own devices" on public.devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "read own tickets" on public.support_tickets;
create policy "read own tickets" on public.support_tickets
  for select using (auth.uid() = user_id or public.is_admin());

drop policy if exists "create own tickets" on public.support_tickets;
create policy "create own tickets" on public.support_tickets
  for insert with check (auth.uid() = user_id);

drop policy if exists "read flags" on public.feature_flags;
create policy "read flags" on public.feature_flags
  for select using (auth.role() = 'authenticated');

-- webhook_events, notifications and audit_logs carry no user-facing policy at
-- all: only the service role touches them, and service role bypasses RLS.

-- ---------------------------------------------------------------------------
-- Admins
--
-- Replace the email below with yours, then re-run this block whenever you add
-- an admin. The account must have signed up already.
-- ---------------------------------------------------------------------------
update public.profiles
   set is_admin = true
 where email in ('you@example.com');

-- ---------------------------------------------------------------------------
-- Starter feature flags
-- ---------------------------------------------------------------------------
insert into public.feature_flags (key, description, enabled, rollout_percent) values
  ('ai_coach_v2',      'Model-generated coach notes instead of rule-based', false, 0),
  ('body_composition', 'Muscle vs fat tracking',                            false, 0),
  ('autopilot',        'Adaptive plan engine',                              false, 0)
on conflict (key) do nothing;
