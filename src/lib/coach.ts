/**
 * Personal Coach.
 *
 * Watches the dashboard the way a good clinician would: not "you drank 1.7 L",
 * but "your loss stalled for 12 days and your protein is short — here is the one
 * thing to change". It runs on every render from data already on the device, so
 * it works offline and costs nothing.
 *
 * Rules are ordered by clinical seriousness, and the first match wins. Muscle
 * loss outranks a stall, a stall outranks a slow week, and anything real
 * outranks praise — a coach that congratulates you while you are losing muscle
 * is worse than no coach.
 */

import { DAY } from './dates';
import { computeBodyComp, leanLossFraction } from './bodycomp';
import { changeOverDays, detectPlateau, weightSeries } from './insights';
import { toDisplay } from './units';
import type { LogEntry, Profile } from '../store/types';
import type { MetabolicScore } from './score';

export type CoachStatus = 'on_track' | 'watch' | 'alert' | 'celebrate' | 'setup';

export type CoachInsight = {
  status: CoachStatus;
  /** Short verdict, e.g. "You're on track". */
  headline: string;
  /** One sentence of why, in plain language. */
  detail: string;
  /** The single most useful next step, when there is one. */
  action?: string;
  /** Quick-add kind the action routes to. */
  actionKind?: LogEntry['kind'];
};

/** Weekly loss outside this band is worth commenting on. */
const HEALTHY_WEEKLY_LOSS_LB = { min: 0.5, max: 2.5 };
/** Above this share of loss coming from lean mass, muscle is at risk. */
const LEAN_LOSS_ALARM = 0.4;

/** Average loss per week in pounds, over the trailing `days`. Negative = losing. */
export function avgWeeklyLoss(logs: LogEntry[], days = 30, now = Date.now()) {
  const window = weightSeries(logs).filter((w) => w.t >= now - days * DAY);
  if (window.length < 2) return null;
  const first = window[0];
  const last = window[window.length - 1];
  const spanDays = (last.t - first.t) / DAY;
  if (spanDays < 3) return null;
  return ((last.value - first.value) / spanDays) * 7;
}

export function coachInsight(
  profile: Profile,
  logs: LogEntry[],
  score: MetabolicScore,
  now = Date.now(),
): CoachInsight {
  const units = profile.settings.units;
  const weights = weightSeries(logs);
  const weekly = avgWeeklyLoss(logs, 30, now);
  const show = (lb: number, digits = 1) => Math.abs(toDisplay(lb, units)).toFixed(digits);

  // Nothing to coach on yet.
  if (weights.length < 2) {
    return {
      status: 'setup',
      headline: "Let's get your baseline",
      detail:
        'Log a weigh-in on two different days and I can start telling you whether your plan is working.',
      action: 'Log a weigh-in',
      actionKind: 'weight',
    };
  }

  // 1. Muscle loss — the thing this product exists to prevent.
  const comp = computeBodyComp(profile, logs);
  const leanShare = leanLossFraction(profile, logs);
  if (comp && leanShare > LEAN_LOSS_ALARM && weights.length >= 6) {
    return {
      status: 'alert',
      headline: 'Protect your muscle',
      detail: `About ${Math.round(leanShare * 100)}% of what you have lost looks like lean mass, not fat. Muscle is what keeps the weight off.`,
      action: `Hit ${profile.goals.proteinG} g of protein today and add a strength session`,
      actionKind: 'meal',
    };
  }

  // 2. Losing too fast — usually under-eating, and the fastest route to muscle loss.
  if (weekly != null && toDisplay(-weekly, units) > toDisplay(HEALTHY_WEEKLY_LOSS_LB.max, units)) {
    return {
      status: 'watch',
      headline: 'That is faster than ideal',
      detail: `You are averaging ${show(weekly)} ${units} a week. Above about ${show(HEALTHY_WEEKLY_LOSS_LB.max)} ${units} the body starts taking more from muscle.`,
      action: 'Raise protein and eat a little more today',
      actionKind: 'meal',
    };
  }

  // 3. Plateau — reuses the shared detector so the coach and the Progress
  // screen can never disagree about whether the user has stalled.
  const plateau = detectPlateau(profile, logs, now);
  if (plateau) {
    const proteinShort = score.lines.find((l) => l.id === 'protein');
    return {
      status: 'watch',
      headline: 'Your loss has stalled',
      detail: `Weight has held steady for ${plateau.days} days. ${plateau.reason}`,
      action:
        proteinShort && proteinShort.ratio < 0.8
          ? 'Start by closing your protein gap'
          : 'Check your dose timing with your prescriber',
      actionKind: proteinShort && proteinShort.ratio < 0.8 ? 'meal' : undefined,
    };
  }

  // 4. Gaining.
  if (weekly != null && weekly > 0.3) {
    return {
      status: 'alert',
      headline: 'Trending up',
      detail: `You are up ${show(weekly)} ${units} a week on average. One heavy day is noise, but a month of this is a pattern worth catching early.`,
      action: 'Log meals for a few days so we can see what changed',
      actionKind: 'meal',
    };
  }

  // 5. Habits are slipping even though the scale looks fine.
  //
  // Only judge habits when there is habit data to judge. Someone who logs
  // nothing but weight has a low score through absence, not through slipping,
  // and telling them otherwise is both wrong and discouraging.
  const habitsTracked = logs.some(
    (l) => l.at >= now - 3 * DAY && l.kind !== 'weight' && l.kind !== 'photo',
  );
  if (habitsTracked && score.total < 50) {
    const worst = [...score.lines]
      .filter((l) => l.max >= 10)
      .sort((a, b) => a.ratio - b.ratio)[0];
    return {
      status: 'watch',
      headline: 'Your habits are slipping',
      detail: `Today's score is ${score.total}. ${worst ? `${worst.label} is the weakest at ${worst.earned} of ${worst.max}.` : ''}`,
      action: score.actions[0]?.title,
      actionKind: score.actions[0]?.kind,
    };
  }

  // 6. Genuinely excellent — worth saying out loud.
  const week7 = changeOverDays(logs, 7, now);
  if (score.total >= 85 && week7 != null && week7 < 0) {
    return {
      status: 'celebrate',
      headline: 'Great — you are on track',
      detail: `Down ${show(week7)} ${units} this week with a score of ${score.total}. This is exactly the pattern that holds.`,
      action: score.actions[0]?.title,
      actionKind: score.actions[0]?.kind,
    };
  }

  // 7. Default: steady progress.
  return {
    status: 'on_track',
    headline: 'You are on track',
    detail:
      weekly != null && weekly < 0
        ? `Averaging ${show(weekly)} ${units} a week — right in the healthy range.`
        : 'Keep logging and your trend will sharpen over the next few days.',
    action: score.actions[0]?.title,
    actionKind: score.actions[0]?.kind,
  };
}
