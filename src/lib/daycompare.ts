/**
 * Day-vs-day comparison — the numbers behind "Today vs Yesterday" tiles and
 * the Today / Yesterday / Week switch. A premium home screen answers "what's
 * different from yesterday?", not "what data do I have?".
 */

import { DAY, isSameDay, startOfDay } from './dates';
import type { LogEntry } from '../store/types';

export type DayStats = {
  /** Last weigh-in on that calendar day, or null. */
  weight: number | null;
  waterMl: number;
  proteinG: number;
  sleepH: number;
  activityMin: number;
  /** Average symptom severity that day (0 = feeling fine), null when no check-in. */
  symptomAvg: number | null;
  doseLogged: boolean;
};

export function statsFor(logs: LogEntry[], at: number): DayStats {
  let weight: number | null = null;
  let weightAt = 0;
  let waterMl = 0;
  let proteinG = 0;
  let sleepH = 0;
  let activityMin = 0;
  const sev: number[] = [];
  let doseLogged = false;

  for (const l of logs) {
    if (!isSameDay(l.at, at)) continue;
    switch (l.kind) {
      case 'weight':
        if (l.at >= weightAt) {
          weight = l.value;
          weightAt = l.at;
        }
        break;
      case 'water':
        waterMl += l.value;
        break;
      case 'meal':
        proteinG += l.value;
        break;
      case 'sleep':
        sleepH += l.value;
        break;
      case 'activity':
        activityMin += l.value;
        break;
      case 'symptom':
        sev.push(l.value);
        break;
      case 'dose':
        doseLogged = true;
        break;
    }
  }

  return {
    weight,
    waterMl,
    proteinG,
    sleepH,
    activityMin,
    symptomAvg: sev.length ? sev.reduce((a, b) => a + b, 0) / sev.length : null,
    doseLogged,
  };
}

/** Daily averages (and total weight change) over the trailing 7 days. */
export function weekStats(logs: LogEntry[], now = Date.now()): DayStats & { weightChange: number | null } {
  const days: DayStats[] = [];
  for (let i = 0; i < 7; i++) days.push(statsFor(logs, startOfDay(now) - i * DAY + 12 * 3600_000));

  const withData = (pick: (d: DayStats) => number) => {
    const vals = days.map(pick).filter((v) => v > 0);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  };

  const weights = logs
    .filter((l) => l.kind === 'weight' && l.at >= now - 7 * DAY)
    .sort((a, b) => a.at - b.at);

  const sev = days.map((d) => d.symptomAvg).filter((v): v is number => v != null);

  return {
    weight: weights.at(-1)?.value ?? null,
    weightChange: weights.length >= 2 ? weights[weights.length - 1].value - weights[0].value : null,
    waterMl: Math.round(withData((d) => d.waterMl)),
    proteinG: Math.round(withData((d) => d.proteinG)),
    sleepH: Math.round(withData((d) => d.sleepH) * 10) / 10,
    activityMin: Math.round(withData((d) => d.activityMin)),
    symptomAvg: sev.length ? sev.reduce((a, b) => a + b, 0) / sev.length : null,
    doseLogged: days.some((d) => d.doseLogged),
  };
}

export type SymptomTrend = 'better' | 'worse' | 'same' | null;

export function symptomTrend(current: DayStats, previous: DayStats): SymptomTrend {
  if (current.symptomAvg == null || previous.symptomAvg == null) return null;
  const d = current.symptomAvg - previous.symptomAvg;
  if (d < -0.4) return 'better';
  if (d > 0.4) return 'worse';
  return 'same';
}
