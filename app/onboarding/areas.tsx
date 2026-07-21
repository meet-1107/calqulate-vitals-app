import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { useProfile } from '../../src/store/profile';
import type { TrackArea } from '../../src/store/types';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const AREAS: { id: TrackArea; label: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'side_effects', label: 'Side Effects' },
  { id: 'protein', label: 'Protein' },
  { id: 'water', label: 'Water' },
  { id: 'activity', label: 'Activity' },
  { id: 'blood_sugar', label: 'Blood Sugar' },
];

export default function AreasScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, patchProfile } = useProfile();
  const selected = profile.trackAreas ?? [];

  const toggle = (id: TrackArea) => {
    Haptics.selectionAsync().catch(() => {});
    patchProfile({
      trackAreas: selected.includes(id) ? selected.filter((a) => a !== id) : [...selected, id],
    });
  };

  return (
    <Screen
      scroll
      footer={
        <Button
          title="Continue"
          disabled={selected.length === 0}
          onPress={() => router.push('/onboarding/permissions')}
        />
      }
    >
      <OnboardingHeader step={6} />
      <Text variant="title">Which areas would you like to keep track of?</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
        You can change these anytime.
      </Text>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {AREAS.map((a) => {
          const on = selected.includes(a.id);
          return (
            <Pressable
              key={a.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => toggle(a.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: on ? c.primarySoft : scheme === 'dark' ? c.card : c.cardAlt,
                borderWidth: 1.5,
                borderColor: on ? c.primary : 'transparent',
              }}
            >
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={22}
                color={on ? c.primary : c.textTertiary}
              />
              <Text variant="bodyStrong">{a.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Screen>
  );
}
