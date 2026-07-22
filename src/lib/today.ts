/**
 * Today Intelligence — the daily briefing.
 *
 * The free hook. Weight tracking is a commodity; answering "what will today
 * feel like, and what should I do about it?" before the user has logged
 * anything is not. Everything here is derived from the dose cycle, body
 * composition, and the user's own logging history — nothing is invented, and
 * every field can explain where it came from.
 */

import { computeBodyComp } from './bodycomp';
import { computeToday } from './insights';
import { todayForecast, type CyclePhase } from './insights';
import { computeScore, type MetabolicScore } from './score';
import { formatWeight } from './units';
import type { LogEntry, Profile } from '../store/types';

export type Level = 'Low' | 'Moderate' | 'High' | 'Unknown';

export type TodayBrief = {
  phase: CyclePhase;
  /** Modelled medication level, 0-100. */
  activity: number;
  hunger: Level;
  energy: Level;
  /** Grams, from lean mass where known. */
  proteinTarget: number;
  proteinBasis: string;
  /** Millilitres, from body weight. */
  hydrationTarget: number;
  workout: { window: string; basis: string } | null;
  score: MetabolicScore;
  headline: string;
};

/** Hunger tracks the dose cycle: quietest at peak, loudest at the trough. */
const HUNGER_BY_PHASE: Record<CyclePhase, Level> = {
  rising: 'Low',
  peak: 'Low',
  declining: 'Moderate',
  trough: 'High',
  overdue: 'High',
  none: 'Unknown',
};

/** Energy dips in the day after a shot, then settles. */
const ENERGY_BY_PHASE: Record<CyclePhase, Level> = {
  rising: 'Moderate',
  peak: 'High',
  declining: 'High',
  trough: 'Moderate',
  overdue: 'Moderate',
  none: 'Unknown',
};

/**
 * Protein target.
 *
 * Preferred basis is lean body mass at ~1 g per pound, which is the figure used
 * for muscle preservation during a calorie deficit. Without a body-composition
 * estimate it falls back to ~1.6 g per kg of current weight, the general
 * high-protein recommendation. Clamped to a sane range so an outlier weigh-in
 * cannot produce an absurd target.
 */
function proteinTarget(profile: Profile, logs: LogEntry[]): { grams: number; basis: string } {
  const comp = computeBodyComp(profile, logs);
  if (comp?.leanMassNow && comp.leanMassNow > 0) {
    const grams = Math.round(comp.leanMassNow * 1.0);
    return {
      grams: Math.max(60, Math.min(220, grams)),
      basis: `From ${Math.round(comp.leanMassNow)} lb lean mass`,
    };
  }

  const weights = logs.filter((l) => l.kind === 'weight').sort((a, b) => b.at - a.at);
  const lb = weights[0]?.value ?? profile.startWeight;
  if (lb == null) return { grams: profile.goals.proteinG, basis: 'Your daily goal' };

  const grams = Math.round((lb / 2.2046226218) * 1.6);
  return {
    grams: Math.max(60, Math.min(220, grams)),
    basis: '1.6 g per kg body weight',
  };
}

/** Roughly half an ounce of water per pound of body weight. */
function hydrationTarget(profile: Profile, logs: LogEntry[]): number {
  const weights = logs.filter((l) => l.kind === 'weight').sort((a, b) => b.at - a.at);
  const lb = weights[0]?.value ?? profile.startWeight;
  if (lb == null) return profile.goals.waterMl;
  return Math.max(1800, Math.min(4000, Math.round((lb * 14.787) / 50) * 50));
}

const windowLabel = (startHour: number) => {
  const fmt = (h: number) => {
    const suffix = h >= 12 ? 'pm' : 'am';
    const hour = h % 12 === 0 ? 12 : h % 12;
    return `${hour}${suffix}`;
  };
  return `${fmt(startHour)}–${fmt(startHour + 3)}`;
};

/**
 * Best window to train.
 *
 * If the user has a habit, we reflect it back rather than fighting it — the
 * session someone will actually do beats the theoretically optimal one. With no
 * history, the window follows the dose cycle: on a fresh shot, later in the day
 * once early side effects settle; otherwise mid-afternoon.
 */
function workoutWindow(logs: LogEntry[], phase: CyclePhase) {
  if (phase === 'none') return null;

  const activityHours = logs.filter((l) => l.kind === 'activity').map((l) => new Date(l.at).getHours());

  if (activityHours.length >= 3) {
    const buckets = new Map<number, number>();
    for (const h of activityHours) {
      const start = Math.max(5, Math.min(20, h - 1));
      buckets.set(start, (buckets.get(start) ?? 0) + 1);
    }
    const [best] = [...buckets.entries()].sort((a, b) => b[1] - a[1])[0];
    return { window: windowLabel(best), basis: 'When you usually train' };
  }

  const start = phase === 'rising' ? 16 : 14;
  return {
    window: windowLabel(start),
    basis: phase === 'rising' ? 'After dose effects settle' : 'Your steadiest energy',
  };
}

export function todayBrief(profile: Profile, logs: LogEntry[], now = Date.now()): TodayBrief {
  const forecast = todayForecast(profile, logs, now);
  const score = computeScore(profile, logs, now);
  const activity = computeToday(profile, logs, now).medicationLevel;
  const protein = proteinTarget(profile, logs);

  return {
    phase: forecast.phase,
    activity,
    hunger: HUNGER_BY_PHASE[forecast.phase],
    energy: ENERGY_BY_PHASE[forecast.phase],
    proteinTarget: protein.grams,
    proteinBasis: protein.basis,
    hydrationTarget: hydrationTarget(profile, logs),
    workout: workoutWindow(logs, forecast.phase),
    score,
    headline: forecast.headline,
  };
}

/** "2.8 L" */
export const litres = (ml: number) => `${(ml / 1000).toFixed(1)} L`;

export const proteinSummary = (profile: Profile, brief: TodayBrief) =>
  `${brief.proteinTarget} g · ${brief.proteinBasis}`;

/** Re-exported so callers can format weights without a second import. */
export { formatWeight };
