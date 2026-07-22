/**
 * Pattern discovery — week 2 of Body Intelligence.
 *
 * "Your nausea appears mostly 24 hours after injection" is the moment a user
 * decides the app understands them. It is also the moment it is easiest to lose
 * them for good, because a confident-sounding pattern drawn from six data
 * points is a lie that happens to be well-formatted.
 *
 * So every pattern here obeys three rules:
 *
 *   1. **A minimum sample.** Nothing is reported below `MIN_PAIRS` paired
 *      observations. Correlations over a handful of days are noise.
 *   2. **A minimum effect.** A weak relationship is not surfaced at all,
 *      rather than surfaced with a hedge nobody reads.
 *   3. **Association, never causation.** The copy says "tracks with" and
 *      "tends to", because that is all a correlation earns.
 *
 * Each pattern carries its own sample size so the UI can show the user exactly
 * how much evidence sits behind it.
 */

import { DAY, startOfDay } from './dates';
import { computeToday } from './insights';
import type { LogEntry, Profile } from '../store/types';

/** Below this many paired days, nothing is reported. */
export const MIN_PAIRS = 10;
/** Below this |r|, the relationship is too weak to be worth a card. */
const MIN_R = 0.35;
/** Symptom-timing needs this many symptom entries after a dose. */
const MIN_SYMPTOM_EVENTS = 5;

export type Pattern = {
  id: string;
  title: string;
  detail: string;
  /** Paired observations behind the claim. */
  n: number;
  /** Pearson r, when the pattern is a correlation. */
  r?: number;
  strength: 'strong' | 'moderate';
  icon: string;
};

/** Pearson correlation. Returns null when the sample or the variance is too small. */
export function pearson(xs: number[], ys: number[]): { r: number; n: number } | null {
  const n = Math.min(xs.length, ys.length);
  if (n < MIN_PAIRS) return null;

  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;

  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null; // no variance — a flat line correlates with nothing

  const r = num / Math.sqrt(dx * dy);
  return Number.isFinite(r) ? { r, n } : null;
}

const strengthOf = (r: number): Pattern['strength'] => (Math.abs(r) >= 0.6 ? 'strong' : 'moderate');

/** Daily totals for a log kind, keyed by day start. */
function dailyTotals(logs: LogEntry[], kind: LogEntry['kind']): Map<number, number> {
  const out = new Map<number, number>();
  for (const l of logs) {
    if (l.kind !== kind) continue;
    const d = startOfDay(l.at);
    out.set(d, (out.get(d) ?? 0) + l.value);
  }
  return out;
}

/** Daily mean for a log kind — severity and sleep are averages, not sums. */
function dailyMeans(logs: LogEntry[], kind: LogEntry['kind']): Map<number, number> {
  const sums = new Map<number, { total: number; count: number }>();
  for (const l of logs) {
    if (l.kind !== kind) continue;
    const d = startOfDay(l.at);
    const cur = sums.get(d) ?? { total: 0, count: 0 };
    sums.set(d, { total: cur.total + l.value, count: cur.count + 1 });
  }
  return new Map([...sums].map(([d, v]) => [d, v.total / v.count]));
}

/** Pairs two daily series on the days both exist. */
function pair(a: Map<number, number>, b: Map<number, number>, offsetDays = 0) {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [day, x] of a) {
    const y = b.get(day + offsetDays * DAY);
    if (y != null) {
      xs.push(x);
      ys.push(y);
    }
  }
  return { xs, ys };
}

/**
 * When symptoms cluster relative to the last injection.
 *
 * More useful than a correlation because it is concrete and actionable, and it
 * is a straight count rather than an inferred statistic.
 */
export function symptomTiming(logs: LogEntry[]): Pattern | null {
  const doses = logs.filter((l) => l.kind === 'dose').sort((a, b) => a.at - b.at);
  if (!doses.length) return null;

  // Only symptoms that actually reported something.
  const symptoms = logs.filter((l) => l.kind === 'symptom' && l.value > 0);
  if (symptoms.length < MIN_SYMPTOM_EVENTS) return null;

  const buckets = [0, 0, 0, 0]; // 0-24h, 24-48h, 48-96h, 96h+
  let counted = 0;

  for (const s of symptoms) {
    const prior = doses.filter((d) => d.at <= s.at).pop();
    if (!prior) continue;
    const hours = (s.at - prior.at) / 3600_000;
    if (hours > 168) continue; // beyond a cycle, the link is meaningless
    counted++;
    if (hours < 24) buckets[0]++;
    else if (hours < 48) buckets[1]++;
    else if (hours < 96) buckets[2]++;
    else buckets[3]++;
  }

  if (counted < MIN_SYMPTOM_EVENTS) return null;

  const labels = ['the first 24 hours', '24 to 48 hours', '2 to 4 days', 'late in the week'];
  const top = buckets.indexOf(Math.max(...buckets));
  const share = buckets[top] / counted;
  if (share < 0.45) return null; // no clear clustering

  return {
    id: 'symptom-timing',
    title: 'Your side effects have a schedule',
    detail: `${Math.round(share * 100)}% of your symptom entries land in ${labels[top]} after an injection. Planning lighter meals for that window usually helps.`,
    n: counted,
    strength: share >= 0.6 ? 'strong' : 'moderate',
    icon: 'time-outline',
  };
}

