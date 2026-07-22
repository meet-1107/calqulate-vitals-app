import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, SectionTitle } from '../src/components/Card';
import { Ring } from '../src/components/charts';
import { ProGate } from '../src/components/Pro';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import {
  rankedScenarios,
  simulateStack,
  simulateTomorrow,
  type ScenarioId,
} from '../src/lib/tomorrow';
import { useProfile } from '../src/store/profile';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

/**
 * Tomorrow Simulator.
 *
 * The scores come from the real scoring function run over hypothetical logs, so
 * a promised +9 is exactly what the user will get if they do it. Selections
 * stack, which is the part people play with.
 */
export default function TomorrowScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, logs } = useProfile();
  const [picked, setPicked] = useState<string[]>([]);

  const sim = useMemo(() => simulateTomorrow(profile, logs), [profile, logs]);
  const ranked = useMemo(() => rankedScenarios(sim), [sim]);

  // Stacking is not additive — the score caps at 100 and components saturate —
  // so a combined pick is re-simulated rather than summed.
  const combined = useMemo(
    () => (picked.length ? simulateStack(profile, logs, picked as ScenarioId[]) : sim.baseline),
    [picked, profile, logs, sim.baseline],
  );

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading" style={{ flex: 1 }}>
          Tomorrow Simulator
        </Text>
      </View>

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
        What tomorrow looks like, depending on what you do.
      </Text>

      <ProGate feature="future.scenarios">
        <>
          <LinearGradient
            colors={scheme === 'dark' ? [c.primarySoft, c.card] : [c.primarySoft, c.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius.xl,
              padding: spacing.lg + 2,
              marginTop: spacing.lg,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.xl,
              borderWidth: scheme === 'dark' ? 1 : 0,
              borderColor: c.border,
            }}
          >
            <Ring percent={sim.baseline} size={116} stroke={12} label={String(sim.baseline)} caption="if you coast" />
            <View style={{ flex: 1, gap: 4 }}>
              <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
                Tomorrow
              </Text>
              <Text variant="body" tone="secondary">
                Today you are at {sim.today}. Do nothing tomorrow and you land at{' '}
                <Text variant="bodyStrong">{sim.baseline}</Text>.
              </Text>
              <Text variant="caption" tone="primary" style={{ marginTop: 4 }}>
                Best possible tomorrow: {sim.best}
              </Text>
            </View>
          </LinearGradient>

          <SectionTitle>What if…</SectionTitle>
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {ranked.map((r, i) => {
              const on = picked.includes(r.scenario.id);
              const positive = r.delta > 0;
              return (
                <Pressable
                  key={r.scenario.id}
                  onPress={() =>
                    setPicked((prev) =>
                      on ? prev.filter((x) => x !== r.scenario.id) : [...prev, r.scenario.id],
                    )
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingVertical: spacing.lg,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                  }}
                >
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: radius.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: r.scenario.negative ? c.proSoft : on ? c.primary : c.primarySoft,
                    }}
                  >
                    <Ionicons
                      name={r.scenario.icon as keyof typeof Ionicons.glyphMap}
                      size={17}
                      color={r.scenario.negative ? c.pro : on ? c.onPrimary : c.primary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text variant="body">{r.scenario.label}</Text>
                    <Text variant="micro" tone="tertiary" style={{ marginTop: 2 }}>
                      Score becomes {r.score}
                    </Text>
                  </View>

                  <Text
                    variant="bodyStrong"
                    style={{ color: positive ? c.primary : r.delta < 0 ? c.pro : c.textTertiary }}
                  >
                    {r.delta > 0 ? `+${r.delta}` : r.delta < 0 ? String(r.delta) : '—'}
                  </Text>
                </Pressable>
              );
            })}
          </Card>

          {picked.length ? (
            <View
              style={{
                marginTop: spacing.lg,
                padding: spacing.lg,
                borderRadius: radius.lg,
                backgroundColor: c.primarySoft,
                gap: 4,
              }}
            >
              <Text variant="caption" tone="secondary">
                All {picked.length} together
              </Text>
              <Text variant="hero" tone="primary">
                {combined}
              </Text>
              <Text variant="caption" tone="primary">
                {combined - sim.baseline > 0
                  ? `+${combined - sim.baseline} on doing nothing`
                  : 'No change'}
              </Text>
              <Pressable onPress={() => setPicked([])} style={{ marginTop: spacing.sm }}>
                <Text variant="caption" tone="secondary">
                  Clear
                </Text>
              </Pressable>
            </View>
          ) : null}

          <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.lg }}>
            These are exact. Each figure is your real score recalculated over tomorrow with that
            entry added — not an estimate of the effect.
          </Text>
        </>
      </ProGate>
    </Screen>
  );
}
