/**
 * GLP-1 activity curve — the medication level over time with the story
 * annotated: injection markers, a "today" dot, and the forecast drawn dashed.
 */

import { View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import { spacing } from '../theme';

type Point = { t: number; value: number };

export function PKChart({
  data,
  injections,
  width,
  height = 180,
  now = Date.now(),
}: {
  data: Point[];
  /** Timestamps of logged doses inside the chart window. */
  injections: number[];
  width: number;
  height?: number;
  now?: number;
}) {
  const c = useColors();
  const pad = 10;
  const labelH = 20;
  const plotH = height - labelH;

  if (data.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" tone="tertiary">
          Log a dose to see your medication curve
        </Text>
      </View>
    );
  }

  const minT = data[0].t;
  const maxT = data[data.length - 1].t;
  const x = (t: number) => pad + ((t - minT) / (maxT - minT || 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - Math.max(0, Math.min(110, v)) / 110) * (plotH - pad * 2);

  const split = data.findIndex((p) => p.t >= now);
  const solid = (split > 0 ? data.slice(0, split + 1) : data)
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t)} ${y(p.value)}`)
    .join(' ');
  const dashed =
    split > 0
      ? data.slice(split).map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t)} ${y(p.value)}`).join(' ')
      : '';
  const area = `${solid} L ${x(data[Math.max(split, 0)]?.t ?? maxT)} ${plotH} L ${x(minT)} ${plotH} Z`;

  // Today's dot sits on the curve.
  let todayPt = data[0];
  for (const p of data) if (Math.abs(p.t - now) < Math.abs(todayPt.t - now)) todayPt = p;

  // The forecast peak, if it's ahead of now.
  let peak = data[0];
  for (const p of data) if (p.value > peak.value) peak = p;

  return (
    <View>
      <Svg width={width} height={plotH}>
        <Defs>
          <LinearGradient id="pkfade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={c.primary} stopOpacity="0.20" />
            <Stop offset="1" stopColor={c.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#pkfade)" />
        {injections
          .filter((t) => t >= minT && t <= maxT)
          .map((t, i) => (
            <Line
              key={i}
              x1={x(t)}
              y1={pad}
              x2={x(t)}
              y2={plotH - 2}
              stroke={c.textTertiary}
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          ))}
        <Path d={solid} stroke={c.primary} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        {dashed ? (
          <Path
            d={dashed}
            stroke={c.primary}
            strokeWidth={2}
            strokeDasharray="4 5"
            strokeOpacity={0.55}
            fill="none"
          />
        ) : null}
        <Circle cx={x(todayPt.t)} cy={y(todayPt.value)} r={7} fill={c.card} />
        <Circle cx={x(todayPt.t)} cy={y(todayPt.value)} r={5} fill={c.primary} />
      </Svg>
      <View
        style={{
          height: labelH,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
        }}
      >
        <Text variant="micro" tone="tertiary">💉 doses</Text>
        <Text variant="micro" tone="primary">● today · {Math.round(todayPt.value)}%</Text>
        <Text variant="micro" tone="tertiary">
          peak {peak.t > now ? 'ahead' : 'passed'}
        </Text>
      </View>
      <View style={{ marginTop: spacing.xs }} />
    </View>
  );
}
