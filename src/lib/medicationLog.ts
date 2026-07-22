/**
 * Dose history and side effects — the record a user (or their prescriber)
 * actually wants to look at.
 *
 * A flat list of "1.0 mg, 1.0 mg, 1.0 mg" is a database dump. What matters is
 * the shape of the treatment: when the dose changed, whether doses landed on
 * schedule, and which side effects follow them. That is what this module
 * extracts.
 */

import { DAY, isSameDay } from './dates';
import { getMedication } from './medications';
import { siteLabel } from './injectionSites';
import type { LogEntry, Profile } from '../store/types';

const HOUR = 3600_000;

// ---------------------------------------------------------------------------
// Dose timeline
// ---------------------------------------------------------------------------

export type DoseChange = 'start' | 'increase' | 'decrease' | 'same';

export type DoseEvent = {
  id: string;
  at: number;
  amount: number;
  site?: string;
  siteName: string | null;
  change: DoseChange;
  /** Previous dose amount, when this one changed it. */
  from: number | null;
  /** Days since the previous dose; null for the first. */
  gapDays: number | null;
  /** True when the gap ran well past the scheduled interval. */
  late: boolean;
};

/**
 * The dose log as a timeline, newest first.
 *
 * Each entry knows whether it changed the dose and how long after the previous
 * one it landed, so titration steps and missed weeks are visible without the
 * user doing arithmetic.
 */
export function doseTimeline(profile: Profile, logs: LogEntry[]): DoseEvent[] {
  const med = getMedication(profile.medication);
  // Lateness is judged generously: a dose taken a day late on a weekly
  // schedule is normal life, not a lapse worth flagging.
  const lateAfter = med.intervalHours * 1.4 * HOUR;

  const ascending = logs
    .filter((l) => l.kind === 'dose')
    .sort((a, b) => a.at - b.at);

  const events: DoseEvent[] = ascending.map((l, i) => {
    const prev = ascending[i - 1];
    const gap = prev ? l.at - prev.at : null;

    let change: DoseChange = 'same';
    let from: number | null = null;
    if (!prev) change = 'start';
    else if (l.value > prev.value) {
      change = 'increase';
      from = prev.value;
    } else if (l.value < prev.value) {
      change = 'decrease';
      from = prev.value;
    }

    return {
      id: l.id,
      at: l.at,
      amount: l.value,
      site: l.site,
      siteName: siteLabel(l.site),
      change,
      from,
      gapDays: gap != null ? Math.round(gap / DAY) : null,
      late: gap != null && gap > lateAfter,
    };
  });

  return events.reverse();
}

export type TitrationStep = { at: number; from: number; to: number };

/** Just the dose changes — the titration story, oldest first. */
export const titrationSteps = (profile: Profile, logs: LogEntry[]): TitrationStep[] =>
  doseTimeline(profile, logs)
    .filter((e) => e.from != null)
    .map((e) => ({ at: e.at, from: e.from!, to: e.amount }))
    .reverse();

/** How long the user has been on their current dose. */
export function daysOnCurrentDose(profile: Profile, logs: LogEntry[], now = Date.now()): number | null {
  const events = doseTimeline(profile, logs);
  if (!events.length) return null;

  const current = events[0].amount;
  // Walk back to the first dose at this amount in the current run.
  let since = events[0].at;
  for (const e of events) {
    if (e.amount !== current) break;
    since = e.at;
  }
  return Math.floor((now - since) / DAY);
}

// ---------------------------------------------------------------------------
// Side effects
// ---------------------------------------------------------------------------

export type SideEffect = {
  name: string;
  count: number;
  /** Mean severity 1-5 over the window. */
  severity: number;
  /** Compared with the previous window of equal length. */
  trend: 'better' | 'worse' | 'steady' | 'new';
  lastAt: number;
  /** Cycle day this symptom most often lands on, when there is a pattern. */
  typicalDay: number | null;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/**
 * Which cycle day a symptom usually falls on.
 *
 * Only reported when there are at least three occurrences and they actually
 * cluster — two entries on the same day is a coincidence, not a pattern.
 */
function typicalCycleDay(
  entries: LogEntry[],
  doses: LogEntry[],
  cycleDays: number,
): number | null {
  if (entries.length < 3 || !doses.length) return null;

  const counts = new Map<number, number>();
  for (const e of entries) {
    const prior = doses.filter((d) => d.at <= e.at).sort((a, b) => b.at - a.at)[0];
    if (!prior) continue;
    const day = Math.min(cycleDays, Math.floor((e.at - prior.at) / DAY) + 1);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  if (!counts.size) return null;

  const [day, hits] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return hits / entries.length >= 0.4 ? day : null;
}

/**
 * Side effects over the trailing window, worst first.
 *
 * "Feeling fine" check-ins are counted as data but never listed as a symptom —
 * they are the absence of one.
 */
export function sideEffects(
  profile: Profile,
  logs: LogEntry[],
  days = 30,
  now = Date.now(),
): SideEffect[] {
  const med = getMedication(profile.medication);
  const cycleDays = Math.max(1, Math.round(med.intervalHours / 24));
  const doses = logs.filter((l) => l.kind === 'dose');

  const cutoff = now - days * DAY;
  const previousCutoff = now - 2 * days * DAY;

  const inWindow = logs.filter(
    (l) => l.kind === 'symptom' && l.value > 0 && l.at >= cutoff && !!l.label,
  );
  const inPrevious = logs.filter(
    (l) => l.kind === 'symptom' && l.value > 0 && l.at >= previousCutoff && l.at < cutoff && !!l.label,
  );

  const byName = new Map<string, LogEntry[]>();
  for (const l of inWindow) {
    const key = l.label!;
    byName.set(key, [...(byName.get(key) ?? []), l]);
  }

  return [...byName.entries()]
    .map(([name, entries]) => {
      const severity = mean(entries.map((e) => e.value));
      const before = inPrevious.filter((e) => e.label === name);
      const beforeSeverity = mean(before.map((e) => e.value));

      let trend: SideEffect['trend'] = 'new';
      if (before.length) {
        const delta = severity - beforeSeverity;
        trend = delta <= -0.5 ? 'better' : delta >= 0.5 ? 'worse' : 'steady';
      }

      return {
        name,
        count: entries.length,
        severity: +severity.toFixed(1),
        trend,
        lastAt: Math.max(...entries.map((e) => e.at)),
        typicalDay: typicalCycleDay(entries, doses, cycleDays),
      };
    })
    .sort((a, b) => b.severity * b.count - a.severity * a.count);
}

/** Days since the last symptom of any kind — the "how have I been" line. */
export function daysSinceSymptom(logs: LogEntry[], now = Date.now()): number | null {
  const last = logs
    .filter((l) => l.kind === 'symptom' && l.value > 0)
    .sort((a, b) => b.at - a.at)[0];
  return last ? Math.floor((now - last.at) / DAY) : null;
}

/** Whether the user checked in today, whatever the answer was. */
export const checkedInToday = (logs: LogEntry[], now = Date.now()) =>
  logs.some((l) => l.kind === 'symptom' && isSameDay(l.at, now));
