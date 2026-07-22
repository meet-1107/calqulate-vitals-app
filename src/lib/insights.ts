import { getMedication } from './medications';
import { formatWeight } from './units';
import { levelPercent } from './pk';
import { DAY, isSameDay, nextInjection, startOfDay } from './dates';
import type { LogEntry, Profile } from '../store/types';

export type Today = {
  weight: number | null;
  weightDelta: number | null;
  waterMl: number;
  proteinG: number;
  medicationLevel: number;
  nextInjection: Date | null;
  hydrationPct: number;
  proteinPct: number;
};

const sumOn = (logs: LogEntry[], kind: LogEntry['kind'], at: number) =>
  logs.filter((l) => l.kind === kind && isSameDay(l.at, at)).reduce((s, l) => s + l.value, 0);

export function weightSeries(logs: LogEntry[]) {
  return logs
    .filter((l) => l.kind === 'weight')
    .sort((a, b) => a.at - b.at)
    .map((l) => ({ t: l.at, value: l.value }));
}

export function computeToday(profile: Profile, logs: LogEntry[], now = Date.now()): Today {
  const weights = weightSeries(logs);
  const latest = weights.at(-1) ?? null;
  const previous = weights.at(-2) ?? null;

  const med = getMedication(profile.medication);
  const doses = logs
    .filter((l) => l.kind === 'dose')
    .map((l) => ({ takenAt: l.at, amountMg: l.value }));

  const waterMl = sumOn(logs, 'water', now);
  const proteinG = sumOn(logs, 'meal', now);

  return {
    weight: latest?.value ?? null,
    weightDelta: latest && previous ? latest.value - previous.value : null,
    waterMl,
    proteinG,
    medicationLevel: levelPercent(doses, now, med.halfLifeHours, profile.doseMg ?? 0),
    nextInjection: nextInjection(profile.injectionDay, profile.injectionHour, now),
    hydrationPct: Math.min(100, Math.round((waterMl / profile.goals.waterMl) * 100)),
    proteinPct: Math.min(100, Math.round((proteinG / profile.goals.proteinG) * 100)),
  };
}

/** Total change since the first logged weigh-in (or onboarding start weight). */
export function totalChange(profile: Profile, logs: LogEntry[]) {
  const weights = weightSeries(logs);
  const start = weights[0]?.value ?? profile.startWeight;
  const latest = weights.at(-1)?.value ?? profile.startWeight;
  if (start == null || latest == null) return null;
  return latest - start;
}

export function goalProgress(profile: Profile, logs: LogEntry[]) {
  const { startWeight, goalWeight } = profile;
  const latest = weightSeries(logs).at(-1)?.value ?? startWeight;
  if (startWeight == null || goalWeight == null || latest == null) return 0;
  const span = startWeight - goalWeight;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((startWeight - latest) / span) * 100)));
}

/** Change over the trailing `days` window. */
export function changeOverDays(logs: LogEntry[], days: number, now = Date.now()) {
  const cutoff = startOfDay(now) - days * DAY;
  const window = weightSeries(logs).filter((w) => w.t >= cutoff);
  if (window.length < 2) return null;
  return window[window.length - 1].value - window[0].value;
}

/**
 * Projected date the goal weight is reached, from the slope of the trailing
 * 28 days. Returns null when the trend is flat, rising, or too thin to fit —
 * a confident-looking date drawn from three data points would be a lie.
 */
export function projectGoalDate(profile: Profile, logs: LogEntry[], now = Date.now()) {
  const { goalWeight } = profile;
  if (goalWeight == null) return null;

  const window = weightSeries(logs).filter((w) => w.t >= now - 28 * DAY);
  if (window.length < 4) return null;

  const days = window.map((w) => (w.t - window[0].t) / DAY);
  const meanX = days.reduce((a, b) => a + b, 0) / days.length;
  const meanY = window.reduce((s, w) => s + w.value, 0) / window.length;

  const denom = days.reduce((s, x) => s + (x - meanX) ** 2, 0);
  if (denom === 0) return null;

  const slope =
    days.reduce((s, x, i) => s + (x - meanX) * (window[i].value - meanY), 0) / denom;
  if (slope >= -0.01) return null; // not losing

  const latest = window[window.length - 1].value;
  if (latest <= goalWeight) return null;

  const daysOut = (latest - goalWeight) / -slope;
  if (!Number.isFinite(daysOut) || daysOut > 365 * 3) return null;
  return new Date(now + daysOut * DAY);
}

