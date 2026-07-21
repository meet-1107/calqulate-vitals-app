import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { OptionCard } from '../../src/components/OptionCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { requestPermission } from '../../src/lib/notifications';
import { useProfile } from '../../src/store/profile';
import { spacing } from '../../src/theme';

export default function Reminders() {
  const router = useRouter();
  const { profile, patchProfile } = useProfile();
  const [choice, setChoice] = useState<'yes' | 'later' | null>(null);

  // Ask the OS only when the user opts in — a denied prompt here is expensive
  // to recover from, since iOS never shows it again.
  const choose = async (wanted: 'yes' | 'later') => {
    setChoice(wanted);
    const granted = wanted === 'yes' ? await requestPermission() : false;
    patchProfile({ settings: { ...profile.settings, notifications: granted } });
    setTimeout(() => router.push('/onboarding/account'), 220);
  };

  return (
    <Screen>
      <OnboardingHeader step={7} />
      <Text variant="title">Would you like medication reminders?</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
        A gentle nudge on injection day. You can change this anytime.
      </Text>

      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <OptionCard
          label="Yes"
          sublabel="Remind me on my injection day"
          selected={choice === 'yes'}
          onPress={() => choose('yes')}
        />
        <OptionCard
          label="Maybe Later"
          sublabel="I'll set this up in Settings"
          selected={choice === 'later'}
          onPress={() => choose('later')}
        />
      </View>
    </Screen>
  );
}
