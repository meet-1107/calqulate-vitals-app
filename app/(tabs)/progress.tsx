import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../../src/components/Card';
import { Donut } from '../../src/components/charts';
import { Badge, Scatter, Timeline } from '../../src/components/progress-parts';
import { ProgressHero } from '../../src/components/ProgressHero';
import { ProGate } from '../../src/components/Pro';
import { RangePicker } from '../../src/components/RangePicker';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { WeightChart } from '../../src/components/WeightChart';
import { DAY } from '../../src/lib/dates';
import { FREE_HISTORY_DAYS } from '../../src/lib/entitlements';
import { estimateComposition, gatherInputs } from '../../src/lib/composition';
import { modelCompleteness } from '../../src/lib/bodyModel';
import { findPatterns } from '../../src/lib/patterns';
import { predictTomorrow } from '../../src/lib/prediction';
import { goalProgress, totalChange, weightSeries } from '../../src/lib/insights';
import { dayIndex } from '../../src/lib/journey';
import {
  METRICS,
  achievements,
  decisionReplay,
  explore,
  journeyMilestones,
  monthlyStory,
  type MetricId,
} from '../../src/lib/progress';
import { formatWeight } from '../../src/lib/units';
import { useProfile } from '../../src/store/profile';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

/**
 * Progress — a transformation story, not an analytics page.
 *
 * The order is deliberate: where you are, how you got here, what your body is
 * doing, what the engine has learned, and only then the charts. A user opening
 * this tab is asking "am I actually succeeding?", and the answer should be
 * legible before any axis is.
 */
