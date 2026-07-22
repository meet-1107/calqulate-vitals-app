/**
 * Calqulate Metabolic Score™
 *
 * One number, 0-100, for how well today's habits support metabolism and GLP-1
 * treatment. The whole point is that it is *not* mysterious: every component
 * publishes its own weight, what was earned, why, and the specific action that
 * would earn the rest. If you change a weight here, change it in one place —
 * `COMPONENTS` is the single source of truth for the app and the marketing copy.
 *
 * Weights total exactly 100:
 *   Medication 25 · Protein 20 · Hydration 15 · Weight check 10
 *   Activity 10 · Sleep 10 · Symptoms 5 · Consistency 5
 */

import { DAY, isSameDay, startOfDay } from './dates';
import { getMedication } from './medications';
import { levelPercent } from './pk';
import type { LogEntry, LogKind, Profile } from '../store/types';

export type ScoreComponentId =
  | 'medication'
  | 'protein'
  | 'hydration'
  | 'weight'
  | 'activity'
  | 'sleep'
  | 'symptoms'
  | 'consistency';

export type ScoreComponent = {
  id: ScoreComponentId;
  label: string;
  weight: number;
  /** What the component measures, in one plain-language line. */
  blurb: string;
};

export const COMPONENTS: ScoreComponent[] = [
  { id: 'medication', label: 'Medication', weight: 25, blurb: 'How much medication is working today' },
  { id: 'protein', label: 'Protein', weight: 20, blurb: 'Protein protects muscle while you lose fat' },
  { id: 'hydration', label: 'Hydration', weight: 15, blurb: 'Water eases GI side effects' },
  { id: 'weight', label: 'Weight Check', weight: 10, blurb: 'A weigh-in keeps your trend honest' },
  { id: 'activity', label: 'Activity', weight: 10, blurb: 'Movement keeps metabolic rate up' },
  { id: 'sleep', label: 'Sleep', weight: 10, blurb: 'Short sleep raises appetite hormones' },
  { id: 'symptoms', label: 'Symptoms', weight: 5, blurb: 'Checking in catches problems early' },
  { id: 'consistency', label: 'Consistency', weight: 5, blurb: 'Logging two days in a row' },
];

export type ScoreLine = {
  id: ScoreComponentId;
  label: string;
  blurb: string;
  earned: number;
  max: number;
  /** Progress toward this component's own goal, 0-1. */
  ratio: number;
  detail: string;
};

export type ScoreAction = {
  id: ScoreComponentId;
  /** "Drink 800 mL more water" */
  title: string;
  points: number;
  /** Quick-add kind this action routes to, when one applies. */
  kind?: LogKind;
};

export type ScoreBand = 'Needs work' | 'Fair' | 'Good' | 'Great' | 'Excellent';

export type MetabolicScore = {
  total: number;
  band: ScoreBand;
  lines: ScoreLine[];
  actions: ScoreAction[];
  /** Points still reachable before midnight. */
  available: number;
};

