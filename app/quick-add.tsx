/**
 * Quick Add — a launcher plus a dedicated, custom-made screen per log type.
 * No long forms: every screen has one visual hero, large type, and a single
 * obvious action. Always rendered light (white background) regardless of the
 * app theme.
 */

import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Field } from '../src/components/Field';
import { LineChart, Ring } from '../src/components/charts';
import { Text } from '../src/components/Text';
import { WheelPicker } from '../src/components/WheelPicker';
import { changeOverDays, weightSeries } from '../src/lib/insights';
import { formatWeight, toDisplay, toStored } from '../src/lib/units';
import { getMedication } from '../src/lib/medications';
import { useProfile } from '../src/store/profile';
import type { LogKind, Units } from '../src/store/types';
import { ThemeScope, useColors } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Kind = LogKind;

const ACCENT: Record<Kind, { tint: string; soft: string }> = {
  weight: { tint: '#0F9F73', soft: '#E9F7F1' },
  meal: { tint: '#E8862F', soft: '#FDF0E3' },
  water: { tint: '#3B82D6', soft: '#E8F1FB' },
  dose: { tint: '#8B5CF6', soft: '#F1EBFD' },
  symptom: { tint: '#E85C7A', soft: '#FDEBEF' },
  activity: { tint: '#0F9F73', soft: '#E9F7F1' },
  sleep: { tint: '#6366F1', soft: '#EDEEFC' },
  photo: { tint: '#0D9DA3', soft: '#E6F6F7' },
};

const MENU: { id: Kind; title: string; sub: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'weight', title: 'Weight', sub: 'Track your weight', icon: 'scale-outline' },
  { id: 'meal', title: 'Meal', sub: 'What did you eat?', icon: 'restaurant-outline' },
  { id: 'water', title: 'Water', sub: 'Track your water intake', icon: 'water-outline' },
  { id: 'dose', title: 'Dose', sub: 'Medication dose', icon: 'medkit-outline' },
  { id: 'symptom', title: 'Symptoms', sub: 'How are you feeling?', icon: 'pulse-outline' },
  { id: 'activity', title: 'Activity', sub: 'Log your activity', icon: 'walk-outline' },
  { id: 'sleep', title: 'Sleep', sub: 'Track your sleep', icon: 'moon-outline' },
  { id: 'photo', title: 'Photo', sub: 'Progress photo', icon: 'camera-outline' },
];

const range = (from: number, to: number, step: number) =>
  Array.from({ length: Math.round((to - from) / step) + 1 }, (_, i) => +(from + i * step).toFixed(1));

const WEIGHT_SCALE: Record<Units, number[]> = {
  lb: range(80, 500, 0.5),
  kg: range(36, 227, 0.1),
};
const SLEEP_SCALE = range(3, 12, 0.5);

const MOODS = ['😄', '🙂', '😐', '🙁', '😣'] as const;
const SYMPTOMS = ['Nausea', 'Fatigue', 'Headache', 'Constipation', 'Diarrhea', 'Bloating', 'Heartburn', 'Injection site'];
const SITES = ['Abdomen', 'Thigh', 'Arm'] as const;
const WATER_CHIPS = [250, 500, 750, 1000];
const ACTIVITY_PRESETS = [15, 30, 45, 60];

/* ---------- shared pieces ---------- */

