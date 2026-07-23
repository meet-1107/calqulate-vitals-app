import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { PLAN_NAME } from './Pro';
import { headlineFeatures } from '../lib/entitlements';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

/**
 * The Vitals showcase, for the Profile screen.
 *
 * Its job is to tell a free user what they are missing, in one glance, using
 * gold as the premium signal throughout — never green, which the app reserves
 * for actions the user has already earned.
 *
 * The listed features come from `headlineFeatures()`, the single source of
 * truth for the tier split, so this card can never advertise something that is
 * actually free, or fall out of step with the paywall.
 *
 * For a subscriber it flips to a quiet "you're on Vitals" state rather than
 * pushing an upgrade they already bought.
 */
export function VitalsCard({ isPro }: { isPro: boolean }) {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();

  const features = headlineFeatures().slice(0, 5);

  if (isPro) {
    return (
      <Pressable onPress={() => router.push('/paywall')}>
        <LinearGradient
          colors={[c.proSoft, c.card]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.xl,
            padding: spacing.lg + 2,
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            borderWidth: 1,
            borderColor: c.pro,
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.pro,
            }}
          >
            <Ionicons name="sparkles" size={22} color={c.onPro} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" tone="pro">
              You&apos;re on {PLAN_NAME}
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 1 }}>
              Every premium insight is unlocked. Manage your subscription.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.pro} />
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={() => router.push('/paywall')}>
      <LinearGradient
        colors={scheme === 'dark' ? [c.proSoft, c.card] : ['#FDF6E3', '#FFFDF7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius.xl,
          padding: spacing.xl,
          gap: spacing.lg,
          borderWidth: 1,
          borderColor: c.pro,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.pro,
            }}
          >
            <Ionicons name="sparkles" size={22} color={c.onPro} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{PLAN_NAME}</Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 1 }}>
              Understand what your medication is doing to your body
            </Text>
          </View>
        </View>

        <View style={{ gap: spacing.md }}>
          {features.map((f) => (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <Ionicons name="checkmark-circle" size={19} color={c.pro} style={{ marginTop: 1 }} />
              <Text variant="body" style={{ flex: 1 }}>
                {f.title}
              </Text>
            </View>
          ))}
        </View>

        {/* The upgrade action, unmistakably gold. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            minHeight: 50,
            borderRadius: radius.pill,
            backgroundColor: c.pro,
          }}
        >
          <Text variant="bodyStrong" style={{ color: c.onPro }}>
            See everything in Vitals
          </Text>
          <Ionicons name="arrow-forward" size={16} color={c.onPro} />
        </View>

        <Text variant="micro" tone="tertiary" style={{ textAlign: 'center' }}>
          7-day free trial · cancel anytime
        </Text>
      </LinearGradient>
    </Pressable>
  );
}
