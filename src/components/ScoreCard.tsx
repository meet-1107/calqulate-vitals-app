import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { Ring } from './charts';
import type { MetabolicScore } from '../lib/score';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

/**
 * The signature card. Score, band, and the headline that makes it a game:
 * how many points are still on the table today.
 */
export function ScoreCard({ score, delta }: { score: MetabolicScore; delta?: number }) {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();

  return (
    <LinearGradient
      colors={scheme === 'dark' ? [c.primarySoft, c.card] : [c.primarySoft, c.card]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: radius.xl,
        padding: spacing.lg + 2,
        borderWidth: scheme === 'dark' ? 1 : 0,
        borderColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
            Metabolic Score
          </Text>
          {delta != null && delta !== 0 ? (
            <Text variant="micro" tone={delta > 0 ? 'primary' : 'secondary'}>
              {delta > 0 ? '↑' : '↓'} {delta > 0 ? '+' : ''}
              {delta} pts
            </Text>
          ) : null}
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={c.textTertiary}
          onPress={() => router.push('/score')}
        />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl, marginTop: spacing.md }}>
        <Ring percent={score.total} size={124} stroke={13} label={String(score.total)} caption={score.band} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          {score.available > 0 ? (
            <Text variant="bodyStrong" tone="primary">
              +{score.available} points available today
            </Text>
          ) : (
            <Text variant="bodyStrong" tone="primary">
              Every point earned today
            </Text>
          )}
          {score.actions.slice(0, 3).map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Ionicons name="ellipse-outline" size={14} color={c.textTertiary} />
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {a.title}
              </Text>
              <Text variant="caption" tone="primary">
                +{a.points}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </LinearGradient>
  );
}
