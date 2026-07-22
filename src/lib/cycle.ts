/**
 * The medication cycle — the foundation the rest of the app sits on.
 *
 * Every day, a GLP-1 user opens the app to answer four questions before
 * anything else:
 *
 *   1. Where am I in my cycle?
 *   2. Did I take my dose?
 *   3. What should today feel like?
 *   4. What should I do about it?
 *
 * This module answers the first two and feeds the third. Nothing here needs a
 * weigh-in, a model, or a week of history — it works on day one, from a single
 * logged dose, which is the point.
 *
 * Everything is derived from the dose event: the cycle day, the next dose, the
 * countdown, and where the peak sits relative to now.
 */

import { DAY, isSameDay } from './dates';
import { getMedication } from './medications';
import { levelPercent, levelSeries } from './pk';
import type { LogEntry, Profile } from '../store/types';

const HOUR = 3600_000;

export type CyclePosition = 'fresh' | 'rising' | 'peak' | 'declining' | 'trough' | 'overdue' | 'none';

export type MedicationCycle = {
  medicationName: string;
  molecule: string;
  route: 'injection' | 'oral';
  doseMg: number | null;
  /** 1-based day within the current cycle. Null with no doses logged. */
  day: number | null;
  /** Days in a full cycle: 7 for a weekly shot, 1 for a daily pill. */
  cycleDays: number;
  /** Modelled drug activity right now, 0-100. */
  activity: number;
  position: CyclePosition;
  /** "Peak passed yesterday" / "Peak today" / "Peak in 2 days". */
  peakNote: string | null;
  lastDose: { at: number; amount: number; site?: string } | null;
  /** Whether a dose was logged today — the "did I take it?" answer. */
  takenToday: boolean;
  nextDoseAt: number | null;
  /** Hours overdue; 0 when not overdue. */
  overdueHours: number;
  /** "3 days left" / "Due today" / "Overdue by 2 days". */
  countdown: string;
  /** Doses logged in the last four cycles, against those expected. */
  adherence: { taken: number; expected: number; percent: number };
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * When the modelled level peaks within this cycle.
 *
 * Taken from the PK curve rather than a fixed rule, so it follows the molecule:
 * semaglutide peaks days after a shot, an oral peaks within hours.
 */
function peakNoteFor(
  doses: { takenAt: number; amountMg: number }[],
  lastAt: number,
  halfLifeHours: number,
  doseMg: number,
  intervalHours: number,
  now: number,
): string | null {
  if (!doses.length || !doseMg) return null;

  const samples = levelSeries(doses, lastAt, halfLifeHours, doseMg, {
    back: 0,
    forward: Math.ceil(intervalHours / 24),
    intervalHours,
  });
  if (samples.length < 3) return null;

  let peak = samples[0];
  for (const s of samples) if (s.value > peak.value) peak = s;

  const days = Math.round((now - peak.t) / DAY);
  if (days === 0) return 'Peak today';
  if (days === 1) return 'Peak passed yesterday';
  if (days > 1) return `Peak passed ${plural(days, 'day')} ago`;
  return `Peak in ${plural(Math.abs(days), 'day')}`;
}

/** The scheduled next dose, preferring what the user actually set. */
function nextDoseTime(
  profile: Profile,
  lastAt: number | null,
  intervalHours: number,
  now: number,
): number | null {
  // An explicit schedule from onboarding wins while it is still ahead of us.
  if (profile.nextInjectionAt && profile.nextInjectionAt > now) return profile.nextInjectionAt;

  if (lastAt != null) return lastAt + intervalHours * HOUR;

  // No history: fall back to the chosen weekday and hour.
  if (profile.injectionDay != null) {
    const d = new Date(now);
    const delta = (profile.injectionDay - d.getDay() + 7) % 7;
    const next = new Date(d);
    next.setDate(d.getDate() + delta);
    next.setHours(profile.injectionHour, 0, 0, 0);
    if (next.getTime() <= now) next.setDate(next.getDate() + 7);
    return next.getTime();
  }
  return null;
}

function countdownFor(nextAt: number | null, overdueHours: number, now: number): string {
  if (overdueHours > 0) {
    const days = Math.floor(overdueHours / 24);
    return days >= 1 ? `Overdue by ${plural(days, 'day')}` : `Overdue by ${plural(Math.round(overdueHours), 'hour')}`;
  }
  if (nextAt == null) return 'No schedule set';

  const hours = (nextAt - now) / HOUR;
  if (hours <= 0) return 'Due now';
  if (hours < 24 && isSameDay(nextAt, now)) return 'Due today';
  if (hours < 48) return 'Due tomorrow';
  return `${plural(Math.round(hours / 24), 'day')} left`;
}

export function medicationCycle(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): MedicationCycle {
  const med = getMedication(profile.medication);
  const intervalHours = med.intervalHours;
  const cycleDays = Math.max(1, Math.round(intervalHours / 24));

  const doseLogs = logs
    .filter((l) => l.kind === 'dose' && l.at <= now)
    .sort((a, b) => b.at - a.at);
  const last = doseLogs[0] ?? null;
  const doses = doseLogs.map((l) => ({ takenAt: l.at, amountMg: l.value }));

  const activity = levelPercent(doses, now, med.halfLifeHours, profile.doseMg ?? 0, intervalHours);

  const nextDoseAt = nextDoseTime(profile, last?.at ?? null, intervalHours, now);
  const overdueHours = nextDoseAt != null && now > nextDoseAt ? (now - nextDoseAt) / HOUR : 0;

  // Day within the cycle, 1-based and capped: a weekly user who is four days
  // late is on "day 7 of 7", not "day 11 of 7". Overrunning the cycle length
  // is what makes a counter read as broken.
  const day =
    last != null ? Math.min(cycleDays, Math.floor((now - last.at) / DAY) + 1) : null;

  // Position is about WHERE in the cycle, not how high the level is.
  //
  // Classifying by absolute activity looked reasonable until tested: someone
  // two days after their first ever shot has a legitimately low level while
  // titrating, and was being told they were in a trough. Elapsed fraction of
  // the interval is the honest measure, and it scales automatically from a
  // weekly shot to a daily pill.
  let position: CyclePosition = 'none';
  if (!last) position = 'none';
  else if (overdueHours > 12) position = 'overdue';
  else {
    const elapsed = (now - last.at) / HOUR / intervalHours;
    if (elapsed < 0.12) position = 'fresh';
    else if (elapsed < 0.35) position = 'rising';
    else if (elapsed < 0.55) position = 'peak';
    else if (elapsed < 0.8) position = 'declining';
    else position = 'trough';
  }

  // Adherence over four cycles: what was taken against what was due.
  const window = 4 * intervalHours * HOUR;
  const taken = doseLogs.filter((l) => l.at >= now - window).length;
  const expected = 4;

  return {
    medicationName: med.name,
    molecule: med.molecule,
    route: med.route,
    doseMg: profile.doseMg,
    day,
    cycleDays,
    activity,
    position,
    peakNote: last
      ? peakNoteFor(doses, last.at, med.halfLifeHours, profile.doseMg ?? 0, intervalHours, now)
      : null,
    lastDose: last ? { at: last.at, amount: last.value, site: last.site } : null,
    takenToday: doseLogs.some((l) => isSameDay(l.at, now)),
    nextDoseAt,
    overdueHours,
    countdown: countdownFor(nextDoseAt, overdueHours, now),
    adherence: {
      taken: Math.min(taken, expected),
      expected,
      percent: Math.min(100, Math.round((taken / expected) * 100)),
    },
  };
}

// ---------------------------------------------------------------------------
// What today should feel like
// ---------------------------------------------------------------------------

export type Expectation = 'Low' | 'Moderate' | 'High' | 'Unknown';

export type Outlook = {
  hunger: Expectation;
  energy: Expectation;
  nausea: Expectation;
  constipation: Expectation;
  note: string;
};

/**
 * Expected side effects for where the user is in the cycle.
 *
 * GI effects cluster in the day or two after a dose and ease through the week;
 * appetite suppression is strongest near peak and returns at the trough.
 * These are population patterns, not predictions about this person — the copy
 * says "expected", and the symptom log is what turns them personal.
 */
const OUTLOOK_BY_POSITION: Record<CyclePosition, Outlook> = {
  fresh: {
    hunger: 'Low',
    energy: 'Moderate',
    nausea: 'High',
    constipation: 'Moderate',
    note: 'The first day or two after a dose is when GI effects cluster. Eat small, hydrate, go easy on fatty food.',
  },
  rising: {
    hunger: 'Low',
    energy: 'Moderate',
    nausea: 'Moderate',
    constipation: 'Moderate',
    note: 'Appetite is falling as the dose takes hold. Get protein in while eating is comfortable.',
  },
  peak: {
    hunger: 'Low',
    energy: 'High',
    nausea: 'Low',
    constipation: 'Moderate',
    note: 'Peak coverage — appetite should be quiet. Front-load protein and fibre today.',
  },
  declining: {
    hunger: 'Moderate',
    energy: 'High',
    nausea: 'Low',
    constipation: 'Low',
    note: 'Mid-cycle. Appetite creeps back from here, so plan meals before hunger decides for you.',
  },
  trough: {
    hunger: 'High',
    energy: 'Moderate',
    nausea: 'Low',
    constipation: 'Low',
    note: 'Coverage is low before your next dose. Expect food noise — a protein-heavy breakfast blunts it.',
  },
  overdue: {
    hunger: 'High',
    energy: 'Moderate',
    nausea: 'Low',
    constipation: 'Low',
    note: 'Your dose is overdue. Take it when you can and log it so the curve stays accurate.',
  },
  none: {
    hunger: 'Unknown',
    energy: 'Unknown',
    nausea: 'Unknown',
    constipation: 'Unknown',
    note: 'Log your first dose and the daily outlook starts here.',
  },
};

export const outlookFor = (cycle: MedicationCycle): Outlook => OUTLOOK_BY_POSITION[cycle.position];

/** "Monday 8:15 PM" — for the dose confirmation line. */
export function doseStamp(at: number, now = Date.now()): string {
  const d = new Date(at);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (isSameDay(at, now)) return `Today ${time}`;
  if (isSameDay(at, now - DAY)) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'long' })} ${time}`;
}
