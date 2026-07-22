/**
 * The Progress story.
 *
 * Everything the Progress tab needs to read as a transformation narrative
 * rather than a pile of charts: milestones with real dates, a monthly story,
 * the decision that actually moved the needle, achievements with real criteria,
 * and paired series for the correlation explorer.
 *
 * All of it is derived from logs. Nothing is scripted, and an achievement that
 * has not been earned is never shown as earned.
 */

import { DAY, startOfDay } from './dates';
import { estimateComposition, gatherInputs } from './composition';
import { computeScore } from './score';
import { correlate, type Correlation } from './stats';
import { totalChange, weightSeries } from './insights';
import { weeklySummaries } from './bodyModel';
import { toDisplay } from './units';
import type { LogEntry, Profile, Units } from '../store/types';

// ---------------------------------------------------------------------------
// Journey timeline
// ---------------------------------------------------------------------------

export type Milestone = {
  id: string;
  label: string;
  /** Null when not yet reached. */
  at: number | null;
  reached: boolean;
  icon: string;
  /** Shown instead of a date for the goal. */
  subtitle?: string;
};

/** The first moment cumulative loss crossed `amountLb`. */
function firstLossAt(logs: LogEntry[], startLb: number, amountLb: number): number | null {
  for (const w of weightSeries(logs)) {
    if (startLb - w.value >= amountLb) return w.t;
  }
  return null;
}

export function journeyMilestones(
  profile: Profile,
  logs: LogEntry[],
  units: Units,
  now = Date.now(),
): Milestone[] {
  if (!logs.length) return [];

  const first = Math.min(...logs.map((l) => l.at));
  const weights = weightSeries(logs);
  const startLb = profile.startWeight ?? weights[0]?.value ?? 0;
  const firstDose = logs.filter((l) => l.kind === 'dose').sort((a, b) => a.at - b.at)[0];

  // Thresholds in the user's own units, converted back to stored pounds.
  const perUnit = units === 'kg' ? 2.2046226218 : 1;
  const small = units === 'kg' ? 5 : 10;
  const big = units === 'kg' ? 10 : 25;

  const monthAt = first + 30 * DAY;

  const out: Milestone[] = [
    { id: 'started', label: 'Started', at: first, reached: true, icon: 'flag-outline' },
    {
      id: 'first-dose',
      label: 'First injection',
      at: firstDose?.at ?? null,
      reached: !!firstDose,
      icon: 'medkit-outline',
    },
    {
      id: 'small-loss',
      label: `Lost ${small} ${units}`,
      at: firstLossAt(logs, startLb, small * perUnit),
      reached: firstLossAt(logs, startLb, small * perUnit) != null,
      icon: 'trending-down-outline',
    },
    {
      id: 'first-month',
      label: 'First month',
      at: monthAt <= now ? monthAt : null,
      reached: monthAt <= now,
      icon: 'calendar-outline',
    },
    {
      id: 'big-loss',
      label: `${big} ${units} lost`,
      at: firstLossAt(logs, startLb, big * perUnit),
      reached: firstLossAt(logs, startLb, big * perUnit) != null,
      icon: 'star-outline',
    },
  ];

  if (profile.goalWeight != null) {
    const hit = weights.find((w) => w.value <= profile.goalWeight!);
    out.push({
      id: 'goal',
      label: 'Goal weight',
      at: hit?.t ?? null,
      reached: !!hit,
      icon: 'trophy-outline',
      subtitle: hit ? undefined : `${toDisplay(profile.goalWeight, units).toFixed(1)} ${units}`,
    });
  }

  return out;
}

// ---------------------------------------------------------------------------
// Monthly story
// ---------------------------------------------------------------------------

export type MonthlyStory = {
  label: string;
  weightLost: number | null;
  fatLost: number | null;
  musclePreserved: string;
  bestHabit: string | null;
  hardestDay: { at: number; why: string } | null;
  summary: string;
  days: number;
};

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' };

