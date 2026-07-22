/**
 * Weekly report — the shareable artifact.
 *
 * Nobody posts "82 kg". People post a scorecard that makes them look like they
 * are winning at something hard. Every figure here is computed from the user's
 * own logs plus published trial data.
 *
 * ON THE COMPARISON LINE
 * ----------------------
 * A claim like "better than 93% of similar users" would require a cohort we do
 * not have. Inventing a percentile and putting it on something a user posts
 * publicly is fabricating a statistic, so this compares against **published
 * clinical-trial figures** instead, and says so on the card. That is both true
 * and more credible than a made-up peer ranking: "ahead of the STEP-1 average"
 * is a claim with a citation behind it.
 *
 * When real cohort data exists, `percentile` can be filled from the backend and
 * the copy swapped — the shape is already here.
 */

import { computeBenchmark } from './benchmark';
import { computeBodyComp, leanLossFraction } from './bodycomp';
import { DAY, dayKey } from './dates';
import { changeOverDays, weightSeries } from './insights';
import { getMedication } from './medications';
import { computeScore } from './score';
import { formatWeight } from './units';
import type { LogEntry, Profile, Units } from '../store/types';

/**
 * Share of GLP-1 weight loss that comes from lean mass in published studies.
 * Used as the honest comparison baseline for muscle preservation.
 */
const TRIAL_LEAN_LOSS_SHARE = 0.4;

export type Grade = 'A+' | 'A' | 'B' | 'C' | 'D';

export type WeeklyReport = {
  weekLabel: string;
  score: number;
  grade: Grade;
  units: Units;
  weightChange: number | null;
  fatChange: number | null;
  muscleChange: number | null;
  /** Percent of scheduled doses logged this week. */
  medicationPct: number;
  medicationVerdict: string;
  proteinPct: number;
  hydrationPct: number;
  /** One honest, sourced sentence. */
  summary: string;
  /** Where the comparison came from, printed small on the card. */
  summarySource: string;
  medicationName: string;
  /** False when there is too little logged to make a card worth sharing. */
  hasEnoughData: boolean;
};

