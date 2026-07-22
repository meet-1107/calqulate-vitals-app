import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../../src/components/Card';
import { Meter, Ring, StackedBar } from '../../src/components/charts';
import { CoachCard } from '../../src/components/CoachCard';
import { TodayBriefing } from '../../src/components/TodayBriefing';
import { PKChart } from '../../src/components/PKChart';
import { LogoLockup } from '../../src/components/Logo';
import { ProGate } from '../../src/components/Pro';
import { RangePicker } from '../../src/components/RangePicker';
import { ScoreCard } from '../../src/components/ScoreCard';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { WeightChart, WeightStats } from '../../src/components/WeightChart';
import { avgWeeklyLoss, coachInsight } from '../../src/lib/coach';
import { todayBrief } from '../../src/lib/today';
import { FREE_HISTORY_DAYS } from '../../src/lib/entitlements';
import { formatWeight, toDisplay } from '../../src/lib/units';
import { DAY, greeting, relativeDay } from '../../src/lib/dates';
import { statsFor, symptomTrend, weekStats } from '../../src/lib/daycompare';
import { computeBodyComp, leanLossFraction } from '../../src/lib/bodycomp';
import {
  changeOverDays,
  computeToday,
  goalProgress,
  todayForecast,
  totalChange,
  weightSeries,
} from '../../src/lib/insights';
import { getMedication } from '../../src/lib/medications';
import { levelSeries } from '../../src/lib/pk';
import { computeScore } from '../../src/lib/score';
import { useScoreSync } from '../../src/hooks/useScoreSync';
import { useProfile } from '../../src/store/profile';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';
import type { LogKind } from '../../src/store/types';

const QUICK: { id: LogKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'weight', label: 'Weight', icon: 'scale-outline' },
  { id: 'meal', label: 'Meal', icon: 'restaurant-outline' },
  { id: 'water', label: 'Water', icon: 'water-outline' },
  { id: 'dose', label: 'Dose', icon: 'medkit-outline' },
  { id: 'symptom', label: 'Symptoms', icon: 'pulse-outline' },
  { id: 'activity', label: 'Activity', icon: 'walk-outline' },
  { id: 'sleep', label: 'Sleep', icon: 'moon-outline' },
  { id: 'photo', label: 'Photo', icon: 'camera-outline' },
];

type Mode = 'today' | 'yesterday' | 'week';

