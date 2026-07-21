/**
 * Body composition estimation.
 *
 * Splits total weight change into fat mass and lean (muscle) mass. Without a
 * smart scale this is an evidence-based estimate, not a measurement: GLP-1
 * DXA substudies show 20–40% of lost weight is lean mass, and the share moves
 * with protein intake, activity, and rate of loss. Every output is labelled an
 * estimate in the UI.
 *
 * Baseline lean split: 25% of loss is lean.
 *   - Protein adherence ≥80% of goal        → −10 (protein is protective)
 *   - Protein adherence <40% of goal        → +8
 *   - Regular activity (≥3 active days/wk)  → −5
 *   - Fast loss (>1% body weight per week)  → +7
 * Clamped to 10–40%.
 */

import { DAY, startOfDay } from './dates';
import type { LogEntry, Profile } from '../store/types';
import { weightSeries } from './insights';

export type BodyComp = {
  /** Total weight change since start; negative = lost. Profile units. */
  totalLost: number;
  fatLost: number;
  leanLost: number;
  /** Share of the loss that was fat, 0-100. */
  fatSharePct: number;
  leanSharePct: number;
  /** How much of the starting lean mass is retained, 0-100. */
  musclePreservationPct: number;
  preservationBand: 'Excellent' | 'Good' | 'Fair' | 'At risk';
  /** Estimated current fat/lean mass, for the donut. */
  leanMassNow: number;
  fatMassNow: number;
  bodyFatPctNow: number;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Average daily protein as a fraction of goal over the trailing window. */
function proteinAdherence(profile: Profile, logs: LogEntry[], days: number, now: number) {
  const goal = profile.goals.proteinG;
  if (goal <= 0) return 0.5;
  const cutoff = startOfDay(now) - days * DAY;
  const byDay = new Map<number, number>();
  for (const l of logs) {
    if (l.kind !== 'meal' || l.at < cutoff) continue;
    const d = startOfDay(l.at);
    byDay.set(d, (byDay.get(d) ?? 0) + l.value);
  }
  if (byDay.size === 0) return 0.5; // unknown — assume middling, not zero
  const avg = [...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size;
  return clamp(avg / goal, 0, 1.5);
}

function activeDaysPerWeek(logs: LogEntry[], days: number, now: number) {
  const cutoff = startOfDay(now) - days * DAY;
  const set = new Set<number>();
  for (const l of logs) {
    if (l.kind === 'activity' && l.at >= cutoff && l.value >= 15) set.add(startOfDay(l.at));
  }
  return (set.size / days) * 7;
}

/** Fraction of lost weight that was lean mass, 0.10–0.40. */
export function leanLossFraction(profile: Profile, logs: LogEntry[], now = Date.now()): number {
  let lean = 25;

  const adherence = proteinAdherence(profile, logs, 28, now);
  if (adherence >= 0.8) lean -= 10;
  else if (adherence < 0.4) lean += 8;

  if (activeDaysPerWeek(logs, 28, now) >= 3) lean -= 5;

  const weights = weightSeries(logs);
  const recent = weights.filter((w) => w.t >= now - 28 * DAY);
  if (recent.length >= 2) {
    const span = (recent[recent.length - 1].t - recent[0].t) / DAY;
    const change = recent[recent.length - 1].value - recent[0].value;
    const current = recent[recent.length - 1].value;
    if (span >= 7 && current > 0) {
      const weeklyPct = (-change / current) * (7 / span) * 100;
      if (weeklyPct > 1) lean += 7;
    }
  }

  return clamp(lean, 10, 40) / 100;
}

/**
 * Estimated starting body-fat fraction. Without measurements, use a
 * population prior for people starting GLP-1 treatment (BMI ≥ 27): ~40%.
 */
const START_BODY_FAT = 0.4;

export function computeBodyComp(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): BodyComp | null {
  const weights = weightSeries(logs);
  const start = profile.startWeight ?? weights[0]?.value ?? null;
  const latest = weights.at(-1)?.value ?? start;
  if (start == null || latest == null) return null;

  const totalLost = start - latest; // positive = lost
  const leanFrac = leanLossFraction(profile, logs, now);

  const lost = Math.max(0, totalLost);
  const leanLost = lost * leanFrac;
  const fatLost = lost - leanLost;

  const leanMassStart = start * (1 - START_BODY_FAT);
  const fatMassStart = start * START_BODY_FAT;
  const leanMassNow = Math.max(0, leanMassStart - leanLost);
  const fatMassNow = Math.max(0, fatMassStart - fatLost);

  const preservation =
    leanMassStart > 0 ? clamp((leanMassNow / leanMassStart) * 100, 0, 100) : 100;

  return {
    totalLost: -totalLost,
    fatLost,
    leanLost,
    fatSharePct: lost > 0 ? Math.round((fatLost / lost) * 100) : 0,
    leanSharePct: lost > 0 ? Math.round((leanLost / lost) * 100) : 0,
    musclePreservationPct: Math.round(preservation * 10) / 10,
    preservationBand:
      preservation >= 97 ? 'Excellent' : preservation >= 94 ? 'Good' : preservation >= 90 ? 'Fair' : 'At risk',
    leanMassNow,
    fatMassNow,
    bodyFatPctNow:
      leanMassNow + fatMassNow > 0
        ? Math.round((fatMassNow / (leanMassNow + fatMassNow)) * 100)
        : 0,
  };
}

export type RiverWeek = {
  label: string;
  fatMass: number;
  leanMass: number;
};

/**
 * Weekly estimated fat/lean mass for the river chart — fat visibly shrinks
 * while lean stays nearly flat.
 */
export function riverWeeks(profile: Profile, logs: LogEntry[], maxWeeks = 12): RiverWeek[] {
  const weights = weightSeries(logs);
  const start = profile.startWeight ?? weights[0]?.value;
  if (weights.length < 2 || start == null) return [];

  const first = weights[0].t;
  const last = weights[weights.length - 1].t;
  const weekCount = Math.min(maxWeeks, Math.max(2, Math.ceil((last - first) / (7 * DAY)) + 1));
  const leanFrac = leanLossFraction(profile, logs);

  const leanStart = start * (1 - START_BODY_FAT);
  const fatStart = start * START_BODY_FAT;

  const out: RiverWeek[] = [];
  for (let w = 0; w < weekCount; w++) {
    const t = first + w * 7 * DAY;
    // Latest weigh-in at or before this week's end; carry forward.
    let weight = weights[0].value;
    for (const p of weights) {
      if (p.t <= t + 7 * DAY) weight = p.value;
      else break;
    }
    const lost = Math.max(0, start - weight);
    out.push({
      label: `W${w + 1}`,
      fatMass: Math.max(0, fatStart - lost * (1 - leanFrac)),
      leanMass: Math.max(0, leanStart - lost * leanFrac),
    });
  }
  return out;
}
