import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { WheelPicker } from '../../src/components/WheelPicker';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { getMedication } from '../../src/lib/medications';
import { useProfile } from '../../src/store/profile';
import { spacing } from '../../src/theme';

export default function DoseScreen() {
  const router = useRouter();
  const { profile, patchProfile } = useProfile();
  const med = getMedication(profile.medication);
  const dose = profile.doseMg ?? med.doses[0];

  return (
    <Screen
      footer={
        <Button
          title="Continue"
          onPress={() => {
            patchProfile({ doseMg: dose });
            router.push('/onboarding/injection');
          }}
        />
      }
    >
      <OnboardingHeader step={5} />
      <Text variant="title">Current dose</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
        {med.name} · {med.molecule}
      </Text>
      <View style={{ marginTop: spacing.xxl }}>
        <WheelPicker
          values={med.doses}
          value={dose}
          suffix="mg"
          format={(v) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0$/, ''))}
          onChange={(v) => patchProfile({ doseMg: v })}
        />
      </View>
    </Screen>
  );
}
