import { View } from 'react-native';
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
};

/**
 * Progress hero.
 *
 * One number, one progress bar, three small facts. A user opening Progress is
 * asking "how far have I come?", and that is a single figure — not a row of
 * competing visuals.
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
}: Props) {
  const c = useColors();
  const { scheme } = useTheme();

  return (
    <LinearGradient
      colors={scheme === 'dark' ? [c.primarySoft, c.card] : ['#EAF6F0', '#F6FBF8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: 24,
        padding: spacing.xl,
        gap: spacing.lg,
        borderWidth: scheme === 'dark' ? 1 : 0,
        borderColor: c.border,
      }}
    >
      {/* One number, one bar, three small facts.
          The previous version put the loss, a confidence ring and a sparkline
          in three columns side by side, which left every element too narrow to
          read and made the card look like a dashboard rather than an answer. */}
      <View style={{ alignItems: 'center', gap: 2 }}>
        <Text variant="caption" tone="secondary">
          Total weight lost
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
          <Text variant="hero" tone="primary">
            {formatWeight(Math.abs(lostLb), units)}
          </Text>
          <Text variant="heading" tone="secondary">
            {units}
          </Text>
        </View>
      </View>

      <View style={{ gap: spacing.sm }}>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: c.track, overflow: 'hidden' }}>
          <View style={{ width: `${goalPercent}%`, height: '100%', backgroundColor: c.primary }} />
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="micro" tone="tertiary">
            {startLb != null ? `${formatWeight(startLb, units)} ${units}` : '—'}
          </Text>
          <Text variant="micro" tone="primary">
            {goalPercent}% of goal
          </Text>
          <Text variant="micro" tone="tertiary">
            {goalLb != null ? `${formatWeight(goalLb, units)} ${units}` : 'Set a goal'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', paddingTop: spacing.xs }}>
        {[
          { label: 'DAY', value: String(days) },
          { label: 'SINCE', value: since ? new Date(since).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—' },
          { label: 'MODEL', value: `${intelligence}%` },
        ].map((item) => (
          <View key={item.label} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
            <Text variant="micro" tone="tertiary">
              {item.label}
            </Text>
            <Text variant="bodyStrong">{item.value}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}
