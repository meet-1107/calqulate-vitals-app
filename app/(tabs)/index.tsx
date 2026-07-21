import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../../src/components/Card';
import { LineChart, Meter } from '../../src/components/charts';
import { LogoLockup } from '../../src/components/Logo';
import { ProGate } from '../../src/components/Pro';
import { ScoreCard } from '../../src/components/ScoreCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { greeting, relativeDay } from '../../src/lib/dates';
import { coachMessage, computeToday, weightSeries } from '../../src/lib/insights';
import { getMedication } from '../../src/lib/medications';
import { computeScore } from '../../src/lib/score';
import { useProfile } from '../../src/store/profile';
import { useColors } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const QUICK = [
  { id: 'weight', label: 'Weight', icon: 'scale-outline' },
  { id: 'water', label: 'Water', icon: 'water-outline' },
  { id: 'meal', label: 'Meal', icon: 'restaurant-outline' },
  { id: 'symptom', label: 'Symptoms', icon: 'pulse-outline' },
] as const;

function HeroRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Text variant="body" tone="secondary">
        {label}
      </Text>
      <Text variant="bodyStrong">{value}</Text>
    </View>
  );
}

export default function Home() {
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, logs } = useProfile();

  const today = useMemo(() => computeToday(profile, logs), [profile, logs]);
  const score = useMemo(() => computeScore(profile, logs), [profile, logs]);
  const coach = useMemo(() => coachMessage(profile, logs, today), [profile, logs, today]);
  const trend = useMemo(() => weightSeries(logs).slice(-30), [logs]);
  const med = getMedication(profile.medication);
  const units = profile.settings.units;
  const chartWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;

  const deltaLabel =
    today.weightDelta == null
      ? '—'
      : `${today.weightDelta <= 0 ? '↓' : '↑'} ${Math.abs(today.weightDelta).toFixed(1)} ${units}`;

  return (
    <Screen scroll>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.sm,
          marginBottom: spacing.lg,
        }}
      >
        <LogoLockup size={30} />
        <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={10}>
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.primarySoft,
            }}
          >
            <Text variant="caption" tone="primary">
              {(profile.name || profile.email || '?').charAt(0).toUpperCase()}
            </Text>
          </View>
        </Pressable>
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <Text variant="caption" tone="secondary">
          {greeting()}
        </Text>
        <Text variant="title">{profile.name || 'there'}</Text>
      </View>

      <Pressable onPress={() => router.push('/score')}>
        <ScoreCard score={score} />
      </Pressable>

      <SectionTitle>Today</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text variant="body" tone="secondary">
              {med.name} active
            </Text>
            <Text variant="heading">{today.medicationLevel}%</Text>
          </View>
          <View style={{ marginTop: spacing.sm }}>
            <Meter percent={today.medicationLevel} />
          </View>
        </View>

        <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
          <HeroRow
            label="Weight"
            value={today.weight != null ? `${today.weight.toFixed(1)} ${units}  ${deltaLabel}` : '—'}
          />
          <HeroRow label="Hydration" value={`${today.hydrationPct}%`} />
          <HeroRow label="Protein" value={`${today.proteinG} g`} />
          <HeroRow
            label="Next injection"
            value={
              today.nextInjection
                ? `${relativeDay(today.nextInjection)} · ${today.nextInjection.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : 'Not set'
            }
          />
        </View>
      </Card>

      <SectionTitle>AI Coach</SectionTitle>
      <Card style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.primarySoft,
          }}
        >
          <Ionicons name="sparkles" size={18} color={c.primary} />
        </View>
        <Text variant="body" style={{ flex: 1 }}>
          {coach}
        </Text>
      </Card>

      <SectionTitle>Quick log</SectionTitle>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {QUICK.map((q) => (
          <Card
            key={q.id}
            onPress={() => router.push({ pathname: '/quick-add', params: { kind: q.id } })}
            style={{ flex: 1, alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}
            padded={false}
          >
            <Ionicons name={q.icon} size={22} color={c.primary} />
            <Text variant="micro" tone="secondary">
              {q.label}
            </Text>
          </Card>
        ))}
      </View>

      <SectionTitle>How today will feel</SectionTitle>
      <ProGate feature="glp1.day-forecast">
        <Card>
          <Text variant="body">
            {today.medicationLevel >= 70
              ? 'Medication is near peak coverage — appetite should stay low. Front-load protein while you have the appetite for it.'
              : today.medicationLevel >= 40
                ? 'You are mid-cycle. Appetite usually returns gradually from here.'
                : 'Coverage is low ahead of your next dose. Expect a hungrier day and plan meals early.'}
          </Text>
        </Card>
      </ProGate>

      <SectionTitle
        action={
          <Pressable onPress={() => router.push('/(tabs)/progress')}>
            <Text variant="caption" tone="primary">
              See all
            </Text>
          </Pressable>
        }
      >
        Recent trend
      </SectionTitle>
      <Card>
        <LineChart data={trend} width={chartWidth} height={150} />
      </Card>
    </Screen>
  );
}
