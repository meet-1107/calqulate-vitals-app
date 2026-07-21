import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../../src/components/Button';
import { Logo } from '../../src/components/Logo';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { useColors } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme';

const PILLARS = ['Medication', 'Weight', 'Side Effects', 'Progress'];

export default function Welcome() {
  const c = useColors();
  const router = useRouter();

  return (
    <Screen
      footer={<Button title="Continue" onPress={() => router.push('/onboarding/reason')} />}
    >
      <OnboardingHeader step={1} />
      <Logo size={132} style={{ marginTop: spacing.xxl }} />
      <Text variant="title" style={{ marginTop: spacing.xxxl, textAlign: 'center' }}>
        Track your GLP-1 journey with confidence.
      </Text>
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        {PILLARS.map((p) => (
          <View key={p} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="checkmark-circle" size={22} color={c.primary} />
            <Text variant="body">{p}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}
