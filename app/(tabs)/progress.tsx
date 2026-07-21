import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../../src/components/Card';
import { LineChart, Meter, Ring, StatTile } from '../../src/components/charts';
import { ProGate } from '../../src/components/Pro';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { DAY } from '../../src/lib/dates';
import { FREE_HISTORY_DAYS } from '../../src/lib/entitlements';
import {
  changeOverDays,
  computeToday,
  goalProgress,
  projectGoalDate,
  totalChange,
  weightSeries,
} from '../../src/lib/insights';
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
  const { width } = useWindowDimensions();
  const { profile, logs } = useProfile();
  const [days, setDays] = useState(30);

  const units = profile.settings.units;
  const chartWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;

  // Free accounts see 90 days; the full timeline is what Vitals keeps forever.
  const windowDays = profile.isPro ? days : Math.min(days, FREE_HISTORY_DAYS);

  const series = useMemo(() => {
    const cutoff = Date.now() - windowDays * DAY;
    return weightSeries(logs).filter((p) => p.t >= cutoff);
  }, [logs, windowDays]);

  const today = useMemo(() => computeToday(profile, logs), [profile, logs]);
  const total = totalChange(profile, logs);
  const week = changeOverDays(logs, 7);
  const progress = goalProgress(profile, logs);
  const goalDate = projectGoalDate(profile, logs);

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        Progress
      </Text>

      <SectionTitle>Weight</SectionTitle>
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
        <LineChart data={series} width={chartWidth} height={180} />
        <View style={{ marginTop: spacing.lg }}>
          <RangeSelector value={days} onChange={setDays} locked={!profile.isPro} />
        </View>
        {!profile.isPro && days > FREE_HISTORY_DAYS ? (
          <Text variant="caption" tone="pro" style={{ marginTop: spacing.md }}>
            Showing the last {FREE_HISTORY_DAYS} days. Vitals keeps your full timeline.
          </Text>
        ) : null}
      </Card>

      <SectionTitle>Goal</SectionTitle>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
        <Ring percent={progress} size={112} caption="to goal" />
        <View style={{ flex: 1, gap: spacing.md }}>
          <StatTile
            label="Start"
            value={profile.startWeight?.toFixed(1) ?? '—'}
            unit={units}
          />
          <StatTile label="Goal" value={profile.goalWeight?.toFixed(1) ?? '—'} unit={units} />
        </View>
      </Card>

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

      <SectionTitle>Goal date</SectionTitle>
      <ProGate feature="overview.goal-date">
        <Card>
          <Text variant="body">
            {goalDate
              ? `At your current pace you reach ${profile.goalWeight} ${units} around ${goalDate.toLocaleDateString(
                  undefined,
                  { month: 'long', year: 'numeric' },
                )}.`
              : 'Log a few more weigh-ins and your projected goal date will appear here.'}
          </Text>
        </Card>
      </ProGate>

      <SectionTitle>Muscle vs fat</SectionTitle>
      <ProGate feature="glp1.muscle-guard">
        <Card>
          <Text variant="body" tone="secondary">
            Connect a smart scale or log body-fat percentage to split your loss into fat and
            lean mass.
          </Text>
        </Card>
      </ProGate>

      <SectionTitle>Weekly review</SectionTitle>
      <ProGate feature="glp1.weekly-review">
        <Card>
          <Text variant="body">
            {week != null
              ? `You changed ${Math.abs(week).toFixed(1)} ${units} over the last 7 days.`
              : 'Log at least two weigh-ins this week to unlock your report.'}
          </Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
            Hydration {today.hydrationPct}% · Protein {today.proteinG} g today
          </Text>
        </Card>
      </ProGate>
    </Screen>
  );
}
