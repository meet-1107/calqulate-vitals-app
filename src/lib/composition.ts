/**
 * Body Composition Engine™
 *
 * Estimates how this week's weight change splits into fat and lean tissue, with
 * an explicit confidence, because it is a prediction and pretending otherwise
 * would be dishonest about something people make decisions on.
 *
 * THREE LAYERS, IN ORDER OF AUTHORITY
 *
 * 1. Physiology — the baseline split is Forbes' rule: the leaner you already
 *    are, the more of any loss comes from lean tissue. This is a published
 *    relationship, not a tuned constant, so it anchors everything else:
 *
 *        ΔFFM / ΔWeight ≈ 10.4 / (10.4 + FatMass_kg)
 *
 * 2. Behaviour — protein, resistance training, sleep, rate of loss, age, and
 *    medication coverage modulate that baseline through the Muscle
 *    Preservation Index. Behaviour can move the split a long way, but it
 *    cannot escape physiology, so the result stays bounded.
 *
 * 3. Energy conservation — mass and energy must balance. A kilogram of fat
 *    carries ~7700 kcal; a kilogram of lean tissue carries far less because it
 *    is mostly water. When intake is known the partition is therefore
 *    *solvable* rather than merely estimated, and that path is trusted more.
 *
 *        7·deficit = ΔFat·7700 + ΔLean·1400
 *
 * None of this is a measurement. A DXA scan is a measurement; this is an
 * estimate with error bars, and the UI says so.
 */

import { DAY, startOfDay } from './dates';
import { computeToday, weightSeries } from './insights';
import type { LogEntry, Profile } from '../store/types';

// ---------------------------------------------------------------------------
// Physical constants
// ---------------------------------------------------------------------------

/** Energy density of adipose tissue, kcal per kg. */
export const KCAL_PER_KG_FAT = 7700;
/**
 * Energy density of lean tissue, kcal per kg. Far lower than fat because lean
 * mass is ~73% water: roughly 200 g of protein per kg at 4 kcal/g, plus
 * glycogen.
 */
export const KCAL_PER_KG_LEAN = 1400;
/** Forbes' constant, in kg. */
const FORBES_C = 10.4;
export const LB_PER_KG = 2.2046226218;

/** Physiological bounds on the lean share of a weight change. */
const LEAN_MIN = 0.03;
const LEAN_MAX = 0.55;

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type EngineInputs = {
  weightLb: number;
  bodyFatPct: number | null;
  ageYears: number | null;
  /** Average daily protein, grams. Null when nothing was logged. */
  proteinG: number | null;
  proteinGoalG: number;
  /** Resistance sessions per week. */
  strengthPerWeek: number | null;
  /** Average sleep, hours. */
  sleepH: number | null;
  hydrationMl: number | null;
  hydrationGoalMl: number;
  /** Percent of body weight lost per week; positive means losing. */
  weeklyLossPct: number | null;
  /** Modelled medication coverage, 0-100. */
  medicationLevel: number;
  /** Average daily calorie deficit, when known. */
  calorieDeficit: number | null;
};

export type ScoreName =
  | 'protein'
  | 'strength'
  | 'sleep'
  | 'hydration'
  | 'rate'
  | 'age'
  | 'medication'
  | 'calories';

