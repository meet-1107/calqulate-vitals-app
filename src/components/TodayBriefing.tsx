import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { Ring } from './charts';
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

/**
 * One stat in the row.
 *
 * Short label, value, nothing else. The previous version carried an icon and an
 * explanatory caption per cell, which collided with its neighbour, truncated,
 * and left the grid ragged. The explanation belongs in the sentence below the
 * row, not in six competing footnotes.
 */
/** One line describing where in the dose cycle this level sits. */
const PHASE_CAPTION: Record<TodayBrief['phase'], string> = {
  rising: 'Rising after your dose',
  peak: 'Peak coverage',
  declining: 'Easing off mid-cycle',
  trough: 'Low before your next dose',
  overdue: 'Dose overdue',
  none: 'Log a dose to start the curve',
};

function Stat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={{ flex: 1, gap: 3 }}>
      <Text variant="micro" tone="tertiary" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="bodyStrong" style={tint ? { color: tint } : undefined} numberOfLines={1}>
        {value}
      </Text>
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

      {/* GLP-1 activity leads: it is what makes every other number make sense.
          A ring rather than a bar — it reads as a level at a glance and matches
          the score and confidence rings used elsewhere. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Ring percent={brief.activity} size={96} stroke={10} label={`${brief.activity}%`} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyStrong">GLP-1 activity</Text>
          <Text variant="caption" tone="secondary">
            {PHASE_CAPTION[brief.phase]}
          </Text>
        </View>
      </View>

      {/* Four stats, one row, equal widths. The Metabolic Score is deliberately
          absent: the very next card on Home is the score, and showing it twice
          made this card look busy while saying nothing new. */}
      <View style={{ height: 1, backgroundColor: c.border }} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Stat
          label="HUNGER"
          value={brief.hunger}
          tint={hunger.good ? c.primary : hunger.bad ? c.pro : undefined}
        />
        <Stat
          label="ENERGY"
          value={brief.energy}
          tint={energy.good ? c.primary : energy.bad ? c.pro : undefined}
        />
        <Stat label="PROTEIN" value={`${brief.proteinTarget} g`} />
        <Stat label="WATER" value={litres(brief.hydrationTarget)} />
      </View>
      <View style={{ height: 1, backgroundColor: c.border }} />

      {brief.headline ? (
        <Text variant="caption" tone="secondary">
          {brief.headline}
        </Text>
      ) : null}

      {brief.workout ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Ionicons name="barbell-outline" size={13} color={c.textTertiary} />
          <Text variant="micro" tone="tertiary">
            Best window to train: {brief.workout.window} · {brief.workout.basis.toLowerCase()}
          </Text>
        </View>
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
