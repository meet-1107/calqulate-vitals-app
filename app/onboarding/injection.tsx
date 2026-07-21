import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { WheelPicker } from '../../src/components/WheelPicker';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { DAY_LABELS, formatHour } from '../../src/lib/dates';
import { useProfile } from '../../src/store/profile';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function InjectionScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, patchProfile } = useProfile();

  return (
    <Screen
      footer={
        <Button
          title="Continue"
          disabled={profile.injectionDay == null}
          onPress={() => router.push('/onboarding/weight')}
        />
      }
    >
      <OnboardingHeader step={6} />
      <Text variant="title">When is your injection day?</Text>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
        {DAY_LABELS.map((label, i) => {
          const selected = profile.injectionDay === i;
          return (
            <Pressable
              key={label}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                patchProfile({ injectionDay: i });
              }}
              style={{
                flex: 1,
                aspectRatio: 0.72,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: selected
                  ? c.primary
                  : scheme === 'dark'
                    ? c.card
                    : c.cardAlt,
              }}
            >
              <Text
                variant="caption"
                style={{ color: selected ? c.onPrimary : c.textSecondary }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text variant="heading" style={{ marginTop: spacing.xxl }}>
        Reminder time
      </Text>
      <View style={{ marginTop: spacing.md }}>
        <WheelPicker
          values={HOURS}
          value={profile.injectionHour}
          format={formatHour}
          onChange={(h) => patchProfile({ injectionHour: h })}
        />
      </View>
    </Screen>
  );
}
