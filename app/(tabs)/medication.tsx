import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../../src/components/Card';
import { PKChart } from '../../src/components/PKChart';
import { ProBlur } from '../../src/components/ProBlur';
import { ProGate } from '../../src/components/Pro';
import { DoseTimeline, SideEffectList } from '../../src/components/DoseTimeline';
import { MedicationHero } from '../../src/components/MedicationHero';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { computeSweetSpot } from '../../src/lib/dosing';
import { computeToday } from '../../src/lib/insights';
import { getMedication } from '../../src/lib/medications';
import { levelSeries } from '../../src/lib/pk';
import { medicationCycle } from '../../src/lib/cycle';
import {
  daysOnCurrentDose,
  daysSinceSymptom,
  doseTimeline,
  sideEffects,
} from '../../src/lib/medicationLog';
import {
  SITES,
  nextSite,
  rotationCoverage,
  rotationWarnings,
  siteHistory,
} from '../../src/lib/injectionSites';
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

  const cycle = useMemo(() => medicationCycle(profile, logs, now), [profile, logs, now]);
  const timeline = useMemo(() => doseTimeline(profile, logs), [profile, logs]);
  const effects = useMemo(() => sideEffects(profile, logs, 30, now), [profile, logs, now]);
  const onDose = useMemo(() => daysOnCurrentDose(profile, logs, now), [profile, logs, now]);
  const sinceSymptom = useMemo(() => daysSinceSymptom(logs, now), [logs, now]);
  const rotation = useMemo(
    () => ({
      next: nextSite(logs),
      coverage: rotationCoverage(logs, now),
      warnings: rotationWarnings(logs, now),
      recent: siteHistory(logs).filter((h) => h.at >= now - 30 * 86_400_000),
    }),
    [logs, now],
  );

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

  return (
    <Screen scroll>
      <Text variant="title" style={{ marginTop: spacing.sm }}>
        Medication
      </Text>
      <Text variant="caption" tone="secondary" style={{ marginTop: 2, marginBottom: spacing.lg }}>
        Stay on track with your treatment
      </Text>

      {/* Cycle, activity and the log action — the same hero as Home, so the
          answer to "where am I" is identical wherever it is asked. */}
      <MedicationHero cycle={cycle} />

      {/* Adherence and rotation: the two things a tracker must get right. */}
      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
        <Card style={{ flex: 1, gap: 4 }}>
          <Text variant="micro" tone="tertiary">
            ADHERENCE
          </Text>
          <Text variant="heading" tone="primary">
            {cycle.adherence.percent}%
          </Text>
          <Text variant="micro" tone="tertiary">
            {cycle.adherence.taken} of {cycle.adherence.expected} recent doses
          </Text>
        </Card>
        {cycle.route === 'injection' ? (
          <Card style={{ flex: 1, gap: 4 }}>
            <Text variant="micro" tone="tertiary">
              SITE ROTATION
            </Text>
            <Text variant="heading" tone={rotation.warnings.length ? 'pro' : 'primary'}>
              {rotation.coverage}/{SITES.length}
            </Text>
            <Text variant="micro" tone="tertiary">
              sites used this month
            </Text>
          </Card>
        ) : null}
      </View>

      {/* Side effects: what the medication is actually doing to this person. */}
      <SectionTitle
        action={
          <Pressable onPress={() => router.push({ pathname: '/quick-add', params: { kind: 'symptom' } })}>
            <Text variant="caption" tone="primary">
              Check in
            </Text>
          </Pressable>
        }
      >
        Side effects
      </SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <SideEffectList effects={effects} />
        {sinceSymptom != null && effects.length > 0 ? (
          <Text variant="micro" tone="tertiary">
            Last reported {sinceSymptom === 0 ? 'today' : `${sinceSymptom} days ago`}.
          </Text>
        ) : null}
      </Card>

      {/* Dose history: the shape of the treatment, not a list of rows. */}
      <SectionTitle
        action={
          onDose != null ? (
            <Text variant="caption" tone="secondary">
              {onDose}d on {cycle.doseMg} mg
            </Text>
          ) : undefined
        }
      >
        Dose history
      </SectionTitle>
      <Card>
        <DoseTimeline events={showAllHistory ? timeline : timeline.slice(0, 6)} />
        {timeline.length > 6 ? (
          <Pressable onPress={() => setShowAllHistory((v) => !v)} style={{ marginTop: spacing.lg }}>
            <Text variant="caption" tone="primary">
              {showAllHistory ? 'Show less' : `Show all ${timeline.length} doses`}
            </Text>
          </Pressable>
        ) : null}
      </Card>

      {cycle.route === 'injection' ? (
        <>
          <SectionTitle>Injection sites</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {SITES.map((site) => {
                const used = rotation.recent.filter((h) => h.site === site.id).length;
                const isNext = site.id === rotation.next.id;
                return (
                  <View
                    key={site.id}
                    style={{
                      width: '31%',
                      alignItems: 'center',
                      gap: 4,
                      paddingVertical: spacing.md,
                      borderRadius: radius.lg,
                      backgroundColor: isNext ? c.primarySoft : c.bgElevated,
                      borderWidth: 1.5,
                      borderColor: isNext ? c.primary : 'transparent',
                    }}
                  >
                    <Text variant="micro" tone={isNext ? 'primary' : 'tertiary'} style={{ textAlign: 'center' }}>
                      {site.label}
                    </Text>
                    <Text variant="caption" tone={used >= 3 ? 'pro' : 'secondary'}>
                      {used === 0 ? '—' : `${used}×`}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text variant="caption" tone="secondary">
              Next up: {rotation.next.label}.
              {rotation.warnings.length
                ? ` ${rotation.warnings[0].label} has taken ${rotation.warnings[0].times} doses this month — repeated injections in one spot absorb unevenly.`
                : ' Rotating keeps absorption even.'}
            </Text>
          </Card>
        </>
      ) : null}

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

    </Screen>
  );
}
