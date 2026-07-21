import { getMedication } from './medications';
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
    return `Down ${Math.abs(weekly).toFixed(1)} ${units} this week — exactly as expected.`;
  }
  if (today.proteinPct < 50) {
    return `Protein is at ${today.proteinG} g. Aim for ${profile.goals.proteinG} g today.`;
  }
  if (today.hydrationPct < 50) {
    return "Hydration is behind — water helps with the GI side effects too.";
  }
  return "You're progressing exactly as expected.";
}