/**
 * The month as a story.
 *
 * "Best habit" is the score component with the highest average ratio, and
 * "hardest day" is the lowest-scoring day with something logged — a day with no
 * entries is an absence, not a struggle, and calling it "hardest" would be
 * putting words in the user's mouth.
 */
export function monthlyStory(
  profile: Profile,
  logs: LogEntry[],
  monthsAgo = 0,
  now = Date.now(),
): MonthlyStory | null {
  const ref = new Date(now);
  ref.setMonth(ref.getMonth() - monthsAgo);
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1).getTime();
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).getTime();

  const inMonth = logs.filter((l) => l.at >= start && l.at < end);
  if (inMonth.length < 5) return null;

  const weights = weightSeries(inMonth);
  const weightLost = weights.length >= 2 ? weights[weights.length - 1].value - weights[0].value : null;

  // Composition across the month, from the month's own behaviour.
  const upTo = logs.filter((l) => l.at < end);
  const { input, context } = gatherInputs(profile, upTo, Math.min(end, now), 30);
  const est = estimateComposition(input, context);
  const fatLost = weightLost != null ? +(weightLost * (est.fatPct / 100)).toFixed(2) : null;

  // Best habit: highest average component ratio across the month's days.
  const days = [...new Set(inMonth.map((l) => startOfDay(l.at)))].sort();
  const totals = new Map<string, { sum: number; label: string; n: number }>();
  let worst: { at: number; score: number } | null = null;

  for (const d of days) {
    const score = computeScore(profile, logs, d + 12 * 3600_000);
    for (const line of score.lines) {
      if (line.id === 'consistency') continue;
      const cur = totals.get(line.id) ?? { sum: 0, label: line.label, n: 0 };
      totals.set(line.id, { sum: cur.sum + line.ratio, label: line.label, n: cur.n + 1 });
    }
    if (!worst || score.total < worst.score) worst = { at: d, score: score.total };
  }

  const ranked = [...totals.values()].sort((a, b) => b.sum / b.n - a.sum / a.n);
  const bestHabit = ranked.length && ranked[0].sum / ranked[0].n >= 0.6 ? ranked[0].label : null;

  const musclePreserved = est.mpi >= 80 ? 'Excellent' : est.mpi >= 65 ? 'Good' : est.mpi >= 45 ? 'Fair' : 'At risk';

  const summary =
    weightLost != null && weightLost < 0
      ? days.length >= 20
        ? 'Your most consistent month yet — the habits are doing the work.'
        : 'Real progress. More logging days would sharpen the picture.'
      : days.length >= 20
        ? 'The scale held, but your consistency did not slip. That is how plateaus break.'
        : 'A quieter month. The trend picks up as soon as the logging does.';

  return {
    label: new Date(start).toLocaleDateString(undefined, MONTH_FORMAT),
    weightLost,
    fatLost,
    musclePreserved,
    bestHabit,
    hardestDay: worst ? { at: worst.at, why: `Score ${worst.score}` } : null,
    summary,
    days: days.length,
  };
}

// ---------------------------------------------------------------------------
// Decision replay
// ---------------------------------------------------------------------------

export type DecisionReplay = {
  change: string;
  effect: string;
  gainPp: number;
  confidence: 'Low' | 'Moderate' | 'Good';
  weeksBefore: number;
  weeksAfter: number;
};

/**
 * The change that actually moved the needle.
 *
 * Splits the user's weeks at the point a behaviour changed most, and compares
 * fat-loss efficiency either side. Requires several weeks on both sides — a
 * single good week after a change is a coincidence, not a decision.
 */
