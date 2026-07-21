import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../../src/components/Button';
import { Card, SectionTitle } from '../../src/components/Card';
import { LineChart, Meter } from '../../src/components/charts';
import { ProGate } from '../../src/components/Pro';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { relativeDay } from '../../src/lib/dates';
import { computeToday } from '../../src/lib/insights';
import { getMedication } from '../../src/lib/medications';
import { levelSeries } from '../../src/lib/pk';
import { useProfile } from '../../src/store/profile';
import { useColors } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

export default function MedicationTab() {
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, logs, addLog } = useProfile();

  const med = getMedication(profile.medication);
  const today = useMemo(() => computeToday(profile, logs), [profile, logs]);
  const doseLogs = useMemo(() => logs.filter((l) => l.kind === 'dose'), [logs]);
  const chartWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;

  const curve = useMemo(() => {
    const now = Date.now();
    const doses = doseLogs.map((l) => ({ takenAt: l.at, amountMg: l.value }));
    return levelSeries(doses, now, med.halfLifeHours, profile.doseMg ?? 0);
  }, [doseLogs, med.halfLifeHours, profile.doseMg]);

  // Everything after `now` is a forecast, drawn dashed.
  const splitIndex = curve.findIndex((p) => p.t >= Date.now());

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        Medication
      </Text>

      <SectionTitle>Next dose</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.md,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.primarySoft,
            }}
          >
            <Ionicons name="medkit" size={24} color={c.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">
              {med.name} · {profile.doseMg ?? '—'} mg
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              {today.nextInjection
                ? `${relativeDay(today.nextInjection)} · ${today.nextInjection.toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}`
                : 'No injection day set'}
            </Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <Button
            title="Log dose taken"
            onPress={() => addLog('dose', profile.doseMg ?? 0, { label: med.name })}
          />
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
      </Card>

      <SectionTitle>
        PK curve
      </SectionTitle>
      <Card onPress={profile.isPro ? undefined : () => router.push('/paywall')}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Text variant="caption" tone="secondary">
            Past 14 days and 7-day forecast
          </Text>
          {!profile.isPro ? (
            <View
              style={{
                paddingHorizontal: spacing.sm,
                paddingVertical: 2,
                borderRadius: radius.pill,
                backgroundColor: c.proSoft,
              }}
            >
              <Text variant="micro" tone="pro">
                PRO
              </Text>
            </View>
          ) : null}
        </View>
        <View style={{ opacity: profile.isPro ? 1 : 0.35 }}>
          <LineChart
            data={curve}
            width={chartWidth}
            height={170}
            domain={[0, 110]}
            projectedFrom={splitIndex > 0 ? splitIndex : undefined}
            showLastPoint={false}
          />
        </View>
        {!profile.isPro ? (
          <Text variant="caption" tone="pro" style={{ marginTop: spacing.md }}>
            Unlock the forecast with Pro
          </Text>
        ) : null}
      </Card>

      <SectionTitle>Dose readiness</SectionTitle>
      <ProGate feature="glp1.titration-readiness">
        <Card>
          <Text variant="body">
            {doseLogs.length < 4
              ? 'Log at least four doses at your current strength and we can tell you whether you are ready to step up.'
              : today.medicationLevel >= 60
                ? 'Coverage is holding through the week. If side effects are mild, this is a reasonable point to discuss a step up with your prescriber.'
                : 'Coverage is dipping between doses. Worth reviewing timing before increasing the dose.'}
          </Text>
        </Card>
      </ProGate>

      <SectionTitle>Refills</SectionTitle>
      <ProGate feature="glp1.refill-tracking">
        <Card>
          <Text variant="body" tone="secondary">
            Add your pen or vial count and we will warn you before you run out.
          </Text>
        </Card>
      </ProGate>

      <SectionTitle>History</SectionTitle>
      {doseLogs.length === 0 ? (
        <Card>
          <Text variant="body" tone="secondary">
            No doses logged yet.
          </Text>
        </Card>
      ) : (
        <Card>
          {doseLogs.slice(0, 12).map((l, i) => (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <Text variant="body">
                {new Date(l.at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </Text>
              <Text variant="bodyStrong" tone="secondary">
                {l.value} mg
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
