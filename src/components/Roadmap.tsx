/**
 * Milestone roadmap — the journey from start weight to goal as levels.
 * Completed milestones get a check, the current position a filled dot,
 * future ones an outline.
 */

import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import { spacing } from '../theme';

export function Roadmap({
  start,
  goal,
  current,
  unit,
}: {
  start: number;
  goal: number;
  current: number;
  unit: string;
}) {
  const c = useColors();
  if (!(start > goal)) return null;

  // Milestones every ~5 units, snapped to clean numbers, start → goal.
  const span = start - goal;
  const step = span <= 12 ? 2.5 : 5;
  const marks: number[] = [start];
  for (let m = Math.floor(start / step) * step; m > goal; m -= step) {
    if (m < start - 0.01) marks.push(Math.round(m * 10) / 10);
  }
  marks.push(goal);

  return (
    <View style={{ gap: 0 }}>
      {marks.map((m, i) => {
        const reached = current <= m + 0.001;
        const isCurrent =
          !reached && (i === marks.length - 1 || current <= (marks[i - 1] ?? Infinity)) &&
          current > m;
        const isGoal = i === marks.length - 1;
        const last = i === marks.length - 1;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.lg }}>
            <View style={{ alignItems: 'center', width: 28 }}>
              {reached ? (
                <Ionicons name="checkmark-circle" size={26} color={c.primary} />
              ) : isCurrent ? (
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: 3,
                    borderColor: c.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary }} />
                </View>
              ) : (
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 13,
                    borderWidth: 2,
                    borderColor: c.track,
                  }}
                />
              )}
              {!last ? (
                <View style={{ width: 2, flex: 1, minHeight: 18, backgroundColor: reached ? c.primary : c.track }} />
              ) : null}
            </View>
            <View style={{ paddingBottom: last ? 0 : spacing.lg, flex: 1, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="bodyStrong" tone={reached ? 'default' : 'secondary'}>
                {m.toFixed(m % 1 === 0 ? 0 : 1)} {unit}
              </Text>
              <Text variant="caption" tone={isGoal ? 'pro' : isCurrent ? 'primary' : 'tertiary'}>
                {isGoal ? 'Goal' : reached ? 'Done' : isCurrent ? 'You are here' : ''}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}