export type CyclePhase = 'rising' | 'peak' | 'declining' | 'trough' | 'overdue' | 'none';

export type TodayForecast = {
  phase: CyclePhase;
  appetite: string;
  sideEffects: string;
  energy: string;
  headline: string;
};

/**
 * Today Forecast — where the user is in the dose cycle and what that usually
 * feels like. Same phase classification as calqulate.net's forecast engine:
 * the first ~1.5 days after a shot cluster the GI side effects; appetite is
 * best suppressed near peak; food noise returns at the trough.
 */
export function todayForecast(profile: Profile, logs: LogEntry[], now = Date.now()): TodayForecast {
  const lastDose = logs
    .filter((l) => l.kind === 'dose' && l.at <= now)
    .sort((a, b) => b.at - a.at)[0];

  if (!lastDose) {
    return {
      phase: 'none',
      appetite: 'Unknown',
      sideEffects: 'Unknown',
      energy: 'Unknown',
      headline: 'Log your first dose and the daily forecast starts here.',
    };
  }

  const intervalH = 168; // weekly cadence
  const f = (now - lastDose.at) / (intervalH * 3600_000);
  const pct = computeToday(profile, logs, now).medicationLevel;

  let phase: CyclePhase;
  if (f > 1.15) phase = 'overdue';
  else if (f < 0.22) phase = 'rising';
  else if (pct >= 82 && f < 0.5) phase = 'peak';
  else if (pct < 60 || f >= 0.8) phase = 'trough';
  else phase = 'declining';

  const map: Record<CyclePhase, Omit<TodayForecast, 'phase'>> = {
    rising: {
      appetite: 'Dropping',
      sideEffects: 'Elevated',
      energy: 'May dip',
      headline:
        'Fresh dose on board. Appetite is falling, but the next day or two is when nausea clusters — eat small, hydrate, go easy on fatty food.',
    },
    peak: {
      appetite: 'Well suppressed',
      sideEffects: 'Low',
      energy: 'Steady',
      headline:
        'You are at peak coverage — appetite should be quiet. Front-load protein today while eating is easy.',
    },
    declining: {
      appetite: 'Gradually returning',
      sideEffects: 'Low',
      energy: 'Steady',
      headline: 'Mid-cycle. Appetite creeps back from here — plan meals before hunger decides for you.',
    },
    trough: {
      appetite: 'Returning',
      sideEffects: 'Minimal',
      energy: 'Normal',
      headline:
        'Coverage is low ahead of your next dose. Expect food noise today — a protein-heavy breakfast blunts it.',
    },
    overdue: {
      appetite: 'Back',
      sideEffects: 'Minimal',
      energy: 'Normal',
      headline: 'Your dose is overdue. Take it when you can and log it so the curve stays accurate.',
    },
    none: { appetite: '—', sideEffects: '—', energy: '—', headline: '' },
  };

  return { phase, ...map[phase] };
}

export type Plateau = {
  days: number;
  reason: string;
};

/**
 * Plateau detection: the trailing window is flat (≤0.15% of body weight per
 * week either way) after a period of real loss. Needs enough weigh-ins that
 * "flat" is a trend, not noise.
 */