function ModeSwitch({ value, onChange }: { value: Mode; onChange: (m: Mode) => void }) {
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
      {(
        [
          ['today', 'Today'],
          ['yesterday', 'Yesterday'],
          ['week', 'Week'],
        ] as const
      ).map(([id, label]) => (
        <Pressable
          key={id}
          onPress={() => onChange(id)}
          style={{
            flex: 1,
            paddingVertical: spacing.sm,
            alignItems: 'center',
            borderRadius: radius.pill,
            backgroundColor: value === id ? c.primary : 'transparent',
          }}
        >
          <Text variant="caption" style={{ color: value === id ? c.onPrimary : c.textSecondary }}>
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function CompareTile({
  icon,
  label,
  value,
  delta,
  good,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  delta?: string | null;
  good?: boolean;
}) {
  const c = useColors();
  const { scheme } = useTheme();
  return (
    <View
      style={{
        width: 118,
        padding: spacing.md,
        borderRadius: radius.lg,
        gap: 4,
        backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
        borderWidth: scheme === 'dark' ? 1 : 0,
        borderColor: c.border,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Ionicons name={icon} size={14} color={c.primary} />
        <Text variant="micro" tone="tertiary">
          {label}
        </Text>
      </View>
      <Text variant="bodyStrong">{value}</Text>
      {delta ? (
        <Text variant="micro" style={{ color: good ? c.primary : c.textSecondary }}>
          {delta}
        </Text>
      ) : (
        <Text variant="micro" tone="tertiary">
          —
        </Text>
      )}
    </View>
  );
}

export default function Home() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, logs } = useProfile();
  const [mode, setMode] = useState<Mode>('today');
  const [range, setRange] = useState(30);

  const units = profile.settings.units;
  const chartWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;
  const now = Date.now();
  const at = mode === 'yesterday' ? now - DAY : now;

  const today = useMemo(() => computeToday(profile, logs, at), [profile, logs, at]);
  const score = useMemo(() => computeScore(profile, logs, at), [profile, logs, at]);
  const scorePrev = useMemo(() => computeScore(profile, logs, at - DAY), [profile, logs, at]);
  const comp = useMemo(() => computeBodyComp(profile, logs), [profile, logs]);
  const forecast = useMemo(() => todayForecast(profile, logs, at), [profile, logs, at]);
  const week = changeOverDays(logs, 7);
  const progress = goalProgress(profile, logs);
  const total = totalChange(profile, logs);
  const coach = useMemo(() => coachInsight(profile, logs, score, now), [profile, logs, score, now]);

  const brief = useMemo(() => todayBrief(profile, logs, now), [profile, logs, now]);

  // Persist today's score for server-side trends and the weekly digest.
  useScoreSync(score);

  // Free accounts see 90 days; Vitals keeps the whole timeline.
  const windowDays = profile.isPro ? range : Math.min(range, FREE_HISTORY_DAYS);
  const rangeSeries = useMemo(
    () => weightSeries(logs).filter((p) => p.t >= now - windowDays * DAY),
    [logs, windowDays, now],
  );
  const weeklyAvg = useMemo(() => avgWeeklyLoss(logs, windowDays, now), [logs, windowDays, now]);
  const latestWeight = rangeSeries.at(-1)?.value ?? profile.startWeight;
  const toGo =
    latestWeight != null && profile.goalWeight != null ? latestWeight - profile.goalWeight : null;

  // Day-vs-day tiles (or weekly averages in week mode).
  const dayNow = useMemo(() => statsFor(logs, at), [logs, at]);
  const dayPrev = useMemo(() => statsFor(logs, at - DAY), [logs, at]);
  const weekAgg = useMemo(() => weekStats(logs, now), [logs, now]);
  const sympt = symptomTrend(dayNow, dayPrev);

  // Fat / muscle change over the trailing 7 days.
  const bodyDelta = useMemo(() => {
    const weekLogs = logs.filter((l) => l.at <= now - 7 * DAY);
    const then = computeBodyComp(profile, weekLogs, now - 7 * DAY);
    if (!comp || !then) return null;
    return {
      fat: comp.fatMassNow - then.fatMassNow,
      lean: comp.leanMassNow - then.leanMassNow,
    };
  }, [comp, logs, profile, now]);

  // PK curve for the activity chart.
  const med = getMedication(profile.medication);
  const doseLogs = useMemo(() => logs.filter((l) => l.kind === 'dose'), [logs]);
  const curve = useMemo(() => {
    const doses = doseLogs.map((l) => ({ takenAt: l.at, amountMg: l.value }));
    return levelSeries(doses, now, med.halfLifeHours, profile.doseMg ?? 0, { back: 7, forward: 7 });
  }, [doseLogs, med.halfLifeHours, profile.doseMg, now]);

  const peakLabel = useMemo(() => {
    const future = curve.filter((p) => p.t >= now);
    if (!future.length) return null;
    let peak = future[0];
    for (const p of future) if (p.value > peak.value) peak = p;
    if (peak.value <= (future[0]?.value ?? 0) + 1) return null;
    return relativeDay(new Date(peak.t));
  }, [curve, now]);

  const fatShare = Math.round((1 - leanLossFraction(profile, logs)) * 100);
  const scoreDelta = score.total - scorePrev.total;
  const missionTarget = Math.min(100, score.total + score.available);

  const coachChecklist =
    forecast.phase === 'peak' || forecast.phase === 'rising'
      ? ['High protein meals', 'Strength training', 'Hydration focus']
      : forecast.phase === 'declining'
        ? ['Plan meals ahead', 'Protein at breakfast', 'Keep walks going']
        : ['Protein-heavy breakfast', 'Water before meals', 'Early bedtime'];

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

      {/* Greeting sits above the headline: the name is context, the verdict is
          the message. */}
      <View style={{ marginBottom: spacing.md }}>
        <Text variant="body" tone="secondary">
          {greeting()}, {profile.name || 'there'} 👋
        </Text>
        <Text variant="hero" style={{ marginTop: 2 }}>
          {coach.headline}
        </Text>
      </View>

      <View style={{ marginBottom: spacing.lg }}>
        <ModeSwitch value={mode} onChange={setMode} />
      </View>

      {/* The daily briefing leads: it has value before anything is logged. */}
      {mode === 'today' ? (
        <View style={{ marginBottom: spacing.lg }}>
          <TodayBriefing brief={brief} />
        </View>
      ) : null}

      <Pressable onPress={() => router.push('/score')}>
        <ScoreCard score={score} delta={scoreDelta} />
      </Pressable>

      {/* Coach sits directly under the score so a warning is impossible to miss. */}
      <View style={{ marginTop: spacing.lg }}>
        <CoachCard insight={coach} />
      </View>

      {/* Today's Body — how healthy the loss is, not how big. */}
      {comp && comp.totalLost < 0 ? (
        <>
          <SectionTitle>Today&apos;s body</SectionTitle>
          <Card style={{ gap: spacing.lg }}>
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text variant="caption" tone="secondary">
                  Fat loss progress
                </Text>
                <Text variant="caption" tone="primary">
                  {progress}%
                </Text>
              </View>
              <Meter percent={progress} />
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <View>
                <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
                  Muscle protection
                </Text>
                <Text variant="heading">{comp.musclePreservationPct.toFixed(0)}%</Text>
                <Text variant="micro" tone="primary">
                  {comp.preservationBand}
                </Text>
              </View>
              {bodyDelta ? (
                <View style={{ alignItems: 'flex-end', gap: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.pro }} />
                    <Text variant="caption" tone="secondary">
                      Fat {bodyDelta.fat <= 0 ? '−' : '+'}
                      {formatWeight(Math.abs(bodyDelta.fat), units)} {units} · 7d
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
                    <Text variant="caption" tone="secondary">
                      Muscle {Math.abs(toDisplay(bodyDelta.lean, units)) < 0.15 ? 'stable' : `${bodyDelta.lean <= 0 ? '−' : '+'}${formatWeight(Math.abs(bodyDelta.lean), units)} ${units}`} · 7d
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            <Pressable onPress={() => router.push('/(tabs)/progress')}>
              <Text variant="caption" tone="primary">
                Body composition →
              </Text>
            </Pressable>
          </Card>
        </>
      ) : null}

      {/* Comparison strip — what changed vs yesterday (or weekly averages). */}
      <SectionTitle>{mode === 'week' ? 'This week · daily average' : mode === 'yesterday' ? 'Yesterday vs day before' : 'Today vs yesterday'}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {mode === 'week' ? (
          <>
            <CompareTile
              icon="scale-outline"
              label="Weight"
              value={weekAgg.weight != null ? `${formatWeight(weekAgg.weight, units)} ${units}` : '—'}
              delta={
                weekAgg.weightChange != null
                  ? `${weekAgg.weightChange <= 0 ? '↓' : '↑'} ${formatWeight(Math.abs(weekAgg.weightChange), units)} ${units} / 7d`
                  : null
              }
              good={weekAgg.weightChange != null && weekAgg.weightChange <= 0}
            />
            <CompareTile icon="water-outline" label="Water" value={`${(weekAgg.waterMl / 1000).toFixed(1)} L`} delta="per day" good />
            <CompareTile icon="restaurant-outline" label="Protein" value={`${weekAgg.proteinG} g`} delta="per day" good />
            <CompareTile
              icon="moon-outline"
              label="Sleep"
              value={weekAgg.sleepH > 0 ? `${weekAgg.sleepH} h` : '—'}
              delta={weekAgg.sleepH > 0 ? 'per night' : null}
              good
            />
            <CompareTile
              icon="pulse-outline"
              label="Symptoms"
              value={weekAgg.symptomAvg != null ? (weekAgg.symptomAvg <= 1 ? 'Mild' : weekAgg.symptomAvg <= 3 ? 'Moderate' : 'Strong') : '—'}
              delta={weekAgg.doseLogged ? 'dose logged ✓' : null}
              good
            />
          </>
        ) : (
          <>
            <CompareTile
              icon="scale-outline"
              label="Weight"
              value={dayNow.weight != null ? `${formatWeight(dayNow.weight, units)} ${units}` : '—'}
              delta={
                dayNow.weight != null && dayPrev.weight != null
                  ? `${dayNow.weight - dayPrev.weight <= 0 ? '↓' : '↑'} ${formatWeight(Math.abs(dayNow.weight - dayPrev.weight), units)} ${units}`
                  : null
              }
              good={dayNow.weight != null && dayPrev.weight != null && dayNow.weight <= dayPrev.weight}
            />
            <CompareTile
              icon="water-outline"
              label="Water"
              value={`${(dayNow.waterMl / 1000).toFixed(1)} L`}
              delta={
                dayPrev.waterMl > 0 || dayNow.waterMl > 0
                  ? `${dayNow.waterMl >= dayPrev.waterMl ? '↑' : '↓'} ${Math.abs(dayNow.waterMl - dayPrev.waterMl)} mL`
                  : null
              }
              good={dayNow.waterMl >= dayPrev.waterMl}
            />
            <CompareTile
              icon="restaurant-outline"
              label="Protein"
              value={`${Math.round(dayNow.proteinG)} g`}
              delta={
                dayPrev.proteinG > 0 || dayNow.proteinG > 0
                  ? `${dayNow.proteinG >= dayPrev.proteinG ? '↑' : '↓'} ${Math.abs(Math.round(dayNow.proteinG - dayPrev.proteinG))} g`
                  : null
              }
              good={dayNow.proteinG >= dayPrev.proteinG}
            />
            <CompareTile
              icon="moon-outline"
              label="Sleep"
              value={dayNow.sleepH > 0 ? `${dayNow.sleepH.toFixed(1)} h` : '—'}
              delta={
                dayNow.sleepH > 0 && dayPrev.sleepH > 0
                  ? `${dayNow.sleepH >= dayPrev.sleepH ? '↑' : '↓'} ${Math.abs(Math.round((dayNow.sleepH - dayPrev.sleepH) * 60))} min`
                  : null
              }
              good={dayNow.sleepH >= dayPrev.sleepH}
            />
            <CompareTile
              icon="pulse-outline"
              label="Symptoms"
              value={dayNow.symptomAvg != null ? (dayNow.symptomAvg <= 1 ? 'Mild' : dayNow.symptomAvg <= 3 ? 'Moderate' : 'Strong') : '—'}
              delta={sympt === 'better' ? '↓ Better' : sympt === 'worse' ? '↑ Worse' : sympt === 'same' ? 'Same' : null}
              good={sympt === 'better'}
            />
          </>
        )}
      </ScrollView>

      {/* Weight trend — the chart plus the three numbers that answer
          "is this working?": total change, weekly pace, and goal progress. */}
      <Card style={{ marginTop: spacing.xl, gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text variant="heading">Weight Trend</Text>
          <RangePicker
            value={range}
            onChange={setRange}
            lockedFrom={profile.isPro ? undefined : FREE_HISTORY_DAYS}
          />
        </View>

        <WeightChart
          data={rangeSeries}
          units={units}
          width={chartWidth}
          height={220}
          goal={profile.goalWeight}
        />

        {profile.goalWeight == null ? (
          <Pressable
            onPress={() => router.push('/goal')}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              padding: spacing.lg,
              borderRadius: radius.lg,
              backgroundColor: c.primarySoft,
            }}
          >
            <Ionicons name="flag-outline" size={20} color={c.primary} />
            <Text variant="caption" tone="primary" style={{ flex: 1 }}>
              Set a goal weight to unlock progress tracking
            </Text>
            <Ionicons name="chevron-forward" size={16} color={c.primary} />
          </Pressable>
        ) : null}

        <WeightStats
          units={units}
          totalChange={
            total != null ? `${total <= 0 ? '↓' : '↑'} ${formatWeight(Math.abs(total), units)} ${units}` : '—'
          }
          bodyFraction={
            total != null && profile.startWeight
              ? `${Math.abs((total / profile.startWeight) * 100).toFixed(1)}% of body weight`
              : undefined
          }
          avgWeekly={
            weeklyAvg != null
              ? `${weeklyAvg <= 0 ? '↓' : '↑'} ${formatWeight(Math.abs(weeklyAvg), units)} ${units}`
              : '—'
          }
          goalPercent={progress}
          toGo={
            toGo != null && toGo > 0 ? `${formatWeight(toGo, units)} ${units} to go` : 'Goal reached'
          }
        />

        {!profile.isPro && range > FREE_HISTORY_DAYS ? (
          <Text variant="caption" tone="pro">
            Showing the last {FREE_HISTORY_DAYS} days. Vitals keeps your full timeline.
          </Text>
        ) : null}
      </Card>

      {/* Weekly report — the shareable artifact. */}
      <Card
        onPress={() => router.push('/report')}
        style={{ marginTop: spacing.xl, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.proSoft,
          }}
        >
          <Ionicons name="share-social-outline" size={20} color={c.pro} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">Your weekly report</Text>
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            Score, body composition and adherence — ready to share
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
      </Card>

      {/* GLP-1 activity — the curve with today's dot and the peak called out. */}
      <SectionTitle>GLP-1 activity</SectionTitle>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
            <Text variant="title" tone="primary">
              {today.medicationLevel}%
            </Text>
            <Text variant="caption" tone="secondary">
              active
            </Text>
          </View>
          {peakLabel ? (
            <View
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: 3,
                borderRadius: radius.pill,
                backgroundColor: c.primarySoft,
              }}
            >
              <Text variant="micro" tone="primary">
                Peak {peakLabel}
              </Text>
            </View>
          ) : null}
        </View>
        <PKChart data={curve} injections={doseLogs.map((l) => l.at)} width={chartWidth} height={150} now={now} />
      </Card>

      {/* Today's Mission — the actions, gamified. */}
      {mode === 'today' && score.actions.length > 0 ? (
        <>
          <SectionTitle
            action={
              <Text variant="caption" tone="primary">
                +{score.available} pts
              </Text>
            }
          >
            Today&apos;s mission
          </SectionTitle>
          <Card style={{ gap: spacing.sm }}>
            {score.actions.slice(0, 3).map((a) => (
              <Pressable
                key={a.id}
                onPress={() =>
                  a.kind ? router.push({ pathname: '/quick-add', params: { kind: a.kind } }) : undefined
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                }}
              >
                <Ionicons name="square-outline" size={20} color={c.textTertiary} />
                <Text variant="body" style={{ flex: 1 }}>
                  {a.title}
                </Text>
                <Text variant="caption" tone="primary">
                  +{a.points} pts
                </Text>
              </Pressable>
            ))}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                marginTop: spacing.sm,
                paddingTop: spacing.md,
                borderTopWidth: 1,
                borderTopColor: c.border,
              }}
            >
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                Complete every mission to boost your Metabolic Score to {missionTarget}
              </Text>
              <Ring percent={missionTarget} size={46} stroke={5} label={`${missionTarget}`} />
            </View>
          </Card>
        </>
      ) : null}

      {/* Quick log — horizontally scrollable pills. */}
      <SectionTitle>Quick log</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {QUICK.map((q) => (
          <Pressable
            key={q.id}
            onPress={() => router.push({ pathname: '/quick-add', params: { kind: q.id } })}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.md,
              borderRadius: radius.pill,
              backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
              borderWidth: scheme === 'dark' ? 1 : 0,
              borderColor: c.border,
            }}
          >
            <Ionicons name={q.icon} size={16} color={c.primary} />
            <Text variant="caption">{q.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Weekly progress + coach. */}
      {week != null && week < 0 ? (
        <>
          <SectionTitle
            action={
              <Pressable onPress={() => router.push('/(tabs)/progress')}>
                <Text variant="caption" tone="primary">
                  See details
                </Text>
              </Pressable>
            }
          >
            Weekly progress
          </SectionTitle>
          <Card style={{ gap: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text variant="body" tone="secondary">
                Lost
              </Text>
              <Text variant="title" tone="primary">
                {formatWeight(Math.abs(week), units)} {units}
              </Text>
              <Text variant="body" tone="secondary">
                this week · {fatShare}% was body fat
              </Text>
            </View>
            <StackedBar
              a={Math.abs(week) * (fatShare / 100)}
              b={Math.abs(week) * (1 - fatShare / 100)}
              aLabel="Fat loss"
              bLabel="Muscle loss"
            />
          </Card>
        </>
      ) : null}

      <SectionTitle>AI Coach</SectionTitle>
      <ProGate feature="glp1.day-forecast">
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
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
              {forecast.phase !== 'none' ? forecast.headline : 'Log your first dose and I can forecast your days.'}
            </Text>
          </View>
          {forecast.phase !== 'none' ? (
            <View style={{ gap: spacing.sm, marginLeft: 36 + spacing.md }}>
              <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
                Great day for
              </Text>
              {coachChecklist.map((item) => (
                <View key={item} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons name="checkmark-circle" size={16} color={c.primary} />
                  <Text variant="caption" tone="secondary">
                    {item}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      </ProGate>

    </Screen>
  );
}
