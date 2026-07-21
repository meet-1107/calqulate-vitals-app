import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button } from '../../src/components/Button';
import { Field } from '../../src/components/Field';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { getMedication } from '../../src/lib/medications';
import { useProfile } from '../../src/store/profile';
import type { DoseUnit } from '../../src/store/types';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const UNITS: DoseUnit[] = ['mg', 'mcg', 'mL', 'units'];

export default function DoseScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, patchProfile } = useProfile();
  const med = getMedication(profile.medication);

  const [value, setValue] = useState(profile.doseMg != null ? String(profile.doseMg) : '');
  const [unit, setUnit] = useState<DoseUnit>(profile.doseUnit ?? 'mg');

  const num = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(num) && num > 0;

  // Automatic conversion between mg and mcg, shown live under the field.
  const converted =
    !valid ? null
    : unit === 'mg' ? `= ${(num * 1000).toLocaleString()} mcg`
    : unit === 'mcg' ? `= ${(num / 1000).toLocaleString()} mg`
    : null;

  const submit = () => {
    // mcg is stored canonically as mg so the rest of the app speaks one unit.
    const doseMg = unit === 'mcg' ? num / 1000 : num;
    const doseUnit: DoseUnit = unit === 'mcg' ? 'mg' : unit;
    patchProfile({ doseMg, doseUnit });
    router.push('/onboarding/injection');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen scroll footer={<Button title="Continue" disabled={!valid} onPress={submit} />}>
        <OnboardingHeader step={4} />
        <Text variant="title">What dose are you currently taking?</Text>
        <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
          {med.name} · {med.molecule}
        </Text>

        <View style={{ marginTop: spacing.xxl }}>
          <Field
            label={`Dose (${unit})`}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={unit === 'mg' ? String(med.doses[0]) : ''}
          />
          {converted ? (
            <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
              {converted}
            </Text>
          ) : null}
        </View>

        <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xl }}>
          Unit
        </Text>
        <View
          style={{
            flexDirection: 'row',
            marginTop: spacing.sm,
            padding: 3,
            borderRadius: radius.pill,
            backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
          }}
        >
          {UNITS.map((u) => (
            <Pressable
              key={u}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setUnit(u);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.sm,
                borderRadius: radius.pill,
                backgroundColor: unit === u ? c.primary : 'transparent',
              }}
            >
              <Text variant="caption" style={{ color: unit === u ? c.onPrimary : c.textSecondary }}>
                {u}
              </Text>
            </Pressable>
          ))}
        </View>

        {unit === 'mg' ? (
          <>
            <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xl }}>
              Common doses
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm }}>
              {med.doses.map((d) => {
                const active = valid && num === d;
                return (
                  <Pressable
                    key={d}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setValue(String(d));
                    }}
                    style={{
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      borderRadius: radius.pill,
                      backgroundColor: active ? c.primarySoft : scheme === 'dark' ? c.card : c.cardAlt,
                      borderWidth: 1.5,
                      borderColor: active ? c.primary : 'transparent',
                    }}
                  >
                    <Text variant="caption" tone={active ? 'primary' : 'secondary'}>
                      {d} mg
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
