import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { PLAN_NAME } from '../src/components/Pro';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { SECTIONS, featuresBySection } from '../src/lib/entitlements';
import { useProfile } from '../src/store/profile';
import { useColors } from '../src/theme/ThemeProvider';
import { spacing } from '../src/theme';

function Cell({ included, limit }: { included: boolean; limit?: string }) {
  const c = useColors();
  return (
    <View style={{ width: 76, alignItems: 'center' }}>
      {included ? (
        <Ionicons name="checkmark" size={18} color={c.primary} />
      ) : (
        <Text variant="caption" tone="tertiary">
          —
        </Text>
      )}
      {limit ? (
        <Text variant="micro" tone="tertiary" style={{ marginTop: 2 }}>
          {limit}
        </Text>
      ) : null}
    </View>
  );
}

export default function Plans() {
  const c = useColors();
  const router = useRouter();
  const { profile } = useProfile();

  return (
    <Screen
      scroll
      footer={
        profile.isPro ? (
          <Button title="Done" variant="secondary" onPress={() => router.back()} />
        ) : (
          <Button title={`Get ${PLAN_NAME}`} variant="pro" onPress={() => router.replace('/paywall')} />
        )
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
        }}
      >
        <Text variant="heading">What you get</Text>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="close" size={26} color={c.textSecondary} />
        </Pressable>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          marginTop: spacing.xl,
          paddingBottom: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
        }}
      >
        <View style={{ flex: 1 }} />
        <Text variant="micro" tone="tertiary" style={{ width: 76, textAlign: 'center' }}>
          FREE
        </Text>
        <Text variant="micro" tone="pro" style={{ width: 76, textAlign: 'center' }}>
          VITALS
        </Text>
      </View>

      {SECTIONS.map((section) => {
        const features = featuresBySection(section);
        if (!features.length) return null;
        return (
          <View key={section} style={{ marginTop: spacing.xl }}>
            <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase', marginBottom: spacing.sm }}>
              {section}
            </Text>
            <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
              {features.map((f, i) => (
                <View
                  key={f.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: spacing.md,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  }}
                >
                  <Text variant="caption" style={{ flex: 1, paddingRight: spacing.sm }}>
                    {f.title}
                  </Text>
                  <Cell included={f.tier === 'free'} limit={f.tier === 'free' ? f.freeLimit : undefined} />
                  <Cell included />
                </View>
              ))}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