export function gradeFor(score: number): Grade {
  if (score >= 93) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

const pct = (part: number, whole: number) =>
  whole <= 0 ? 0 : Math.max(0, Math.min(100, Math.round((part / whole) * 100)));

/** Mean of the daily scores actually achievable across the week. */
function weekScore(profile: Profile, logs: LogEntry[], now: number) {
  const days: number[] = [];
  for (let i = 6; i >= 0; i--) days.push(computeScore(profile, logs, now - i * DAY).total);
  return Math.round(days.reduce((a, b) => a + b, 0) / days.length);
}

function weekAverages(profile: Profile, logs: LogEntry[], now: number) {
  const start = now - 7 * DAY;
  const inWeek = (l: LogEntry) => l.at >= start && l.at <= now;

  const protein = logs.filter((l) => l.kind === 'meal' && inWeek(l)).reduce((s, l) => s + l.value, 0) / 7;
  const water = logs.filter((l) => l.kind === 'water' && inWeek(l)).reduce((s, l) => s + l.value, 0) / 7;

  return {
    proteinPct: pct(protein, profile.goals.proteinG),
    hydrationPct: pct(water, profile.goals.waterMl),
  };
}

/**
 * Adherence over the trailing 4 weeks: doses logged against doses expected on a
 * weekly cadence. One week alone is too coarse — a dose taken a day late would
 * read as either 0% or 200%.
 */
function medicationAdherence(logs: LogEntry[], now: number) {
  const weeks = 4;
  const since = now - weeks * 7 * DAY;
  const doses = logs.filter((l) => l.kind === 'dose' && l.at >= since && l.at <= now);
  if (!doses.length) return { pct: 0, verdict: 'No doses logged' };

  const value = Math.min(100, Math.round((doses.length / weeks) * 100));
  const verdict =
    value >= 95 ? 'Perfect' : value >= 80 ? 'Strong' : value >= 60 ? 'Patchy' : 'Needs work';
  return { pct: value, verdict };
}

export function buildWeeklyReport(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): WeeklyReport {
  const units = profile.settings.units;
  const score = weekScore(profile, logs, now);
  const weightChange = changeOverDays(logs, 7, now);

  // Fat / muscle split of THIS WEEK'S change.
  //
  // Differencing two independent body-composition snapshots does not work: each
  // snapshot is fitted to the whole history available to it, so the two are not
  // on a common basis and the parts fail to sum to the total — it produced
  // "muscle +1.5 lb" in a week, which is not physiologically plausible and is
  // exactly the kind of number that must never reach a shareable card.
  //
  // Instead the week's actual change is split by the model's own estimate of
  // what share of loss is lean, so fat + muscle always equals weight.
  const hasComp = computeBodyComp(profile, logs, now) != null;
  const leanShare = leanLossFraction(profile, logs, now);
  const muscleChange =
    hasComp && weightChange != null ? +(weightChange * leanShare).toFixed(2) : null;
  const fatChange =
    hasComp && weightChange != null && muscleChange != null
      ? +(weightChange - muscleChange).toFixed(2)
      : null;

  const med = medicationAdherence(logs, now);
  const { proteinPct, hydrationPct } = weekAverages(profile, logs, now);

  const { summary, summarySource } = buildSummary(profile, logs, now, units, score);

  const from = new Date(now - 6 * DAY);
  const to = new Date(now);
  const weekLabel = `${from.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${to.toLocaleDateString(
    undefined,
    { month: 'short', day: 'numeric' },
  )}`;

  // A card is only worth sharing once there is something on it. Two weigh-ins
  // and a few days of logging is the floor.
  const weekLogs = logs.filter((l) => l.at >= now - 7 * DAY);
  const hasEnoughData = weightSeries(logs).length >= 2 && weekLogs.length >= 3;

  return {
    weekLabel,
    score,
    grade: gradeFor(score),
    hasEnoughData,
    units,
    weightChange,
    fatChange,
    muscleChange,
    medicationPct: med.pct,
    medicationVerdict: med.verdict,
    proteinPct,
    hydrationPct,
    summary,
    summarySource,
    medicationName: getMedication(profile.medication).name,
  };
}

/**
 * The headline claim. Ordered so the strongest *true* statement wins, and every
 * branch names its source.
 */
function buildSummary(
  profile: Profile,
  logs: LogEntry[],
  now: number,
  units: Units,
  score: number,
): { summary: string; summarySource: string } {
  const leanShare = leanLossFraction(profile, logs, now);
  const weights = weightSeries(logs);

  // 1. Muscle preservation against the published lean-loss share.
  if (weights.length >= 4 && leanShare < TRIAL_LEAN_LOSS_SHARE) {
    const fatShare = Math.round((1 - leanShare) * 100);
    return {
      summary: `${fatShare}% of your loss came from fat. Published GLP-1 studies see up to 40% of weight lost as lean mass — you are protecting more muscle than that.`,
      summarySource: 'Compared with published GLP-1 body-composition data',
    };
  }

  // 2. Trial benchmark.
  const bench = computeBenchmark(profile, logs, now);
  if (bench && bench.verdict !== 'early') {
    const verb =
      bench.verdict === 'ahead' ? 'ahead of' : bench.verdict === 'on-track' ? 'in line with' : 'behind';
    return {
      summary: `You are ${bench.actualPct.toFixed(1)}% down at week ${bench.weeks} — ${verb} the ${bench.trialName} trial average of ${bench.expectedPct.toFixed(1)}%.`,
      summarySource: `Compared with the ${bench.trialName} trial`,
    };
  }

  // 3. Consistency.
  const week = changeOverDays(logs, 7, now);
  if (week != null && week < 0) {
    return {
      summary: `Down ${formatWeight(Math.abs(week), units)} ${units} this week with a metabolic score of ${score}. Consistency at this level is what makes the loss hold.`,
      summarySource: 'From your own logs this week',
    };
  }

  return {
    summary: `A metabolic score of ${score} this week. Keep logging and the trend sharpens fast.`,
    summarySource: 'From your own logs this week',
  };
}

/** Stable filename for the exported image. */
export const reportFilename = (now = Date.now()) => `calqulate-week-${dayKey(now)}.png`;
