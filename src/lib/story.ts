/**
 * Weekly Health Story data — one insight per card, computed from the logs.
 */

import { DAY, startOfDay } from './dates';
import { changeOverDays } from './insights';
import { leanLossFraction } from './bodycomp';
import { computeScore } from './score';
import { formatWeight } from './units';
import type { LogEntry, Profile } from '../store/types';
import type { StoryCard } from '../components/StoryCards';

export function weeklyStory(profile: Profile, logs: LogEntry[], now = Date.now()): StoryCard[] {
  const cards: StoryCard[] = [];
  const units = profile.settings.units;

  const week = changeOverDays(logs, 7, now);
  if (week != null && week < 0) {
    const fatShare = Math.round((1 - leanLossFraction(profile, logs, now)) * 100);
    cards.push({
      icon: 'trending-down',
      kicker: 'This week',
      value: `−${formatWeight(Math.abs(week), units)} ${units}`,
      message: `You lost ${formatWeight(Math.abs(week), units)} ${units} — an estimated ${fatShare}% of it was body fat.`,
    });
  } else if (week != null) {
    cards.push({
      icon: 'analytics',
      kicker: 'This week',
      value: `${week >= 0 ? '+' : ''}${formatWeight(week, units)} ${units}`,
      message:
        'Weight held steady this week. Plateaus are a normal part of the journey — consistency is what breaks them.',
    });
  }

  // Protein: average of daily totals vs goal over the last 7 days.
  const cutoff = startOfDay(now) - 7 * DAY;
  const byDay = new Map<number, number>();
  for (const l of logs) {
    if (l.kind !== 'meal' || l.at < cutoff) continue;
    const d = startOfDay(l.at);
    byDay.set(d, (byDay.get(d) ?? 0) + l.value);
  }
  if (byDay.size > 0 && profile.goals.proteinG > 0) {
    const avg = [...byDay.values()].reduce((a, b) => a + b, 0) / byDay.size;
    const pct = Math.min(150, Math.round((avg / profile.goals.proteinG) * 100));
    cards.push({
      icon: 'restaurant',
      kicker: 'Protein',
      value: `${pct}%`,
      message:
        pct >= 90
          ? 'Great job. Protein like this is what protects your muscle while the fat comes off.'
          : pct >= 60
            ? 'Solid week. A little more protein would push muscle protection even higher.'
            : 'Protein ran low this week — that raises the share of loss that comes from muscle.',
    });
  }

  // Medication adherence: a weekly medication expects one dose per 7 days.
  const doses7 = logs.filter((l) => l.kind === 'dose' && l.at >= now - 7 * DAY).length;
  if (logs.some((l) => l.kind === 'dose')) {
    cards.push({
      icon: 'medkit',
      kicker: 'Medication',
      value: doses7 >= 1 ? '100%' : '0%',
      message:
        doses7 >= 1
          ? 'Perfect adherence. Steady levels are what keep appetite quiet all week.'
          : 'No dose logged in the last 7 days. If you took one, log it so your curve stays accurate.',
    });
  }

  // Metabolic score now vs a week ago.
  const scoreNow = computeScore(profile, logs, now).total;
  const scoreThen = computeScore(profile, logs, now - 7 * DAY).total;
  const delta = scoreNow - scoreThen;
  cards.push({
    icon: 'pulse',
    kicker: 'Metabolic score',
    value: `${scoreNow}`,
    message:
      delta > 0
        ? `Up ${delta} points from last week. Your habits are compounding.`
        : delta < 0
          ? `Down ${Math.abs(delta)} from last week — one strong day gets it back.`
          : 'Holding steady. Consistency is the whole game.',
    tone: 'pro',
  });

  return cards;
}
