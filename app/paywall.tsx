import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, ButtonStack } from '../src/components/Button';
import { PLAN_NAME } from '../src/components/Pro';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { FEATURE_MAP, headlineFeatures, type FeatureId } from '../src/lib/entitlements';
import { FALLBACK_PLANS, getPlans, purchase, restore, type Plan, type PlanId } from '../src/lib/billing';
import { useProfile } from '../src/store/profile';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

export default function Paywall() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ feature?: string }>();
  const { profile, patchProfile } = useProfile();

  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [plan, setPlan] = useState<PlanId>('yearly');
  const [busy, setBusy] = useState(false);

  // Store-localised prices when RevenueCat is reachable; fallbacks otherwise.
  useEffect(() => {
    let cancelled = false;
    getPlans().then((p) => !cancelled && setPlans(p));
    return () => {
      cancelled = true;
    };
  }, []);

  const trigger = params.feature ? FEATURE_MAP.get(params.feature as FeatureId) : undefined;

  const buy = async () => {
    setBusy(true);
    try {
      const result = await purchase(plan);
      if (result.isPro) {
        patchProfile({ isPro: true });
        router.back();
      } else if (!result.cancelled) {
        Alert.alert('Purchase failed', 'Nothing was charged. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const restorePurchases = async () => {
    const result = await restore();
    if (result.isPro) {
      patchProfile({ isPro: true });
      router.back();
    } else {
      Alert.alert('Nothing to restore', 'No active subscription was found for this account.');
    }
  };

  if (profile.isPro) {
    return (
      <Screen footer={<Button title="Done" onPress={() => router.back()} />}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md }}>
          <Ionicons name="sparkles" size={36} color={c.pro} />
          <Text variant="title">You&apos;re on {PLAN_NAME}</Text>
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            Manage or cancel your subscription in the App Store or Play Store.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      footer={
        <ButtonStack>
          <Button title="Start Free Trial" variant="pro" loading={busy} onPress={buy} />
          <Button title="Not now" variant="ghost" onPress={() => router.back()} />
        </ButtonStack>
      }
    >
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={c.textSecondary} />
        </Pressable>
      </View>

      <LinearGradient
        colors={[c.proSoft, c.primarySoft]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.xl, padding: spacing.xl, alignItems: 'center', marginTop: spacing.md }}
      >
        <Ionicons name="sparkles" size={30} color={c.pro} />
        <Text variant="title" style={{ marginTop: spacing.md, textAlign: 'center' }}>
          {PLAN_NAME}
        </Text>
        {trigger ? (
          <Text variant="body" tone="secondary" style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            {trigger.title}
          </Text>
        ) : (
          <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs, textAlign: 'center' }}>
            Everything in Free, plus the parts that need your full history
          </Text>
        )}
      </LinearGradient>

      {trigger?.detail ? (
        <Text variant="body" style={{ marginTop: spacing.xl }}>
          {trigger.detail}
        </Text>
      ) : null}

      <View style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        {headlineFeatures()
          .filter((f) => f.id !== trigger?.id)
          .map((f) => (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md }}>
              <Ionicons name="checkmark-circle" size={22} color={c.pro} />
              <Text variant="body" style={{ flex: 1 }}>
                {f.title}
              </Text>
            </View>
          ))}
      </View>

      <Pressable onPress={() => router.push('/plans')} style={{ marginTop: spacing.lg }}>
        <Text variant="caption" tone="primary">
          Compare Free and {PLAN_NAME} →
        </Text>
      </Pressable>

      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        {plans.map((p) => {
          const active = plan === p.id;
          return (
            <Pressable
              key={p.id}
              onPress={() => setPlan(p.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                padding: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: active ? c.proSoft : scheme === 'dark' ? c.card : c.cardAlt,
                borderWidth: 1.5,
                borderColor: active ? c.pro : 'transparent',
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">
                  {p.title}
                  {p.price ? ` · ${p.price}` : ''}
                </Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                  {p.subtitle}
                </Text>
              </View>
              {p.badge ? (
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    backgroundColor: c.pro,
                  }}
                >
                  <Text variant="micro" style={{ color: c.onPro }}>
                    {p.badge}
                  </Text>
                </View>
              ) : null}
              <Ionicons
                name={active ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={active ? c.pro : c.textTertiary}
              />
            </Pressable>
          );
        })}
      </View>

      <Pressable onPress={restorePurchases} style={{ marginTop: spacing.lg }}>
        <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
          Restore purchases
        </Text>
      </Pressable>

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.md, textAlign: 'center' }}>
        Prices shown in your local currency at checkout. Cancel anytime.
      </Text>
    </Screen>
  );
}
