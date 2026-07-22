import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Card, SectionTitle } from '../src/components/Card';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import {
  UNLOCKS,
  buildJourney,
  equivalent,
  milestones,
  nextUnlock,
} from '../src/lib/journey';
import { formatWeight } from '../src/lib/units';
import { useProfile } from '../src/store/profile';
import { useColors, useTheme } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', gap: 2 }}>
      <Text variant="heading">{value}</Text>
      <Text variant="micro" tone="tertiary" style={{ textAlign: 'center' }}>
        {label}
      </Text>
    </View>
  );
}

/**
 * The journey.
 *
 * Nothing here is computed cleverly — it is a count of what the user actually
 * did. That is the point: accumulated history is what makes an app worth
 * keeping, and it cannot be faked or rushed.
 */
export default function JourneyScreen() {
  const c = useColors();
  const { scheme } = useTheme();
  const router = useRouter();
  const { profile, logs } = useProfile();
  const units = profile.settings.units;

  const j = useMemo(() => buildJourney(profile, logs), [profile, logs]);
  const marks = useMemo(() => milestones(profile, logs, units), [profile, logs, units]);
  const upcoming = nextUnlock(j.day);
  const mass = j.totalLost != null && j.totalLost < 0 ? equivalent(j.totalLost) : null;

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading" style={{ flex: 1 }}>
          Your journey
        </Text>
      </View>

      <LinearGradient
        colors={scheme === 'dark' ? [c.primarySoft, c.card] : [c.primarySoft, c.card]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: radius.xl,
          padding: spacing.xl,
          marginTop: spacing.lg,
          alignItems: 'center',
          gap: spacing.sm,
          borderWidth: scheme === 'dark' ? 1 : 0,
          borderColor: c.border,
        }}
      >
        <Text variant="micro" tone="tertiary" style={{ textTransform: 'uppercase' }}>
          Day
        </Text>
        <Text variant="hero" tone="primary">
          {j.day}
        </Text>
        {j.totalLost != null && j.totalLost < 0 ? (
          <>
            <Text variant="heading">
              {formatWeight(Math.abs(j.totalLost), units)} {units} down
            </Text>
            {mass ? (
              <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
                About the weight of {mass}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="body" tone="secondary" style={{ textAlign: 'center' }}>
            Your history starts here.
          </Text>
        )}
      </LinearGradient>

      <Card style={{ marginTop: spacing.lg, flexDirection: 'row' }}>
        <Stat value={String(j.activeDays)} label="days logged" />
        <Stat value={String(j.weighIns)} label="weigh-ins" />
        <Stat value={String(j.doses)} label="doses" />
        <Stat value={String(j.meals)} label="meals" />
        <Stat value={String(j.photos)} label="photos" />
      </Card>

      {j.improvingStreak > 0 ? (
        <Card style={{ marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
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
            <Ionicons name="flame" size={20} color={c.pro} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong">
              {j.improvingStreak} day{j.improvingStreak === 1 ? '' : 's'} improving
            </Text>
            <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
              Your score beat the day before — that is harder than just showing up
            </Text>
          </View>
        </Card>
      ) : null}

      {j.fatLost != null && j.fatLost < 0 ? (
        <>
          <SectionTitle>What you actually lost</SectionTitle>
          <Card style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" tone="secondary">
                Fat
              </Text>
              <Text variant="bodyStrong" tone="primary">
                ↓ {formatWeight(Math.abs(j.fatLost), units)} {units}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="body" tone="secondary">
                Muscle
              </Text>
              <Text variant="bodyStrong" tone={j.muscleHeld ? 'primary' : 'pro'}>
                {j.muscleHeld ? 'Protected' : 'Watch this'}
              </Text>
            </View>
            <Pressable onPress={() => router.push('/composition')} style={{ marginTop: spacing.sm }}>
              <Text variant="caption" tone="primary">
                See the full analysis →
              </Text>
            </Pressable>
          </Card>
        </>
      ) : null}

      <SectionTitle>Milestones</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {marks.map((m, i) => (
          <View
            key={m.title}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              paddingVertical: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.border,
            }}
          >
            <Ionicons
              name={m.reached ? 'checkmark-circle' : 'ellipse-outline'}
              size={20}
              color={m.reached ? c.primary : c.textTertiary}
            />
            <Text variant="body" style={{ flex: 1 }} tone={m.reached ? 'default' : 'secondary'}>
              {m.title}
            </Text>
            <Text variant="caption" tone={m.reached ? 'primary' : 'tertiary'}>
              {m.detail}
            </Text>
          </View>
        ))}
      </Card>

      <SectionTitle>Unlocked so far</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {UNLOCKS.map((u, i) => {
          const open = u.day <= j.day;
          return (
            <Pressable
              key={u.id}
              disabled={!open}
              onPress={() => router.push(u.route as never)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.md,
                paddingVertical: spacing.md,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: c.border,
                opacity: open ? 1 : 0.45,
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.pill,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: open ? c.primarySoft : c.track,
                }}
              >
                <Ionicons
                  name={(open ? u.icon : 'lock-closed') as keyof typeof Ionicons.glyphMap}
                  size={16}
                  color={open ? c.primary : c.textTertiary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body">{u.title}</Text>
                <Text variant="micro" tone="tertiary" style={{ marginTop: 2 }}>
                  {open ? u.blurb : `Opens on day ${u.day}`}
                </Text>
              </View>
              {open ? <Ionicons name="chevron-forward" size={16} color={c.textTertiary} /> : null}
            </Pressable>
          );
        })}
      </Card>

      {upcoming ? (
        <Text variant="caption" tone="secondary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
          {upcoming.title} opens in {upcoming.day - j.day} day
          {upcoming.day - j.day === 1 ? '' : 's'}.
        </Text>
      ) : null}
    </Screen>
  );
}
