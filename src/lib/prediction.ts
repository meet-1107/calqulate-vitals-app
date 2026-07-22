/**
 * Prediction — week 3 of Body Intelligence, and the Decision Engine behind it.
 *
 * THE TIER SPLIT
 * Free gets one prediction: what tomorrow's weight is likely to be, how sure we
 * are, and which of their inputs is driving it. Premium gets the Decision
 * Engine: what that number becomes if they change something. Knowing the future
 * is interesting; changing it is what people pay for.
 *
 * HONESTY
 * The prediction is a least-squares fit over recent weigh-ins with a real
 * prediction interval from the residual spread — not a number dressed up with a
 * confidence figure chosen to look good. When the data is thin or noisy the
 * interval widens and confidence drops, which is the correct behaviour even
 * though it makes the feature look weaker.
 *
 * A note on what changing protein does: raising protein barely moves tomorrow's
 * scale number, because a day's protein is a small energy change and most
 * day-to-day weight movement is water. What it moves is *composition*. The
 * Decision Engine says so rather than inventing a satisfying drop, because a
 * user who follows the advice and does not see the promised number stops
 * believing everything else in the app.
 */

import { DAY, startOfDay } from './dates';
import { estimateComposition, gatherInputs, KCAL_PER_KG_FAT, LB_PER_KG } from './composition';
import { computeToday, weightSeries } from './insights';
import type { LogEntry, Profile } from '../store/types';

/** Minimum weigh-ins before any prediction is offered. */
export const MIN_WEIGH_INS = 6;
const WINDOW_DAYS = 21;

/**
 * Irreducible day-to-day variation, in pounds.
 *
 * Body weight swings roughly a pound either way from water, glycogen, sodium and
 * gut contents regardless of fat mass. A tidy run of weigh-ins can produce a
 * near-zero residual and therefore a ±0 interval, which would be a claim no
 * scale can honour. The interval is floored here so the app never promises more
 * precision than a bathroom scale physically has.
 */
const MIN_RESIDUAL_SD = 0.9;

export type Driver = { label: string; detail: string; good: boolean };

export type WeightPrediction = {
  /** Predicted weight tomorrow, in stored pounds. */
  value: number;
  /** 68% interval — one residual standard deviation either side. */
  low: number;
  high: number;
  confidence: number;
  /** Pounds per day, from the fitted slope. Negative means losing. */
  dailySlope: number;
  drivers: Driver[];
  dataPoints: number;
};

/** Ordinary least squares on (day, weight). */
function fit(points: { t: number; value: number }[]) {
  const n = points.length;
  const t0 = points[0].t;
  const xs = points.map((p) => (p.t - t0) / DAY);
  const ys = points.map((p) => p.value);

  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;

  // Residual standard deviation: how far real readings sit from the fit.
  const residuals = ys.map((y, i) => y - (intercept + slope * xs[i]));
  const sd =
    n > 2
      ? Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / (n - 2))
      : Math.abs(residuals[0] ?? 0.5);

  return { slope, intercept, sd, t0 };
}

/**
 * Which of the user's inputs is pushing the trend, from the composition
 * engine's own normalised scores. These are the levers that actually feed the
 * model, so the "why" is the model's reasoning rather than a plausible story
 * written next to it.
 */
function driversFor(profile: Profile, logs: LogEntry[], now: number): Driver[] {
  const { input, context } = gatherInputs(profile, logs, now);
  const est = estimateComposition(input, context);
  const level = computeToday(profile, logs, now).medicationLevel;

  const out: Driver[] = [];

  if (!est.missing.includes('protein')) {
    out.push({
      label: 'Protein',
      detail: est.scores.protein >= 0.8 ? 'At target — protecting muscle' : 'Below target',
      good: est.scores.protein >= 0.8,
    });
  }
  if (!est.missing.includes('sleep')) {
    out.push({
      label: 'Sleep',
      detail: est.scores.sleep >= 0.7 ? 'Enough to recover on' : 'Short — raises appetite',
      good: est.scores.sleep >= 0.7,
    });
  }
  out.push({
    label: 'Medication activity',
    detail: `${level}% coverage`,
    good: level >= 50,
  });
  if (!est.missing.includes('hydration')) {
    out.push({
      label: 'Hydration',
      detail: est.scores.hydration >= 0.8 ? 'On target' : 'Below target',
      good: est.scores.hydration >= 0.8,
    });
  }

  return out;
}