export function decisionReplay(
  profile: Profile,
  logs: LogEntry[],
  now = Date.now(),
): DecisionReplay | null {
  const weeks = weeklySummaries(profile, logs, now);
  if (weeks.length < 6) return null;

  const candidates: { key: keyof typeof weeks[0]; label: string; effect: string }[] = [
    { key: 'strengthSessions', label: 'Started resistance training', effect: 'Fat-loss efficiency' },
    { key: 'proteinG', label: 'Raised your protein', effect: 'Muscle preservation' },
    { key: 'sleepH', label: 'Started sleeping more', effect: 'Recovery' },
    { key: 'waterMl', label: 'Improved hydration', effect: 'Symptom load' },
  ];

  let best: DecisionReplay | null = null;

  for (const cand of candidates) {
    // Find the split maximising the jump in this behaviour.
    for (let split = 3; split <= weeks.length - 3; split++) {
      const before = weeks.slice(0, split);
      const after = weeks.slice(split);

      const avg = (ws: typeof weeks, k: typeof cand.key) =>
        ws.reduce((s, w) => s + (w[k] as number), 0) / ws.length;

      const behaviourJump = avg(after, cand.key) - avg(before, cand.key);
      if (behaviourJump <= 0) continue;

      // Only meaningful jumps count.
      const relative = behaviourJump / Math.max(1, avg(before, cand.key) || 1);
      if (relative < 0.35) continue;

      const gain = avg(after, 'efficiency') - avg(before, 'efficiency');
      if (gain < 1) continue;

      if (!best || gain > best.gainPp) {
        best = {
          change: cand.label,
          effect: cand.effect,
          gainPp: +gain.toFixed(1),
          confidence: weeks.length >= 16 ? 'Good' : weeks.length >= 10 ? 'Moderate' : 'Low',
          weeksBefore: before.length,
          weeksAfter: after.length,
        };
      }
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  earned: boolean;
  /** Progress toward earning it, 0-1. */
  progress: number;
  icon: string;
  tint: 'green' | 'blue' | 'violet' | 'gold' | 'teal';
};

const daysMeeting = (logs: LogEntry[], kind: LogEntry['kind'], goal: number) => {
  const byDay = new Map<number, number>();
  for (const l of logs) {
    if (l.kind !== kind) continue;
    const d = startOfDay(l.at);
    byDay.set(d, (byDay.get(d) ?? 0) + l.value);
  }
  return [...byDay.values()].filter((v) => v >= goal).length;
};

export function achievements(
  profile: Profile,
  logs: LogEntry[],
  units: Units,
  now = Date.now(),
): Achievement[] {
  const lost = totalChange(profile, logs);
  const lostShown = lost != null ? -toDisplay(lost, units) : 0;
  const bigTarget = units === 'kg' ? 10 : 25;

  const proteinDays = daysMeeting(logs, 'meal', profile.goals.proteinG);
  const waterDays = daysMeeting(logs, 'water', profile.goals.waterMl);

  // A perfect medication month: four doses inside the last 28 days.
  const doses28 = logs.filter((l) => l.kind === 'dose' && l.at >= now - 28 * DAY).length;

  const { input, context } = gatherInputs(profile, logs, now);
  const est = estimateComposition(input, context);

  // Consistency: longest run of consecutive days with any entry.
  const days = [...new Set(logs.map((l) => startOfDay(l.at)))].sort();
  let run = 0;
  let longest = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] - days[i - 1] === DAY ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  const mk = (
    id: string,
    title: string,
    detail: string,
    value: number,
    target: number,
    icon: string,
    tint: Achievement['tint'],
  ): Achievement => ({
    id,
    title,
    detail,
    earned: value >= target,
    progress: Math.max(0, Math.min(1, value / target)),
    icon,
    tint,
  });

  return [
    mk('big-loss', `${bigTarget} ${units} Down`, `${Math.max(0, lostShown).toFixed(1)} of ${bigTarget} ${units}`, lostShown, bigTarget, 'scale-outline', 'green'),
    mk('protein-100', '100 Protein Days', `${proteinDays} of 100 days at target`, proteinDays, 100, 'restaurant-outline', 'blue'),
    mk('perfect-month', 'Perfect Medication Month', `${doses28} of 4 doses in 28 days`, doses28, 4, 'medkit-outline', 'violet'),
    mk('muscle-guardian', 'Muscle Guardian', `Preservation index ${est.mpi} of 80`, est.mpi, 80, 'shield-checkmark-outline', 'gold'),
    mk('hydration', 'Hydration Master', `${waterDays} of 30 days at target`, waterDays, 30, 'water-outline', 'teal'),
    mk('consistency', 'Consistency King', `Longest streak ${longest} of 30 days`, longest, 30, 'flame-outline', 'green'),
  ];
}

// ---------------------------------------------------------------------------
// Correlation explorer
// ---------------------------------------------------------------------------

export type MetricId = 'protein' | 'water' | 'sleep' | 'activity' | 'symptom' | 'weight' | 'medication';

export const METRICS: { id: MetricId; label: string; kind: LogEntry['kind']; mean?: boolean }[] = [
  { id: 'protein', label: 'Protein', kind: 'meal' },
  { id: 'water', label: 'Hydration', kind: 'water' },
  { id: 'sleep', label: 'Sleep', kind: 'sleep', mean: true },
  { id: 'activity', label: 'Activity', kind: 'activity' },
  { id: 'symptom', label: 'Symptoms', kind: 'symptom', mean: true },
  { id: 'weight', label: 'Weight', kind: 'weight', mean: true },
];

function seriesFor(logs: LogEntry[], id: MetricId): Map<number, number> {
  const spec = METRICS.find((m) => m.id === id);
  if (!spec) return new Map();

  const acc = new Map<number, { total: number; n: number }>();
  for (const l of logs) {
    if (l.kind !== spec.kind) continue;
    const d = startOfDay(l.at);
    const cur = acc.get(d) ?? { total: 0, n: 0 };
    acc.set(d, { total: cur.total + l.value, n: cur.n + 1 });
  }
  return new Map([...acc].map(([d, v]) => [d, spec.mean ? v.total / v.n : v.total]));
}

export type Explored = {
  points: { x: number; y: number }[];
  stat: Correlation | null;
  xLabel: string;
  yLabel: string;
};

/**
 * Removes the linear time trend from a series.
 *
 * Without this the explorer is a spurious-correlation machine. Over a
 * successful few months protein drifts up while weight drifts down, so the two
 * correlate at r = -0.87 purely because both move with time — and the app would
 * present that as "your protein is driving your loss". Detrending both series
 * first asks the question the user actually means: on days you ate *more than
 * usual for that point in your journey*, was the other measure unusual too?
 */
function detrend(entries: [number, number][]): Map<number, number> {
  const n = entries.length;
  if (n < 3) return new Map(entries);

  const t0 = entries[0][0];
  const xs = entries.map(([t]) => (t - t0) / DAY);
  const ys = entries.map(([, v]) => v);
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;

  // Residual around the trend, recentred so the scatter still reads naturally.
  return new Map(entries.map(([t], i) => [t, ys[i] - (my + slope * (xs[i] - mx)) + my]));
}

/**
 * Paired daily values for two metrics, for a scatter plot.
 *
 * A scatter rather than two lines on one chart: a dual-axis chart lets any two
 * series be made to look related by choosing the scales, which is exactly the
 * wrong tool for a feature whose entire job is judging whether a relationship
 * is real. Both series are detrended first — see `detrend`.
 */
export function explore(logs: LogEntry[], x: MetricId, y: MetricId): Explored {
  const rawX = [...seriesFor(logs, x)].sort((a, b) => a[0] - b[0]);
  const rawY = [...seriesFor(logs, y)].sort((a, b) => a[0] - b[0]);
  const xs = detrend(rawX);
  const ys = detrend(rawY);

  const points: { x: number; y: number }[] = [];
  for (const [day, xv] of xs) {
    const yv = ys.get(day);
    if (yv != null) points.push({ x: xv, y: yv });
  }

  return {
    points,
    stat: correlate(points.map((p) => p.x), points.map((p) => p.y)),
    xLabel: METRICS.find((m) => m.id === x)?.label ?? x,
    yLabel: METRICS.find((m) => m.id === y)?.label ?? y,
  };
}