function HeroCard({
  kind,
  title,
  caption,
  children,
}: {
  kind: Kind;
  title: string;
  caption: string;
  children?: React.ReactNode;
}) {
  const a = ACCENT[kind];
  const item = MENU.find((m) => m.id === kind)!;
  return (
    <View style={{ borderRadius: 28, padding: spacing.lg, backgroundColor: a.soft, gap: spacing.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#FFFFFF',
          }}
        >
          <Ionicons name={item.icon} size={22} color={a.tint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="caption" tone="secondary">
            {caption}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

function SaveButton({ kind, label, disabled, onPress }: { kind: Kind; label: string; disabled?: boolean; onPress: () => void }) {
  const a = ACCENT[kind];
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center',
        paddingVertical: spacing.lg,
        borderRadius: radius.lg,
        backgroundColor: a.tint,
        opacity: disabled ? 0.35 : pressed ? 0.85 : 1,
      })}
    >
      <Text variant="bodyStrong" style={{ color: '#FFFFFF' }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Chip({
  label,
  active,
  tint,
  onPress,
}: {
  label: string;
  active: boolean;
  tint: string;
  onPress: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={{
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        borderRadius: radius.pill,
        backgroundColor: active ? `${tint}1A` : c.cardAlt,
        borderWidth: 1.5,
        borderColor: active ? tint : 'transparent',
      }}
    >
      <Text variant="caption" style={{ color: active ? tint : c.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

function TimeRow() {
  const c = useColors();
  const label = `Today, ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  return (
    <View>
      <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
        Time
      </Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: c.cardAlt,
        }}
      >
        <Text variant="body">{label}</Text>
        <Ionicons name="time-outline" size={18} color={c.textTertiary} />
      </View>
    </View>
  );
}

/* ---------- screen ---------- */

export default function QuickAdd() {
  return (
    <ThemeScope scheme="light">
      <QuickAddInner />
    </ThemeScope>
  );
}

function QuickAddInner() {
  const c = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ kind?: string }>();
  const { profile, logs, addLog } = useProfile();

  const [view, setView] = useState<'menu' | Kind>((params.kind as Kind) ?? 'menu');

  const units = profile.settings.units;
  const med = getMedication(profile.medication);

  // Weight state
  const lastWeight = useMemo(() => weightSeries(logs).at(-1)?.value ?? null, [logs]);
  const [weight, setWeight] = useState(
    lastWeight != null ? toDisplay(lastWeight, units) : units === 'lb' ? 180 : 83,
  );
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const weekChange = useMemo(() => changeOverDays(logs, 7), [logs]);
  const weightTrend = useMemo(() => weightSeries(logs).slice(-14), [logs]);

  // Meal state
  const [mealType, setMealType] = useState('Breakfast');
  const [food, setFood] = useState('');
  const [protein, setProtein] = useState('');
  const recentFoods = useMemo(() => {
    const seen = new Set<string>();
    const out: { label: string; protein: number }[] = [];
    for (const l of logs) {
      if (l.kind !== 'meal' || !l.label) continue;
      const name = l.label.includes('·') ? l.label.split('·')[1].trim() : l.label;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      out.push({ label: name, protein: l.value });
      if (out.length >= 4) break;
    }
    return out;
  }, [logs]);

  // Water state
  const [waterAmount, setWaterAmount] = useState(500);
  const todayWater = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return logs
      .filter((l) => l.kind === 'water' && l.at >= start.getTime())
      .reduce((s, l) => s + l.value, 0);
  }, [logs]);

  // Dose state
  const [dose, setDose] = useState(profile.doseMg ?? med.doses[0]);
  const [site, setSite] = useState<(typeof SITES)[number]>('Abdomen');

  // Symptoms state
  const [feelingFine, setFeelingFine] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [severity, setSeverity] = useState(2);

  // Activity state
  const [minutes, setMinutes] = useState<number | null>(null);
  const [activityName, setActivityName] = useState('');

  // Sleep state
  const [sleepH, setSleepH] = useState(7.5);

  const close = () => router.back();
  const save = (kind: Kind, value: number, extra?: { label?: string; note?: string }) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addLog(kind, value, extra);
    close();
  };

  const chartWidth = width - spacing.xl * 2 - spacing.lg * 2;
  const active = view === 'menu' ? null : MENU.find((m) => m.id === view)!;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: spacing.xl,
            height: 52,
          }}
        >
          {view !== 'menu' ? (
            <Pressable hitSlop={12} onPress={() => setView('menu')}>
              <Ionicons name="arrow-back" size={24} color={c.text} />
            </Pressable>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text variant="heading" style={{ flex: 1, textAlign: 'center' }}>
            {active ? active.title : ''}
          </Text>
          <Pressable hitSlop={12} onPress={close}>
            <Ionicons name="close" size={26} color={c.textSecondary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingBottom: spacing.xxxl + insets.bottom,
            gap: spacing.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {view === 'menu' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.sm }}>
              <View style={{ marginBottom: spacing.md }}>
                <Text variant="title">Quick Add</Text>
                <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
                  Log your data in seconds
                </Text>
              </View>
              {MENU.map((m) => {
                const a = ACCENT[m.id];
                return (
                  <Pressable
                    key={m.id}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setView(m.id);
                    }}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      padding: spacing.lg,
                      borderRadius: radius.lg,
                      backgroundColor: pressed ? a.soft : c.cardAlt,
                    })}
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: radius.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: a.soft,
                      }}
                    >
                      <Ionicons name={m.icon} size={22} color={a.tint} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text variant="bodyStrong">{m.title}</Text>
                      <Text variant="caption" tone="secondary">
                        {m.sub}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={c.textTertiary} />
                  </Pressable>
                );
              })}
            </Animated.View>
          ) : null}

          {/* WEIGHT */}
          {view === 'weight' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="weight" title="Log your weight" caption="Track your progress over time">
                {weightTrend.length >= 2 ? (
                  <View>
                    <LineChart data={weightTrend} width={chartWidth} height={80} showLastPoint />
                    {weekChange != null ? (
                      <View
                        style={{
                          alignSelf: 'flex-end',
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 4,
                          marginTop: spacing.sm,
                          paddingHorizontal: spacing.md,
                          paddingVertical: 4,
                          borderRadius: radius.pill,
                          backgroundColor: '#FFFFFF',
                        }}
                      >
                        <Ionicons
                          name={weekChange <= 0 ? 'arrow-down' : 'arrow-up'}
                          size={12}
                          color={ACCENT.weight.tint}
                        />
                        <Text variant="micro" style={{ color: ACCENT.weight.tint }}>
                          {formatWeight(Math.abs(weekChange), units)} {units} vs last 7 days
                        </Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}
              </HeroCard>

              <View style={{ alignItems: 'center' }}>
                <Text variant="caption" tone="secondary">
                  Today&apos;s Weight
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text variant="hero">{weight.toFixed(1)}</Text>
                  <Text variant="heading" tone="secondary">
                    {units}
                  </Text>
                </View>
                {lastWeight != null ? (
                  <Text variant="micro" tone="tertiary" style={{ marginTop: 2 }}>
                    Previous {formatWeight(lastWeight, units)} {units} ·{' '}
                    {weight - toDisplay(lastWeight, units) <= 0 ? '−' : '+'}
                    {Math.abs(weight - toDisplay(lastWeight, units)).toFixed(1)} {units}
                  </Text>
                ) : null}
              </View>

              <WheelPicker
                values={WEIGHT_SCALE[units]}
                value={
                  WEIGHT_SCALE[units].reduce((b, v) =>
                    Math.abs(v - weight) < Math.abs(b - weight) ? v : b,
                  )
                }
                suffix={units}
                onChange={setWeight}
              />

              <TimeRow />

              <Field
                label="Notes (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="Add a note about your progress…"
              />

              <View>
                <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
                  How do you feel?
                </Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  {MOODS.map((m, i) => (
                    <Pressable
                      key={m}
                      onPress={() => setMood(mood === i ? null : i)}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: radius.md,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: mood === i ? ACCENT.weight.soft : c.cardAlt,
                        borderWidth: 1.5,
                        borderColor: mood === i ? ACCENT.weight.tint : 'transparent',
                      }}
                    >
                      <Text style={{ fontSize: 24 }}>{m}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <SaveButton
                kind="weight"
                label="Save Weight"
                onPress={() =>
                  save('weight', toStored(weight, units), {
                    note:
                      [note.trim(), mood != null ? `Mood ${MOODS[mood]}` : '']
                        .filter(Boolean)
                        .join(' · ') || undefined,
                  })
                }
              />
            </Animated.View>
          ) : null}

          {/* MEAL */}
          {view === 'meal' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="meal" title="Log your meal" caption="What did you eat?" />

              <View>
                <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
                  Meal type
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((t) => (
                    <Chip key={t} label={t} active={mealType === t} tint={ACCENT.meal.tint} onPress={() => setMealType(t)} />
                  ))}
                </View>
              </View>

              <Field label="Food" value={food} onChangeText={setFood} placeholder="Greek yogurt" />
              <Field
                label="Protein (g)"
                value={protein}
                onChangeText={setProtein}
                keyboardType="number-pad"
                placeholder="24"
              />

              {recentFoods.length > 0 ? (
                <View>
                  <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
                    Recent
                  </Text>
                  <View style={{ gap: spacing.sm }}>
                    {recentFoods.map((r) => (
                      <Pressable
                        key={r.label}
                        onPress={() => {
                          setFood(r.label);
                          setProtein(String(Math.round(r.protein)));
                        }}
                        style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          padding: spacing.lg,
                          borderRadius: radius.lg,
                          backgroundColor: c.cardAlt,
                        }}
                      >
                        <Text variant="body">{r.label}</Text>
                        <Text variant="caption" tone="secondary">
                          {Math.round(r.protein)} g
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              <SaveButton
                kind="meal"
                label="Save Meal"
                disabled={!(Number(protein) > 0)}
                onPress={() =>
                  save('meal', Number(protein), {
                    label: food.trim() ? `${mealType} · ${food.trim()}` : mealType,
                  })
                }
              />
            </Animated.View>
          ) : null}

          {/* WATER */}
          {view === 'water' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="water" title="Track your water" caption="Stay hydrated">
                <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
                  <Ring
                    percent={Math.min(100, ((todayWater + waterAmount) / profile.goals.waterMl) * 100)}
                    size={120}
                    stroke={12}
                    color={ACCENT.water.tint}
                    label={`${((todayWater + waterAmount) / 1000).toFixed(2)} L`}
                    caption={`of ${(profile.goals.waterMl / 1000).toFixed(1)} L`}
                  />
                </View>
              </HeroCard>

              <View style={{ alignItems: 'center' }}>
                <Text variant="caption" tone="secondary">
                  Amount
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text variant="hero" style={{ color: ACCENT.water.tint }}>
                    {waterAmount}
                  </Text>
                  <Text variant="heading" tone="secondary">
                    ml
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'center' }}>
                {WATER_CHIPS.map((ml) => (
                  <Chip
                    key={ml}
                    label={ml === 1000 ? '1 L' : `${ml} ml`}
                    active={waterAmount === ml}
                    tint={ACCENT.water.tint}
                    onPress={() => setWaterAmount(ml)}
                  />
                ))}
              </View>

              <View
                style={{
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: c.cardAlt,
                  gap: spacing.sm,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption" tone="secondary">
                    Today so far
                  </Text>
                  <Text variant="caption">{(todayWater / 1000).toFixed(2)} L</Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption" tone="secondary">
                    Remaining after this
                  </Text>
                  <Text variant="caption">
                    {(Math.max(0, profile.goals.waterMl - todayWater - waterAmount) / 1000).toFixed(2)} L
                  </Text>
                </View>
              </View>

              <SaveButton kind="water" label="Save Water" onPress={() => save('water', waterAmount)} />
            </Animated.View>
          ) : null}

          {/* DOSE */}
          {view === 'dose' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="dose" title="Log your dose" caption="Track medication" />

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: c.cardAlt,
                }}
              >
                <Text variant="caption" tone="secondary">
                  Medication
                </Text>
                <Text variant="bodyStrong">
                  {med.molecule} ({med.name})
                </Text>
              </View>

              <View style={{ alignItems: 'center' }}>
                <Text variant="caption" tone="secondary">
                  Dose
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text variant="hero" style={{ color: ACCENT.dose.tint }}>
                    {dose}
                  </Text>
                  <Text variant="heading" tone="secondary">
                    mg
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
                {med.doses.map((d) => (
                  <Chip key={d} label={`${d}`} active={dose === d} tint={ACCENT.dose.tint} onPress={() => setDose(d)} />
                ))}
              </View>

              <View>
                <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
                  Injection site
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  {SITES.map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => setSite(s)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: spacing.sm,
                        padding: spacing.lg,
                        borderRadius: radius.lg,
                        backgroundColor: site === s ? ACCENT.dose.soft : c.cardAlt,
                        borderWidth: 1.5,
                        borderColor: site === s ? ACCENT.dose.tint : 'transparent',
                      }}
                    >
                      <Ionicons
                        name="body-outline"
                        size={20}
                        color={site === s ? ACCENT.dose.tint : c.textTertiary}
                      />
                      <Text
                        variant="caption"
                        style={{ color: site === s ? ACCENT.dose.tint : c.textSecondary }}
                      >
                        {s}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <TimeRow />

              <SaveButton
                kind="dose"
                label="Save Dose"
                onPress={() => save('dose', dose, { label: `${med.name} · ${site}` })}
              />
            </Animated.View>
          ) : null}

          {/* SYMPTOMS */}
          {view === 'symptom' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="symptom" title="Log symptoms" caption="How are you feeling?">
                <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
                  <Text style={{ fontSize: 56 }}>
                    {feelingFine ? '😄' : picked.length === 0 ? '🙂' : severity <= 2 ? '😐' : severity <= 4 ? '🙁' : '😣'}
                  </Text>
                  <Text variant="caption" tone="secondary" style={{ marginTop: spacing.sm }}>
                    {feelingFine
                      ? 'Feeling fine today'
                      : picked.length === 0
                        ? 'Select what you feel'
                        : severity <= 2
                          ? "Mild — you're doing okay"
                          : severity <= 4
                            ? 'Moderate'
                            : 'Severe — consider calling your prescriber'}
                  </Text>
                </View>
              </HeroCard>

              <Pressable
                onPress={() => {
                  setFeelingFine((v) => !v);
                  setPicked([]);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: feelingFine ? ACCENT.symptom.soft : c.cardAlt,
                  borderWidth: 1.5,
                  borderColor: feelingFine ? ACCENT.symptom.tint : 'transparent',
                }}
              >
                <Ionicons
                  name={feelingFine ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={feelingFine ? ACCENT.symptom.tint : c.textTertiary}
                />
                <Text variant="bodyStrong">Feeling fine — no symptoms</Text>
              </Pressable>

              {!feelingFine ? (
                <>
                  <View>
                    <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
                      Common symptoms
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                      {SYMPTOMS.map((s) => (
                        <Chip
                          key={s}
                          label={s}
                          active={picked.includes(s)}
                          tint={ACCENT.symptom.tint}
                          onPress={() =>
                            setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]))
                          }
                        />
                      ))}
                    </View>
                  </View>

                  <View>
                    <Text variant="caption" tone="secondary" style={{ marginBottom: spacing.sm }}>
                      Severity
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Pressable
                          key={n}
                          onPress={() => setSeverity(n)}
                          style={{
                            flex: 1,
                            paddingVertical: spacing.md,
                            alignItems: 'center',
                            borderRadius: radius.md,
                            backgroundColor: severity === n ? ACCENT.symptom.tint : c.cardAlt,
                          }}
                        >
                          <Text
                            variant="bodyStrong"
                            style={{ color: severity === n ? '#FFFFFF' : c.textSecondary }}
                          >
                            {n}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                </>
              ) : null}

              <Field
                label="Notes (optional)"
                value={note}
                onChangeText={setNote}
                placeholder="Add any additional notes…"
              />

              <SaveButton
                kind="symptom"
                label="Save Symptoms"
                disabled={!feelingFine && picked.length === 0}
                onPress={() =>
                  save('symptom', feelingFine ? 0 : severity, {
                    label: feelingFine ? 'Feeling fine' : picked.join(', '),
                    note: note.trim() || undefined,
                  })
                }
              />
            </Animated.View>
          ) : null}

          {/* ACTIVITY */}
          {view === 'activity' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="activity" title="Log your activity" caption="Movement keeps metabolic rate up" />

              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                {ACTIVITY_PRESETS.map((min) => (
                  <Pressable
                    key={min}
                    onPress={() => setMinutes(min)}
                    style={{
                      flex: 1,
                      paddingVertical: spacing.lg,
                      alignItems: 'center',
                      borderRadius: radius.md,
                      backgroundColor: minutes === min ? ACCENT.activity.soft : c.cardAlt,
                      borderWidth: 1.5,
                      borderColor: minutes === min ? ACCENT.activity.tint : 'transparent',
                    }}
                  >
                    <Text variant="bodyStrong">{min}</Text>
                    <Text variant="micro" tone="tertiary">
                      MIN
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Field label="Activity" value={activityName} onChangeText={setActivityName} placeholder="Walk" />

              <SaveButton
                kind="activity"
                label="Save Activity"
                disabled={minutes == null}
                onPress={() => save('activity', minutes ?? 0, { label: activityName.trim() || 'Activity' })}
              />
            </Animated.View>
          ) : null}

          {/* SLEEP */}
          {view === 'sleep' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="sleep" title="Track your sleep" caption="Short sleep raises appetite hormones" />

              <View style={{ alignItems: 'center' }}>
                <Text variant="caption" tone="secondary">
                  Hours slept
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
                  <Text variant="hero" style={{ color: ACCENT.sleep.tint }}>
                    {sleepH.toFixed(1)}
                  </Text>
                  <Text variant="heading" tone="secondary">
                    h
                  </Text>
                </View>
              </View>

              <WheelPicker values={SLEEP_SCALE} value={sleepH} suffix="h" onChange={setSleepH} />

              <SaveButton kind="sleep" label="Save Sleep" onPress={() => save('sleep', sleepH)} />
            </Animated.View>
          ) : null}

          {/* PHOTO */}
          {view === 'photo' ? (
            <Animated.View entering={FadeInDown.duration(200)} style={{ gap: spacing.xl }}>
              <HeroCard kind="photo" title="Progress photo" caption="Watch your transformation" />
              <View
                style={{
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: spacing.xxl,
                  borderRadius: radius.xl,
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: c.border,
                }}
              >
                <Ionicons name="camera-outline" size={32} color={c.textTertiary} />
                <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
                  Progress photos need camera access. Enable it in Settings.
                </Text>
              </View>
            </Animated.View>
          ) : null}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}
