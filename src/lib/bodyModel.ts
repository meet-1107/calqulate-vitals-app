/**
 * The Personal Body Model — how much the engine actually understands about
 * this user, and what their best weeks had in common.
 *
 * ON "CAUSALITY"
 * This does not establish causation and does not claim to. What it does is
 * stronger than a lone correlation and honest about what it is: it looks at the
 * user's best-performing weeks and reports the conditions that co-occurred in
 * them. "Your six best weeks all had 7.5+ hours of sleep and three training
 * sessions" is a description of their history, not a causal law, and the copy
 * says so. It is more actionable than a scatter of separate correlations
 * because behaviours travel together in real life.
 */

import { DAY, startOfDay } from './dates';
import { estimateComposition, gatherInputs } from './composition';
import { weightSeries } from './insights';
import { correlate, MIN_PAIRS } from './stats';
import type { LogEntry, Profile } from '../store/types';

// ---------------------------------------------------------------------------
// What the model knows
// ---------------------------------------------------------------------------

export type DomainId = 'protein' | 'training' | 'sleep' | 'hydration' | 'medication' | 'plateau';

export type Domain = {
  id: DomainId;
  label: string;
  /** 0-1: how well this dimension is understood for this user. */
  learned: number;
  /** What is still needed, when anything is. */
  needs: string | null;
};

/** Paired days required before a dimension counts as understood. */
const DOMAIN_TARGET = 21;

const distinctDays = (logs: LogEntry[], kinds: LogEntry['kind'][]) =>
  new Set(logs.filter((l) => kinds.includes(l.kind)).map((l) => startOfDay(l.at))).size;

export function domains(profile: Profile, logs: LogEntry[]): Domain[] {
  const weighIns = weightSeries(logs).length;

  const spec: { id: DomainId; label: string; days: number; noun: string }[] = [
    { id: 'protein', label: 'Protein sensitivity', days: distinctDays(logs, ['meal']), noun: 'days of meals' },
    { id: 'training', label: 'Exercise response', days: distinctDays(logs, ['strength', 'activity']), noun: 'days of training' },
    { id: 'sleep', label: 'Sleep sensitivity', days: distinctDays(logs, ['sleep']), noun: 'nights of sleep' },
    { id: 'hydration', label: 'Hydration response', days: distinctDays(logs, ['water']), noun: 'days of water' },
    { id: 'medication', label: 'Medication timing', days: distinctDays(logs, ['dose', 'symptom']), noun: 'doses and check-ins' },
    { id: 'plateau', label: 'Plateau behaviour', days: weighIns, noun: 'weigh-ins' },
  ];

  return spec.map((s) => {
    const learned = Math.min(1, s.days / DOMAIN_TARGET);
    const short = DOMAIN_TARGET - s.days;
    return {
      id: s.id,
      label: s.label,
      learned,
      needs: learned >= 1 ? null : `${short} more ${s.noun}`,
    };
  });
}

/**
 * Overall model completeness.
 *
 * A weighted mean of the dimensions rather than a count, so logging a lot of
 * one thing cannot make the model look finished. Capped below 100: a model of a
 * living person is never complete, and a full bar would invite more trust than
 * the thing deserves.
 */
export function modelCompleteness(profile: Profile, logs: LogEntry[]): number {
  const d = domains(profile, logs);
  const mean = d.reduce((s, x) => s + x.learned, 0) / d.length;
  return Math.round(Math.min(0.96, mean) * 100);
}

// ---------------------------------------------------------------------------
// Best weeks
// ---------------------------------------------------------------------------

export type WeekSummary = {
  start: number;
  /** Fat-loss efficiency for the week, the performance measure. */
  efficiency: number;
  weightChange: number;
  proteinG: number;
  sleepH: number;
  strengthSessions: number;
  waterMl: number;
};

