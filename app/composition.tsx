import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../src/components/Card';
import { Donut } from '../src/components/charts';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import {
  LEVERS,
  MPI_WEIGHTS,
  estimateComposition,
  gatherInputs,
  simulate,
  topOpportunity,
  type EngineInputs,
  type ScoreName,
} from '../src/lib/composition';
import { formatWeight } from '../src/lib/units';
import { useProfile } from '../src/store/profile';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

const SCORE_LABEL: Record<ScoreName, string> = {
  protein: 'Protein',
  strength: 'Resistance training',
  sleep: 'Sleep',
  hydration: 'Hydration',
  rate: 'Loss rate',
  age: 'Age',
  medication: 'Medication coverage',
  calories: 'Calorie deficit',
};

export default function CompositionScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, logs } = useProfile();
  const units = profile.settings.units;

  const { input, context } = useMemo(() => gatherInputs(profile, logs), [profile, logs]);
  const [overrides, setOverrides] = useState<string[]>([]);

  // The digital twin: stack the selected levers and re-run the engine.
  const simulated: EngineInputs = useMemo(
    () =>
      LEVERS.filter((l) => overrides.includes(l.id)).reduce((acc, l) => l.apply(acc), input),
    [input, overrides],
  );

  const base = useMemo(() => estimateComposition(input, context), [input, context]);
  const twin = useMemo(() => estimateComposition(simulated, context), [simulated, context]);
  const opportunity = useMemo(() => topOpportunity(input, context), [input, context]);

  const active = overrides.length > 0 ? twin : base;
  const delta = twin.fatPct - base.fatPct;

  const confidenceTint =
    active.confidenceBand === 'High' ? c.primary : active.confidenceBand === 'Moderate' ? c.pro : c.danger;

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading" style={{ flex: 1 }}>
          Body Composition
        </Text>
      </View>

      <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
        Estimated composition of this week&apos;s weight change.
      </Text>

      <Card style={{ marginTop: spacing.lg, alignItems: 'center', gap: spacing.lg }}>
        <Donut
          a={active.fatPct}
          b={active.leanPct}
          size={168}
          stroke={20}
          label={`${active.fatPct}%`}
          caption="fat loss"
        />

        <View style={{ flexDirection: 'row', gap: spacing.xl }}>
          <View style={{ alignItems: 'center' }}>
            <Text variant="micro" tone="tertiary">
              FAT LOSS
            </Text>
            <Text variant="heading" tone="primary">
              {active.fatPct}%
            </Text>
            {active.fatChange != null ? (
              <Text variant="micro" tone="secondary">
                {formatWeight(Math.abs(active.fatChange), units)} {units}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text variant="micro" tone="tertiary">
              LEAN TISSUE
            </Text>
            <Text variant="heading" tone="pro">
              {active.leanPct}%
            </Text>
            {active.leanChange != null ? (
              <Text variant="micro" tone="secondary">
                {formatWeight(Math.abs(active.leanChange), units)} {units}
              </Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text variant="micro" tone="tertiary">
              CONFIDENCE
            </Text>
            <Text variant="heading" style={{ color: confidenceTint }}>
              {active.confidence}%
            </Text>
            <Text variant="micro" tone="secondary">
              {active.confidenceBand}
            </Text>
          </View>
        </View>

        {!active.bodyFatMeasured ? (
          <Text variant="micro" tone="tertiary" style={{ textAlign: 'center' }}>
            Body fat is estimated from a population average. Add a real measurement to raise
            confidence.
          </Text>
        ) : null}
      </Card>

      {/* Muscle Preservation Index */}
      <SectionTitle>Muscle Preservation Index</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="hero" tone="primary">
            {active.mpi}
          </Text>
          <Text variant="bodyStrong" tone="secondary">
            {active.mpiBand}
          </Text>
        </View>

        {(Object.keys(MPI_WEIGHTS) as ScoreName[]).map((k) => (
          <View key={k} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="secondary">
                {SCORE_LABEL[k]}
                {active.missing.includes(k) ? ' · not logged' : ''}
              </Text>
              <Text variant="caption" tone="tertiary">
                {Math.round(active.scores[k] * 100)}% · weight {Math.round(MPI_WEIGHTS[k] * 100)}
              </Text>
            </View>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${Math.round(active.scores[k] * 100)}%`,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: active.missing.includes(k) ? c.textTertiary : c.primary,
                }}
              />
            </View>
          </View>
        ))}
      </Card>

      {/* Why */}
      {active.reasons.length ? (
        <>
          <SectionTitle>Why</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            {active.reasons.map((r) => (
              <View key={r} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}>
                <Ionicons name="checkmark-circle" size={16} color={c.primary} style={{ marginTop: 2 }} />
                <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                  {r}
                </Text>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {/* Main opportunity */}
      {opportunity ? (
        <>
          <SectionTitle>Main opportunity</SectionTitle>
          <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.primarySoft,
              }}
            >
              <Ionicons name="trending-up" size={20} color={c.primary} />
            </View>
            <Text variant="body" style={{ flex: 1 }}>
              {opportunity.lever.label} — estimated to improve lean preservation by about{' '}
              <Text variant="bodyStrong" tone="primary">
                {opportunity.gainPp} percentage points
              </Text>
              .
            </Text>
          </Card>
        </>
      ) : null}

      {/* Digital twin */}
      <SectionTitle>Simulate</SectionTitle>
      <Card style={{ gap: spacing.lg }}>
        <Text variant="caption" tone="secondary">
          Tap a change to see what it would do to this week&apos;s split.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {LEVERS.map((l) => {
            const on = overrides.includes(l.id);
            const preview = simulate(input, context, l);
            return (
              <Pressable
                key={l.id}
                onPress={() =>
                  setOverrides((prev) => (on ? prev.filter((x) => x !== l.id) : [...prev, l.id]))
                }
                style={{
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                  borderRadius: radius.pill,
                  backgroundColor: on ? c.primary : scheme === 'dark' ? c.cardAlt : c.bgElevated,
                  borderWidth: 1.5,
                  borderColor: on ? c.primary : 'transparent',
                }}
              >
                <Text variant="caption" style={{ color: on ? c.onPrimary : c.text }}>
                  {l.label}
                </Text>
                <Text
                  variant="micro"
                  style={{ color: on ? c.onPrimary : c.textTertiary, marginTop: 2 }}
                >
                  {preview.gainPp > 0 ? `+${preview.gainPp}pp fat share` : 'no change'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {overrides.length ? (
          <View
            style={{
              padding: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: c.primarySoft,
              gap: 4,
            }}
          >
            <Text variant="caption" tone="secondary">
              Simulated result
            </Text>
            <Text variant="heading" tone="primary">
              {twin.fatPct}% fat / {twin.leanPct}% lean
            </Text>
            <Text variant="caption" tone="primary">
              {delta > 0 ? `+${delta} percentage points versus today` : 'Same as today'} · MPI {base.mpi} →{' '}
              {twin.mpi}
            </Text>
            <Pressable onPress={() => setOverrides([])} style={{ marginTop: spacing.sm }}>
              <Text variant="caption" tone="secondary">
                Reset
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xl }}>
        This is a model, not a measurement. The split is estimated from Forbes&apos; rule for body
        composition, your logged habits, and — when calories are known — conservation of energy. A
        DXA scan is the only way to measure it directly.
      </Text>
    </Screen>
  );
}
