import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import {
  AXIS_W,
  buildWeightModel,
  indexAtX,
  phaseBands,
  weeklyChangeAt,
  zoomSeries,
  type Phase,
  type WeightPoint,
} from '../lib/weightChart';
import { formatWeight } from '../lib/units';
import type { Units } from '../store/types';
import { radius, shadow, spacing } from '../theme';

export type { WeightPoint };

type Props = {
  /** Points in stored pounds; the chart converts for display. */
  data: WeightPoint[];
  units: Units;
  width: number;
  height?: number;
  /** Horizontal goal line, in stored pounds. */
  goal?: number | null;
  /** Drag to scrub, pinch to zoom, double-tap to reset. */
  interactive?: boolean;
};

const monthDay = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * The dashboard's weight trend.
 *
 * Gradient area, smooth curve, a dot and value on every reading, the latest
 * value in a filled badge, and phase shading behind it all — green where the
 * trend is falling, neutral where it is holding, amber where it is climbing.
 *
 * Interaction: drag to scrub a crosshair with the reading and that week's
 * change, pinch to zoom the window (anchored at today, which is the end people
 * care about), double-tap to reset. The pan gesture only claims horizontal
 * movement so the surrounding scroll view keeps working.
 */
export function WeightChart({ data, units, width, height = 220, goal, interactive = true }: Props) {
  const c = useColors();
  const MAX_LABELS = 7;

  const [zoom, setZoom] = useState(1);
  const [scrub, setScrub] = useState<number | null>(null);

  const shown = useMemo(() => zoomSeries(data, zoom), [data, zoom]);
  const model = useMemo(
    () => buildWeightModel(shown, units, width, height, goal, MAX_LABELS),
    [shown, units, width, height, goal],
  );
  const bands = useMemo(() => phaseBands(shown), [shown]);

  const scrubTo = (x: number) => {
    if (!model) return;
    setScrub(indexAtX(model, x));
  };
  const applyZoom = (scale: number) => setZoom((z) => Math.max(0.08, Math.min(1, z / scale)));

  const pan = Gesture.Pan()
    // Horizontal only, so vertical scrolling still belongs to the page.
    .activeOffsetX([-8, 8])
    .failOffsetY([-14, 14])
    .onBegin((e) => runOnJS(scrubTo)(e.x))
    .onUpdate((e) => runOnJS(scrubTo)(e.x))
    .onFinalize(() => runOnJS(setScrub)(null));

  const pinch = Gesture.Pinch().onUpdate((e) => runOnJS(applyZoom)(e.scale));
  const reset = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      runOnJS(setZoom)(1);
      runOnJS(setScrub)(null);
    });

  const gesture = Gesture.Race(reset, Gesture.Simultaneous(pan, pinch));

  if (!model) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" tone="tertiary">
          Log two weigh-ins to see your trend
        </Text>
      </View>
    );
  }

  const { xy, line, area, scale, y, baseline, goalY, labelStride } = model;
  const last = xy[xy.length - 1];
  const active = scrub != null ? xy[scrub] : null;
  const weekly = scrub != null ? weeklyChangeAt(shown, scrub) : null;

  const PHASE_FILL: Record<Phase, string> = {
    losing: c.primary,
    stable: c.textTertiary,
    regain: c.pro,
  };
  const PHASE_OPACITY: Record<Phase, number> = { losing: 0.07, stable: 0.05, regain: 0.1 };

  // Bands are drawn in time space, so they need the same x mapping as the line.
  const minT = shown[0].t;
  const maxT = shown[shown.length - 1].t;
  const spanT = maxT - minT || 1;
  const bandX = (t: number) => AXIS_W + ((t - minT) / spanT) * (width - AXIS_W - 8);

  const chart = (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="wfade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.primary} stopOpacity="0.22" />
          <Stop offset="1" stopColor={c.primary} stopOpacity="0.01" />
        </LinearGradient>
      </Defs>

      {/* Phase shading, behind everything. */}
      {bands.map((b) => (
        <Rect
          key={`${b.from}-${b.phase}`}
          x={bandX(b.from)}
          y={12}
          width={Math.max(1, bandX(b.to) - bandX(b.from))}
          height={baseline - 12}
          fill={PHASE_FILL[b.phase]}
          opacity={PHASE_OPACITY[b.phase]}
        />
      ))}

      {scale.ticks.map((t) => (
        <G key={t}>
          <Line x1={AXIS_W} y1={y(t)} x2={width} y2={y(t)} stroke={c.track} strokeWidth={1} />
          <SvgText x={AXIS_W - 8} y={y(t) + 4} fill={c.textTertiary} fontSize="11" textAnchor="end">
            {Number.isInteger(t) ? t : t.toFixed(1)}
          </SvgText>
        </G>
      ))}

      {goalY != null ? (
        <G>
          <Line
            x1={AXIS_W}
            y1={goalY}
            x2={width}
            y2={goalY}
            stroke={c.pro}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <SvgText x={width} y={goalY - 6} fill={c.pro} fontSize="10" textAnchor="end">
            GOAL
          </SvgText>
        </G>
      ) : null}

      <Path d={area} fill="url(#wfade)" />
      <Path d={line} stroke={c.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" />

      {/* Dots on every reading; values on a thinned subset, hidden while scrubbing. */}
      {xy.map((p, i) => {
        const isLast = i === xy.length - 1;
        const showValue = !isLast && i % labelStride === 0 && scrub == null;
        return (
          <G key={p.t}>
            {showValue ? (
              <SvgText x={p.x} y={p.y - 12} fill={c.textSecondary} fontSize="11" textAnchor="middle">
                {p.v.toFixed(1)}
              </SvgText>
            ) : null}
            {!isLast ? (
              <>
                <Circle cx={p.x} cy={p.y} r={4.5} fill={c.card} />
                <Circle cx={p.x} cy={p.y} r={3} fill={c.primary} />
              </>
            ) : null}
          </G>
        );
      })}

      {/* Crosshair while scrubbing. */}
      {active ? (
        <G>
          <Line x1={active.x} y1={12} x2={active.x} y2={baseline} stroke={c.primary} strokeWidth={1.5} strokeDasharray="3 3" />
          <Circle cx={active.x} cy={active.y} r={7} fill={c.card} />
          <Circle cx={active.x} cy={active.y} r={5} fill={c.primary} />
        </G>
      ) : (
        <G>
          <Rect
            x={Math.min(last.x - 22, width - 46)}
            y={last.y - 26}
            width={44}
            height={20}
            rx={6}
            fill={c.primary}
          />
          <SvgText
            x={Math.min(last.x, width - 24)}
            y={last.y - 12}
            fill={c.onPrimary}
            fontSize="11"
            fontWeight="600"
            textAnchor="middle"
          >
            {last.v.toFixed(1)}
          </SvgText>
          <Circle cx={last.x} cy={last.y} r={6} fill={c.card} />
          <Circle cx={last.x} cy={last.y} r={4} fill={c.primary} />
        </G>
      )}

      <SvgText x={AXIS_W} y={baseline + 16} fill={c.textTertiary} fontSize="11">
        {monthDay(xy[0].t)}
      </SvgText>
      {xy.length > 3 ? (
        <SvgText
          x={(AXIS_W + width) / 2}
          y={baseline + 16}
          fill={c.textTertiary}
          fontSize="11"
          textAnchor="middle"
        >
          {monthDay(xy[Math.floor(xy.length / 2)].t)}
        </SvgText>
      ) : null}
      <SvgText x={width} y={baseline + 16} fill={c.textTertiary} fontSize="11" textAnchor="end">
        Today
      </SvgText>
      <SvgText x={AXIS_W - 8} y={12} fill={c.textTertiary} fontSize="10" textAnchor="end">
        {units}
      </SvgText>
    </Svg>
  );

  return (
    <View>
      {interactive ? <GestureDetector gesture={gesture}>{chart}</GestureDetector> : chart}

      {/* Scrub tooltip, positioned over the chart and kept inside its bounds. */}
      {active ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: Math.max(0, Math.min(width - 140, active.x - 70)),
            top: 4,
            width: 140,
            padding: spacing.md,
            borderRadius: radius.md,
            backgroundColor: c.card,
            borderWidth: 1,
            borderColor: c.border,
            ...shadow(c.shadow, 1),
          }}
        >
          <Text variant="micro" tone="tertiary">
            {new Date(active.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <Text variant="bodyStrong">{active.v.toFixed(1)}</Text>
            <Text variant="micro" tone="secondary">
              {units}
            </Text>
          </View>
          {weekly != null ? (
            <Text variant="micro" tone={weekly <= 0 ? 'primary' : 'pro'}>
              {weekly <= 0 ? '↓' : '↑'} {formatWeight(Math.abs(weekly), units)} {units} that week
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Legend, only when there is more than one phase to explain. */}
      {bands.length > 1 ? (
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
          {(['losing', 'stable', 'regain'] as Phase[])
            .filter((p) => bands.some((b) => b.phase === p))
            .map((p) => (
              <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 3,
                    backgroundColor: PHASE_FILL[p],
                    opacity: 0.35,
                  }}
                />
                <Text variant="micro" tone="tertiary">
                  {p === 'losing' ? 'Losing' : p === 'stable' ? 'Holding' : 'Regain'}
                </Text>
              </View>
            ))}
          {zoom < 1 ? (
            <Text variant="micro" tone="primary">
              Zoomed · double-tap to reset
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The three-up stat strip under the chart. */
export function WeightStats({
  totalChange,
  avgWeekly,
  goalPercent,
  units,
  bodyFraction,
  toGo,
}: {
  totalChange: string;
  avgWeekly: string;
  goalPercent: number;
  units: Units;
  bodyFraction?: string;
  toGo?: string;
}) {
  const c = useColors();
  const size = 54;
  const stroke = 6;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, goalPercent));

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.bgElevated,
        borderRadius: 16,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="micro" tone="tertiary">
          Total change
        </Text>
        <Text variant="bodyStrong" tone="primary">
          {totalChange}
        </Text>
        {bodyFraction ? (
          <Text variant="micro" tone="tertiary">
            {bodyFraction}
          </Text>
        ) : null}
      </View>

      <View style={{ width: 1, height: 34, backgroundColor: c.border }} />

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="micro" tone="tertiary">
          Avg weekly loss
        </Text>
        <Text variant="bodyStrong" tone="primary">
          {avgWeekly}
        </Text>
        <Text variant="micro" tone="tertiary">
          per week
        </Text>
      </View>

      <View style={{ width: 1, height: 34, backgroundColor: c.border }} />

      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="micro" tone="tertiary">
          Goal progress
        </Text>
        <Text variant="bodyStrong" tone="primary">
          {pct}%
        </Text>
        {toGo ? (
          <Text variant="micro" tone="tertiary">
            {toGo}
          </Text>
        ) : null}
      </View>

      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={c.primary}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${(circumference * pct) / 100} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </View>
  );
}
