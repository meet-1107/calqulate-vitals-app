import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import { AXIS_W, buildWeightModel, type WeightPoint } from '../lib/weightChart';
import type { Units } from '../store/types';
import { spacing } from '../theme';

export type { WeightPoint };

type Props = {
  /** Points in stored pounds; the chart converts for display. */
  data: WeightPoint[];
  units: Units;
  width: number;
  height?: number;
  /** Horizontal goal line, in stored pounds. */
  goal?: number | null;
};

const monthDay = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/**
 * The dashboard's weight trend: gradient area, smooth curve, a dot and value on
 * every reading, and the latest value called out in a filled badge.
 *
 * Readings are thinned to at most `MAX_LABELS` labels so a 90-day range stays
 * legible — the dots all remain, only the text is dropped.
 */
export function WeightChart({ data, units, width, height = 220, goal }: Props) {
  const c = useColors();
  const MAX_LABELS = 7;

  const model = useMemo(
    () => buildWeightModel(data, units, width, height, goal, MAX_LABELS),
    [data, units, width, height, goal],
  );

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

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="wfade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.primary} stopOpacity="0.22" />
          <Stop offset="1" stopColor={c.primary} stopOpacity="0.01" />
        </LinearGradient>
      </Defs>

      {/* Gridlines and y-axis ticks. */}
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

      {/* A dot on every reading; values on a thinned subset. */}
      {xy.map((p, i) => {
        const isLast = i === xy.length - 1;
        const showValue = !isLast && i % labelStride === 0;
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

      {/* Latest reading, called out. */}
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

      {/* x-axis: first, middle, and "Today". */}
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
      {/* Unit sits at the top of the value axis, clear of the date labels. */}
      <SvgText x={AXIS_W - 8} y={12} fill={c.textTertiary} fontSize="10" textAnchor="end">
        {units}
      </SvgText>
    </Svg>
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