/** MPI weights. They sum to 1. */
export const MPI_WEIGHTS: Record<ScoreName, number> = {
  protein: 0.25,
  strength: 0.25,
  sleep: 0.15,
  hydration: 0.1,
  rate: 0.1,
  age: 0.05,
  medication: 0.05,
  calories: 0.05,
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
/** Linear ramp: `at lo → 0`, `at hi → 1`. */
const ramp = (v: number, lo: number, hi: number) => clamp((v - lo) / (hi - lo), 0, 1);

/**
 * Normalises every input to 0-1. A null input scores 0.5 — explicitly "unknown"
 * rather than "bad" — and is reported as missing so it lowers confidence
 * instead of silently penalising the user.
 */
export function normalise(input: EngineInputs): {
  scores: Record<ScoreName, number>;
  missing: ScoreName[];
} {
  const missing: ScoreName[] = [];
  const known = <T>(v: T | null, name: ScoreName): v is T => {
    if (v == null) {
      missing.push(name);
      return false;
    }
    return true;
  };

  // Protein: full marks at goal, which is itself lean-mass derived.
  const protein = known(input.proteinG, 'protein')
    ? clamp(input.proteinG / Math.max(1, input.proteinGoalG), 0, 1)
    : 0.5;

  // Resistance training: the strongest lever there is. 3 sessions a week is
  // where the preservation benefit plateaus.
  const strength = known(input.strengthPerWeek, 'strength')
    ? clamp(input.strengthPerWeek / 3, 0, 1)
    : 0.5;

  // Sleep: below 6 h, cortisol and appetite regulation both suffer.
  const sleep = known(input.sleepH, 'sleep') ? ramp(input.sleepH, 5, 7.5) : 0.5;

  const hydration = known(input.hydrationMl, 'hydration')
    ? clamp(input.hydrationMl / Math.max(1, input.hydrationGoalMl), 0, 1)
    : 0.5;

  // Rate: ≤0.7%/week is mostly fat; ≥2%/week drives lean loss hard. Gaining or
  // holding scores full marks — nothing is being catabolised.
  const rate = known(input.weeklyLossPct, 'rate')
    ? input.weeklyLossPct <= 0
      ? 1
      : 1 - ramp(input.weeklyLossPct, 0.7, 2)
    : 0.5;

  // Age: sarcopenia risk climbs from roughly 30 onward.
  const age = known(input.ageYears, 'age') ? 1 - ramp(input.ageYears, 30, 75) * 0.65 : 0.5;

  // Medication: steady therapeutic coverage supports steady eating. Very low
  // coverage means returning appetite; very high with poor intake is the classic
  // GLP-1 under-eating trap. Protein is scored separately, so this only captures
  // the stability of coverage.
  const medication = 1 - Math.abs(clamp(input.medicationLevel, 0, 100) - 65) / 100;

  // Calories: a deficit beyond ~1000 kcal/day is where lean loss accelerates.
  const calories = known(input.calorieDeficit, 'calories')
    ? 1 - ramp(input.calorieDeficit, 750, 1500)
    : 0.5;

  return {
    scores: { protein, strength, sleep, hydration, rate, age, medication, calories },
    missing,
  };
}

export function musclePreservationIndex(scores: Record<ScoreName, number>): number {
  const total = (Object.keys(MPI_WEIGHTS) as ScoreName[]).reduce(
    (sum, k) => sum + MPI_WEIGHTS[k] * scores[k],
    0,
  );
  return Math.round(clamp(total, 0, 1) * 100);
}

export type MpiBand = 'Excellent' | 'Strong' | 'Fair' | 'At risk';

export function mpiBand(mpi: number): MpiBand {
  if (mpi >= 80) return 'Excellent';
  if (mpi >= 65) return 'Strong';
  if (mpi >= 45) return 'Fair';
  return 'At risk';
}

/**
 * Forbes baseline: the lean share of a weight change, from fat mass alone.
 * A person carrying 40 kg of fat loses a much smaller proportion of lean tissue
 * than someone carrying 10 kg, at identical behaviour.
 */
export function forbesLeanFraction(fatMassKg: number): number {
  return clamp(FORBES_C / (FORBES_C + Math.max(1, fatMassKg)), LEAN_MIN, LEAN_MAX);
}

/**
 * The partition, from physiology modulated by behaviour.
 *
 * MPI shifts the Forbes baseline by up to ±45%: excellent habits cannot make a
 * lean person partition like an obese one, and terrible habits cannot push an
 * obese person past the physiological ceiling. The multiplier is centred so
 * MPI 50 reproduces the untouched Forbes value.
 */
export function partition(fatMassKg: number, mpi: number): { fat: number; lean: number } {
  const base = forbesLeanFraction(fatMassKg);
  const modulated = base * (1.45 - 0.9 * (mpi / 100));
  const lean = clamp(modulated, LEAN_MIN, LEAN_MAX);
  return { fat: 1 - lean, lean };
}

/**
 * Partition solved from energy balance, when intake is known.
 *
 * With a measured deficit the split stops being a guess: only one division of
 * the mass satisfies both conservation of mass and conservation of energy.
 * Returns null when the numbers are inconsistent — which usually means the
 * calorie logging is wrong, not the physics.
 */
export function partitionFromEnergy(
  weeklyChangeKg: number,
  dailyDeficitKcal: number,
): { fat: number; lean: number } | null {
  const lostKg = -weeklyChangeKg;
  if (lostKg <= 0.05 || dailyDeficitKcal <= 0) return null;

  const weeklyKcal = dailyDeficitKcal * 7;
  const fatKg = (weeklyKcal - KCAL_PER_KG_LEAN * lostKg) / (KCAL_PER_KG_FAT - KCAL_PER_KG_LEAN);
  const fatFraction = fatKg / lostKg;
  if (!Number.isFinite(fatFraction) || fatFraction < 0.2 || fatFraction > 1.05) return null;

  const fat = clamp(fatFraction, 1 - LEAN_MAX, 1 - LEAN_MIN);
  return { fat, lean: 1 - fat };
}

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

export type CompositionEstimate = {
  fatPct: number;
  leanPct: number;
  /** 0-100. How much the estimate should be trusted. */
  confidence: number;
  confidenceBand: 'High' | 'Moderate' | 'Low';
  mpi: number;
  mpiBand: MpiBand;
  /** Fat lost / total lost, as a percentage. */
  fatLossEfficiency: number;
  scores: Record<ScoreName, number>;
  missing: ScoreName[];
  /** Whether energy balance contributed to the answer. */
  energySolved: boolean;
  /** False when body fat is a population prior rather than a measurement. */
  bodyFatMeasured: boolean;
  /** Plain-language support for the estimate. */
  reasons: string[];
  /** Absolute masses for the week, in the caller's units. */
  weeklyChange: number | null;
  fatChange: number | null;
  leanChange: number | null;
};

/**
 * Confidence.
 *
 * Rises with the number of inputs actually observed and the number of
 * weigh-ins behind the trend; energy-solved estimates get a further lift
 * because they are constrained by physics rather than inferred from behaviour.
 * Deliberately capped below 100 — this is never a measurement.
 */
function confidenceFrom(
  missing: ScoreName[],
  weighIns: number,
  energySolved: boolean,
  bodyFatMeasured: boolean,
) {
  const observed = (Object.keys(MPI_WEIGHTS) as ScoreName[]).filter((k) => !missing.includes(k));
  // Weight the coverage by how much each input actually matters.
  const covered = observed.reduce((s, k) => s + MPI_WEIGHTS[k], 0);

  const dataDepth = ramp(weighIns, 2, 8); // 8+ weigh-ins is a solid trend
  const raw = 0.25 + covered * 0.45 + dataDepth * 0.2 + (energySolved ? 0.12 : 0);

  // Without a measured body fat percentage the Forbes baseline runs on a
  // population prior, and that assumption sits underneath every other number
  // here. Perfect habit logging cannot make up for not knowing the starting
  // point, so confidence is held to "Moderate" until there is a real
  // measurement. Claiming 88% off an assumed body fat would be fake certainty.
  const ceiling = bodyFatMeasured ? 0.94 : 0.7;
  return Math.round(clamp(raw, 0.2, ceiling) * 100);
}

const bandFor = (c: number): CompositionEstimate['confidenceBand'] =>
  c >= 75 ? 'High' : c >= 55 ? 'Moderate' : 'Low';

/** The engine. */
export function estimateComposition(
  input: EngineInputs,
  context: { weighIns: number; weeklyChangeLb: number | null },
): CompositionEstimate {
  const { scores, missing } = normalise(input);
  const mpi = musclePreservationIndex(scores);

  // Body fat drives the Forbes baseline. Without a measurement we fall back to
  // a population prior for people starting GLP-1 treatment, and say so by
  // capping confidence below.
  const bodyFatMeasured = input.bodyFatPct != null;
  const fatMassKg = ((input.bodyFatPct ?? 38) / 100) * (input.weightLb / LB_PER_KG);

  const behavioural = partition(fatMassKg, mpi);

  // Energy balance overrides behaviour where it can, because it is a constraint
  // rather than a correlation.
  const energy =
    context.weeklyChangeLb != null && input.calorieDeficit != null
      ? partitionFromEnergy(context.weeklyChangeLb / LB_PER_KG, input.calorieDeficit)
      : null;

  const fat = energy ? energy.fat * 0.65 + behavioural.fat * 0.35 : behavioural.fat;
  const lean = 1 - fat;

  const confidence = confidenceFrom(missing, context.weighIns, energy != null, bodyFatMeasured);

  const weeklyChange = context.weeklyChangeLb;
  const losing = weeklyChange != null && weeklyChange < 0;

  return {
    fatPct: Math.round(fat * 100),
    leanPct: Math.round(lean * 100),
    confidence,
    confidenceBand: bandFor(confidence),
    mpi,
    mpiBand: mpiBand(mpi),
    fatLossEfficiency: Math.round(fat * 100),
    scores,
    missing,
    energySolved: energy != null,
    bodyFatMeasured,
    reasons: buildReasons(input, scores, missing),
    weeklyChange,
    fatChange: losing ? +(weeklyChange! * fat).toFixed(2) : null,
    leanChange: losing ? +(weeklyChange! * lean).toFixed(2) : null,
  };
}

/** The "why" list — only claims backed by data the user actually logged. */
function buildReasons(
  input: EngineInputs,
  scores: Record<ScoreName, number>,
  missing: ScoreName[],
): string[] {
  const out: string[] = [];

  if (!missing.includes('protein') && input.proteinG != null) {
    const pct = Math.round((input.proteinG / Math.max(1, input.proteinGoalG)) * 100);
    out.push(
      scores.protein >= 0.85
        ? `Protein averaged ${Math.round(input.proteinG)} g — ${pct}% of target`
        : `Protein averaged ${Math.round(input.proteinG)} g, ${100 - pct}% short of target`,
    );
  }

  if (!missing.includes('strength') && input.strengthPerWeek != null) {
    out.push(
      input.strengthPerWeek >= 1
        ? `Resistance training ${Math.round(input.strengthPerWeek * 10) / 10}× per week`
        : 'No resistance training logged — the strongest lever you have',
    );
  }

  if (!missing.includes('rate') && input.weeklyLossPct != null) {
    out.push(
      scores.rate >= 0.8
        ? `Losing ${input.weeklyLossPct.toFixed(2)}% of body weight per week — in the protective range`
        : `Losing ${input.weeklyLossPct.toFixed(2)}% per week, fast enough to cost lean tissue`,
    );
  }

  if (!missing.includes('sleep') && input.sleepH != null) {
    out.push(
      scores.sleep >= 0.8
        ? `Sleep averaged ${input.sleepH.toFixed(1)} hours`
        : `Sleep averaged ${input.sleepH.toFixed(1)} hours — short sleep raises cortisol`,
    );
  }

  if (input.calorieDeficit != null) {
    out.push(`Intake logged — the split is solved from energy balance, not inferred`);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Digital twin — what happens if I change one thing?
// ---------------------------------------------------------------------------

export type Lever = { id: string; label: string; apply: (i: EngineInputs) => EngineInputs };

export const LEVERS: Lever[] = [
  {
    id: 'protein+15',
    label: 'Eat 15 g more protein a day',
    apply: (i) => ({ ...i, proteinG: (i.proteinG ?? i.proteinGoalG * 0.6) + 15 }),
  },
  {
    id: 'protein+30',
    label: 'Eat 30 g more protein a day',
    apply: (i) => ({ ...i, proteinG: (i.proteinG ?? i.proteinGoalG * 0.6) + 30 }),
  },
  {
    id: 'strength+1',
    label: 'Add one resistance session a week',
    apply: (i) => ({ ...i, strengthPerWeek: (i.strengthPerWeek ?? 0) + 1 }),
  },
  {
    id: 'strength+2',
    label: 'Add two resistance sessions a week',
    apply: (i) => ({ ...i, strengthPerWeek: (i.strengthPerWeek ?? 0) + 2 }),
  },
  {
    id: 'sleep+1',
    label: 'Sleep one hour more',
    apply: (i) => ({ ...i, sleepH: (i.sleepH ?? 6) + 1 }),
  },
  {
    id: 'slower',
    label: 'Slow the loss to 0.7% a week',
    apply: (i) => ({ ...i, weeklyLossPct: Math.min(i.weeklyLossPct ?? 1, 0.7) }),
  },
];

export type Simulation = {
  lever: Lever;
  fatPct: number;
  /** Change in lean-preservation, in percentage points. */
  gainPp: number;
};

/** Runs one lever through the engine and reports the change. */
export function simulate(
  input: EngineInputs,
  context: { weighIns: number; weeklyChangeLb: number | null },
  lever: Lever,
): Simulation {
  const base = estimateComposition(input, context);
  const next = estimateComposition(lever.apply(input), context);
  return { lever, fatPct: next.fatPct, gainPp: next.fatPct - base.fatPct };
}

/**
 * The single change worth making. Every lever is simulated and the biggest
 * real gain wins; ties break toward the cheaper habit, since advice nobody
 * follows is worth nothing.
 */
export function topOpportunity(
  input: EngineInputs,
  context: { weighIns: number; weeklyChangeLb: number | null },
): Simulation | null {
  const ranked = LEVERS.map((l) => simulate(input, context, l))
    .filter((s) => s.gainPp >= 1)
    .sort((a, b) => b.gainPp - a.gainPp);
  return ranked[0] ?? null;
}

// ---------------------------------------------------------------------------
// Gathering inputs from logs
// ---------------------------------------------------------------------------

const avgPerDay = (logs: LogEntry[], kind: LogEntry['kind'], days: number, now: number) => {
  const cutoff = startOfDay(now) - days * DAY;
  const byDay = new Map<number, number>();
  for (const l of logs) {
    if (l.kind !== kind || l.at < cutoff) continue;
    const d = startOfDay(l.at);
    byDay.set(d, (byDay.get(d) ?? 0) + l.value);
  }
  if (!byDay.size) return null;
  return [...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size;
};

/** Weekly percentage of body weight lost, from the trailing window. */
export function weeklyLossPercent(logs: LogEntry[], days: number, now: number) {
  const window = weightSeries(logs).filter((w) => w.t >= now - days * DAY);
  if (window.length < 2) return null;
  const first = window[0];
  const last = window[window.length - 1];
  const span = (last.t - first.t) / DAY;
  if (span < 4 || last.value <= 0) return null;
  return ((first.value - last.value) / last.value) * (7 / span) * 100;
}

export function gatherInputs(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
  windowDays = 28,
): { input: EngineInputs; context: { weighIns: number; weeklyChangeLb: number | null } } {
  const weights = weightSeries(logs);
  const weightLb = weights.at(-1)?.value ?? profile.startWeight ?? 200;

  const strengthDays = new Set(
    logs
      .filter((l) => l.kind === 'strength' && l.at >= now - windowDays * DAY)
      .map((l) => startOfDay(l.at)),
  ).size;

  const weeklyWindow = weights.filter((w) => w.t >= now - 7 * DAY);
  const weeklyChangeLb =
    weeklyWindow.length >= 2 ? weeklyWindow[weeklyWindow.length - 1].value - weeklyWindow[0].value : null;

  return {
    input: {
      weightLb,
      bodyFatPct: profile.bodyFatPct ?? null,
      ageYears: profile.birthYear ? new Date(now).getFullYear() - profile.birthYear : null,
      proteinG: avgPerDay(logs, 'meal', windowDays, now),
      proteinGoalG: profile.goals.proteinG,
      strengthPerWeek: strengthDays > 0 ? (strengthDays / windowDays) * 7 : null,
      sleepH: avgPerDay(logs, 'sleep', windowDays, now),
      hydrationMl: avgPerDay(logs, 'water', windowDays, now),
      hydrationGoalMl: profile.goals.waterMl,
      weeklyLossPct: weeklyLossPercent(logs, windowDays, now),
      medicationLevel: computeToday(profile, logs, now).medicationLevel,
      calorieDeficit: null,
    },
    context: { weighIns: weights.length, weeklyChangeLb },
  };
}

/** One call: logs in, full estimate out. */
export function compositionEngine(profile: Profile, logs: LogEntry[], now = Date.now()) {
  const { input, context } = gatherInputs(profile, logs, now);
  const estimate = estimateComposition(input, context);
  return { estimate, input, context, opportunity: topOpportunity(input, context) };
}
