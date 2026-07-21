import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { Card } from './Card';
import { getFeature, isPremium, type FeatureId } from '../lib/entitlements';
import { useProfile } from '../store/profile';
import { useColors } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

/** The premium plan's name in user-facing copy. */
export const PLAN_NAME = 'Calqulate Vitals';

export function useEntitlement(id: FeatureId) {
  const { profile } = useProfile();
  const feature = getFeature(id);
  return { feature, unlocked: !isPremium(id) || profile.isPro };
}

export function ProBadge({ label = 'VITALS' }: { label?: string }) {
  const c = useColors();
  return (
    <View
      style={{
        paddingHorizontal: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.pill,
        backgroundColor: c.proSoft,
      }}
    >
      <Text variant="micro" tone="pro">
        {label}
      </Text>
    </View>
  );
}

/**
 * Wraps a premium surface. When locked, the feature's own promise is shown
 * rather than a generic "upgrade" — the user should know what they are missing.
 */
export function ProGate({
  feature: id,
  children,
  preview,
}: {
  feature: FeatureId;
  children: ReactNode;
  /** Optional dimmed teaser rendered behind the lock. */
  preview?: ReactNode;
}) {
  const c = useColors();
  const router = useRouter();
  const { unlocked, feature } = useEntitlement(id);

  if (unlocked) return <>{children}</>;

  return (
    <Card onPress={() => router.push({ pathname: '/paywall', params: { feature: id } })}>
      {preview ? <View style={{ opacity: 0.28 }} pointerEvents="none">{preview}</View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginTop: preview ? spacing.lg : 0 }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.proSoft,
          }}
        >
          <Ionicons name="lock-closed" size={18} color={c.pro} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {feature.title}
            </Text>
            <ProBadge />
          </View>
          {feature.detail ? (
            <Text variant="caption" tone="secondary">
              {feature.detail}
            </Text>
          ) : null}
          <Text variant="caption" tone="pro" style={{ marginTop: 2 }}>
            Unlock with {PLAN_NAME}
          </Text>
        </View>
      </View>
    </Card>
  );
}
