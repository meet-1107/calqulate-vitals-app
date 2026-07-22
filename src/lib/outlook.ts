/**
 * Tomorrow's Body Outlook — predicting physiology instead of the scale.
 *
 * A user cannot control tomorrow's weight. Water, glycogen, sodium and gut
 * contents move it a pound either way regardless of what they do, so predicting
 * it sets the app up to be wrong about something the user checks every morning.
 *
 * What they *can* control is protein, training, sleep, hydration and timing —
 * and those act on mechanisms the model can actually predict: how efficiently
 * the loss comes from fat, whether muscle is protected, how recovered they will
 * feel, how hungry the dose cycle will make them.
 *
 * So the headline is the mechanism, not the outcome. It is more useful, more
 * controllable, and far harder to be embarrassingly wrong about.
 */

import { estimateComposition, gatherInputs, type EngineInputs } from './composition';
import { todayForecast, type CyclePhase } from './insights';
import { DAY, startOfDay } from './dates';
import { rateEvidence, type Evidence } from './stats';
import type { LogEntry, Profile } from '../store/types';

export type Level = 'Low' | 'Moderate' | 'High';

export type BodyOutlook = {
  /** Share of tomorrow's loss expected to come from fat. */
  fatLossEfficiency: number;
  /** Muscle Preservation Index. */
  musclePreservation: number;
  recovery: Level;
  recoveryWhy: string;
  hunger: Level;
  hungerWhy: string;
  confidence: number;
  phase: CyclePhase;
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Hunger tracks the dose cycle: quietest at peak, loudest at the trough. */
const HUNGER_BY_PHASE: Record<CyclePhase, Level> = {
  rising: 'Low',
  peak: 'Low',
  declining: 'Moderate',
  trough: 'High',
  overdue: 'High',
  none: 'Moderate',
};

/**
 * Recovery: sleep does most of the work, with hydration and symptom load
 * pulling it down. Reported as a band rather than a number because the inputs
 * are too coarse to justify a precise figure.
 */
function recoveryFrom(
  input: EngineInputs,
  symptomLoad: number,
): { level: Level; why: string } {
  const sleep = input.sleepH;
  if (sleep == null) {
    return { level: 'Moderate', why: 'Log your sleep and this sharpens quickly' };
  }

  const hydration = input.hydrationMl != null ? input.hydrationMl / input.hydrationGoalMl : 0.6;
  const score =
    clamp((sleep - 5) / 2.5, 0, 1) * 0.65 +
    clamp(hydration, 0, 1) * 0.2 +
    (1 - clamp(symptomLoad / 4, 0, 1)) * 0.15;

  // Sleep gates the ceiling outright. Good hydration cannot make six hours of
  // sleep into a recovered day, and saying otherwise while quoting the short
  // sleep back to the user reads as broken.
  if (score >= 0.72 && sleep >= 7) {
    return { level: 'High', why: `${sleep.toFixed(1)} h of sleep with hydration on track` };
  }
  if (score >= 0.45 && sleep >= 6) {
    return {
      level: 'Moderate',
      why:
        sleep < 7
          ? `${sleep.toFixed(1)} h of sleep — a little short of the 7 h that lifts recovery`
          : 'Hydration is what is holding recovery back',
    };
  }
  return {
    level: 'Low',
    why: sleep < 6 ? `${sleep.toFixed(1)} h of sleep — recovery suffers below six` : 'Symptoms and hydration are stacking up',
  };
}

/** Mean symptom severity over the trailing week. */
function symptomLoad(logs: LogEntry[], now: number): number {
  const recent = logs.filter((l) => l.kind === 'symptom' && l.at >= now - 7 * DAY);
  if (!recent.length) return 0;
  return recent.reduce((s, l) => s + l.value, 0) / recent.length;
}

export function bodyOutlook(profile: Profile, logs: LogEntry[], now = Date.now()): BodyOutlook {
  const { input, context } = gatherInputs(profile, logs, now);
  const est = estimateComposition(input, context);
  const forecast = todayForecast(profile, logs, now + DAY);
  const recovery = recoveryFrom(input, symptomLoad(logs, now));

  return {
    fatLossEfficiency: est.fatPct,
    musclePreservation: est.mpi,
    recovery: recovery.level,
    recoveryWhy: recovery.why,
    hunger: HUNGER_BY_PHASE[forecast.phase],
    hungerWhy: forecast.headline,
    confidence: est.confidence,
    phase: forecast.phase,
  };
}

// ---------------------------------------------------------------------------
// Ranked levers
// ---------------------------------------------------------------------------

export type LeverId = 'strength' | 'protein' | 'sleep' | 'hydration' | 'pace';

export type RankedLever = {
  id: LeverId;
  title: string;
  /** Change in fat-loss efficiency, in percentage points. */
  gainPp: number;
  /** What the change acts on, in the user's terms. */
  effect: string;
  evidence: Evidence;
  /** Why this specific user, from their own data where possible. */
  reason: string;
  icon: string;
};

/**
 * Levers, with whether each is clinically well supported.
 *
 * Resistance training and protein for muscle retention in a deficit are
 * established; hydration and pace are sensible but weaker; meal timing is
 * deliberately absent until there is something real to say about it.
 */
const LEVER_SPECS: {
  id: LeverId;
  title: string;
  effect: string;
  icon: string;
  clinical: boolean;
  apply: (i: EngineInputs, p: Profile) => EngineInputs;
  maxedWhen: (i: EngineInputs, p: Profile) => boolean;
  reason: string;
}[] = [
  {
    id: 'strength',
    title: 'Resistance training',
    effect: 'Fat-loss efficiency',
    icon: 'barbell-outline',
    clinical: true,
    apply: (i) => ({ ...i, strengthPerWeek: Math.min(3, (i.strengthPerWeek ?? 0) + 2) }),
    maxedWhen: (i) => (i.strengthPerWeek ?? 0) >= 3,
    reason: 'Loading a muscle is the strongest signal to keep it during a deficit',
  },
  {
    id: 'protein',
    title: 'Protein',
    effect: 'Muscle preservation',
    icon: 'nutrition-outline',
    clinical: true,
    apply: (i, p) => ({ ...i, proteinG: p.goals.proteinG }),
    maxedWhen: (i, p) => (i.proteinG ?? 0) >= p.goals.proteinG * 0.98,
    reason: 'Protein supplies what the body would otherwise take from muscle',
  },
  {
    id: 'sleep',
    title: 'Sleep',
    effect: 'Recovery',
    icon: 'moon-outline',
    clinical: true,
    apply: (i) => ({ ...i, sleepH: Math.max(7.5, (i.sleepH ?? 6) + 1) }),
    maxedWhen: (i) => (i.sleepH ?? 0) >= 7.5,
    reason: 'Short sleep raises cortisol and appetite, and blunts recovery',
  },
  {
    id: 'hydration',
    title: 'Hydration',
    effect: 'Symptom relief',
    icon: 'water-outline',
    clinical: false,
    apply: (i) => ({ ...i, hydrationMl: i.hydrationGoalMl }),
    maxedWhen: (i) => (i.hydrationMl ?? 0) >= i.hydrationGoalMl * 0.98,
    reason: 'Fluid helps with the GI side effects that derail eating well',
  },
  {
    id: 'pace',
    title: 'Slow the pace',
    effect: 'Muscle preservation',
    icon: 'speedometer-outline',
    clinical: true,
    apply: (i) => ({ ...i, weeklyLossPct: Math.min(i.weeklyLossPct ?? 1, 0.7) }),
    maxedWhen: (i) => (i.weeklyLossPct ?? 0) <= 0.7,
    reason: 'Above about 1% of body weight a week, more of the loss is lean tissue',
  },
];

/**
 * Today's biggest opportunities, ranked by modelled effect.
 *
 * A lever already at target is dropped entirely rather than listed with a zero
 * — recommending protein to someone already hitting their protein target is the
 * fastest way to make advice feel automated and ignorable.
 *
 * `personalConfidence` lets a discovered pattern in the user's own data lift a
 * lever's evidence rating: the app has seen this work *for them*.
 */
export function rankLevers(
  profile: Profile,
  logs: LogEntry[],
  personalConfidence: Partial<Record<LeverId, number>> = {},
  now = Date.now(),
): RankedLever[] {
  const { input, context } = gatherInputs(profile, logs, now);
  const base = estimateComposition(input, context);

  return LEVER_SPECS.filter((spec) => !spec.maxedWhen(input, profile))
    .map((spec) => {
      const next = estimateComposition(spec.apply(input, profile), context);
      return {
        id: spec.id,
        title: spec.title,
        gainPp: +(next.fatPct - base.fatPct).toFixed(1),
        effect: spec.effect,
        evidence: rateEvidence(personalConfidence[spec.id] ?? null, spec.clinical),
        reason: spec.reason,
        icon: spec.icon,
      };
    })
    .filter((l) => l.gainPp > 0)
    .sort((a, b) => b.gainPp - a.gainPp || b.evidence.stars - a.evidence.stars);
}

/** Levers already at target — shown as "you're doing this" rather than hidden. */
export function maxedLevers(profile: Profile, logs: LogEntry[], now = Date.now()): string[] {
  const { input } = gatherInputs(profile, logs, now);
  return LEVER_SPECS.filter((s) => s.maxedWhen(input, profile)).map((s) => s.title);
}

/** Day key helper for callers that group by day. */
export const dayOf = (t: number) => startOfDay(t);
