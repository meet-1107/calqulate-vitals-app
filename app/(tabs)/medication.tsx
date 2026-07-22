import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, SectionTitle } from '../../src/components/Card';
import { LineChart, Meter } from '../../src/components/charts';
import { PKChart } from '../../src/components/PKChart';
import { ProBlur } from '../../src/components/ProBlur';
import { ProGate } from '../../src/components/Pro';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { computeSweetSpot } from '../../src/lib/dosing';
import { computeToday } from '../../src/lib/insights';
import { getMedication } from '../../src/lib/medications';
import { levelSeries } from '../../src/lib/pk';
import { useProfile } from '../../src/store/profile';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { palette, radius, spacing } from '../../src/theme';

export default function MedicationTab() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, logs, addLog } = useProfile();

  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showReadiness, setShowReadiness] = useState(false);
  const [showRefills, setShowRefills] = useState(false);

  const med = getMedication(profile.medication);
  const now = Date.now();
  const today = useMemo(() => computeToday(profile, logs), [profile, logs]);
  const doseLogs = useMemo(
    () => logs.filter((l) => l.kind === 'dose').sort((a, b) => b.at - a.at),
    [logs],
  );
  const chartWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;

  const curve = useMemo(() => {
    const doses = doseLogs.map((l) => ({ takenAt: l.at, amountMg: l.value }));
    return levelSeries(doses, now, med.halfLifeHours, profile.doseMg ?? 0, {
      intervalHours: med.intervalHours,
    });
  }, [doseLogs, med.halfLifeHours, profile.doseMg, now]);

  const miniCurve = useMemo(() => {
    const doses = doseLogs.map((l) => ({ takenAt: l.at, amountMg: l.value }));
    return levelSeries(doses, now, med.halfLifeHours, profile.doseMg ?? 0, {
      back: 4,
      forward: 7,
      intervalHours: med.intervalHours,
    });
  }, [doseLogs, med.halfLifeHours, profile.doseMg, now]);

  const peakLabel = useMemo(() => {
    const future = miniCurve.filter((p) => p.t >= now);
    if (!future.length) return null;
    let peak = future[0];
    for (const p of future) if (p.value > peak.value) peak = p;
    if (peak.value <= (future[0]?.value ?? 0) + 1) return null;
    const d = new Date(peak.t);
    const isToday = new Date(now).toDateString() === d.toDateString();
    return isToday ? 'today' : `on ${d.toLocaleDateString(undefined, { weekday: 'short' })}`;
  }, [miniCurve, now]);

  const sweetSpot = useMemo(() => computeSweetSpot(logs), [logs]);

  // Countdown to next dose.
  const countdown = useMemo(() => {
    if (!today.nextInjection) return null;
    const ms = today.nextInjection.getTime() - now;
    if (ms <= 0) return 'Due now';
    const days = Math.floor(ms / (24 * 3600_000));
    const hrs = Math.floor((ms % (24 * 3600_000)) / 3600_000);
    return days > 0 ? `${days} day${days === 1 ? '' : 's'} ${hrs} hr${hrs === 1 ? '' : 's'} left` : `${hrs} hr${hrs === 1 ? '' : 's'} left`;
  }, [today.nextInjection, now]);

  const hasDose = profile.doseMg != null && profile.doseMg > 0;
  const gradient: [string, string] =
    scheme === 'dark' ? [palette.green700, palette.green600] : [palette.green500, palette.green600];

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        Medication
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        Stay on track with your treatment
      </Text>

      {/* NEXT DOSE hero */}
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: radius.xl, overflow: 'hidden' }}
      >
        <View style={{ padding: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            >
              <Ionicons name="calendar" size={20} color="#FFFFFF" />
            </View>
            <Text variant="micro" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: 1.5 }}>
              NEXT DOSE
            </Text>
            <View style={{ flex: 1 }} />
            <Ionicons name="medkit" size={44} color="rgba(255,255,255,0.35)" />
          </View>

          <Text variant="title" style={{ color: '#FFFFFF', marginTop: spacing.lg }}>
            {profile.medication ? med.name : 'No medication set'}
          </Text>

          {hasDose ? (
            <View
              style={{
                alignSelf: 'flex-start',
                marginTop: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: 4,
                borderRadius: radius.pill,
                backgroundColor: '#FFFFFF',
              }}
            >
              <Text variant="caption" style={{ color: palette.green600, fontWeight: '700' }}>
                {profile.doseMg} {profile.doseUnit ?? 'mg'}
              </Text>
            </View>
          ) : null}

          <Text variant="body" style={{ color: 'rgba(255,255,255,0.9)', marginTop: spacing.md }}>
            {today.nextInjection
              ? `${today.nextInjection.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })} · ${today.nextInjection.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : 'Set your injection day in Settings to see your schedule'}
          </Text>
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.xl,
            paddingVertical: spacing.lg,
            backgroundColor: 'rgba(0,0,0,0.14)',
          }}
        >
          <Ionicons name="time-outline" size={20} color="rgba(255,255,255,0.85)" />
          <View style={{ flex: 1 }}>
            <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              {countdown ?? 'No schedule yet'}
            </Text>
            <Text variant="micro" style={{ color: 'rgba(255,255,255,0.7)' }}>
              until next dose
            </Text>
          </View>
          <Pressable
            onPress={() => addLog('dose', profile.doseMg ?? 0, { label: med.name })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: '#FFFFFF',
            }}
          >
            <Text variant="caption" style={{ color: palette.green600, fontWeight: '700' }}>
              Log dose taken
            </Text>
            <Ionicons name="chevron-forward" size={14} color={palette.green600} />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Medication level */}
      <SectionTitle>Medication level</SectionTitle>
      <Card>
        {doseLogs.length === 0 ? (
          <Text variant="body" tone="secondary">
            Log your first dose and your live medication level appears here.
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <View style={{ width: 110 }}>
                <Text variant="caption" tone="secondary">
                  Right now
                </Text>
                <Text variant="hero" tone="primary">
                  {today.medicationLevel}%
                </Text>
                <Text variant="micro" tone="tertiary">
                  Active in your system
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                {peakLabel ? (
                  <View
                    style={{
                      alignSelf: 'center',
                      paddingHorizontal: spacing.md,
                      paddingVertical: 3,
                      borderRadius: radius.pill,
                      backgroundColor: c.primarySoft,
                      marginBottom: spacing.xs,
                    }}
                  >
                    <Text variant="micro" tone="primary">
                      Peak {peakLabel}
                    </Text>
                  </View>
                ) : null}
                <LineChart
                  data={miniCurve}
                  width={chartWidth - 110 - spacing.lg}
                  height={84}
                  domain={[0, 110]}
                  showLastPoint={false}
                />
              </View>
            </View>
            <View style={{ marginTop: spacing.lg }}>
              <Meter percent={today.medicationLevel} />
            </View>
          </>
        )}
      </Card>

      {/* PK curve — blurred for free users */}
      <SectionTitle
        action={
          !profile.isPro ? (
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
          ) : undefined
        }
      >
        PK curve
      </SectionTitle>
      <Card>
        <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.md }}>
          Past 14 days & 7-day forecast
        </Text>
        {doseLogs.length === 0 ? (
          <Text variant="body" tone="secondary">
            Your full pharmacokinetic curve builds itself from the doses you log.
          </Text>
        ) : (
          <ProBlur
            locked={!profile.isPro}
            onUpgrade={() => router.push('/paywall')}
            label="Unlock 7-day forecast & insights"
          >
            <PKChart
              data={curve}
              injections={doseLogs.map((l) => l.at)}
              width={chartWidth}
              height={190}
            />
          </ProBlur>
        )}
      </Card>

      {/* PRO mini cards */}
      <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.xl }}>
        <Card
          style={{ flex: 1, gap: spacing.sm }}
          onPress={() =>
            profile.isPro ? setShowReadiness((v) => !v) : router.push('/paywall')
          }
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.primarySoft,
              }}
            >
              <Ionicons name="trending-up" size={18} color={c.primary} />
            </View>
            {!profile.isPro ? (
              <Text variant="micro" tone="pro">
                PRO
              </Text>
            ) : null}
          </View>
          <Text variant="bodyStrong">Ready to increase your dose?</Text>
          <Text variant="micro" tone="tertiary">
            Checks your loss, coverage and side effects
          </Text>
          <Text variant="caption" tone="primary">
            Check readiness ›
          </Text>
        </Card>

        <Card
          style={{ flex: 1, gap: spacing.sm }}
          onPress={() => (profile.isPro ? setShowRefills((v) => !v) : router.push('/paywall'))}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.md,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: c.primarySoft,
              }}
            >
              <Ionicons name="bag-add" size={18} color={c.primary} />
            </View>
            {!profile.isPro ? (
              <Text variant="micro" tone="pro">
                PRO
              </Text>
            ) : null}
          </View>
          <Text variant="bodyStrong">Never run out of medication</Text>
          <Text variant="micro" tone="tertiary">
            Smart refill reminders & tracking
          </Text>
          <Text variant="caption" tone="primary">
            Manage refills ›
          </Text>
        </Card>
      </View>

      {showReadiness && profile.isPro ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="body">
            {doseLogs.length < 4
              ? 'Log at least four doses at your current strength and we can tell you whether you are ready to step up.'
              : today.medicationLevel >= 60
                ? 'Coverage is holding through the week. If side effects are mild, this is a reasonable point to discuss a step up with your prescriber.'
                : 'Coverage is dipping between doses. Worth reviewing timing before increasing the dose.'}
          </Text>
        </Card>
      ) : null}

      {showRefills && profile.isPro ? (
        <Card style={{ marginTop: spacing.md }}>
          <Text variant="body" tone="secondary">
            Add your pen or vial count and we will warn you before you run out. Coming in the next
            update.
          </Text>
        </Card>
      ) : null}

      {/* Sweet spot */}
      <SectionTitle>Dosing sweet spot</SectionTitle>
      <ProGate feature="glp1.titration-readiness">
        <Card style={{ gap: spacing.md }}>
          <Text variant="caption" tone="secondary">
            Maximum fat loss, minimal side effects — how each strength has actually treated you.
          </Text>
          {sweetSpot.perDose
            .filter((d) => d.weeks >= 0.5)
            .map((d) => {
              const isBest = sweetSpot.best?.doseMg === d.doseMg;
              return (
                <View
                  key={d.doseMg}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: spacing.md,
                    borderRadius: radius.md,
                    backgroundColor: isBest ? c.primarySoft : 'transparent',
                    borderWidth: isBest ? 1.5 : 0,
                    borderColor: c.primary,
                  }}
                >
                  <View>
                    <Text variant="bodyStrong">
                      {d.doseMg} mg {isBest ? '· Sweet spot' : ''}
                    </Text>
                    <Text variant="micro" tone="tertiary">
                      {d.weeks} wk on this dose
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      variant="caption"
                      tone={d.weeklyChange != null && d.weeklyChange < 0 ? 'primary' : 'secondary'}
                    >
                      {d.weeklyChange != null
                        ? `${d.weeklyChange <= 0 ? '−' : '+'}${Math.abs(d.weeklyChange).toFixed(1)}/wk`
                        : 'no trend yet'}
                    </Text>
                    <Text variant="micro" tone="tertiary">
                      side effects {d.avgSeverity}/5
                    </Text>
                  </View>
                </View>
              );
            })}
          {sweetSpot.needs ? (
            <Text variant="caption" tone="secondary">
              {sweetSpot.needs}
            </Text>
          ) : sweetSpot.best ? (
            <Text variant="caption" tone="secondary">
              {sweetSpot.best.doseMg} mg has given you the best loss for the fewest side effects.
              Bring this to your prescriber — never change dose on your own.
            </Text>
          ) : null}
        </Card>
      </ProGate>

      {/* Dose history */}
      <SectionTitle
        action={
          doseLogs.length > 5 ? (
            <Pressable onPress={() => setShowAllHistory((v) => !v)}>
              <Text variant="caption" tone="primary">
                {showAllHistory ? 'Show less' : 'View all ›'}
              </Text>
            </Pressable>
          ) : undefined
        }
      >
        Dose history
      </SectionTitle>
      {doseLogs.length === 0 ? (
        <Card>
          <Text variant="body" tone="secondary">
            No doses logged yet. Tap “Log dose taken” above after your injection.
          </Text>
        </Card>
      ) : (
        <Card>
          {(showAllHistory ? doseLogs : doseLogs.slice(0, 5)).map((l, i) => (
            <View
              key={l.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
              }}
            >
              <Ionicons name="checkmark-circle" size={20} color={c.primary} />
              <Text variant="body" style={{ flex: 1 }}>
                {new Date(l.at).toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
              <Text variant="bodyStrong">{l.value} mg</Text>
              <Text variant="caption" tone="tertiary">
                {new Date(l.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  );
}