export function bandFor(total: number): ScoreBand {
  if (total >= 95) return 'Excellent';
  if (total >= 85) return 'Great';
  if (total >= 70) return 'Good';
  if (total >= 50) return 'Fair';
  return 'Needs work';
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

const sumOn = (logs: LogEntry[], kind: LogKind, at: number) =>
  logs.filter((l) => l.kind === kind && isSameDay(l.at, at)).reduce((s, l) => s + l.value, 0);

const anyOn = (logs: LogEntry[], kind: LogKind, at: number) =>
  logs.some((l) => l.kind === kind && isSameDay(l.at, at));

const weightOf = (id: ScoreComponentId) => COMPONENTS.find((c) => c.id === id)!.weight;

/**
 * Medication coverage.
 *
 * Full marks once the modelled level is at or above `FULL_COVERAGE` of steady
 * state — the therapeutic plateau, not the peak, so a user mid-titration is not
 * permanently punished for being on a starting dose.
 */
const FULL_COVERAGE = 70;

function medicationLine(profile: Profile, logs: LogEntry[], at: number): ScoreLine {
  const max = weightOf('medication');
  const med = getMedication(profile.medication);
  const doses = logs
    .filter((l) => l.kind === 'dose' && l.at <= at)
    .map((l) => ({ takenAt: l.at, amountMg: l.value }));

  if (!doses.length) {
    return {
      id: 'medication',
      label: 'Medication',
      blurb: COMPONENTS[0].blurb,
      earned: 0,
      max,
      ratio: 0,
      detail: 'No dose logged yet',
    };
  }

  const level = levelPercent(doses, at, med.halfLifeHours, profile.doseMg ?? 0);
  const ratio = clamp01(level / FULL_COVERAGE);
  return {
    id: 'medication',
    label: 'Medication',
    blurb: COMPONENTS[0].blurb,
    earned: Math.round(max * ratio),
    max,
    ratio,
    detail: `${level}% active`,
  };
}

function ratioLine(
  id: ScoreComponentId,
  value: number,
  goal: number,
  detail: string,
): ScoreLine {
  const meta = COMPONENTS.find((c) => c.id === id)!;
  const ratio = goal > 0 ? clamp01(value / goal) : 0;
  return {
    id,
    label: meta.label,
    blurb: meta.blurb,
    earned: Math.round(meta.weight * ratio),
    max: meta.weight,
    ratio,
    detail,
  };
}

function binaryLine(id: ScoreComponentId, done: boolean, detail: string): ScoreLine {
  const meta = COMPONENTS.find((c) => c.id === id)!;
  return {
    id,
    label: meta.label,
    blurb: meta.blurb,
    earned: done ? meta.weight : 0,
    max: meta.weight,
    ratio: done ? 1 : 0,
    detail,
  };
}

export function computeScore(
  profile: Profile,
  logs: LogEntry[],
  at = Date.now(),
): MetabolicScore {
  const g = profile.goals;

  const protein = sumOn(logs, 'meal', at);
  const water = sumOn(logs, 'water', at);
  // Resistance training counts toward the movement goal as well as carrying its
  // own weight in the composition engine. Logging the single most
  // muscle-protective thing a user can do must never score zero.
  const activity = sumOn(logs, 'activity', at) + sumOn(logs, 'strength', at);
  const sleep = sumOn(logs, 'sleep', at);
  const weighed = anyOn(logs, 'weight', at);
  const checkedIn = anyOn(logs, 'symptom', at);

  const yesterday = at - DAY;
  const loggedYesterday = logs.some(
    (l) => isSameDay(l.at, yesterday) && l.kind !== 'photo',
  );

  const lines: ScoreLine[] = [
    medicationLine(profile, logs, at),
    ratioLine('protein', protein, g.proteinG, `${Math.round(protein)} of ${g.proteinG} g`),
    ratioLine('hydration', water, g.waterMl, `${Math.round(water)} of ${g.waterMl} mL`),
    binaryLine('weight', weighed, weighed ? 'Logged today' : 'Not logged today'),
    ratioLine('activity', activity, g.activityMin, `${Math.round(activity)} of ${g.activityMin} min`),
    ratioLine('sleep', sleep, g.sleepHours, sleep ? `${sleep.toFixed(1)} of ${g.sleepHours} h` : 'Not logged'),
    binaryLine('symptoms', checkedIn, checkedIn ? 'Checked in' : 'No check-in yet'),
    binaryLine('consistency', loggedYesterday, loggedYesterday ? 'Two days running' : 'Nothing logged yesterday'),
  ];

  const total = Math.max(0, Math.min(100, lines.reduce((s, l) => s + l.earned, 0)));

  const actions: ScoreAction[] = [];
  const gap = (l: ScoreLine) => l.max - l.earned;

  const proteinLeft = Math.max(0, g.proteinG - protein);
  if (proteinLeft > 0) {
    actions.push({
      id: 'protein',
      title: `Eat ${Math.round(proteinLeft)}g more protein`,
      points: gap(lines[1]),
      kind: 'meal',
    });
  }

  const waterLeft = Math.max(0, g.waterMl - water);
  if (waterLeft > 0) {
    actions.push({
      id: 'hydration',
      title: `Drink ${Math.round(waterLeft)} mL more water`,
      points: gap(lines[2]),
      kind: 'water',
    });
  }

  if (!weighed) {
    actions.push({ id: 'weight', title: 'Log a weigh-in', points: gap(lines[3]), kind: 'weight' });
  }

  const activityLeft = Math.max(0, g.activityMin - activity);
  if (activityLeft > 0) {
    actions.push({
      id: 'activity',
      title: `Take a ${Math.round(activityLeft)}-minute walk`,
      points: gap(lines[4]),
      kind: 'activity',
    });
  }

  const sleepLeft = Math.max(0, g.sleepHours - sleep);
  if (sleepLeft > 0) {
    actions.push({
      id: 'sleep',
      title: sleep === 0 ? "Log last night's sleep" : `Log ${sleepLeft.toFixed(1)}h more sleep`,
      points: gap(lines[5]),
      kind: 'sleep',
    });
  }

  if (!checkedIn) {
    actions.push({
      id: 'symptoms',
      title: 'Check in on how you feel',
      points: gap(lines[6]),
      kind: 'symptom',
    });
  }

  // Only prompt for a dose when one is actually due — nagging someone who is
  // three days into a weekly cycle would make the score feel arbitrary.
  const lastDose = logs.filter((l) => l.kind === 'dose' && l.at <= at).sort((a, b) => b.at - a.at)[0];
  const daysSinceDose = lastDose ? (at - lastDose.at) / DAY : Infinity;
  const doseDue =
    !anyOn(logs, 'dose', at) &&
    (!lastDose ||
      daysSinceDose >= 7 ||
      (profile.injectionDay != null && new Date(at).getDay() === profile.injectionDay));

  if (lines[0].earned < lines[0].max && doseDue) {
    actions.push({ id: 'medication', title: 'Log your dose', points: gap(lines[0]), kind: 'dose' });
  }

  // Yesterday's consistency point can't be earned today, so it is never an action.
  const actionable = actions.filter((a) => a.points > 0).sort((a, b) => b.points - a.points);

  return {
    total,
    band: bandFor(total),
    lines,
    actions: actionable,
    available: actionable.reduce((s, a) => s + a.points, 0),
  };
}

/** Daily scores over the trailing `days`, sampled at midday so PK levels are fair. */
export function scoreHistory(profile: Profile, logs: LogEntry[], days = 30, now = Date.now()) {
  const points: { t: number; value: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const t = startOfDay(now - i * DAY) + 12 * 3600_000;
    if (t > now) continue;
    points.push({ t, value: computeScore(profile, logs, t).total });
  }
  return points;
}
