import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, SectionTitle } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { STAGES, buildIntelligence, historyDays, todayObservation } from '../src/lib/intelligence';
import { bodyOutlook, maxedLevers, rankLevers } from '../src/lib/outlook';
import { bestWeeks, modelCompleteness, personalLeverConfidence } from '../src/lib/bodyModel';
import { formatWeight } from '../src/lib/units';
import { useProfile } from '../src/store/profile';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

const CHECKS = ['Weight', 'Protein', 'Sleep', 'Medication', 'Symptoms'];

/**
 * The unlock moment.
 *
 * A short staged reveal — the app really is reading each stream, and the pause
 * gives the milestone weight. It is capped at a few seconds because a fake
 * progress bar that outstays its welcome reads as a loading screen, not a
 * ceremony.
 */
function ModelReveal({
  dataPoints,
  days,
  patterns,
  onDone,
}: {
  dataPoints: number;
  days: number;
  patterns: number;
  onDone: () => void;
}) {
  const c = useColors();
  const [step, setStep] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    const timers = CHECKS.map((_, i) => setTimeout(() => setStep(i + 1), 500 + i * 420));
    const done = setTimeout(onDone, 500 + CHECKS.length * 420 + 900);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
    };
  }, [fade, onDone]);

  return (
    <Animated.View style={{ opacity: fade, alignItems: 'center', paddingVertical: spacing.xxxl, gap: spacing.lg }}>
      <Ionicons name="sparkles" size={34} color={c.primary} />
      <Text variant="title" style={{ textAlign: 'center' }}>
        Your body model is ready
      </Text>
      <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
        We observed {dataPoints} data points over {days} days
        {patterns > 0 ? ` and found ${patterns} personal pattern${patterns === 1 ? '' : 's'}` : ''}.
      </Text>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {CHECKS.map((label, i) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons
              name={i < step ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={i < step ? c.primary : c.textTertiary}
            />
            <Text variant="body" tone={i < step ? 'default' : 'tertiary'}>
              {label}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

export default function IntelligenceScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, logs, patchProfile } = useProfile();
  const units = profile.settings.units;

  const intel = useMemo(() => buildIntelligence(profile, logs), [profile, logs]);
  const observations = useMemo(() => todayObservation(logs), [logs]);
  const days = historyDays(logs);

  const learned = useMemo(() => modelCompleteness(profile, logs), [profile, logs]);
  const outlook = useMemo(() => bodyOutlook(profile, logs), [profile, logs]);
  const personal = useMemo(() => personalLeverConfidence(profile, logs), [profile, logs]);
  const levers = useMemo(() => rankLevers(profile, logs, personal), [profile, logs, personal]);
  const alreadyGood = useMemo(() => maxedLevers(profile, logs), [profile, logs]);
  const weeks = useMemo(() => bestWeeks(profile, logs), [profile, logs]);

  // Fires once, the first time the model becomes ready.
  const [revealing, setRevealing] = useState(intel.modelReady && !profile.modelUnlockedAt);

  if (revealing) {
    return (
      <Screen>
        <ModelReveal
          dataPoints={intel.dataPoints}
          days={days}
          patterns={intel.patterns.length}
          onDone={() => {
            patchProfile({ modelUnlockedAt: Date.now() });
            setRevealing(false);
          }}
        />
      </Screen>
    );
  }

  const stageIndex = STAGES.findIndex((s) => s.id === intel.stage);

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading" style={{ flex: 1 }}>
          Body Intelligence
        </Text>
      </View>

      {/* How much the engine actually understands about this person. */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Text variant="bodyStrong">Your Body Model</Text>
          <Text variant="heading" tone="primary">
            {learned}%
          </Text>
        </View>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: c.track, overflow: 'hidden' }}>
          <View style={{ width: `${learned}%`, height: '100%', backgroundColor: c.primary }} />
        </View>
        <Text variant="micro" tone="tertiary">
          Learned from {intel.dataPoints} data points. It keeps improving as you log.
        </Text>
      </Card>

      {/* The ladder, so the user can see what is coming. */}
      <Card style={{ marginTop: spacing.lg, gap: spacing.md }}>
        {STAGES.map((s, i) => {
          const done = i < stageIndex;
          const current = i === stageIndex;
          return (
            <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: done || current ? c.primary : c.track,
                }}
              >
                <Ionicons
                  name={done ? 'checkmark' : current ? 'radio-button-on' : 'lock-closed'}
                  size={14}
                  color={done || current ? c.onPrimary : c.textTertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong" tone={current ? 'primary' : done ? 'default' : 'tertiary'}>
                  {s.title}
                </Text>
                <Text variant="micro" tone="tertiary">
                  {s.blurb}
                </Text>
              </View>
              {!done && !current ? (
                <Text variant="micro" tone="tertiary">
                  day {s.day}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Card>

      {intel.blockedBy ? (
        <Card style={{ marginTop: spacing.lg, flexDirection: 'row', gap: spacing.md }}>
          <Ionicons name="information-circle" size={18} color={c.pro} />
          <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
            {intel.next?.title} needs {intel.blockedBy}. The date has arrived — the data has not
            yet, and a model built on too little would only mislead you.
          </Text>
        </Card>
      ) : null}

      {/* WEEK 1 — observation */}
      {intel.stage === 'observation' ? (
        <>
          <SectionTitle>Today</SectionTitle>
          <Card style={{ gap: spacing.sm }}>
            {observations.length ? (
              observations.map((o) => (
                <View key={o} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
                  <Ionicons name="ellipse" size={7} color={c.primary} />
                  <Text variant="body" tone="secondary">
                    {o}
                  </Text>
                </View>
              ))
            ) : (
              <Text variant="body" tone="secondary">
                Nothing logged yet today.
              </Text>
            )}
            <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.sm }}>
              Week one is observation. Once there are enough paired days, patterns start appearing
              here — {Math.max(0, 8 - intel.day)} days to go.
            </Text>
          </Card>
        </>
      ) : null}

      {/* WEEK 2 — patterns */}
      {intel.stage !== 'observation' ? (
        <>
          <SectionTitle>What we have noticed</SectionTitle>
          {intel.patterns.length ? (
            intel.patterns.map((p) => (
              <Card key={p.id} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
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
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {p.title}
                  </Text>
                </View>
                <Text variant="body" tone="secondary">
                  {p.detail}
                </Text>
                <Text variant="micro" tone="tertiary">
                  {p.strength === 'strong' ? 'Strong' : 'Moderate'} association · {p.n} days of data
                  {p.r != null ? ` · r = ${p.r.toFixed(2)}` : ''}
                </Text>
              </Card>
            ))
          ) : (
            <Card>
              <Text variant="body" tone="secondary">
                No pattern is clear enough to report yet. We only surface one when there are at
                least 10 paired days behind it — a pattern from less than that is usually noise.
              </Text>
            </Card>
          )}
        </>
      ) : null}

      {/* WEEK 3 — physiology, not the scale */}
      {intel.prediction ? (
        <>
          <SectionTitle>Tomorrow&apos;s Body Outlook</SectionTitle>
          <LinearGradient
            colors={scheme === 'dark' ? [c.primarySoft, c.card] : [c.primarySoft, c.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius.xl,
              padding: spacing.lg + 2,
              gap: spacing.lg,
              borderWidth: scheme === 'dark' ? 1 : 0,
              borderColor: c.border,
            }}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.lg }}>
              {[
                { label: 'FAT LOSS EFFICIENCY', value: `${outlook.fatLossEfficiency}%`, tint: c.primary },
                { label: 'MUSCLE PRESERVATION', value: `${outlook.musclePreservation}`, tint: c.primary },
                { label: 'RECOVERY', value: outlook.recovery, tint: outlook.recovery === 'Low' ? c.pro : c.primary },
                { label: 'HUNGER', value: outlook.hunger, tint: outlook.hunger === 'High' ? c.pro : c.primary },
              ].map((m) => (
                <View key={m.label} style={{ width: '50%', gap: 2 }}>
                  <Text variant="micro" tone="tertiary">
                    {m.label}
                  </Text>
                  <Text variant="title" style={{ color: m.tint }}>
                    {m.value}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ gap: 4 }}>
              <Text variant="caption" tone="secondary">
                {outlook.recoveryWhy}
              </Text>
              <Text variant="micro" tone="tertiary">
                Confidence {outlook.confidence}% · these are mechanisms you control, not a scale
                reading you cannot
              </Text>
            </View>
          </LinearGradient>

          {/* The scale number, deliberately secondary. */}
          <Card style={{ marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Ionicons name="scale-outline" size={18} color={c.textTertiary} />
            <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
              For reference, the scale should read around{' '}
              {formatWeight(intel.prediction.value, units)} {units} (
              {formatWeight(intel.prediction.low, units)}–
              {formatWeight(intel.prediction.high, units)}). Day-to-day movement is mostly water.
            </Text>
          </Card>

          {/* Ranked opportunities — never suggesting what is already good. */}
          <SectionTitle>Today&apos;s biggest opportunities</SectionTitle>
          {levers.length ? (
            levers.slice(0, 3).map((l, i) => (
              <Card key={l.id} style={{ marginBottom: spacing.md, gap: spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <Text variant="heading" tone="tertiary">
                    {i + 1}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{l.title}</Text>
                    <Text variant="micro" tone="tertiary" style={{ marginTop: 2 }}>
                      {l.effect}
                    </Text>
                  </View>
                  <Text variant="heading" tone="primary">
                    +{l.gainPp}
                  </Text>
                </View>
                <Text variant="caption" tone="secondary">
                  {l.reason}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Text variant="caption" tone="pro">
                    {'★'.repeat(l.evidence.stars)}
                    {'☆'.repeat(4 - l.evidence.stars)}
                  </Text>
                  <Text variant="micro" tone="tertiary">
                    {l.evidence.label}
                  </Text>
                </View>
              </Card>
            ))
          ) : (
            <Card>
              <Text variant="body" tone="secondary">
                Nothing to improve today — every lever we track is already at target.
              </Text>
            </Card>
          )}

          {alreadyGood.length ? (
            <Text variant="caption" tone="primary" style={{ marginBottom: spacing.md }}>
              Already strong: {alreadyGood.join(' · ')}
            </Text>
          ) : null}

          {/* What the best weeks had in common — behaviour patterns, not variables. */}
          {weeks ? (
            <>
              <SectionTitle>What your best weeks had in common</SectionTitle>
              <Card style={{ gap: spacing.md }}>
                <Text variant="body" tone="secondary">
                  Across {weeks.weeks} weeks, your {weeks.topCount} strongest shared these:
                </Text>
                {weeks.traits.map((t) => (
                  <View key={t.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Ionicons name="checkmark-circle" size={16} color={c.primary} />
                    <Text variant="body" style={{ flex: 1 }}>
                      {t.label}
                    </Text>
                    <Text variant="micro" tone="tertiary">
                      {t.hits}/{t.total}
                    </Text>
                  </View>
                ))}
                <Text variant="micro" tone="tertiary">
                  Confidence: {weeks.confidence}. These co-occurred in your best weeks — that is a
                  description of your history, not proof that one caused the other.
                </Text>
              </Card>
            </>
          ) : null}

          {/* The paywall, placed after the value rather than in front of it. */}
          {!profile.isPro ? (
            <Pressable onPress={() => router.push('/paywall')} style={{ marginTop: spacing.lg }}>
              <LinearGradient
                colors={[c.proSoft, c.primarySoft]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md }}
              >
                <Text variant="bodyStrong">
                  Your Body Intelligence is trained on {intel.dataPoints} data points.
                </Text>
                <Text variant="body" tone="secondary">
                  You know what tomorrow looks like. Want to know what it becomes if you sleep
                  more, eat more protein, or change your routine?
                </Text>
                <View style={{ gap: spacing.sm }}>
                  {['Unlimited simulations', '7-day forecast', 'Plateau detection', 'Composition forecast'].map(
                    (f) => (
                      <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Ionicons name="lock-closed" size={13} color={c.pro} />
                        <Text variant="caption" tone="secondary">
                          {f}
                        </Text>
                      </View>
                    ),
                  )}
                </View>
                <Text variant="bodyStrong" tone="pro">
                  Unlock your Decision Engine →
                </Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable onPress={() => router.push('/tomorrow')} style={{ marginTop: spacing.lg }}>
              <Card style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <Ionicons name="flash" size={20} color={c.pro} />
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  Open your Decision Engine
                </Text>
                <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
              </Card>
            </Pressable>
          )}
        </>
      ) : null}

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xl }}>
        Patterns here are associations found in your own logs, not medical findings, and they do
        not establish cause. Predictions are projections of your trend with a real margin of error.
      </Text>
    </Screen>
  );
}
