import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { WheelPicker } from '../../src/components/WheelPicker';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { useProfile } from '../../src/store/profile';
import type { Units } from '../../src/store/types';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => +(from + i * step).toFixed(1));

const SCALE: Record<Units, number[]> = {
  lb: range(80, 500, 1),
  kg: range(36, 227, 0.5),
};

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

export default function WeightScreen() {
  const router = useRouter();
  const { profile, patchProfile, addLog } = useProfile();
  const units = profile.settings.units;
  const values = SCALE[units];

  const [current, setCurrent] = useState(profile.startWeight ?? (units === 'lb' ? 210 : 95));
  const [goal, setGoal] = useState(profile.goalWeight ?? (units === 'lb' ? 170 : 77));

  const setUnits = (u: Units) => {
    const factor = u === 'kg' ? 0.4536 : 2.2046;
    const snap = (v: number) =>
      SCALE[u].reduce((best, x) => (Math.abs(x - v * factor) < Math.abs(best - v * factor) ? x : best));
    setCurrent(snap(current));
    setGoal(snap(goal));
    patchProfile({ settings: { ...profile.settings, units: u } });
  };

  const submit = () => {
    patchProfile({ startWeight: current, goalWeight: goal });
    addLog('weight', current);
    router.push('/onboarding/permissions');
  };

  return (
    <Screen scroll footer={<Button title="Continue" onPress={submit} />}>
      <OnboardingHeader step={7} />
      <Text variant="title">Where are you starting?</Text>
      <View style={{ marginTop: spacing.lg }}>
        <UnitToggle value={units} onChange={setUnits} />
      </View>

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xl }}>
        Current weight
      </Text>
      <WheelPicker values={values} value={current} suffix={units} onChange={setCurrent} />

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.lg }}>
        Goal weight
      </Text>
      <WheelPicker values={values} value={goal} suffix={units} onChange={setGoal} />

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
        {current > goal
          ? `${(current - goal).toFixed(1)} ${units} to go`
          : 'Goal is at or above your current weight'}
      </Text>
    </Screen>
  );
}
