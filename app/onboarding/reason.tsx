import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { OptionCard } from '../../src/components/OptionCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { useProfile } from '../../src/store/profile';
import type { Reason } from '../../src/store/types';
import { spacing } from '../../src/theme';

const REASONS: { id: Reason; label: string; sub: string }[] = [
  { id: 'weight_loss', label: 'Weight Loss', sub: 'Reach and hold a goal weight' },
  { id: 'diabetes', label: 'Diabetes', sub: 'Manage blood sugar alongside treatment' },
  { id: 'health', label: 'Health Improvement', sub: 'Feel better day to day' },
  { id: 'tracking', label: 'Just Tracking', sub: 'Keep a clean record of everything' },
];

export default function ReasonScreen() {
  const router = useRouter();
  const { profile, patchProfile } = useProfile();

  // Tap once, advance automatically — no second confirm tap.
  const choose = (id: Reason) => {
    patchProfile({ reason: id });
    setTimeout(() => router.push('/onboarding/account'), 220);
  };

  return (
    <Screen>
      <OnboardingHeader step={2} />
      <Text variant="title">Why are you here?</Text>
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {REASONS.map((r) => (
          <OptionCard
            key={r.id}
            label={r.label}
            sublabel={r.sub}
            selected={profile.reason === r.id}
            onPress={() => choose(r.id)}
          />
        ))}
      </View>
    </Screen>
  );
}
