/**
 * Tomorrow Simulator™
 *
 * "What happens if…" rather than "here is what happened".
 *
 * Every number here is produced by running the *real* scoring function over
 * hypothetical logs dated tomorrow — not by a lookup table or a guessed delta.
 * If the simulator says protein is worth +9, then logging that protein tomorrow
 * will move the score by exactly 9. A simulator that mispredicts its own app is
 * worse than no simulator, because the user finds out.
 *
 * The baseline is tomorrow with nothing logged. Medication coverage carries
 * over from real doses, and the consistency point depends on whether anything
 * was logged today, so the starting point is already personal.
 */

import { DAY, startOfDay } from './dates';
import { computeScore, type MetabolicScore } from './score';
import type { LogEntry, LogKind, Profile } from '../store/types';

export type ScenarioId =
  | 'protein'
  | 'noProtein'
  | 'water'
  | 'walk'
  | 'strength'
  | 'sleep'
  | 'weigh'
  | 'dose'
  | 'perfect';

export type Scenario = {
  id: ScenarioId;
  label: string;
  icon: string;
  /** True when the scenario describes neglect rather than effort. */
  negative?: boolean;
  build: (profile: Profile) => { kind: LogKind; value: number }[];
};

export const SCENARIOS: Scenario[] = [
  {
    id: 'protein',
    label: 'Hit your protein target',
    icon: 'nutrition-outline',
    build: (p) => [{ kind: 'meal', value: p.goals.proteinG }],
  },
  {
    id: 'noProtein',
    label: 'Skip protein entirely',
    icon: 'close-circle-outline',
    negative: true,
    build: () => [],
  },
  {
    id: 'water',
    label: 'Drink your water goal',
    icon: 'water-outline',
    build: (p) => [{ kind: 'water', value: p.goals.waterMl }],
  },
  {
    id: 'walk',
    label: 'Walk 20 minutes',
    icon: 'walk-outline',
    build: () => [{ kind: 'activity', value: 20 }],
  },
  {
    id: 'strength',
    label: 'Train for 30 minutes',
    icon: 'barbell-outline',
    build: () => [{ kind: 'strength', value: 30 }],
  },
  {
    id: 'sleep',
    label: 'Sleep 8 hours',
    icon: 'moon-outline',
    build: () => [{ kind: 'sleep', value: 8 }],
  },
  {
    id: 'weigh',
    label: 'Step on the scale',
    icon: 'scale-outline',
    build: () => [{ kind: 'weight', value: 0 }],
  },
  {
    id: 'dose',
    label: 'Take your dose',
    icon: 'medkit-outline',
    build: (p) => [{ kind: 'dose', value: p.doseMg ?? 0 }],
  },
  {
    id: 'perfect',
    label: 'Do everything',
    icon: 'sparkles-outline',
    build: (p) => [
      { kind: 'meal', value: p.goals.proteinG },
      { kind: 'water', value: p.goals.waterMl },
      { kind: 'activity', value: p.goals.activityMin },
      { kind: 'strength', value: 30 },
      { kind: 'sleep', value: p.goals.sleepHours },
      { kind: 'symptom', value: 0 },
      { kind: 'weight', value: 0 },
    ],
  },
];

export type SimulatedDay = {
  scenario: Scenario;
  score: number;
  delta: number;
};

export type TomorrowSimulation = {
  /** Tomorrow with nothing logged. */
  baseline: number;
  /** Today's actual score, for comparison. */
  today: number;
  results: SimulatedDay[];
  /** The realistic ceiling if everything is done. */
  best: number;
};

const idFor = (i: number) => `sim-${i}`;

/**
 * Materialises a scenario as logs timestamped tomorrow midday, then scores that
 * day. Weight is special-cased: the scoring function only cares that a weigh-in
 * exists, so the value carries the last known weight to avoid polluting a trend
 * with a zero.
 */
function scoreWith(
  profile: Profile,
  logs: LogEntry[],
  scenario: Scenario,
  at: number,
  lastWeight: number,
): MetabolicScore {
  const extra: LogEntry[] = scenario.build(profile).map((e, i) => ({
    id: idFor(i),
    kind: e.kind,
    value: e.kind === 'weight' ? lastWeight : e.value,
    at,
  }));
  return computeScore(profile, [...extra, ...logs], at);
}

export function simulateTomorrow(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): TomorrowSimulation {
  // Midday tomorrow: far enough in that the medication curve has moved, and a
  // neutral time of day for a hypothetical.
  const at = startOfDay(now + DAY) + 12 * 3600_000;
  const lastWeight = logs.filter((l) => l.kind === 'weight').sort((a, b) => b.at - a.at)[0]?.value ?? 0;

  const empty: Scenario = { id: 'noProtein', label: '', icon: '', build: () => [] };
  const baseline = scoreWith(profile, logs, empty, at, lastWeight).total;

  const results = SCENARIOS.map((scenario) => {
    const score = scoreWith(profile, logs, scenario, at, lastWeight).total;
    return { scenario, score, delta: score - baseline };
  });

  return {
    baseline,
    today: computeScore(profile, logs, now).total,
    results,
    best: Math.max(...results.map((r) => r.score)),
  };
}

/**
 * Score for several scenarios done together.
 *
 * Deltas do not add up: the score caps at 100 and each component saturates at
 * its own weight, so two +8 choices are rarely +16. The combination is
 * therefore re-scored rather than summed.
 */
export function simulateStack(
  profile: Profile,
  logs: LogEntry[],
  ids: ScenarioId[],
  now = Date.now(),
): number {
  const at = startOfDay(now + DAY) + 12 * 3600_000;
  const lastWeight = logs.filter((l) => l.kind === 'weight').sort((a, b) => b.at - a.at)[0]?.value ?? 0;

  const merged: Scenario = {
    id: 'perfect',
    label: '',
    icon: '',
    build: (p) => SCENARIOS.filter((s) => ids.includes(s.id)).flatMap((s) => s.build(p)),
  };

  return scoreWith(profile, logs, merged, at, lastWeight).total;
}

/** The improvements worth showing, biggest first, neglect cases last. */
export function rankedScenarios(sim: TomorrowSimulation): SimulatedDay[] {
  const positive = sim.results
    .filter((r) => !r.scenario.negative && r.scenario.id !== 'perfect' && r.delta > 0)
    .sort((a, b) => b.delta - a.delta);
  const perfect = sim.results.find((r) => r.scenario.id === 'perfect');
  const negative = sim.results.filter((r) => r.scenario.negative);
  return [...positive, ...(perfect ? [perfect] : []), ...negative];
}