/** Protein intake against the following day's weight change. */
function proteinVsWeight(logs: LogEntry[]): Pattern | null {
  const protein = dailyTotals(logs, 'meal');
  const weights = dailyMeans(logs, 'weight');

  // Day-over-day weight change, keyed by the later day.
  const changes = new Map<number, number>();
  const days = [...weights.keys()].sort((a, b) => a - b);
  for (let i = 1; i < days.length; i++) {
    if (days[i] - days[i - 1] > 2 * DAY) continue; // gap too wide to attribute
    changes.set(days[i], weights.get(days[i])! - weights.get(days[i - 1])!);
  }

  const { xs, ys } = pair(protein, changes, 1);
  const stat = pearson(xs, ys);
  if (!stat || Math.abs(stat.r) < MIN_R) return null;

  const helping = stat.r < 0; // more protein, more weight lost next day
  return {
    id: 'protein-weight',
    title: helping ? 'Protein tracks with your losses' : 'Higher protein days precede flat days',
    detail: helping
      ? `On days you eat more protein, the next morning's weight tends to be lower. Association across ${stat.n} paired days, not proof of cause.`
      : `Your higher-protein days tend to be followed by flatter mornings — often just water shifting. Association across ${stat.n} paired days.`,
    n: stat.n,
    r: stat.r,
    strength: strengthOf(stat.r),
    icon: 'nutrition-outline',
  };
}

/** Sleep against next-day symptom severity. */
function sleepVsSymptoms(logs: LogEntry[]): Pattern | null {
  const sleep = dailyMeans(logs, 'sleep');
  const severity = dailyMeans(logs, 'symptom');

  const { xs, ys } = pair(sleep, severity, 1);
  const stat = pearson(xs, ys);
  if (!stat || Math.abs(stat.r) < MIN_R) return null;
  if (stat.r > 0) return null; // only report the useful direction

  return {
    id: 'sleep-symptoms',
    title: 'Short nights show up as symptoms',
    detail: `After your shorter nights, you tend to report stronger symptoms the next day. Association across ${stat.n} paired days.`,
    n: stat.n,
    r: stat.r,
    strength: strengthOf(stat.r),
    icon: 'moon-outline',
  };
}

/** Hydration against same-day symptom severity. */
function hydrationVsSymptoms(logs: LogEntry[]): Pattern | null {
  const water = dailyTotals(logs, 'water');
  const severity = dailyMeans(logs, 'symptom');

  const { xs, ys } = pair(water, severity);
  const stat = pearson(xs, ys);
  if (!stat || Math.abs(stat.r) < MIN_R || stat.r > 0) return null;

  return {
    id: 'hydration-symptoms',
    title: 'Water settles your stomach',
    detail: `Your better-hydrated days tend to be your easier ones. Association across ${stat.n} paired days.`,
    n: stat.n,
    r: stat.r,
    strength: strengthOf(stat.r),
    icon: 'water-outline',
  };
}

/** Medication coverage against symptom severity. */
function coverageVsSymptoms(profile: Profile, logs: LogEntry[]): Pattern | null {
  const severity = dailyMeans(logs, 'symptom');
  if (severity.size < MIN_PAIRS) return null;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const [day, sev] of severity) {
    xs.push(computeToday(profile, logs, day + 12 * 3600_000).medicationLevel);
    ys.push(sev);
  }

  const stat = pearson(xs, ys);
  if (!stat || Math.abs(stat.r) < MIN_R) return null;

  return {
    id: 'coverage-symptoms',
    title: 'Symptoms follow your dose cycle',
    detail:
      stat.r > 0
        ? `Your symptoms are stronger when medication levels are high — most common in the days right after an injection. Across ${stat.n} days.`
        : `Your symptoms ease as medication levels rise. Across ${stat.n} days.`,
    n: stat.n,
    r: stat.r,
    strength: strengthOf(stat.r),
    icon: 'pulse-outline',
  };
}

/** Every pattern with enough evidence, strongest first. */
export function findPatterns(profile: Profile, logs: LogEntry[]): Pattern[] {
  return [
    symptomTiming(logs),
    proteinVsWeight(logs),
    sleepVsSymptoms(logs),
    hydrationVsSymptoms(logs),
    coverageVsSymptoms(profile, logs),
  ]
    .filter((p): p is Pattern => p !== null)
    .sort((a, b) => Math.abs(b.r ?? 0.5) - Math.abs(a.r ?? 0.5));
}

/**
 * How close the user is to their first pattern, for the "still learning"
 * state. Patterns need paired days, so this counts days with two or more
 * different kinds logged.
 */
export function pairedDayCount(logs: LogEntry[]): number {
  const kindsByDay = new Map<number, Set<string>>();
  for (const l of logs) {
    const d = startOfDay(l.at);
    if (!kindsByDay.has(d)) kindsByDay.set(d, new Set());
    kindsByDay.get(d)!.add(l.kind);
  }
  return [...kindsByDay.values()].filter((s) => s.size >= 2).length;
}
