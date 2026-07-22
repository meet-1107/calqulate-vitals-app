import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { Meter } from './charts';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { litres, type Level, type TodayBrief } from '../lib/today';
import { radius, spacing } from '../theme';

/**
 * The daily briefing.
 *
 * Free, and deliberately the first thing on the screen: it has value before the
 * user logs anything today, which is what makes it a reason to open the app
 * every morning rather than a chore to feed.
 */

function levelTone(level: Level, invert = false) {
  // For hunger, "Low" is the good outcome; for energy it is "High".
  const good = invert ? level === 'Low' : level === 'High';
  const bad = invert ? level === 'High' : level === 'Low';
  return { good, bad };
}

function Item({
  icon,
  label,
  value,
  caption,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  caption?: string;
  tint?: string;
}) {
  const c = useColors();
  return (
    <View style={{ flex: 1, minWidth: '44%', gap: 3 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={13} color={c.textTertiary} />
        <Text variant="micro" tone="tertiary">
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong" style={tint ? { color: tint } : undefined}>
        {value}
      </Text>
      {caption ? (
        <Text variant="micro" tone="tertiary" numberOfLines={1}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

export function TodayBriefing({ brief }: { brief: TodayBrief }) {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();

  const hunger = levelTone(brief.hunger, true);
  const energy = levelTone(brief.energy);

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
        gap: spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
          Today
        </Text>
        <Text variant="micro" tone="tertiary">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
        </Text>
      </View>

      {/* GLP-1 activity leads: it is what makes every other number make sense. */}
      <View>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="body" tone="secondary">
            GLP-1 activity
          </Text>
          <Text variant="title" tone="primary">
            {brief.activity}%
          </Text>
        </View>
        <View style={{ marginTop: spacing.sm }}>
          <Meter percent={brief.activity} />
        </View>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg, columnGap: spacing.md }}>
        <Item
          icon="restaurant-outline"
          label="EXPECTED HUNGER"
          value={brief.hunger}
          tint={hunger.good ? c.primary : hunger.bad ? c.pro : undefined}
        />
        <Item
          icon="flash-outline"
          label="EXPECTED ENERGY"
          value={brief.energy}
          tint={energy.good ? c.primary : energy.bad ? c.pro : undefined}
        />
        <Item
          icon="nutrition-outline"
          label="RECOMMENDED PROTEIN"
          value={`${brief.proteinTarget} g`}
          caption={brief.proteinBasis}
        />
        <Item
          icon="water-outline"
          label="HYDRATION GOAL"
          value={litres(brief.hydrationTarget)}
          caption="from your body weight"
        />
        {brief.workout ? (
          <Item
            icon="barbell-outline"
            label="WORKOUT WINDOW"
            value={brief.workout.window}
            caption={brief.workout.basis}
          />
        ) : null}
        <Item
          icon="sparkles-outline"
          label="METABOLIC SCORE"
          value={String(brief.score.total)}
          caption={brief.score.band}
          tint={c.primary}
        />
      </View>

      {brief.headline ? (
        <Text variant="caption" tone="secondary">
          {brief.headline}
        </Text>
      ) : null}

      {brief.score.available > 0 ? (
        <Pressable
          onPress={() => router.push('/score')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.pill,
            backgroundColor: c.card,
            alignSelf: 'flex-start',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="flag-outline" size={14} color={c.primary} />
          <Text variant="caption" tone="primary">
            Today&apos;s mission · +{brief.score.available} points
          </Text>
        </Pressable>
      ) : null}
    </LinearGradient>
  );
}
