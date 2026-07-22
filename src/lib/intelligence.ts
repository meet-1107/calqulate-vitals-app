/**
 * Body Intelligence — the progressive disclosure ladder.
 *
 *   Week 1  Observation    what you did
 *   Week 2  Patterns       what tends to go with what
 *   Week 3  Prediction     what tomorrow probably looks like
 *   Week 4+ Optimization   what changes it            (Decision Engine, paid)
 *
 * Stages advance on **days elapsed AND data sufficiency**, never on days alone.
 * Announcing "we now understand your metabolism" on day 14 to someone who has
 * logged four times would be a lie, and the first prediction would embarrass
 * itself. A user short on data is told exactly what is missing instead.
 */

import { DAY, startOfDay } from './dates';
import { findPatterns, pairedDayCount, type Pattern } from './patterns';
import { MIN_WEIGH_INS, predictTomorrow, type WeightPrediction } from './prediction';
import { weightSeries } from './insights';
import { dayIndex } from './journey';
import type { LogEntry, Profile } from '../store/types';

export type Stage = 'observation' | 'patterns' | 'prediction' | 'optimization';

export const STAGES: { id: Stage; day: number; title: string; blurb: string }[] = [
  { id: 'observation', day: 1, title: 'Observation', blurb: 'Recording what you do' },
  { id: 'patterns', day: 8, title: 'Patterns', blurb: 'Finding what goes with what' },
  { id: 'prediction', day: 14, title: 'Prediction', blurb: 'Modelling your tomorrow' },
  { id: 'optimization', day: 28, title: 'Optimization', blurb: 'Changing the outcome' },
];

/** Data the model needs before each stage is honest to claim. */
const REQUIREMENTS: Record<Stage, { days: number; weighIns: number; pairedDays: number }> = {
  observation: { days: 1, weighIns: 0, pairedDays: 0 },
  patterns: { days: 8, weighIns: 3, pairedDays: 6 },
  prediction: { days: 14, weighIns: MIN_WEIGH_INS, pairedDays: 8 },
  optimization: { days: 28, weighIns: 10, pairedDays: 14 },
};

export type Intelligence = {
  stage: Stage;
  day: number;
  /** Data points behind the model — the number shown on the unlock screen. */
  dataPoints: number;
  weighIns: number;
  pairedDays: number;
  patterns: Pattern[];
  prediction: WeightPrediction | null;
  /** True once the model has enough to be called trained. */
  modelReady: boolean;
  /** What is still missing before the next stage, when something is. */
  blockedBy: string | null;
  next: { id: Stage; title: string; day: number } | null;
  /** Days remaining until the next stage's date requirement. */
  daysToNext: number | null;
};

function meets(
  stage: Stage,
  day: number,
  weighIns: number,
  pairedDays: number,
): boolean {
  const r = REQUIREMENTS[stage];
  return day >= r.days && weighIns >= r.weighIns && pairedDays >= r.pairedDays;
}

/** What to tell a user who has hit the date but not the data. */
function missingFor(stage: Stage, weighIns: number, pairedDays: number): string | null {
  const r = REQUIREMENTS[stage];
  if (weighIns < r.weighIns) {
    const need = r.weighIns - weighIns;
    return `${need} more weigh-in${need === 1 ? '' : 's'}`;
  }
  if (pairedDays < r.pairedDays) {
    const need = r.pairedDays - pairedDays;
    return `${need} more day${need === 1 ? '' : 's'} logging two or more things`;
  }
  return null;
}

export function buildIntelligence(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): Intelligence {
  const day = dayIndex(logs, now);
  const weighIns = weightSeries(logs).length;
  const pairedDays = pairedDayCount(logs);

  // Highest stage whose date *and* data requirements are both satisfied.
  let stage: Stage = 'observation';
  for (const s of STAGES) {
    if (meets(s.id, day, weighIns, pairedDays)) stage = s.id;
  }

  const index = STAGES.findIndex((s) => s.id === stage);
  const nextStage = STAGES[index + 1] ?? null;

  const patterns = stage === 'observation' ? [] : findPatterns(profile, logs);
  const prediction =
    stage === 'prediction' || stage === 'optimization' ? predictTomorrow(profile, logs, now) : null;

  return {
    stage,
    day,
    dataPoints: logs.length,
    weighIns,
    pairedDays,
    patterns,
    prediction,
    modelReady: stage === 'prediction' || stage === 'optimization',
    blockedBy: nextStage && day >= nextStage.day ? missingFor(nextStage.id, weighIns, pairedDays) : null,
    next: nextStage ? { id: nextStage.id, title: nextStage.title, day: nextStage.day } : null,
    daysToNext: nextStage ? Math.max(0, nextStage.day - day) : null,
  };
}

/** Today's observation — the week-1 payload, before any inference is earned. */
export function todayObservation(logs: LogEntry[], now = Date.now()): string[] {
  const today = startOfDay(now);
  const on = (kind: LogEntry['kind']) =>
    logs.filter((l) => l.kind === kind && startOfDay(l.at) === today);

  const out: string[] = [];
  const weight = on('weight').at(-1);
  if (weight) out.push(`Weighed in at ${weight.value.toFixed(1)}`);

  const protein = on('meal').reduce((s, l) => s + l.value, 0);
  if (protein > 0) out.push(`${Math.round(protein)} g of protein`);

  const water = on('water').reduce((s, l) => s + l.value, 0);
  if (water > 0) out.push(`${(water / 1000).toFixed(1)} L of water`);

  const sleep = on('sleep').at(-1);
  if (sleep) out.push(`${sleep.value.toFixed(1)} hours of sleep`);

  const move = on('activity').concat(on('strength')).reduce((s, l) => s + l.value, 0);
  if (move > 0) out.push(`${Math.round(move)} minutes moving`);

  return out;
}

/** Whether the "your body model is ready" moment should fire. */
export const shouldCelebrate = (intel: Intelligence, alreadySeen: boolean) =>
  intel.modelReady && !alreadySeen;

/** Days of history, for the unlock copy. */
export const historyDays = (logs: LogEntry[], now = Date.now()) =>
  logs.length ? Math.max(1, Math.round((now - Math.min(...logs.map((l) => l.at))) / DAY)) : 0;
