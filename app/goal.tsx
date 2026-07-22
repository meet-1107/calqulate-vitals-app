import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { WheelPicker } from '../src/components/WheelPicker';
import { weightSeries } from '../src/lib/insights';
import { formatWeight, snapToScale, toDisplay, toStored, weightScale } from '../src/lib/units';
import { pushGoal } from '../src/lib/sync';
import { useProfile } from '../src/store/profile';
import type { Units } from '../src/store/types';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

function UnitToggle({ value, onChange }: { value: Units; onChange: (u: Units) => void }) {
  const c = useColors();
  const { scheme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        padding: 3,
        borderRadius: radius.pill,
        backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
      }}
    >
      {(['lb', 'kg'] as Units[]).map((u) => (
        <Pressable
          key={u}
          onPress={() => onChange(u)}
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.sm,
            borderRadius: radius.pill,
            backgroundColor: value === u ? c.primary : 'transparent',
          }}
        >
          <Text variant="caption" style={{ color: value === u ? c.onPrimary : c.textSecondary }}>
            {u.toUpperCase()}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/**
 * Goal weight.
 *
 * Onboarding deliberately skips this to stay under two minutes, so the target
 * is set the first time the dashboard needs one. Switching units here only
 * changes the display — stored values stay in pounds.
 */
export default function GoalScreen() {
  const c = useColors();
  const router = useRouter();
  const { profile, logs, patchProfile } = useProfile();
  const units = profile.settings.units;

  // Prefer the most recent weigh-in as the starting point, so the wheels open
  // somewhere believable rather than on a default.
  const latest = weightSeries(logs).at(-1)?.value ?? null;
  const startLb = profile.startWeight ?? latest ?? toStored(units === 'lb' ? 200 : 90, units);
  const goalLb = profile.goalWeight ?? startLb - toStored(units === 'lb' ? 30 : 14, units);

  const [current, setCurrent] = useState(snapToScale(toDisplay(startLb, units), units));
  const [goal, setGoal] = useState(snapToScale(toDisplay(goalLb, units), units));

  const setUnits = (u: Units) => {
    if (u === units) return;
    // Re-express the same real weight in the new unit, then snap to its wheel.
    setCurrent(snapToScale(toDisplay(toStored(current, units), u), u));
    setGoal(snapToScale(toDisplay(toStored(goal, units), u), u));
    patchProfile({ settings: { ...profile.settings, units: u } });
  };

  const save = () => {
    const startLb = toStored(current, units);
    const goalLb = toStored(goal, units);
    patchProfile({ startWeight: startLb, goalWeight: goalLb });
    if (profile.userId) void pushGoal(profile.userId, startLb, goalLb);
    router.back();
  };

  const diff = current - goal;

  return (
    <Screen scroll footer={<Button title="Save goal" onPress={save} disabled={diff <= 0} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading">Your goal</Text>
      </View>

      <Text variant="body" tone="secondary" style={{ marginTop: spacing.md }}>
        This sets your goal progress ring and your projected goal date.
      </Text>

      <View style={{ marginTop: spacing.lg }}>
        <UnitToggle value={units} onChange={setUnits} />
      </View>

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xl }}>
        Starting weight
      </Text>
      <WheelPicker values={weightScale(units)} value={current} suffix={units} onChange={setCurrent} />

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.lg }}>
        Goal weight
      </Text>
      <WheelPicker values={weightScale(units)} value={goal} suffix={units} onChange={setGoal} />

      <Card style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <Text variant="caption" tone="secondary">
          {diff > 0 ? 'Total to lose' : 'Goal must be below your starting weight'}
        </Text>
        {diff > 0 ? (
          <Text variant="title" tone="primary" style={{ marginTop: 4 }}>
            {formatWeight(toStored(diff, units), units)} {units}
          </Text>
        ) : null}
      </Card>
    </Screen>
  );
}
