-- Calqulate — shots and pills.
--
-- Run after 003_composition.sql. Safe to re-run.

-- ---------------------------------------------------------------------------
-- Injection site on every dose
--
-- Rotation matters clinically: repeatedly injecting the same spot causes
-- lipohypertrophy, which absorbs erratically and shows up as an unexplained
-- change in how the dose works. Storing the site makes rotation reviewable
-- across devices and printable for a prescriber.
--
-- Null for oral medications, which have no site.
-- ---------------------------------------------------------------------------
alter table public.logs
  add column if not exists site text check (site in (
    'abdomen-left', 'abdomen-right',
    'thigh-left',   'thigh-right',
    'arm-left',     'arm-right'
  ));

create index if not exists logs_dose_site_idx
  on public.logs (user_id, site, logged_at desc)
  where kind = 'dose' and site is not null;

-- ---------------------------------------------------------------------------
-- How the medication is taken
--
-- The route changes the schedule (a weekly shot versus a daily pill), the
-- reminders, and how the medication-level curve is normalised. Defaulting to
-- injection keeps every existing row correct.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists medication_route text not null default 'injection'
    check (medication_route in ('injection', 'oral')),
  add column if not exists dose_interval_hours integer not null default 168
    check (dose_interval_hours between 1 and 1344);

-- Existing oral users, if any were recorded before this column existed.
update public.profiles
   set medication_route = 'oral', dose_interval_hours = 24
 where medication in ('rybelsus', 'oral_sema')
   and medication_route <> 'oral';

-- Liraglutide is a once-daily injection, unlike the weekly GLP-1s.
update public.profiles
   set dose_interval_hours = 24
 where medication = 'saxenda'
   and dose_interval_hours = 168;
