import { View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { formatWeight } from '../lib/units';
import type { Units } from '../store/types';
import { spacing } from '../theme';

type Props = {
  /** Stored pounds. */
  lostLb: number;
  startLb: number | null;
  goalLb: number | null;
  units: Units;
  goalPercent: number;
  /** Body model completeness, 0-100. */
  intelligence: number;
  days: number;
  since: number | null;
  /** Recent weight points, for the sparkline. */
  spark: { t: number; value: number }[];
};

/** Confidence ring — the centrepiece of the hero. */
function IntelligenceRing({ percent, size = 118 }: { percent: number; size?: number }) {
  const c = useColors();
  const stroke = 9;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
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
      <Text variant="micro" tone="tertiary" style={{ textAlign: 'center' }}>
        Body Intelligence
      </Text>
      <Text variant="title" tone="primary">
        {pct}%
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <Text variant="micro" tone="secondary">
          Confidence
        </Text>
        <Ionicons name="information-circle-outline" size={10} color={c.textTertiary} />
      </View>
    </View>
  );
}

/** Miniature trend line for the journey column. */
function Sparkline({ points, width = 96, height = 34 }: { points: Props['spark']; width?: number; height?: number }) {
  const c = useColors();
  if (points.length < 2) return <View style={{ width, height }} />;

  const xs = points.map((p) => p.t);
  const ys = points.map((p) => p.value);
  const minX = Math.min(...xs);
  const spanX = Math.max(...xs) - minX || 1;
  const minY = Math.min(...ys);
  const spanY = Math.max(...ys) - minY || 1;

  const at = (i: number) => ({
    x: ((points[i].t - minX) / spanX) * width,
    y: height - ((points[i].value - minY) / spanY) * (height - 4) - 2,
  });

  const d = points.map((_, i) => `${i === 0 ? 'M' : 'L'} ${at(i).x} ${at(i).y}`).join(' ');
  const area = `${d} L ${width} ${height} L 0 ${height} Z`;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={c.primary} stopOpacity="0.25" />
          <Stop offset="1" stopColor={c.primary} stopOpacity="0" />
        </SvgGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path d={d} stroke={c.primary} strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

/**
 * Progress hero.
 *
 * Three columns: what you have lost, how well the model knows you, and how long
 * you have been at it. The middle column is the ring because the model's
 * confidence is the thing that makes every other number on the page mean
 * something.
 */
export function ProgressHero({
  lostLb,
  startLb,
  goalLb,
  units,
  goalPercent,
  intelligence,
  days,
  since,
  spark,
}: Props) {
  const c = useColors();
  const { scheme } = useTheme();

  return (
    <LinearGradient
      colors={scheme === 'dark' ? [c.primarySoft, c.card] : ['#EAF6F0', '#F4FAF7']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        padding: spacing.lg + 2,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        borderWidth: scheme === 'dark' ? 1 : 0,
        borderColor: c.border,
      }}
    >
      {/* Left — the headline number and goal progress. */}
      <View style={{ flex: 1, gap: 6 }}>
        <Text variant="caption" tone="secondary">
          Total Weight Lost
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text variant="hero">{formatWeight(Math.abs(lostLb), units)}</Text>
          <Text variant="heading" tone="secondary">
            {units}
          </Text>
        </View>
        <Text variant="caption" tone="secondary">
          {goalPercent}% of your goal
        </Text>
        <View
          style={{
            height: 7,
            borderRadius: 4,
            backgroundColor: c.track,
            overflow: 'hidden',
            marginTop: 2,
          }}
        >
          <View
            style={{ width: `${goalPercent}%`, height: '100%', backgroundColor: c.primary }}
          />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
          <Text variant="micro" tone="tertiary">
            Started: {startLb != null ? `${formatWeight(startLb, units)} ${units}` : '—'}
          </Text>
          <Text variant="micro" tone="tertiary">
            Goal: {goalLb != null ? `${formatWeight(goalLb, units)} ${units}` : '—'}
          </Text>
        </View>
      </View>

      {/* Middle — the model's confidence. */}
      <IntelligenceRing percent={intelligence} />

      {/* Right — how long you have been at it. */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="caption" tone="secondary">
          You&apos;ve been on your journey for
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
          <Text variant="title">{days}</Text>
          <Text variant="body" tone="secondary">
            days
          </Text>
        </View>
        <Sparkline points={spark} />
        <Text variant="micro" tone="tertiary">
          {since
            ? `Since ${new Date(since).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}`
            : '—'}
        </Text>
      </View>
    </LinearGradient>
  );
}
