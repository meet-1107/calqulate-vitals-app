/**
 * Weight units.
 *
 * Every weight in storage — logs, start weight, goal weight, body composition —
 * is in **pounds**. Display converts on the way out and input converts on the
 * way in. Storing a display-unit number would silently corrupt history the
 * moment someone switched units: a 183 logged as lb would later read as 183 kg.
 *
 * Pounds is canonical rather than kilograms because the audience is US-first and
 * it keeps the common path conversion-free.
 */

import type { Units } from '../store/types';

export const LB_PER_KG = 2.2046226218;

/** Stored pounds → the number to show. */
export const toDisplay = (lb: number, units: Units) => (units === 'kg' ? lb / LB_PER_KG : lb);

/** A number the user typed or picked → pounds for storage. */
export const toStored = (value: number, units: Units) =>
  units === 'kg' ? value * LB_PER_KG : value;

/** "183.2" — value only, for pairing with a separate unit label. */
export const formatWeight = (lb: number, units: Units, digits = 1) =>
  toDisplay(lb, units).toFixed(digits);

/** "183.2 lb" */
export const formatWeightUnit = (lb: number, units: Units, digits = 1) =>
  `${formatWeight(lb, units, digits)} ${units}`;

/**
 * A signed change, in the user's units. Losing weight is the goal, so a
 * negative delta reads with a down arrow and is flagged `good`.
 */
export function formatDelta(
  lbDelta: number | null,
  units: Units,
  digits = 1,
): { text: string; good: boolean } | null {
  if (lbDelta == null || !Number.isFinite(lbDelta)) return null;
  const shown = toDisplay(lbDelta, units);
  const arrow = shown <= 0 ? '↓' : '↑';
  return {
    text: `${arrow} ${Math.abs(shown).toFixed(digits)} ${units}`,
    good: shown <= 0,
  };
}

/** Sensible wheel-picker range for the active unit. */
export function weightScale(units: Units): number[] {
  const [from, to, step] = units === 'kg' ? [36, 227, 0.5] : [80, 500, 1];
  return Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) =>
    +(from + i * step).toFixed(1),
  );
}

/** Snaps an arbitrary value to the nearest option on the wheel. */
export const snapToScale = (value: number, units: Units) =>
  weightScale(units).reduce((best, x) => (Math.abs(x - value) < Math.abs(best - value) ? x : best));
