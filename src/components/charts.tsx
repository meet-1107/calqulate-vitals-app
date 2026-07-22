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
        {/* A round cap on a zero-length arc still paints a dot, so 0% drew a
            stray mark at twelve o'clock. Below half a percent, draw nothing. */}
        {clamped >= 0.5 ? (
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
        ) : null}
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

/**
 * Two-segment horizontal stacked bar — "83% fat / 17% muscle" at a glance.
 * Segments are proportional; labels sit underneath.
 */
export function StackedBar({
  a,
  b,
  aLabel,
  bLabel,
  aColor,
  bColor,
  height = 26,
}: {
  a: number;
  b: number;
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  height?: number;
}) {
  const c = useColors();
  const total = a + b || 1;
  const aPct = Math.round((a / total) * 100);
  const colA = aColor ?? c.primary;
  const colB = bColor ?? c.pro;

  return (
    <View>
      <View style={{ flexDirection: 'row', height, borderRadius: radius.sm, overflow: 'hidden', gap: 2 }}>
        <View style={{ flex: Math.max(a, 0.0001), backgroundColor: colA, borderRadius: radius.sm }} />
        <View style={{ flex: Math.max(b, 0.0001), backgroundColor: colB, borderRadius: radius.sm }} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colA }} />
          <Text variant="caption" tone="secondary">
            {aLabel} · {aPct}%
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colB }} />
          <Text variant="caption" tone="secondary">
            {bLabel} · {100 - aPct}%
          </Text>
        </View>
      </View>
    </View>
  );
}

/** Two-slice donut with a center label — body composition at a glance. */
export function Donut({
  a,
  b,
  size = 132,
  stroke = 16,
  label,
  caption,
  aColor,
  bColor,
}: {
  a: number;
  b: number;
  size?: number;
  stroke?: number;
  label: string;
  caption?: string;
  aColor?: string;
  bColor?: string;
}) {
  const c = useColors();
  const colA = aColor ?? c.primary;
  const colB = bColor ?? c.pro;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const total = a + b || 1;
  const aLen = (a / total) * circumference;
  const gap = 4;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colB}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${Math.max(0, circumference - aLen - gap)} ${aLen + gap}`}
          strokeDashoffset={-aLen - gap / 2}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colA}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${Math.max(0, aLen - gap)} ${circumference - aLen + gap}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text variant="heading">{label}</Text>
      {caption ? (
        <Text variant="micro" tone="secondary">
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** Position gauge — a dot on a track with a verdict, e.g. muscle protection. */
export function PositionGauge({
  percent,
  leftLabel,
  rightLabel,
  verdict,
}: {
  percent: number;
  leftLabel: string;
  rightLabel: string;
  verdict: string;
}) {
  const c = useColors();
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track }}>
        <View
          style={{
            position: 'absolute',
            left: `${clamped}%`,
            top: -5,
            marginLeft: -9,
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: c.primary,
            borderWidth: 3,
            borderColor: c.card,
          }}
        />
        <View
          style={{
            width: `${clamped}%`,
            height: 8,
            borderRadius: 4,
            backgroundColor: c.primarySoft,
          }}
        />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md }}>
        <Text variant="micro" tone="tertiary">
          {leftLabel}
        </Text>
        <Text variant="caption" tone="primary">
          {verdict}
        </Text>
        <Text variant="micro" tone="tertiary">
          {rightLabel}
        </Text>
      </View>
    </View>
  );
}

/**
 * Fat vs muscle river — two stacked areas over weeks. The fat band visibly
 * shrinks while the lean band stays nearly constant.
 */
export function RiverChart({
  weeks,
  width,
  height = 160,
}: {
  weeks: { label: string; fatMass: number; leanMass: number }[];
  width: number;
  height?: number;
}) {
  const c = useColors();
  if (weeks.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" tone="tertiary">
          A few weeks of weigh-ins unlocks this chart
        </Text>
      </View>
    );
  }

  const pad = 8;
  const labelH = 18;
  const plotH = height - labelH;
  const maxTotal = Math.max(...weeks.map((w) => w.fatMass + w.leanMass)) || 1;
  const x = (i: number) => pad + (i / (weeks.length - 1)) * (width - pad * 2);
  const y = (v: number) => plotH - (v / maxTotal) * (plotH - pad);

  const leanTop = weeks.map((w, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(w.leanMass)}`).join(' ');
  const leanArea = `${leanTop} L ${x(weeks.length - 1)} ${plotH} L ${x(0)} ${plotH} Z`;
  const totalTop = weeks
    .map((w, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(w.leanMass + w.fatMass)}`)
    .join(' ');
  const totalDown = weeks
    .map((w, i) => `L ${x(weeks.length - 1 - i)} ${y(weeks[weeks.length - 1 - i].leanMass)}`)
    .join(' ');
  const fatArea = `${totalTop} ${totalDown} Z`;

  return (
    <View>
      <Svg width={width} height={plotH}>
        <Path d={fatArea} fill={c.pro} opacity={0.55} />
        <Path d={leanArea} fill={c.primary} opacity={0.75} />
        <Path d={totalTop} stroke={c.pro} strokeWidth={2} fill="none" />
        <Path d={leanTop} stroke={c.primary} strokeWidth={2} fill="none" />
      </Svg>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', height: labelH, alignItems: 'flex-end' }}>
        <Text variant="micro" tone="tertiary">{weeks[0].label}</Text>
        <Text variant="micro" tone="tertiary">{weeks[weeks.length - 1].label}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.pro }} />
          <Text variant="micro" tone="secondary">Fat</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
          <Text variant="micro" tone="secondary">Muscle</Text>
        </View>
      </View>
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
