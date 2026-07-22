import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import type { CoachInsight, CoachStatus } from '../lib/coach';
import { radius, spacing } from '../theme';

/**
 * Personal Coach.
 *
 * Status drives colour, so a problem is visible before a word is read — amber
 * for "watch", red for "alert", green for everything healthy. The action is a
 * real button that routes into quick-add, because an insight the user cannot
 * act on is just a notification.
 */
export function CoachCard({ insight }: { insight: CoachInsight }) {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();

  const style: Record<CoachStatus, { tint: string; soft: string; icon: keyof typeof Ionicons.glyphMap }> = {
    celebrate: { tint: c.primary, soft: c.primarySoft, icon: 'trophy' },
    on_track: { tint: c.primary, soft: c.primarySoft, icon: 'checkmark-circle' },
    setup: { tint: c.primary, soft: c.primarySoft, icon: 'sparkles' },
    watch: { tint: c.pro, soft: c.proSoft, icon: 'alert-circle' },
    alert: { tint: c.danger, soft: scheme === 'dark' ? '#2A1512' : '#FDECE8', icon: 'warning' },
  };
  const s = style[insight.status];

  return (
    <View
      style={{
        borderRadius: radius.xl,
        padding: spacing.lg + 2,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: insight.status === 'on_track' || insight.status === 'celebrate' ? c.border : s.tint,
        gap: spacing.md,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: s.soft,
          }}
        >
          <Ionicons name={s.icon} size={20} color={s.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
            Personal Coach
          </Text>
          <Text variant="bodyStrong" style={{ color: s.tint, marginTop: 1 }}>
            {insight.headline}
          </Text>
        </View>
      </View>

      <Text variant="body" tone="secondary">
        {insight.detail}
      </Text>

      {insight.action ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            insight.actionKind
              ? router.push({ pathname: '/quick-add', params: { kind: insight.actionKind } })
              : router.push('/score')
          }
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
            backgroundColor: s.soft,
            alignSelf: 'flex-start',
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Text variant="caption" style={{ color: s.tint }}>
            {insight.action}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={s.tint} />
        </Pressable>
      ) : null}
    </View>
  );
}
