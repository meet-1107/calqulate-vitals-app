import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../../src/components/Card';
import {
  Donut,
  LineChart,
  Meter,
  PositionGauge,
  Ring,
  RiverChart,
  StackedBar,
  StatTile,
} from '../../src/components/charts';
import { ProGate } from '../../src/components/Pro';
import { Roadmap } from '../../src/components/Roadmap';
import { StoryCards } from '../../src/components/StoryCards';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { DAY } from '../../src/lib/dates';
import { FREE_HISTORY_DAYS } from '../../src/lib/entitlements';
import { formatWeight } from '../../src/lib/units';
import { computeBenchmark } from '../../src/lib/benchmark';
import { computeBodyComp, riverWeeks } from '../../src/lib/bodycomp';
import {
  changeOverDays,
  computeToday,
  detectPlateau,
  goalProgress,
  projectGoalDate,
  projectedWeightAt,
  projectionSeries,
  totalChange,
  weightSeries,
} from '../../src/lib/insights';
import { weeklyStory } from '../../src/lib/story';
import { useProfile } from '../../src/store/profile';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const RANGES = [
  { label: '1W', days: 7 },
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: 'All', days: 3650, premium: true },
];

function RangeSelector({
  value,
  onChange,
  locked,
}: {
  value: number;
  onChange: (d: number) => void;
  locked: boolean;
}) {
  const c = useColors();
  const { scheme } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        padding: 3,
        borderRadius: radius.pill,
        backgroundColor: scheme === 'dark' ? c.cardAlt : c.bgElevated,
      }}
    >
      {RANGES.map((r) => {
        const gated = !!r.premium && locked;
        return (
          <Pressable
            key={r.label}
            onPress={() => onChange(r.days)}
            style={{
              flex: 1,
              flexDirection: 'row',
              gap: 3,
              paddingVertical: spacing.sm,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.pill,
              backgroundColor: value === r.days ? c.card : 'transparent',
            }}
          >
            <Text variant="caption" tone={value === r.days ? 'default' : 'secondary'}>
              {r.label}
            </Text>
            {gated ? <Ionicons name="lock-closed" size={11} color={c.pro} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function Progress() {
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, logs } = useProfile();
  const [days, setDays] = useState(30);

  const units = profile.settings.units;
  const chartWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;

  // Free accounts see 90 days; the full timeline is what Vitals keeps forever.
  const windowDays = profile.isPro ? days : Math.min(days, FREE_HISTORY_DAYS);

  // History inside the window plus the dotted "Future You" projection.
  const projected = useMemo(() => projectionSeries(profile, logs, 12), [profile, logs]);
  const chart = useMemo(() => {
    const cutoff = Date.now() - windowDays * DAY;
    if (projected.projectedFrom == null) {
      return { series: weightSeries(logs).filter((p) => p.t >= cutoff), projectedFrom: undefined };
    }
    const history = projected.series.slice(0, projected.projectedFrom + 1).filter((p) => p.t >= cutoff);
    const future = projected.series.slice(projected.projectedFrom + 1);
    return {
      series: [...history, ...future],
      projectedFrom: history.length > 0 ? history.length - 1 : undefined,
    };
  }, [logs, projected, windowDays]);

  const today = useMemo(() => computeToday(profile, logs), [profile, logs]);
  const total = totalChange(profile, logs);
  const week = changeOverDays(logs, 7);
  const progress = goalProgress(profile, logs);
  const goalDate = projectGoalDate(profile, logs);

  const comp = useMemo(() => computeBodyComp(profile, logs), [profile, logs]);
  const river = useMemo(() => riverWeeks(profile, logs), [profile, logs]);
  const plateau = useMemo(() => detectPlateau(profile, logs), [profile, logs]);
  const benchmark = useMemo(() => computeBenchmark(profile, logs), [profile, logs]);
  const stories = useMemo(() => weeklyStory(profile, logs), [profile, logs]);

  const in4 = projectedWeightAt(profile, logs, 4);
  const in8 = projectedWeightAt(profile, logs, 8);
  const in12 = projectedWeightAt(profile, logs, 12);

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        Progress
      </Text>

      {stories.length > 0 ? (
        <>
          <SectionTitle>This week&apos;s story</SectionTitle>
          <StoryCards cards={stories} />
        </>
      ) : null}

      <SectionTitle>Body weight</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.lg }}>
          <StatTile
            label="Current"
            value={today.weight != null ? today.weight.toFixed(1) : '—'}
            unit={units}
          />
          <StatTile
            label="This week"
            value={week != null ? `${week <= 0 ? '−' : '+'}${Math.abs(week).toFixed(1)}` : '—'}
            unit={units}
            tone={week != null && week <= 0 ? 'down' : undefined}
          />
          <StatTile
            label="Total"
            value={total != null ? `${total <= 0 ? '−' : '+'}${Math.abs(total).toFixed(1)}` : '—'}
            unit={units}
            tone={total != null && total <= 0 ? 'down' : undefined}
          />
        </View>
        <LineChart
          data={chart.series}
          width={chartWidth}
          height={180}
          projectedFrom={chart.projectedFrom}
        />
        {chart.projectedFrom != null ? (
          <Text variant="micro" tone="tertiary" style={{ marginTop: spacing.sm }}>
            Dotted line: your projected path at the current pace
          </Text>
        ) : null}
        <View style={{ marginTop: spacing.lg }}>
          <RangeSelector value={days} onChange={setDays} locked={!profile.isPro} />
        </View>
        {!profile.isPro && days > FREE_HISTORY_DAYS ? (
          <Text variant="caption" tone="pro" style={{ marginTop: spacing.md }}>
            Showing the last {FREE_HISTORY_DAYS} days. Vitals keeps your full timeline.
          </Text>
        ) : null}
      </Card>

      {plateau ? (
        <Card
          style={{
            marginTop: spacing.md,
            flexDirection: 'row',
            gap: spacing.md,
            alignItems: 'flex-start',
          }}
        >
          <Ionicons name="pause-circle" size={22} color={c.pro} />
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">Plateau detected · {plateau.days} days</Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
              {plateau.reason}
            </Text>
          </View>
        </Card>
      ) : null}

      {comp && comp.totalLost < 0 ? (
        <>
          <SectionTitle>Body composition journey</SectionTitle>
          <Card style={{ gap: spacing.xl }}>
            <View>
              <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
                What you lost
              </Text>
              <StackedBar
                a={comp.fatLost}
                b={comp.leanLost}
                aLabel={`Fat ${formatWeight(comp.fatLost, units)} ${units}`}
                bLabel={`Muscle ${formatWeight(comp.leanLost, units)} ${units}`}
              />
            </View>

            <View>
              <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
                Fat vs muscle over time
              </Text>
              <RiverChart weeks={river} width={chartWidth} height={150} />
            </View>

            <View>
              <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.lg }}>
                Muscle protection
              </Text>
              <PositionGauge
                percent={comp.musclePreservationPct}
                leftLabel="At risk"
                rightLabel="Protected"
                verdict={`${comp.musclePreservationPct.toFixed(0)}% · ${comp.preservationBand}`}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
              <Donut
                a={comp.leanMassNow}
                b={comp.fatMassNow}
                label={today.weight != null ? `${today.weight.toFixed(0)}` : '—'}
                caption={units}
              />
              <View style={{ flex: 1, gap: spacing.md }}>
                <StatTile label="Lean mass" value={comp.leanMassNow.toFixed(1)} unit={units} />
                <StatTile label="Fat mass" value={comp.fatMassNow.toFixed(1)} unit={units} />
                <StatTile label="Body fat" value={`${comp.bodyFatPctNow}`} unit="%" />
              </View>
            </View>

            <Text variant="micro" tone="tertiary">
              Estimated from your weight, protein and activity — not a body scan. Log consistently
              to keep it honest.
            </Text>
          </Card>
        </>
      ) : null}

      {benchmark && benchmark.verdict !== 'early' ? (
        <>
          <SectionTitle>Versus clinical trials</SectionTitle>
          <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
            <Ionicons
              name={
                benchmark.verdict === 'ahead'
                  ? 'rocket'
                  : benchmark.verdict === 'on-track'
                    ? 'checkmark-circle'
                    : 'time'
              }
              size={22}
              color={benchmark.verdict === 'behind' ? c.textSecondary : c.primary}
            />
            <View style={{ flex: 1 }}>
              <Text variant="bodyStrong">
                {benchmark.verdict === 'ahead'
                  ? `Ahead of the ${benchmark.trialName} trial average`
                  : benchmark.verdict === 'on-track'
                    ? `On track with the ${benchmark.trialName} trial average`
                    : `Behind the ${benchmark.trialName} trial average — normal, everyone's pace differs`}
              </Text>
              <Text variant="caption" tone="secondary" style={{ marginTop: 4 }}>
                Week {benchmark.weeks}: you −{benchmark.actualPct}% vs trial −{benchmark.expectedPct}% of
                body weight.
              </Text>
            </View>
          </Card>
        </>
      ) : null}

      <SectionTitle>Goal</SectionTitle>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
        <Ring percent={progress} size={112} caption="to goal" />
        <View style={{ flex: 1, gap: spacing.md }}>
          <StatTile label="Start" value={profile.startWeight != null ? formatWeight(profile.startWeight, units) : '—'} unit={units} />
          <StatTile label="Goal" value={profile.goalWeight != null ? formatWeight(profile.goalWeight, units) : '—'} unit={units} />
        </View>
      </Card>

      <SectionTitle>Future you</SectionTitle>
      <ProGate feature="overview.goal-date">
        <Card style={{ gap: spacing.lg }}>
          {in4 != null || in8 != null || in12 != null ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              {(
                [
                  ['In 4 weeks', in4],
                  ['In 8 weeks', in8],
                  ['In 12 weeks', in12],
                ] as const
              ).map(([label, v]) => (
                <StatTile key={label} label={label} value={v != null ? v.toFixed(1) : '—'} unit={units} />
              ))}
            </View>
          ) : null}
          <Text variant="body">
            {goalDate
              ? `At your current pace you reach ${formatWeight(profile.goalWeight!, units)} ${units} around ${goalDate.toLocaleDateString(
                  undefined,
                  { month: 'long', year: 'numeric' },
                )}.`
              : 'Log a few more weigh-ins and your projection will appear here.'}
          </Text>
        </Card>
      </ProGate>

      {profile.startWeight != null && profile.goalWeight != null && today.weight != null ? (
        <>
          <SectionTitle>Milestones</SectionTitle>
          <Card>
            <Roadmap
              start={profile.startWeight}
              goal={profile.goalWeight}
              current={today.weight}
              unit={units}
            />
          </Card>
        </>
      ) : null}

      <SectionTitle>Medication level</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text variant="body" tone="secondary">
            Right now
          </Text>
          <Text variant="bodyStrong">{today.medicationLevel}%</Text>
        </View>
        <Meter percent={today.medicationLevel} />
        <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.md }}>
          Estimated from your dose history. Not a clinical measurement.
        </Text>
      </Card>
    </Screen>
  );
}
