/**
 * Clinical-trial benchmarking — "am I on track?"
 *
 * Mean % total-body-weight loss curves from the pivotal trials, linearly
 * interpolated, same data as calqulate.net's benchmark engine:
 *   Semaglutide  — STEP-1 (2.4 mg)
 *   Tirzepatide  — SURMOUNT-1 (15 mg)
 *   Liraglutide  — SCALE (3.0 mg)
 */

import { DAY } from './dates';
import { weightSeries } from './insights';
import { getMedication } from './medications';
import type { LogEntry, Profile } from '../store/types';

type CurvePoint = [weeks: number, lossPct: number];

const CURVES: Record<string, CurvePoint[]> = {
  Semaglutide: [[0, 0], [4, 2], [8, 4], [12, 6], [20, 9], [28, 11], [40, 13], [52, 14.5], [68, 14.9]],
  Tirzepatide: [[0, 0], [4, 3], [12, 8], [24, 13], [36, 17], [52, 19], [72, 20.9]],
  Liraglutide: [[0, 0], [8, 3], [16, 5], [28, 7], [40, 7.8], [56, 8]],
};

const ON_TRACK_BAND = 2; // percentage points

export type Benchmark = {
  weeks: number;
  actualPct: number;
  expectedPct: number;
  verdict: 'ahead' | 'on-track' | 'behind' | 'early';
  trialName: string;
};

function expectedLossPct(curve: CurvePoint[], weeks: number): number {
  if (weeks <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    const [w1, p1] = curve[i - 1];
    const [w2, p2] = curve[i];
    if (weeks <= w2) return p1 + ((weeks - w1) / (w2 - w1)) * (p2 - p1);
  }
  return curve[curve.length - 1][1];
}

export function computeBenchmark(profile: Profile, logs: LogEntry[], now = Date.now()): Benchmark | null {
  const med = getMedication(profile.medication);
  const molecule = med.molecule.includes('Semaglutide')
    ? 'Semaglutide'
    : med.molecule.includes('Tirzepatide')
      ? 'Tirzepatide'
      : med.molecule.includes('Liraglutide')
        ? 'Liraglutide'
        : null;
  if (!molecule) return null;

  const weights = weightSeries(logs);
  const start = profile.startWeight ?? weights[0]?.value;
  const latest = weights.at(-1)?.value;
  if (start == null || latest == null || start <= 0) return null;

  const firstT = weights[0]?.t ?? now;
  const weeks = Math.max(0, (now - firstT) / (7 * DAY));
  const actualPct = ((start - latest) / start) * 100;
  const expectedPct = expectedLossPct(CURVES[molecule], weeks);

  const delta = actualPct - expectedPct;
  const verdict: Benchmark['verdict'] =
    weeks < 4 ? 'early' : delta >= ON_TRACK_BAND ? 'ahead' : delta <= -ON_TRACK_BAND ? 'behind' : 'on-track';

  const trialName =
    molecule === 'Semaglutide' ? 'STEP-1' : molecule === 'Tirzepatide' ? 'SURMOUNT-1' : 'SCALE';

  return {
    weeks: Math.round(weeks),
    actualPct: Math.round(actualPct * 10) / 10,
    expectedPct: Math.round(expectedPct * 10) / 10,
    verdict,
    trialName,
  };
}