export function detectPlateau(profile: Profile, logs: LogEntry[], now = Date.now()): Plateau | null {
  const weights = weightSeries(logs);
  if (weights.length < 6) return null;

  const latest = weights[weights.length - 1];
  if (now - latest.t > 5 * DAY) return null; // stale data, not a plateau

  // Walk back from the end to find how long the flat stretch is.
  const tolerance = latest.value * 0.004; // ±0.4% band counts as flat
  let flatStart = latest.t;
  for (let i = weights.length - 1; i >= 0; i--) {
    if (Math.abs(weights[i].value - latest.value) <= tolerance) flatStart = weights[i].t;
    else break;
  }
  const flatDays = Math.round((latest.t - flatStart) / DAY);
  if (flatDays < 7) return null;

  // Only a plateau if there was loss before the flat stretch.
  const before = weights.filter((w) => w.t < flatStart);
  if (before.length < 2) return null;
  const priorChange = before[before.length - 1].value - before[0].value;
  if (priorChange >= -tolerance) return null;

  const level = computeToday(profile, logs, now).medicationLevel;
  const reason =
    level >= 70
      ? 'Your body often adapts after steady loss — metabolic rate drops slightly to match. Plateaus at full medication coverage usually break within 2–3 weeks. Keep protein up and stay consistent.'
      : 'Medication coverage has been below peak, which lets appetite return. Check that doses are on schedule before changing anything else.';

  return { days: flatDays, reason };
}

/**
 * "Future You" — weight history plus a dotted projection from the trailing
 * 28-day slope, weekly points until goal or `maxWeeks` out.
 */
export function projectionSeries(
  profile: Profile,
  logs: LogEntry[],
  maxWeeks = 12,
  now = Date.now(),
): { series: { t: number; value: number }[]; projectedFrom: number | null } {
  const history = weightSeries(logs);
  if (history.length < 4 || profile.goalWeight == null) {
    return { series: history, projectedFrom: null };
  }

  const window = history.filter((w) => w.t >= now - 28 * DAY);
  if (window.length < 4) return { series: history, projectedFrom: null };

  const days = window.map((w) => (w.t - window[0].t) / DAY);
  const meanX = days.reduce((a, b) => a + b, 0) / days.length;
  const meanY = window.reduce((s, w) => s + w.value, 0) / window.length;
  const denom = days.reduce((s, x) => s + (x - meanX) ** 2, 0);
  if (denom === 0) return { series: history, projectedFrom: null };
  const slope = days.reduce((s, x, i) => s + (x - meanX) * (window[i].value - meanY), 0) / denom;
  if (slope >= -0.01) return { series: history, projectedFrom: null };

  const last = history[history.length - 1];
  const future: { t: number; value: number }[] = [];
  for (let w = 1; w <= maxWeeks; w++) {
    const value = last.value + slope * 7 * w;
    future.push({ t: last.t + w * 7 * DAY, value: Math.max(profile.goalWeight, value) });
    if (value <= profile.goalWeight) break;
  }

  return { series: [...history, ...future], projectedFrom: history.length - 1 };
}

/** Weight the projection says you'll be at, `weeks` from now. */
export function projectedWeightAt(
  profile: Profile,
  logs: LogEntry[],
  weeks: number,
  now = Date.now(),
): number | null {
  const { series, projectedFrom } = projectionSeries(profile, logs, weeks, now);
  if (projectedFrom == null) return null;
  const target = now + weeks * 7 * DAY;
  const future = series.slice(projectedFrom);
  let best = future[0];
  for (const p of future) if (Math.abs(p.t - target) < Math.abs(best.t - target)) best = p;
  return best?.value ?? null;
}

/**
 * The "how am I doing today?" line. Rule-based on device; the Pro tier swaps
 * this for a model-generated coach note from the backend.
 */
export function coachMessage(profile: Profile, logs: LogEntry[], today: Today): string {
  const units = profile.settings.units;
  const weekly = changeOverDays(logs, 7);

  if (!logs.some((l) => l.kind === 'weight')) {
    return 'Log your first weigh-in and I can start tracking your trend.';
  }
  if (today.medicationLevel > 0 && today.medicationLevel < 25) {
    return 'Medication level is low — your next dose will bring it back up.';
  }
  if (weekly != null && weekly < -2.5) {
    return "That's a fast week. Keep protein up so the loss stays fat, not muscle.";
  }
  if (weekly != null && weekly < 0) {
    return `Down ${formatWeight(Math.abs(weekly), units)} ${units} this week — exactly as expected.`;
  }
  if (today.proteinPct < 50) {
    return `Protein is at ${today.proteinG} g. Aim for ${profile.goals.proteinG} g today.`;
  }
  if (today.hydrationPct < 50) {
    return "Hydration is behind — water helps with the GI side effects too.";
  }
  return "You're progressing exactly as expected.";
}
