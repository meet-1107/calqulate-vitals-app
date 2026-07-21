import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { OptionCard } from '../../src/components/OptionCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { MEDICATIONS, getMedication } from '../../src/lib/medications';
import type { MedicationId } from '../../src/lib/medications';
import { useProfile } from '../../src/store/profile';
import { spacing } from '../../src/theme';

export default function MedicationScreen() {
  const router = useRouter();
  const { profile, patchProfile } = useProfile();

  const choose = (id: MedicationId) => {
    const med = getMedication(id);
    // Reset the dose when the molecule changes — 0.5 mg means nothing on Zepbound.
    const keepDose = profile.doseMg != null && med.doses.includes(profile.doseMg);
    patchProfile({ medication: id, doseMg: keepDose ? profile.doseMg : null });
    setTimeout(() => router.push('/onboarding/dose'), 220);
  };

  return (
    <Screen scroll>
      <OnboardingHeader step={4} />
      <Text variant="title">Which medication are you taking?</Text>
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {MEDICATIONS.map((m) => (
          <OptionCard
            key={m.id}
            label={m.name}
            sublabel={m.molecule}
            selected={profile.medication === m.id}
            onPress={() => choose(m.id)}
          />
        ))}
      </View>
    </Screen>
  );
}
