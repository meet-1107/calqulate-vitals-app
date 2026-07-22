/**
 * Supabase sync.
 *
 * The device is the source of truth for the UI: every write lands in local
 * state first and is mirrored to Postgres in the background. That keeps logging
 * instant and keeps the app working on a plane, at the cost of last-write-wins
 * on conflicts — acceptable here, since a person only logs from one device at a
 * time and the rows are append-only in practice.
 *
 * Every function swallows its errors. A failed sync must never surface as a
 * broken screen; the next mutation retries the whole row anyway.
 */

import { supabase } from './supabase';
import type { LogEntry, Profile } from '../store/types';
import type { MedicationId } from './medications';
import type { Reason, Units } from '../store/types';

type ProfileRow = {
  id: string;
  email: string;
  name: string | null;
  reason: string | null;
  medication: string | null;
  dose_mg: number | null;
  birth_year: number | null;
  sex: 'male' | 'female' | 'other' | null;
  height_cm: number | null;
  body_fat_pct: number | null;
  injection_day: number | null;
  injection_hour: number;
  start_weight: number | null;
  goal_weight: number | null;
  units: string;
  theme: string;
  notifications: boolean;
  reminder_time: string;
  goals: Profile['goals'];
  onboarded: boolean;
  is_pro: boolean;
  is_admin: boolean;
};

type LogRow = {
  id: string;
  user_id: string;
  kind: LogEntry['kind'];
  value: number;
  label: string | null;
  note: string | null;
  logged_at: string;
};

/** Columns the client is allowed to write. `is_pro` and `is_admin` are not among them. */
function toProfileRow(userId: string, p: Profile) {
  return {
    id: userId,
    email: p.email,
    name: p.name,
    reason: p.reason,
    medication: p.medication,
    dose_mg: p.doseMg,
    birth_year: p.birthYear,
    sex: p.sex,
    height_cm: p.heightCm,
    body_fat_pct: p.bodyFatPct,
    injection_day: p.injectionDay,
    injection_hour: p.injectionHour,
    start_weight: p.startWeight,
    goal_weight: p.goalWeight,
    units: p.settings.units,
    theme: p.settings.theme,
    notifications: p.settings.notifications,
    reminder_time: p.settings.reminderTime,
    goals: p.goals,
    onboarded: p.onboarded,
  };
}

function fromProfileRow(row: ProfileRow): Partial<Profile> {
  return {
    email: row.email,
    name: row.name ?? '',
    reason: (row.reason as Reason | null) ?? null,
    medication: (row.medication as MedicationId | null) ?? null,
    doseMg: row.dose_mg,
    birthYear: row.birth_year ?? null,
    sex: row.sex ?? null,
    heightCm: row.height_cm ?? null,
    bodyFatPct: row.body_fat_pct ?? null,
    injectionDay: row.injection_day,
    injectionHour: row.injection_hour,
    startWeight: row.start_weight,
    goalWeight: row.goal_weight,
    onboarded: row.onboarded,
    isPro: row.is_pro,
    isAdmin: row.is_admin,
    settings: {
      units: row.units as Units,
      theme: row.theme as Profile['settings']['theme'],
      notifications: row.notifications,
      reminderTime: row.reminder_time,
    },
    goals: row.goals,
  };
}

const toLogEntry = (row: LogRow): LogEntry => ({
  id: row.id,
  kind: row.kind,
  value: Number(row.value),
  label: row.label ?? undefined,
  note: row.note ?? undefined,
  at: new Date(row.logged_at).getTime(),
});

export async function pushProfile(userId: string, profile: Profile) {
  if (!supabase) return;
  await supabase.from('profiles').upsert(toProfileRow(userId, profile)).then(undefined, () => {});
}

export async function pushLog(userId: string, entry: LogEntry) {
  if (!supabase) return;
  await supabase
    .from('logs')
    .upsert({
      id: entry.id,
      user_id: userId,
      kind: entry.kind,
      value: entry.value,
      label: entry.label ?? null,
      note: entry.note ?? null,
      logged_at: new Date(entry.at).toISOString(),
    })
    .then(undefined, () => {});
}

/** Soft delete, so "undo any delete" works across devices too. */
export async function pushLogDeleted(id: string, deleted: boolean) {
  if (!supabase) return;
  await supabase
    .from('logs')
    .update({ deleted_at: deleted ? new Date().toISOString() : null })
    .eq('id', id)
    .then(undefined, () => {});
}

export type RemoteState = { profile: Partial<Profile>; logs: LogEntry[] } | null;

/** Reads everything back for this user — used on sign-in and on a new device. */
export async function pullRemote(userId: string): Promise<RemoteState> {
  if (!supabase) return null;
  try {
    const [profileRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase
        .from('logs')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('logged_at', { ascending: false })
        .limit(5000),
    ]);

    if (profileRes.error || !profileRes.data) return null;

    return {
      profile: fromProfileRow(profileRes.data as ProfileRow),
      logs: ((logsRes.data ?? []) as LogRow[]).map(toLogEntry),
    };
  } catch {
    return null;
  }
}

/**
 * Saves today's Metabolic Score.
 *
 * The client can always recompute this from logs, so the row exists for what
 * the client cannot do: server-side trends, weekly digests, and the admin
 * panel, without replaying a user's entire log history. Upserted on
 * (user_id, scored_on), so writing repeatedly through the day is harmless.
 */
export async function pushScore(
  userId: string,
  scoredOn: string,
  score: { total: number; band: string; available: number; lines: { id: string; earned: number }[] },
) {
  if (!supabase) return;
  await supabase
    .from('metabolic_scores')
    .upsert(
      {
        user_id: userId,
        scored_on: scoredOn,
        total: score.total,
        band: score.band,
        available: score.available,
        components: Object.fromEntries(score.lines.map((l) => [l.id, l.earned])),
      },
      { onConflict: 'user_id,scored_on' },
    )
    .then(undefined, () => {});
}

/** Records the active weight goal, keeping previous goals as history. */
export async function pushGoal(userId: string, startLb: number, goalLb: number) {
  if (!supabase) return;
  await supabase.from('goals').update({ active: false }).eq('user_id', userId).eq('active', true);
  await supabase
    .from('goals')
    .insert({ user_id: userId, start_weight_lb: startLb, goal_weight_lb: goalLb })
    .then(undefined, () => {});
}

/** Uploads anything created before sign-in, so nothing logged offline is lost. */
export async function pushAll(userId: string, profile: Profile, logs: LogEntry[]) {
  if (!supabase) return;
  await pushProfile(userId, profile);
  if (!logs.length) return;

  await supabase
    .from('logs')
    .upsert(
      logs.map((entry) => ({
        id: entry.id,
        user_id: userId,
        kind: entry.kind,
        value: entry.value,
        label: entry.label ?? null,
        note: entry.note ?? null,
        logged_at: new Date(entry.at).toISOString(),
      })),
    )
    .then(undefined, () => {});
}