export function predictTomorrow(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): WeightPrediction | null {
  const all = weightSeries(logs);
  const window = all.filter((w) => w.t >= now - WINDOW_DAYS * DAY);
  const points = window.length >= MIN_WEIGH_INS ? window : all.slice(-MIN_WEIGH_INS);
  if (points.length < MIN_WEIGH_INS) return null;

  const fitted = fit(points);
  const { slope, intercept, t0 } = fitted;
  const sd = Math.max(fitted.sd, MIN_RESIDUAL_SD);
  const tomorrow = startOfDay(now + DAY) + 8 * 3600_000;
  const x = (tomorrow - t0) / DAY;
  const value = intercept + slope * x;

  // Confidence falls as the scatter around the fit grows relative to a
  // meaningful amount of weight, and rises with the number of readings.
  // Measured from the raw residual, not the floored one: the floor exists to
  // widen the interval, not to flatter the confidence figure.
  const noise = Math.min(1, Math.max(fitted.sd, MIN_RESIDUAL_SD * 0.6) / 2.5);
  const depth = Math.min(1, (points.length - MIN_WEIGH_INS) / 12);
  const confidence = Math.round(Math.max(35, Math.min(88, (1 - noise) * 70 + depth * 25 + 10)));

  return {
    value: +value.toFixed(1),
    low: +(value - sd).toFixed(1),
    high: +(value + sd).toFixed(1),
    confidence,
    dailySlope: slope,
    drivers: driversFor(profile, logs, now),
    dataPoints: logs.length,
  };
}

// ---------------------------------------------------------------------------
// Decision Engine (premium)
// ---------------------------------------------------------------------------

export type DecisionChange = {
  proteinG?: number;
  sleepH?: number;
  strengthPerWeek?: number;
  hydrationMl?: number;
};

export type Decision = {
  /** Predicted weight tomorrow under the change. */
  weight: number;
  weightDelta: number;
  fatPct: number;
  leanPct: number;
  /** Change in fat share versus doing nothing, in percentage points. */
  fatPctDelta: number;
  confidence: number;
  /** Plain statement of what actually moves, and what does not. */
  note: string;
};

/**
 * Explains the result, including the case where nothing improves because the
 * lever is already at its ceiling — telling someone to eat more protein when
 * they are already at target is how an app loses credibility.
 */
function decisionNote(
  fatPctDelta: number,
  baseline: { scores: Record<string, number> },
  changed: { scores: Record<string, number> },
): string {
  if (fatPctDelta > 0) {
    return `Tomorrow's scale barely moves — one day is a small energy change. What shifts is the mix: ${fatPctDelta} more percentage points of your loss coming from fat.`;
  }

  const maxed = (['protein', 'strength', 'sleep', 'hydration'] as const).filter(
    (k) => baseline.scores[k] >= 0.99 && changed.scores[k] >= 0.99,
  );
  if (maxed.length) {
    return `No change — your ${maxed.join(' and ')} ${maxed.length > 1 ? 'are' : 'is'} already at target. The gains are elsewhere.`;
  }
  return 'This change does not move the mix. Resistance training and protein are the strongest levers.';
}

/**
 * What changes if the user changes something.
 *
 * Weight is adjusted only through energy: extra food is extra energy, and a
 * day of it moves the scale by a genuinely small amount. Composition is where
 * the real effect lands, so that is what the engine leads with.
 */
export function decide(
  profile: Profile,
  logs: LogEntry[],
  change: DecisionChange,
  now = Date.now(),
): Decision | null {
  const base = predictTomorrow(profile, logs, now);
  if (!base) return null;

  const { input, context } = gatherInputs(profile, logs, now);
  const baseline = estimateComposition(input, context);

  const changed = estimateComposition(
    {
      ...input,
      proteinG: change.proteinG ?? input.proteinG,
      sleepH: change.sleepH ?? input.sleepH,
      strengthPerWeek: change.strengthPerWeek ?? input.strengthPerWeek,
      hydrationMl: change.hydrationMl ?? input.hydrationMl,
    },
    context,
  );

  // Energy effect of eating more protein: 4 kcal per gram, converted to mass
  // through the energy density of adipose tissue. One day of it is small, and
  // pretending otherwise would be a lie the scale exposes tomorrow morning.
  const extraProteinG = (change.proteinG ?? input.proteinG ?? 0) - (input.proteinG ?? 0);
  const extraKcal = extraProteinG * 4;
  const weightDelta = (extraKcal / KCAL_PER_KG_FAT) * LB_PER_KG;

  const fatPctDelta = changed.fatPct - baseline.fatPct;

  return {
    weight: +(base.value + weightDelta).toFixed(1),
    weightDelta: +weightDelta.toFixed(2),
    fatPct: changed.fatPct,
    leanPct: changed.leanPct,
    fatPctDelta,
    confidence: Math.round((base.confidence + changed.confidence) / 2),
    note: decisionNote(fatPctDelta, baseline, changed),
  };
}
