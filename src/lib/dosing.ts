/**
 * Dosing sweet spot.
 *
 * "Maximum fat loss, minimal side effects." For every dose strength the user
 * has actually been on, measure what happened on it: average weekly weight
 * change and average symptom severity. The sweet spot is the strength with the
 * best trade-off. This is decision support for a conversation with a
 * prescriber — never a recommendation to change dose on your own.
 */

import { DAY } from './dates';
import type { LogEntry } from '../store/types';

export type DoseStats = {
  doseMg: number;
  weeks: number;
  /** Average weekly weight change while on this dose (negative = loss). */
  weeklyChange: number | null;
  /** Average symptom severity 0-5 while on this dose. */
  avgSeverity: number;
  symptomCount: number;
  /** Higher is better: loss rewarded, side effects penalised. */
  score: number | null;
};

export type SweetSpot = {
  perDose: DoseStats[];
  best: DoseStats | null;
  /** Human-readable status when there isn't enough data yet. */
  needs: string | null;
};

/** Contiguous periods on a given dose, from the dose log. */
function dosePeriods(doses: LogEntry[]): { doseMg: number; from: number; to: number }[] {
  const sorted = [...doses].sort((a, b) => a.at - b.at);
  const periods: { doseMg: number; from: number; to: number }[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i];
    const next = sorted[i + 1];
    const to = next ? next.at : cur.at + 7 * DAY;
    const prev = periods[periods.length - 1];
    if (prev && prev.doseMg === cur.value) prev.to = to;
    else periods.push({ doseMg: cur.value, from: cur.at, to });
  }
  return periods;
}

export function computeSweetSpot(logs: LogEntry[]): SweetSpot {
  const doses = logs.filter((l) => l.kind === 'dose' && l.value > 0);
  const weights = logs.filter((l) => l.kind === 'weight').sort((a, b) => a.at - b.at);
  const symptoms = logs.filter((l) => l.kind === 'symptom');

  if (doses.length < 2) {
    return { perDose: [], best: null, needs: 'Log your doses each week to unlock this analysis.' };
  }

  const periods = dosePeriods(doses);
  const byDose = new Map<number, { spanMs: number; changes: number[]; sev: number[]; }>();

  for (const p of periods) {
    const entry = byDose.get(p.doseMg) ?? { spanMs: 0, changes: [], sev: [] };
    entry.spanMs += p.to - p.from;

    const inRange = weights.filter((w) => w.at >= p.from && w.at <= p.to);
    if (inRange.length >= 2) {
      const spanDays = (inRange[inRange.length - 1].at - inRange[0].at) / DAY;
      if (spanDays >= 3) {
        const change = inRange[inRange.length - 1].value - inRange[0].value;
        entry.changes.push((change / spanDays) * 7);
      }
    }

    for (const s of symptoms) {
      if (s.at >= p.from && s.at <= p.to) entry.sev.push(s.value);
    }
    byDose.set(p.doseMg, entry);
  }

  const perDose: DoseStats[] = [...byDose.entries()]
    .map(([doseMg, e]) => {
      const weeks = e.spanMs / (7 * DAY);
      const weeklyChange = e.changes.length
        ? e.changes.reduce((a, b) => a + b, 0) / e.changes.length
        : null;
      const avgSeverity = e.sev.length ? e.sev.reduce((a, b) => a + b, 0) / e.sev.length : 0;
      // Efficiency = loss rate ÷ (1 + side-effect burden) — same metric as
      // calqulate.net's sweet-spot engine: loss discounted by how bad it felt.
      const lossRate = weeklyChange == null ? null : -weeklyChange;
      const score = lossRate == null || lossRate <= 0 ? null : lossRate / (1 + avgSeverity);
      return {
        doseMg,
        weeks: Math.round(weeks * 10) / 10,
        weeklyChange,
        avgSeverity: Math.round(avgSeverity * 10) / 10,
        symptomCount: e.sev.length,
        score,
      };
    })
    .sort((a, b) => a.doseMg - b.doseMg);

  const scored = perDose.filter((d) => d.score != null && d.weeks >= 2);
  if (scored.length < 2) {
    return {
      perDose,
      best: null,
      needs:
        perDose.length < 2
          ? 'Once you have spent time on two different strengths, we can compare them.'
          : 'Keep logging weigh-ins and symptom check-ins — a couple more weeks of data unlocks the comparison.',
    };
  }

  const best = scored.reduce((a, b) => (b.score! > a.score! ? b : a));
  return { perDose, best, needs: null };
}
