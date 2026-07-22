import { useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { Ring } from './charts';
import { doseStamp, type MedicationCycle } from '../lib/cycle';
import { siteLabel } from '../lib/injectionSites';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

/**
 * The hero card: where am I in my cycle, and did I take my dose.
 *
 * This is the reason the app was installed, so it sits above everything else
 * and works from a single logged dose — no weigh-ins, no history, no model.
 * An overdue dose turns the card amber, because that is the one state the user
 * must not scroll past.
 */
export function MedicationHero({ cycle }: { cycle: MedicationCycle }) {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();

  const overdue = cycle.overdueHours > 0;
  const noun = cycle.route === 'oral' ? 'pill' : 'shot';
  const tint = overdue ? c.pro : c.primary;

  const nextLabel =
    cycle.nextDoseAt != null
      ? new Date(cycle.nextDoseAt).toLocaleDateString([], { weekday: 'long' }) +
        ' ' +
        new Date(cycle.nextDoseAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : 'Not scheduled';

  return (
    <LinearGradient
      colors={
        overdue
          ? [c.proSoft, c.card]
          : scheme === 'dark'
            ? [c.primarySoft, c.card]
            : [c.primarySoft, c.card]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: radius.xl,
        padding: spacing.lg + 2,
        gap: spacing.lg,
        borderWidth: scheme === 'dark' ? 1 : 0,
        borderColor: c.border,
      }}
    >
      {/* Drug, dose, and where in the cycle. */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="bodyStrong">
            {cycle.medicationName}
            {cycle.doseMg != null ? ` · ${cycle.doseMg} mg` : ''}
          </Text>
          <Text variant="micro" tone="tertiary" style={{ marginTop: 2 }}>
            {cycle.day != null ? `Day ${cycle.day} of ${cycle.cycleDays}` : 'No dose logged yet'}
          </Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/medication')} hitSlop={10}>
          <Ionicons name="chevron-forward" size={20} color={c.textTertiary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
        <Ring percent={cycle.activity} size={96} stroke={10} label={`${cycle.activity}%`} color={tint} />

        <View style={{ flex: 1, gap: spacing.sm }}>
          <View>
            <Text variant="micro" tone="tertiary">
              MEDICATION ACTIVITY
            </Text>
            {cycle.peakNote ? (
              <Text variant="caption" tone="secondary">
                {cycle.peakNote}
              </Text>
            ) : null}
          </View>

          <View>
            <Text variant="micro" tone="tertiary">
              NEXT {noun.toUpperCase()}
            </Text>
            <Text variant="bodyStrong" style={{ color: overdue ? c.pro : c.text }}>
              {overdue ? cycle.countdown : nextLabel}
            </Text>
            {!overdue ? (
              <Text variant="micro" tone="tertiary">
                {cycle.countdown}
              </Text>
            ) : null}
          </View>
        </View>
      </View>

      {/* Did I take it? The single most-asked question. */}
      <Pressable
        onPress={() => router.push({ pathname: '/quick-add', params: { kind: 'dose' } })}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.lg,
          backgroundColor: c.card,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Ionicons
          name={cycle.lastDose ? 'checkmark-circle' : 'add-circle-outline'}
          size={22}
          color={cycle.lastDose ? c.primary : tint}
        />
        <View style={{ flex: 1 }}>
          {cycle.lastDose ? (
            <>
              <Text variant="caption">
                Last {noun} · {doseStamp(cycle.lastDose.at)}
              </Text>
              <Text variant="micro" tone="tertiary" style={{ marginTop: 1 }}>
                {cycle.lastDose.amount} mg
                {cycle.lastDose.site ? ` · ${siteLabel(cycle.lastDose.site)}` : ''}
              </Text>
            </>
          ) : (
            <Text variant="caption" tone="secondary">
              Log your first {noun} to start the curve
            </Text>
          )}
        </View>
        <Text variant="caption" tone="primary">
          Log {noun}
        </Text>
      </Pressable>
    </LinearGradient>
  );
}

/** Expected symptoms for today — hunger, energy, nausea, constipation. */
export function OutlookRow({
  outlook,
}: {
  outlook: { hunger: string; energy: string; nausea: string; constipation: string };
}) {
  const c = useColors();

  // Low is good for the side effects, high is good for energy.
  const tone = (value: string, lowIsGood: boolean) => {
    if (value === 'Unknown') return c.textTertiary;
    const good = lowIsGood ? value === 'Low' : value === 'High';
    const bad = lowIsGood ? value === 'High' : value === 'Low';
    return good ? c.primary : bad ? c.pro : c.text;
  };

  const items = [
    { label: 'HUNGER', value: outlook.hunger, lowIsGood: true },
    { label: 'ENERGY', value: outlook.energy, lowIsGood: false },
    { label: 'NAUSEA', value: outlook.nausea, lowIsGood: true },
    { label: 'GI', value: outlook.constipation, lowIsGood: true },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
      {items.map((i) => (
        <View key={i.label} style={{ flex: 1, gap: 3 }}>
          <Text variant="micro" tone="tertiary" numberOfLines={1}>
            {i.label}
          </Text>
          <Text variant="bodyStrong" style={{ color: tone(i.value, i.lowIsGood) }} numberOfLines={1}>
            {i.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
