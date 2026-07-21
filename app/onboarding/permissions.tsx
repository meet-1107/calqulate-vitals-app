import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, ButtonStack } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { requestPermission } from '../../src/lib/notifications';
import { useProfile } from '../../src/store/profile';
import { useColors } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const ITEMS = [
  { icon: 'notifications', title: 'Reminders', body: 'Dose day, weigh-in, hydration' },
  { icon: 'pulse', title: 'Health Data', body: 'Sync weight and steps' },
  { icon: 'camera', title: 'Progress Photos', body: 'Private, stored on your account' },
] as const;

export default function Permissions() {
  const c = useColors();
  const router = useRouter();
  const { profile, patchProfile } = useProfile();

  // Ask the OS only when the user opts in — a denied prompt here is expensive
  // to recover from, since iOS never shows it again.
  const next = async (wanted: boolean) => {
    const granted = wanted ? await requestPermission() : false;
    patchProfile({ settings: { ...profile.settings, notifications: granted } });
    router.push('/onboarding/premium');
  };

  return (
    <Screen
      footer={
        <ButtonStack>
          <Button title="Allow Notifications" onPress={() => next(true)} />
          <Button title="Not now" variant="ghost" onPress={() => next(false)} />
        </ButtonStack>
      }
    >
      <OnboardingHeader step={8} />
      <Text variant="title">A few permissions</Text>
      <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm }}>
        You can change any of these later.
      </Text>

      <View style={{ marginTop: spacing.xxl, gap: spacing.xl }}>
        {ITEMS.map((item) => (
          <View key={item.title} style={{ flexDirection: 'row', gap: spacing.lg, alignItems: 'center' }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.primarySoft,
              }}
            >
              <Ionicons name={item.icon} size={24} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">{item.title}</Text>
              <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                {item.body}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
