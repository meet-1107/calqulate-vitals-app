import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, SectionTitle } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { STAGES, buildIntelligence, historyDays, todayObservation } from '../src/lib/intelligence';
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
function ModelReveal({ dataPoints, days, onDone }: { dataPoints: number; days: number; onDone: () => void }) {
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
        {dataPoints} data points over {days} days.
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

  // Fires once, the first time the model becomes ready.
  const [revealing, setRevealing] = useState(intel.modelReady && !profile.modelUnlockedAt);

  if (revealing) {
    return (
      <Screen>
        <ModelReveal
          dataPoints={intel.dataPoints}
          days={days}
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

      {/* WEEK 3 — the one free prediction */}
      {intel.prediction ? (
        <>
          <SectionTitle>Tomorrow</SectionTitle>
          <LinearGradient
            colors={scheme === 'dark' ? [c.primarySoft, c.card] : [c.primarySoft, c.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: radius.xl,
              padding: spacing.lg + 2,
              gap: spacing.md,
              borderWidth: scheme === 'dark' ? 1 : 0,
              borderColor: c.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <View>
                <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
                  Estimated weight
                </Text>
                <Text variant="hero" tone="primary">
                  {formatWeight(intel.prediction.value, units)}
                </Text>
                <Text variant="caption" tone="secondary">
                  {formatWeight(intel.prediction.low, units)} – {formatWeight(intel.prediction.high, units)}{' '}
                  {units}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text variant="micro" tone="tertiary">
                  CONFIDENCE
                </Text>
                <Text variant="heading">{intel.prediction.confidence}%</Text>
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
                Why
              </Text>
              {intel.prediction.drivers.map((d) => (
                <View key={d.label} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Ionicons
                    name={d.good ? 'arrow-up-circle' : 'arrow-down-circle'}
                    size={15}
                    color={d.good ? c.primary : c.pro}
                  />
                  <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                    {d.label} — {d.detail}
                  </Text>
                </View>
              ))}
            </View>
          </LinearGradient>

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
