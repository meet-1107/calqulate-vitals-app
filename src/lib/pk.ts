/**
 * Medication level model.
 *
 * A one-compartment model with first-order absorption and elimination, summed
 * over every logged dose. This powers the "Medication Active: 74%" hero metric
 * and the Pro PK curve — it is an educational estimate, never a clinical one.
 */

const ABSORPTION_HOURS = 24;
const HOUR = 3600_000;

type Dose = { takenAt: number; amountMg: number };

/** Relative plasma contribution of a single dose `hours` after injection. */
function singleDose(hours: number, halfLifeHours: number): number {
  if (hours <= 0) return 0;
  const ke = Math.LN2 / halfLifeHours;
  const ka = Math.LN2 / ABSORPTION_HOURS;
  if (Math.abs(ka - ke) < 1e-6) return hours * ke * Math.exp(-ke * hours);
  return (ka / (ka - ke)) * (Math.exp(-ke * hours) - Math.exp(-ka * hours));
}

/** Absolute (unnormalised) level in mg-equivalents at a point in time. */
export function levelAt(doses: Dose[], at: number, halfLifeHours: number): number {
  return doses.reduce(
    (sum, d) => sum + d.amountMg * singleDose((at - d.takenAt) / HOUR, halfLifeHours),
    0,
  );
}

/**
 * Steady-state peak for the current dose and cadence — the denominator that
 * turns an abstract concentration into a "% active" a user can read at a glance.
 */
export function steadyStatePeak(
  amountMg: number,
  intervalHours: number,
  halfLifeHours: number,
): number {
  const doses: Dose[] = Array.from({ length: 12 }, (_, i) => ({
    takenAt: -i * intervalHours * HOUR,
    amountMg,
  }));
  let peak = 0;
  for (let h = 0; h <= intervalHours; h += 2) {
    peak = Math.max(peak, levelAt(doses, h * HOUR, halfLifeHours));
  }
  return peak || 1;
}

/** 0-100 medication level, relative to steady-state peak at the current dose. */
export function levelPercent(
  doses: Dose[],
  at: number,
  halfLifeHours: number,
  currentDoseMg: number,
  intervalHours = 168,
): number {
  if (!doses.length || !currentDoseMg) return 0;
  const peak = steadyStatePeak(currentDoseMg, intervalHours, halfLifeHours);
  return Math.max(0, Math.min(100, Math.round((levelAt(doses, at, halfLifeHours) / peak) * 100)));
}

/** Curve samples for the PK chart: `days` back and `forward` days projected. */
export function levelSeries(
  doses: Dose[],
  now: number,
  halfLifeHours: number,
  currentDoseMg: number,
  opts: { back?: number; forward?: number; intervalHours?: number } = {},
): { t: number; value: number }[] {
  const { back = 14, forward = 7, intervalHours = 168 } = opts;
  const peak = steadyStatePeak(currentDoseMg || 1, intervalHours, halfLifeHours);
  const points: { t: number; value: number }[] = [];
  for (let h = -back * 24; h <= forward * 24; h += 6) {
    const t = now + h * HOUR;
    points.push({
      t,
      value: Math.max(0, Math.min(100, (levelAt(doses, t, halfLifeHours) / peak) * 100)),
    });
  }
  return points;
}
