import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../src/components/Button';
import { Field } from '../src/components/Field';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { useProfile } from '../src/store/profile';
import type { LogKind } from '../src/store/types';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

type Kind = LogKind;

const KINDS: { id: Kind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'weight', label: 'Weight', icon: 'scale-outline' },
  { id: 'meal', label: 'Meal', icon: 'restaurant-outline' },
  { id: 'water', label: 'Water', icon: 'water-outline' },
  { id: 'symptom', label: 'Symptoms', icon: 'pulse-outline' },
  { id: 'activity', label: 'Activity', icon: 'walk-outline' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline' },
  { id: 'dose', label: 'Dose', icon: 'medkit-outline' },
  { id: 'photo', label: 'Photo', icon: 'camera-outline' },
];

const WATER_PRESETS = [250, 500, 750];
const FEELING_FINE = 'Feeling fine';
const SYMPTOMS = [
  FEELING_FINE,
  'Nausea',
  'Fatigue',
  'Constipation',
  'Headache',
  'Heartburn',
  'Injection site',
];
const ACTIVITY_PRESETS = [15, 30, 45, 60];

export default function QuickAdd() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ kind?: string }>();
  const { profile, addLog } = useProfile();

  const [kind, setKind] = useState<Kind>((params.kind as Kind) ?? 'weight');
  const [value, setValue] = useState('');
  const [label, setLabel] = useState('');
  const [severity, setSeverity] = useState(2);

  const units = profile.settings.units;

  const save = (amount: number, extra?: { label?: string }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addLog(kind as LogKind, amount, extra);
    router.back();
  };

  const canSave = kind === 'symptom' ? label.length > 0 : Number(value) > 0;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        scroll
        footer={
          kind === 'water' || kind === 'photo' ? undefined : (
            <Button
              title="Save"
              disabled={!canSave}
              onPress={() =>
                kind === 'symptom'
                  ? save(label === FEELING_FINE ? 0 : severity, { label })
                  : save(Number(value), { label: label || undefined })
              }
            />
          )
        }
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.sm,
          }}
        >
          <Text variant="heading">Quick add</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="close" size={26} color={c.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xl }}
        >
          {KINDS.map((k) => {
            const active = kind === k.id;
            return (
              <Pressable
                key={k.id}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  setKind(k.id);
                  setValue('');
                  setLabel('');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.pill,
                  backgroundColor: active ? c.primary : scheme === 'dark' ? c.card : c.cardAlt,
                }}
              >
                <Ionicons name={k.icon} size={18} color={active ? c.onPrimary : c.textSecondary} />
                <Text variant="caption" style={{ color: active ? c.onPrimary : c.textSecondary }}>
                  {k.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {kind === 'weight' ? (
          <Field
            label={`Weight (${units})`}
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="183.2"
            autoFocus
          />
        ) : null}

        {kind === 'meal' ? (
          <View style={{ gap: spacing.lg }}>
            <Field label="Meal" value={label} onChangeText={setLabel} placeholder="Greek yogurt" />
            <Field
              label="Protein (g)"
              value={value}
              onChangeText={setValue}
              keyboardType="number-pad"
              placeholder="24"
            />
          </View>
        ) : null}

        {kind === 'water' ? (
          <View style={{ gap: spacing.md }}>
            {WATER_PRESETS.map((ml) => (
              <Pressable
                key={ml}
                onPress={() => save(ml)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
                }}
              >
                <Text variant="bodyStrong">{ml} ml</Text>
                <Ionicons name="add-circle" size={24} color={c.primary} />
              </Pressable>
            ))}
          </View>
        ) : null}

        {kind === 'symptom' ? (
          <View style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SYMPTOMS.map((s) => {
                const active = label === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => setLabel(s)}
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
                      {s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ display: label === FEELING_FINE ? 'none' : 'flex' }}>
              <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
                Severity
              </Text>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setSeverity(n)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.md,
                      alignItems: 'center',
                      borderRadius: radius.md,
                      backgroundColor: severity === n ? c.primary : scheme === 'dark' ? c.card : c.cardAlt,
                    }}
                  >
                    <Text
                      variant="bodyStrong"
                      style={{ color: severity === n ? c.onPrimary : c.textSecondary }}
                    >
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        {kind === 'activity' ? (
          <View style={{ gap: spacing.lg }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              {ACTIVITY_PRESETS.map((min) => (
                <Pressable
                  key={min}
                  onPress={() => setValue(String(min))}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.lg,
                    alignItems: 'center',
                    borderRadius: radius.md,
                    backgroundColor:
                      value === String(min) ? c.primarySoft : scheme === 'dark' ? c.card : c.cardAlt,
                    borderWidth: 1.5,
                    borderColor: value === String(min) ? c.primary : 'transparent',
                  }}
                >
                  <Text variant="bodyStrong">{min}</Text>
                  <Text variant="micro" tone="tertiary">
                    MIN
                  </Text>
                </Pressable>
              ))}
            </View>
            <Field label="Activity" value={label} onChangeText={setLabel} placeholder="Walk" />
          </View>
        ) : null}

        {kind === 'sleep' ? (
          <Field
            label="Hours slept"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="7.5"
            autoFocus
          />
        ) : null}

        {kind === 'dose' ? (
          <Field
            label="Dose (mg)"
            value={value}
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder={String(profile.doseMg ?? 0.5)}
            autoFocus
          />
        ) : null}

        {kind === 'photo' ? (
          <View
            style={{
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.xxl,
              borderRadius: radius.xl,
              borderWidth: 1.5,
              borderStyle: 'dashed',
              borderColor: c.border,
            }}
          >
            <Ionicons name="camera-outline" size={32} color={c.textTertiary} />
            <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
              Progress photos need camera access. Enable it in Settings.
            </Text>
          </View>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