/** Splits history into calendar weeks and scores each one. */
export function weeklySummaries(profile: Profile, logs: LogEntry[], now = Date.now()): WeekSummary[] {
  if (!logs.length) return [];
  const first = startOfDay(Math.min(...logs.map((l) => l.at)));
  const weeks: WeekSummary[] = [];

  for (let start = first; start < now; start += 7 * DAY) {
    const end = start + 7 * DAY;
    const inWeek = logs.filter((l) => l.at >= start && l.at < end);
    if (inWeek.length < 4) continue;

    const days = new Set(inWeek.map((l) => startOfDay(l.at))).size || 1;
    const sum = (k: LogEntry['kind']) =>
      inWeek.filter((l) => l.kind === k).reduce((s, l) => s + l.value, 0);

    const w = weightSeries(inWeek);
    const weightChange = w.length >= 2 ? w[w.length - 1].value - w[0].value : 0;

    // Score the week from the week's OWN behaviour.
    //
    // Using the default 28-day window here smoothed every week toward the same
    // value, so "best weeks" was ranking noise and no behaviour ever correlated
    // with performance. A 7-day window makes each week reflect what actually
    // happened in it.
    const upTo = logs.filter((l) => l.at < end);
    const { input, context } = gatherInputs(profile, upTo, end, 7);
    const est = estimateComposition(input, context);

    const sleepDays = new Set(
      inWeek.filter((l) => l.kind === 'sleep').map((l) => startOfDay(l.at)),
    ).size;

    weeks.push({
      start,
      efficiency: est.fatPct,
      weightChange,
      proteinG: sum('meal') / days,
      sleepH: sleepDays ? sum('sleep') / sleepDays : 0,
      strengthSessions: new Set(
        inWeek.filter((l) => l.kind === 'strength').map((l) => startOfDay(l.at)),
      ).size,
      waterMl: sum('water') / days,
    });
  }

  return weeks;
}

export type SharedTrait = { label: string; hits: number; total: number };

export type BestWeeks = {
  /** Weeks analysed. */
  weeks: number;
  /** How many of the top weeks are being described. */
  topCount: number;
  traits: SharedTrait[];
  /** Average weight change across the best weeks. */
  avgChange: number;
  confidence: 'Low' | 'Moderate' | 'Good';
};

/** Minimum weeks of history before this analysis says anything. */
const MIN_WEEKS = 6;

/**
 * What the user's best weeks had in common.
 *
 * Takes the top third of weeks by fat-loss efficiency and reports the
 * conditions present in most of them. Traits are only reported when they hold
 * in a clear majority of the best weeks *and* are not equally common in the
 * rest — a trait present in every week explains nothing.
 */
export function bestWeeks(profile: Profile, logs: LogEntry[], now = Date.now()): BestWeeks | null {
  const weeks = weeklySummaries(profile, logs, now);
  if (weeks.length < MIN_WEEKS) return null;

  const sorted = [...weeks].sort((a, b) => b.efficiency - a.efficiency);
  const topCount = Math.max(3, Math.round(weeks.length / 3));
  const top = sorted.slice(0, topCount);
  const rest = sorted.slice(topCount);

  const tests: { label: string; test: (w: WeekSummary) => boolean }[] = [
    { label: '7.5+ hours of sleep', test: (w) => w.sleepH >= 7.5 },
    { label: `${profile.goals.proteinG} g+ of protein a day`, test: (w) => w.proteinG >= profile.goals.proteinG * 0.95 },
    { label: 'two or more resistance sessions', test: (w) => w.strengthSessions >= 2 },
    { label: 'hydration on target', test: (w) => w.waterMl >= profile.goals.waterMl * 0.9 },
  ];

  const traits: SharedTrait[] = [];
  for (const t of tests) {
    const hits = top.filter(t.test).length;
    const restRate = rest.length ? rest.filter(t.test).length / rest.length : 0;
    const topRate = hits / top.length;
    // Must hold in most best weeks, and be meaningfully rarer in the others.
    if (topRate >= 0.6 && topRate - restRate >= 0.25) {
      traits.push({ label: t.label, hits, total: top.length });
    }
  }

  if (!traits.length) return null;

  return {
    weeks: weeks.length,
    topCount: top.length,
    traits,
    avgChange: top.reduce((s, w) => s + w.weightChange, 0) / top.length,
    confidence: weeks.length >= 16 ? 'Good' : weeks.length >= 10 ? 'Moderate' : 'Low',
  };
}

// ---------------------------------------------------------------------------
// Personal lever confidence
// ---------------------------------------------------------------------------

/**
 * How strongly the user's own history supports each lever, as a confidence
 * percentage. Feeds the evidence stars, so a lever the app has watched work for
 * this person outranks one that is merely plausible.
 */
export function personalLeverConfidence(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): Partial<Record<'protein' | 'sleep' | 'hydration' | 'strength', number>> {
  const weeks = weeklySummaries(profile, logs, now);
  if (weeks.length < MIN_PAIRS) return {};

  const eff = weeks.map((w) => w.efficiency);
  const out: Partial<Record<'protein' | 'sleep' | 'hydration' | 'strength', number>> = {};

  const pairs: [keyof typeof out, number[]][] = [
    ['protein', weeks.map((w) => w.proteinG)],
    ['sleep', weeks.map((w) => w.sleepH)],
    ['hydration', weeks.map((w) => w.waterMl)],
    ['strength', weeks.map((w) => w.strengthSessions)],
  ];

  for (const [key, xs] of pairs) {
    const c = correlate(xs, eff);
    // Only a positive association counts as support for doing more of it.
    if (c && c.r > 0) out[key] = c.confidence;
  }

  return out;
}
