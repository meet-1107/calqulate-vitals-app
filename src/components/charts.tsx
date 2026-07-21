import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

export type Point = { t: number; value: number };

const buildPath = (
  points: Point[],
  w: number,
  h: number,
  pad: number,
  domain?: [number, number],
) => {
  if (points.length === 0) return { line: '', area: '', xy: [] as { x: number; y: number }[] };
  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const [minY, maxY] = domain ?? [Math.min(...ys), Math.max(...ys)];
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const xy = points.map((p) => ({
    x: pad + ((p.t - minX) / spanX) * (w - pad * 2),
    y: pad + (1 - (p.value - minY) / spanY) * (h - pad * 2),
  }));

  // Catmull-Rom → cubic bézier, so the trend reads as a smooth line without
  // overshooting real data points.
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
  const area = `${line} L ${xy[xy.length - 1].x} ${h} L ${xy[0].x} ${h} Z`;
  return { line, area, xy };
};

type LineChartProps = {
  data: Point[];
  height?: number;
  width: number;
  color?: string;
  domain?: [number, number];
  /** Index from which the line is a projection rather than history. */
  projectedFrom?: number;
  showLastPoint?: boolean;
};

/** Single-series trend line. No legend — the card title names the series. */
export function LineChart({
  data,
  width,
  height = 160,
  color,
  domain,
  projectedFrom,
  showLastPoint = true,
}: LineChartProps) {
  const c = useColors();
  const stroke = color ?? c.primary;
  const pad = 10;

  if (data.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" tone="tertiary">
          Not enough data yet
        </Text>
      </View>
    );
  }

  const full = buildPath(data, width, height, pad, domain);
  // History and projection share one scale, so both segments read off the same geometry.
  const scaled = full.xy;
  const splitAt = projectedFrom ?? data.length - 1;
  const solidD = scaled
    .slice(0, splitAt + 1)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  const dashedD = scaled
    .slice(splitAt)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');
  const last = scaled[scaled.length - 1];

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={stroke} stopOpacity="0.18" />
          <Stop offset="1" stopColor={stroke} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <Rect key={f} x={0} y={height * f} width={width} height={1} fill={c.track} />
      ))}
      <Path d={full.area} fill="url(#fade)" />
      <Path d={projectedFrom == null ? full.line : solidD} stroke={stroke} strokeWidth={2} fill="none" strokeLinecap="round" />
      {projectedFrom != null ? (
        <Path
          d={dashedD}
          stroke={stroke}
          strokeWidth={2}
          strokeDasharray="4 5"
          strokeOpacity={0.6}
          fill="none"
        />
      ) : null}
      {showLastPoint ? (
        <>
          <Circle cx={last.x} cy={last.y} r={6} fill={c.card} />
          <Circle cx={last.x} cy={last.y} r={4} fill={stroke} />
        </>
      ) : null}
    </Svg>
  );
}

type RingProps = {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  caption?: string;
};

/** Magnitude as a single-hue arc — one number, read at a glance. */
export function Ring({ percent, size = 128, stroke = 12, color, label, caption }: RingProps) {
  const c = useColors();
  const tint = color ?? c.primary;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tint}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${(circumference * clamped) / 100} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="title">{label ?? `${Math.round(clamped)}%`}</Text>
      {caption ? (
        <Text variant="caption" tone="secondary">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

type MeterProps = {
  percent: number;
  color?: string;
  height?: number;
  /** Segment count — segmented meters read faster than a continuous bar. */
  segments?: number;
};

export function Meter({ percent, color, height = 10, segments = 12 }: MeterProps) {
  const c = useColors();
  const tint = color ?? c.primary;
  const filled = Math.round((Math.max(0, Math.min(100, percent)) / 100) * segments);

  return (
    <View style={{ flexDirection: 'row', gap: 3, height }}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            borderRadius: radius.sm,
            backgroundColor: i < filled ? tint : c.track,
            opacity: i < filled ? 1 - (i / segments) * 0.25 : 1,
          }}
        />
      ))}
    </View>
  );
}

export function StatTile({
  label,
  value,
  unit,
  delta,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  tone?: 'up' | 'down';
}) {
  const c = useColors();
  return (
    <View style={{ gap: 2 }}>
      <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
        <Text variant="title">{value}</Text>
        {unit ? (
          <Text variant="caption" tone="secondary">
            {unit}
          </Text>
        ) : null}
      </View>
      {delta ? (
        <Text variant="caption" style={{ color: tone === 'down' ? c.primary : c.textSecondary }}>
          {delta}
        </Text>
      ) : null}
    </View>
  );
}
