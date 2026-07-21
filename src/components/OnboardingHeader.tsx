import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useColors } from '../theme/ThemeProvider';
import { HIT, spacing } from '../theme';

export const ONBOARDING_STEPS = 8;

export function OnboardingHeader({ step, onBack }: { step: number; onBack?: () => void }) {
  const c = useColors();
  const router = useRouter();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        height: HIT,
        marginBottom: spacing.xl,
      }}
    >
      {router.canGoBack() ? (
        <Pressable
          accessibilityLabel="Back"
          hitSlop={12}
          onPress={() => (onBack ? onBack() : router.back())}
        >
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
      ) : (
        <View style={{ width: 26 }} />
      )}
      <View style={{ flex: 1, flexDirection: 'row', gap: 4 }}>
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: i < step ? c.primary : c.track,
            }}
          />
        ))}
      </View>
    </View>
  );
}
