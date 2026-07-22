/**
 * The journey — history, unlocks, and milestones.
 *
 * Three jobs:
 *
 * 1. **Progressive unlock.** Each of the first two weeks reveals something new,
 *    so there is a reason to come back tomorrow that is not nagging. Unlocks
 *    are gated on *days elapsed*, not on logging volume, so a user who misses a
 *    day never loses ground they cannot recover.
 *
 * 2. **Accumulated history.** The count of days, photos, doses and meals is
 *    what makes an app hard to delete. It is also completely honest — these are
 *    just counts of what the user actually did.
 *
 * 3. **Milestones**, expressed physically. "9.4 kg" is abstract; the same mass
 *    as an object is not.
 */

import { DAY, startOfDay } from './dates';
import { computeBodyComp } from './bodycomp';
import { totalChange, weightSeries } from './insights';
import { computeScore } from './score';
import { toDisplay } from './units';
import type { LogEntry, Profile, Units } from '../store/types';

export type UnlockId =
  | 'score'
  | 'weight-trend'
  | 'medication-curve'
  | 'coach'
  | 'hydration'
  | 'protein'
  | 'weekly-report'
  | 'composition'
  | 'prediction';

export type Unlock = {
  id: UnlockId;
  day: number;
  title: string;
  blurb: string;
  route: string;
  icon: string;
};

/** What each day of the first fortnight reveals. */
export const UNLOCKS: Unlock[] = [
  { id: 'score', day: 1, title: 'Metabolic Score', blurb: 'Your daily number, and what moves it', route: '/score', icon: 'sparkles-outline' },
  { id: 'weight-trend', day: 2, title: 'Weight Trend', blurb: 'Your first real trend line', route: '/(tabs)/progress', icon: 'trending-down-outline' },
  { id: 'medication-curve', day: 3, title: 'Medication Curve', blurb: 'How much drug is working, hour by hour', route: '/(tabs)/medication', icon: 'pulse-outline' },
  { id: 'coach', day: 4, title: 'Personal Coach', blurb: 'What to change, and why', route: '/score', icon: 'chatbubble-ellipses-outline' },
  { id: 'hydration', day: 5, title: 'Hydration Trend', blurb: 'How water tracks with side effects', route: '/(tabs)/progress', icon: 'water-outline' },
  { id: 'protein', day: 6, title: 'Protein Quality', blurb: 'Whether your intake protects muscle', route: '/(tabs)/progress', icon: 'nutrition-outline' },
  { id: 'weekly-report', day: 7, title: 'Weekly Report', blurb: 'Your first shareable scorecard', route: '/report', icon: 'ribbon-outline' },
  { id: 'composition', day: 10, title: 'Body Composition', blurb: 'Fat versus muscle, with confidence', route: '/composition', icon: 'body-outline' },
  { id: 'prediction', day: 14, title: 'Tomorrow Simulator', blurb: 'See what tomorrow would look like', route: '/tomorrow', icon: 'flash-outline' },
];

/** Day 1 is the first day the user logged anything. */
export function dayIndex(logs: LogEntry[], now = Date.now()): number {
  if (!logs.length) return 1;
  const first = Math.min(...logs.map((l) => l.at));
  return Math.floor((startOfDay(now) - startOfDay(first)) / DAY) + 1;
}

export const unlockedBy = (day: number) => UNLOCKS.filter((u) => u.day <= day);
export const unlockedToday = (day: number) => UNLOCKS.find((u) => u.day === day) ?? null;
export const nextUnlock = (day: number) => UNLOCKS.find((u) => u.day > day) ?? null;

export type Journey = {
  day: number;
  /** Distinct days with at least one entry. */
  activeDays: number;
  totalLost: number | null;
  fatLost: number | null;
  muscleHeld: boolean;
  photos: number;
  doses: number;
  meals: number;
  weighIns: number;
  entries: number;
  /** Consecutive days where the score beat the day before. */
  improvingStreak: number;
  bestScore: number;
};

/**
 * The Metabolic Streak: consecutive days where the score improved on the day
 * before. Chasing improvement rather than mere attendance, so the streak means
 * something — a logging streak only proves the user opened the app.
 */
export function improvingStreak(profile: Profile, logs: LogEntry[], now = Date.now()): number {
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const day = now - i * DAY;
    const today = computeScore(profile, logs, day).total;
    const before = computeScore(profile, logs, day - DAY).total;
    if (today > before) streak++;
    else break;
  }
  return streak;
}

export function buildJourney(profile: Profile, logs: LogEntry[], now = Date.now()): Journey {
  const count = (kind: LogEntry['kind']) => logs.filter((l) => l.kind === kind).length;
  const activeDays = new Set(logs.map((l) => startOfDay(l.at))).size;
  const comp = computeBodyComp(profile, logs, now);

  let bestScore = 0;
  for (let i = 0; i < 30; i++) {
    bestScore = Math.max(bestScore, computeScore(profile, logs, now - i * DAY).total);
  }

  return {
    day: dayIndex(logs, now),
    activeDays,
    totalLost: totalChange(profile, logs),
    fatLost: comp ? comp.fatLost : null,
    muscleHeld: comp ? comp.musclePreservationPct >= 90 : false,
    photos: count('photo'),
    doses: count('dose'),
    meals: count('meal'),
    weighIns: weightSeries(logs).length,
    entries: logs.length,
    improvingStreak: improvingStreak(profile, logs, now),
    bestScore,
  };
}

// ---------------------------------------------------------------------------
// Milestones
// ---------------------------------------------------------------------------

/**
 * Physical equivalences for a mass, so progress lands emotionally.
 * Masses are in kilograms and deliberately everyday objects.
 */
const EQUIVALENTS: { kg: number; one: string; many: string }[] = [
  { kg: 0.113, one: 'stick of butter', many: 'sticks of butter' },
  { kg: 1.0, one: 'bag of sugar', many: 'bags of sugar' },
  { kg: 2.5, one: 'house brick', many: 'house bricks' },
  { kg: 4.5, one: 'car tyre', many: 'car tyres' },
  { kg: 11.3, one: 'car wheel', many: 'car wheels' },
];

/**
 * The most vivid comparison for a given loss.
 *
 * Picks the *smallest* object that still yields a comprehensible count, because
 * a big number of a familiar small thing lands harder than a small number of a
 * big one: "41 sticks of butter" is a picture, "2 car wheels" is a shrug. The
 * count is capped at 60 so it stays imaginable.
 */
export function equivalent(lostLb: number): string | null {
  const kg = Math.abs(lostLb) / 2.2046226218;
  if (kg < 0.3) return null;

  const counted = EQUIVALENTS.map((e) => ({ ...e, count: Math.round(kg / e.kg) }));
  const pick = counted.find((e) => e.count >= 3 && e.count <= 60) ?? counted[counted.length - 1];
  if (pick.count < 1) return null;
  return `${pick.count} ${pick.count === 1 ? pick.one : pick.many}`;
}

export type Milestone = { title: string; detail: string; reached: boolean };

/** Weight milestones in the user's own units, so the numbers feel round. */
export function milestones(profile: Profile, logs: LogEntry[], units: Units): Milestone[] {
  const lost = totalChange(profile, logs);
  const lostShown = lost != null ? -toDisplay(lost, units) : 0;
  const steps = units === 'kg' ? [1, 2.5, 5, 10, 15, 20, 25] : [5, 10, 15, 25, 35, 50, 75];

  return steps.map((s) => ({
    title: `${s} ${units}`,
    detail: lostShown >= s ? 'Reached' : `${(s - lostShown).toFixed(1)} ${units} to go`,
    reached: lostShown >= s,
  }));
}