export default function Progress() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, logs } = useProfile();

  const units = profile.settings.units;
  const now = Date.now();
  const cardWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;

  const [range, setRange] = useState(30);
  const [xMetric, setXMetric] = useState<MetricId>('protein');
  const [yMetric, setYMetric] = useState<MetricId>('weight');

  const lost = totalChange(profile, logs);
  const progress = goalProgress(profile, logs);
  const day = useMemo(() => dayIndex(logs, now), [logs, now]);
  const learned = useMemo(() => modelCompleteness(profile, logs), [profile, logs]);
  const milestones = useMemo(
    () => journeyMilestones(profile, logs, units, now),
    [profile, logs, units, now],
  );

  const windowDays = profile.isPro ? range : Math.min(range, FREE_HISTORY_DAYS);
  const series = useMemo(
    () => weightSeries(logs).filter((p) => p.t >= now - windowDays * DAY),
    [logs, windowDays, now],
  );

  const comp = useMemo(() => {
    const { input, context } = gatherInputs(profile, logs, now);
    return estimateComposition(input, context);
  }, [profile, logs, now]);

  const patterns = useMemo(() => findPatterns(profile, logs), [profile, logs]);
  const story = useMemo(() => monthlyStory(profile, logs, 0, now), [profile, logs, now]);
  const replay = useMemo(() => decisionReplay(profile, logs, now), [profile, logs, now]);
  const badges = useMemo(() => achievements(profile, logs, units, now), [profile, logs, units, now]);
  const prediction = useMemo(() => predictTomorrow(profile, logs, now), [profile, logs, now]);
  const scatter = useMemo(() => explore(logs, xMetric, yMetric), [logs, xMetric, yMetric]);

  const latest = weightSeries(logs).at(-1)?.value ?? profile.startWeight;
  const doses = logs.filter((l) => l.kind === 'dose').length;
  const firstLog = logs.length ? Math.min(...logs.map((l) => l.at)) : null;

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
        <Text variant="title">Progress</Text>
        <Pressable onPress={() => router.push('/report')} hitSlop={10}>
          <View
            style={{
              width: 38,
              height: 38,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.primarySoft,
            }}
          >
            <Ionicons name="share-outline" size={18} color={c.primary} />
          </View>
        </Pressable>
      </View>

      {/* 1 — Hero: what you lost, how well we know you, how long you have been at it. */}
      <ProgressHero
        lostLb={lost != null && lost < 0 ? lost : 0}
        startLb={profile.startWeight}
        goalLb={profile.goalWeight}
        units={units}
        goalPercent={progress}
        intelligence={learned}
        days={day}
        since={firstLog}
      />

      {/* The narrative line — the thing a chart cannot say. */}
      <Text variant="body" tone="secondary" style={{ marginTop: spacing.lg }}>
        {`You have been with Calqulate for ${day} days${
          lost != null && lost < 0 ? `, lost ${formatWeight(Math.abs(lost), units)} ${units}` : ''
        }, kept an estimated ${comp.fatPct}% of that loss coming from fat, and logged ${doses} injection${
          doses === 1 ? '' : 's'
        }.`}
      </Text>

      {/* 2 — Journey timeline */}
      {milestones.length ? (
        <>
          <SectionTitle>Your journey</SectionTitle>
          <Card>
            <Timeline milestones={milestones} />
          </Card>
        </>
      ) : null}

      {/* 3 — Weight trend */}
      <SectionTitle>Weight trend</SectionTitle>
      <Card style={{ gap: spacing.lg }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <RangePicker
            value={range}
            onChange={setRange}
            lockedFrom={profile.isPro ? undefined : FREE_HISTORY_DAYS}
          />
        </View>
        <WeightChart
          data={series}
          units={units}
          width={cardWidth}
          height={210}
          goal={profile.goalWeight}
        />
      </Card>

      {/* 4 — Body composition */}
      <SectionTitle>Body composition</SectionTitle>
      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xl }}>
        <Donut
          a={comp.fatPct}
          b={comp.leanPct}
          size={132}
          stroke={18}
          label="Estimated"
          caption={`${comp.confidence}% confident`}
        />
        <View style={{ flex: 1, gap: spacing.md }}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary }} />
              <Text variant="caption" tone="secondary">
                Fat mass
              </Text>
            </View>
            <Text variant="heading">{comp.fatPct}%</Text>
          </View>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.pro }} />
              <Text variant="caption" tone="secondary">
                Lean mass
              </Text>
            </View>
            <Text variant="heading">{comp.leanPct}%</Text>
          </View>
          <Pressable onPress={() => router.push('/composition')}>
            <Text variant="caption" tone="primary">
              Open the engine →
            </Text>
          </Pressable>
        </View>
      </Card>

      {/* 5 — Body Intelligence insights */}
      <SectionTitle
        action={
          <Pressable onPress={() => router.push('/intelligence')}>
            <Text variant="caption" tone="primary">
              See all
            </Text>
          </Pressable>
        }
      >
        Body Intelligence
      </SectionTitle>
      {patterns.length ? (
        patterns.slice(0, 3).map((p) => (
          <Card
            key={p.id}
            style={{ marginBottom: spacing.sm, flexDirection: 'row', gap: spacing.md }}
          >
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
              <Ionicons name={p.icon as keyof typeof Ionicons.glyphMap} size={17} color={c.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text variant="body">{p.title}</Text>
              <Text variant="micro" tone="primary" style={{ marginTop: 2 }}>
                Confidence {p.confidence}% · {p.n} days
              </Text>
            </View>
          </Card>
        ))
      ) : (
        <Card>
          <Text variant="body" tone="secondary">
            Patterns appear once there are at least 10 days where two things were logged together.
          </Text>
        </Card>
      )}

      {/* 6 — Correlation explorer */}
      <SectionTitle>Correlation explorer</SectionTitle>
      <ProGate feature="intelligence.decision-engine">
        <Card style={{ gap: spacing.lg }}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {METRICS.map((m) => {
              const active = xMetric === m.id;
              return (
                <Pressable
                  key={m.id}
                  onPress={() => {
                    // Swap rather than collide when the two axes would match.
                    if (m.id === yMetric) setYMetric(xMetric);
                    setXMetric(m.id);
                  }}
                  style={{
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.pill,
                    backgroundColor: active
                      ? c.primary
                      : scheme === 'dark'
                        ? c.cardAlt
                        : c.bgElevated,
                  }}
                >
                  <Text variant="caption" style={{ color: active ? c.onPrimary : c.textSecondary }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Scatter data={scatter} width={cardWidth} />

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              {scatter.xLabel} vs {scatter.yLabel}
            </Text>
            {scatter.stat ? (
              <Text variant="caption" tone="primary">
                r = {scatter.stat.r.toFixed(2)} · {scatter.stat.confidence}% confident
              </Text>
            ) : (
              <Text variant="caption" tone="tertiary">
                Not enough paired days
              </Text>
            )}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing.sm }}
          >
            {METRICS.filter((m) => m.id !== xMetric).map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setYMetric(m.id)}
                style={{
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: yMetric === m.id ? c.pro : c.border,
                }}
              >
                <Text variant="caption" tone={yMetric === m.id ? 'pro' : 'tertiary'}>
                  vs {m.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text variant="micro" tone="tertiary">
            A relationship here is an association in your own logs. It does not establish that one
            causes the other.
          </Text>
        </Card>
      </ProGate>

      {/* 7 — Decision replay */}
      {replay ? (
        <>
          <SectionTitle>Your best decision</SectionTitle>
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: c.primarySoft,
                }}
              >
                <Ionicons name="trending-up" size={19} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{replay.change}</Text>
                <Text variant="micro" tone="tertiary" style={{ marginTop: 2 }}>
                  {replay.effect}
                </Text>
              </View>
              <Text variant="heading" tone="primary">
                +{replay.gainPp}
              </Text>
            </View>
            <Text variant="caption" tone="secondary">
              Comparing {replay.weeksBefore} weeks before with {replay.weeksAfter} after. Confidence:{' '}
              {replay.confidence}.
            </Text>
          </Card>
        </>
      ) : null}

      {/* 8 — Monthly story */}
      {story ? (
        <>
          <SectionTitle>{story.label}</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            {[
              {
                label: 'Weight lost',
                value:
                  story.weightLost != null && story.weightLost < 0
                    ? `${formatWeight(Math.abs(story.weightLost), units)} ${units}`
                    : '—',
              },
              {
                label: 'Estimated fat lost',
                value:
                  story.fatLost != null && story.fatLost < 0
                    ? `${formatWeight(Math.abs(story.fatLost), units)} ${units}`
                    : '—',
              },
              { label: 'Muscle preserved', value: story.musclePreserved },
              { label: 'Best habit', value: story.bestHabit ?? '—' },
              {
                label: 'Hardest day',
                value: story.hardestDay
                  ? new Date(story.hardestDay.at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—',
              },
            ].map((row) => (
              <View
                key={row.label}
                style={{ flexDirection: 'row', justifyContent: 'space-between' }}
              >
                <Text variant="body" tone="secondary">
                  {row.label}
                </Text>
                <Text variant="bodyStrong" tone="primary">
                  {row.value}
                </Text>
              </View>
            ))}
            <View
              style={{
                flexDirection: 'row',
                gap: spacing.sm,
                padding: spacing.md,
                borderRadius: radius.lg,
                backgroundColor: c.primarySoft,
              }}
            >
              <Ionicons name="sparkles" size={16} color={c.primary} />
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {story.summary}
              </Text>
            </View>
          </Card>
        </>
      ) : null}

      {/* 9 — Prediction: the shape is free, the detail is not. */}
      <SectionTitle>What comes next</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <Text variant="body">
          {prediction
            ? prediction.dailySlope < -0.02
              ? 'Steady progress expected — your trend is heading the right way.'
              : prediction.dailySlope > 0.02
                ? 'Your trend has flattened out. The next week is the one to watch.'
                : 'Holding steady this week.'
            : 'A few more weigh-ins and the forecast starts here.'}
        </Text>
        <ProGate feature="intelligence.forecast">
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="secondary">
                Expected fat loss, next 7 days
              </Text>
              <Text variant="bodyStrong" tone="primary">
                {prediction && prediction.dailySlope < 0
                  ? `${formatWeight(
                      Math.abs(prediction.dailySlope * 7 * (comp.fatPct / 100)),
                      units,
                    )} ${units}`
                  : '—'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="caption" tone="secondary">
                Confidence
              </Text>
              <Text variant="bodyStrong">{prediction?.confidence ?? '—'}%</Text>
            </View>
          </View>
        </ProGate>
      </Card>

      {/* 10 — Achievements */}
      <SectionTitle>Achievements</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.md }}
      >
        {badges.map((b) => (
          <Badge key={b.id} item={b} />
        ))}
      </ScrollView>

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xl }}>
        Body composition, fat loss and predictions are model estimates, not measurements.
      </Text>
    </Screen>
  );
}
