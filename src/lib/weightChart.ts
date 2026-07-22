/**
 * Weight-chart layout.
 *
 * Pure geometry, deliberately free of any React Native import so it can be
 * rendered, diffed, and checked outside a component tree.
 */

import { toDisplay } from './units';
import type { Units } from '../store/types';

export type WeightPoint = { t: number; value: number };

export const AXIS_W = 34;
export const LABEL_H = 22;
export const TOP_PAD = 24;

/** "Nice" tick values that bracket the data without crowding the axis. */
export function niceScale(min: number, max: number, ticks = 4) {
  const span = Math.max(max - min, 0.5);
  const rawStep = span / (ticks - 1);
  const mag = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rawStep) ?? mag * 10;
  const lo = Math.floor(min / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= Math.ceil(max / step) * step + step / 2; v += step) out.push(+v.toFixed(4));
  return { ticks: out, lo, hi: out[out.length - 1] };
}

export type WeightModel = NonNullable<ReturnType<typeof buildWeightModel>>;

export function buildWeightModel(
  data: WeightPoint[],
  units: Units,
  width: number,
  height: number,
  goal?: number | null,
  maxLabels = 7,
) {
  if (data.length < 2) return null;

  const values = data.map((p) => toDisplay(p.value, units));
  const goalShown = goal != null ? toDisplay(goal, units) : null;

  // The domain is set by the readings alone. Stretching it to reach a distant
  // goal would squash the actual trend into a flat line at the top of the
  // frame — and the trend is what the chart exists to show. The goal line is
  // drawn only when it happens to fall inside that domain.
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = (hi - lo) * 0.15 + 0.4;
  const scale = niceScale(lo - pad, hi + pad);
  const goalInView = goalShown != null && goalShown >= scale.lo && goalShown <= scale.hi;

  const plotW = width - AXIS_W;
  const plotH = height - LABEL_H - TOP_PAD;
  const minT = data[0].t;
  const spanT = data[data.length - 1].t - minT || 1;
  const spanY = scale.hi - scale.lo || 1;

  const x = (t: number) => AXIS_W + ((t - minT) / spanT) * (plotW - 8);
  const y = (v: number) => TOP_PAD + (1 - (v - scale.lo) / spanY) * plotH;

  const xy = data.map((p, i) => ({ x: x(p.t), y: y(values[i]), v: values[i], t: p.t }));

  // Catmull-Rom → cubic bézier: smooth without overshooting a real reading.
  let line = `M ${xy[0].x} ${xy[0].y}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] ?? p2;
    line +=
      ` C ${p1.x + (p2.x - p0.x) / 6} ${p1.y + (p2.y - p0.y) / 6},` +
      ` ${p2.x - (p3.x - p1.x) / 6} ${p2.y - (p3.y - p1.y) / 6},` +
      ` ${p2.x} ${p2.y}`;
  }
  const baseline = TOP_PAD + plotH;
  const area = `${line} L ${xy[xy.length - 1].x} ${baseline} L ${xy[0].x} ${baseline} Z`;

  return {
    xy,
    line,
    area,
    scale,
    y,
    baseline,
    goalY: goalInView ? y(goalShown!) : null,
    labelStride: Math.ceil(xy.length / maxLabels),
  };
}
