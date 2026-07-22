import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import type { DoseEvent, SideEffect } from '../lib/medicationLog';
import { radius, spacing } from '../theme';

const dateLabel = (at: number) =>
  new Date(at).toLocaleDateString([], { month: 'short', day: 'numeric' });
const timeLabel = (at: number) =>
  new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

/**
 * Dose history as a timeline.
 *
 * A connected rail rather than a table, because the useful information is the
 * shape of the treatment: where the dose stepped up, and where a week was
 * missed. Both are called out rather than left for the reader to spot.
 */
export function DoseTimeline({ events, unit = 'mg' }: { events: DoseEvent[]; unit?: string }) {
  const c = useColors();

  if (!events.length) {
    return (
      <Text variant="body" tone="secondary">
        No doses logged yet. The first one starts your history.
      </Text>
    );
  }

  return (
    <View>
      {events.map((e, i) => {
        const isChange = e.change === 'increase' || e.change === 'decrease';
        const tint = e.change === 'increase' ? c.primary : e.change === 'decrease' ? c.pro : c.textTertiary;

        return (
          <View key={e.id} style={{ flexDirection: 'row', gap: spacing.md }}>
            {/* Rail */}
            <View style={{ alignItems: 'center', width: 24 }}>
              <View
                style={{
                  width: isChange ? 14 : 10,
                  height: isChange ? 14 : 10,
                  borderRadius: radius.pill,
                  backgroundColor: isChange ? tint : c.track,
                  borderWidth: isChange ? 0 : 2,
                  borderColor: c.primary,
                  marginTop: 4,
                }}
              />
              {i < events.length - 1 ? (
                <View style={{ flex: 1, width: 2, backgroundColor: c.border, marginVertical: 2 }} />
              ) : null}
            </View>

            <View style={{ flex: 1, paddingBottom: i < events.length - 1 ? spacing.lg : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
                <Text variant="bodyStrong">
                  {e.amount} {unit}
                </Text>
                <Text variant="micro" tone="tertiary">
                  {dateLabel(e.at)} · {timeLabel(e.at)}
                </Text>
              </View>

              {isChange ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                  <Ionicons
                    name={e.change === 'increase' ? 'arrow-up-circle' : 'arrow-down-circle'}
                    size={13}
                    color={tint}
                  />
                  <Text variant="micro" style={{ color: tint }}>
                    {e.change === 'increase' ? 'Increased' : 'Reduced'} from {e.from} {unit}
                  </Text>
                </View>
              ) : null}

              {e.change === 'start' ? (
                <Text variant="micro" tone="primary" style={{ marginTop: 2 }}>
                  First dose logged
                </Text>
              ) : null}

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: 2 }}>
                {e.siteName ? (
                  <Text variant="micro" tone="tertiary">
                    {e.siteName}
                  </Text>
                ) : null}
                {e.gapDays != null ? (
                  <Text variant="micro" style={{ color: e.late ? c.pro : c.textTertiary }}>
                    {e.late ? `${e.gapDays} days later` : `+${e.gapDays}d`}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Side effects, worst first, with severity and where they land in the cycle. */
export function SideEffectList({ effects }: { effects: SideEffect[] }) {
  const c = useColors();

  if (!effects.length) {
    return (
      <Text variant="body" tone="secondary">
        No side effects logged in the last month. Checking in on a good day is worth as much as on
        a bad one — it is what makes the pattern real.
      </Text>
    );
  }

  const trendTone = (t: SideEffect['trend']) =>
    t === 'better' ? c.primary : t === 'worse' ? c.pro : c.textSecondary;
  const trendLabel = (t: SideEffect['trend']) =>
    t === 'better' ? 'Easing' : t === 'worse' ? 'Worsening' : t === 'new' ? 'New' : 'Steady';

  return (
    <View style={{ gap: spacing.lg }}>
      {effects.map((e) => (
        <View key={e.name} style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="bodyStrong" style={{ flex: 1 }}>
              {e.name}
            </Text>
            <Text variant="micro" style={{ color: trendTone(e.trend) }}>
              {trendLabel(e.trend)}
            </Text>
          </View>

          {/* Severity as five pips — a 1-5 scale reads faster than a number. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View style={{ flexDirection: 'row', gap: 3 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <View
                  key={n}
                  style={{
                    width: 18,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: n <= Math.round(e.severity) ? c.pro : c.track,
                  }}
                />
              ))}
            </View>
            <Text variant="micro" tone="tertiary">
              {e.count}× this month
              {e.typicalDay != null ? ` · usually day ${e.typicalDay}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
