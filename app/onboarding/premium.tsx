import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, ButtonStack } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useProfile } from '../../src/store/profile';
import { useColors } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const BENEFITS = ['Dose reminders', 'Weekly insights', 'Progress tracking', 'Medication history'];

export default function PremiumPreview() {
  const c = useColors();
  const router = useRouter();
  const { patchProfile } = useProfile();

  // The trial is a real purchase, so it goes through the paywall rather than
  // flipping the entitlement here.
  const finish = (showPaywall: boolean) => {
    patchProfile({ onboarded: true });
    router.replace('/(tabs)');
    if (showPaywall) router.push('/paywall');
  };

  return (
    <Screen
      footer={
        <ButtonStack>
          <Button title="Try Vitals Free" variant="pro" onPress={() => finish(true)} />
          <Button title="Continue Free" variant="ghost" onPress={() => finish(false)} />
        </ButtonStack>
      }
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <LinearGradient
          colors={[c.proSoft, c.primarySoft]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.xl,
            alignItems: 'center',
          }}
        >
          <Ionicons name="sparkles" size={30} color={c.pro} />
          <Text variant="heading" style={{ marginTop: spacing.md }}>
            You&apos;re all set
          </Text>
        </LinearGradient>

        <Text variant="title" style={{ marginTop: spacing.xxl }}>
          Here&apos;s what you&apos;ll receive
        </Text>

        <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
          {BENEFITS.map((b) => (
            <View key={b} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Ionicons name="checkmark-circle" size={22} color={c.primary} />
              <Text variant="body">{b}</Text>
            </View>
          ))}
        </View>

        <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xl }}>
          7 days free, then $9.99/month. Cancel anytime.
        </Text>
      </View>
    </Screen>
  );
}
