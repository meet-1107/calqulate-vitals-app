import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Card, SectionTitle } from '../src/components/Card';
import { LineChart, Ring } from '../src/components/charts';
import { ProGate } from '../src/components/Pro';
import { Screen } from '../src/components/Screen';
import { Text } from '../src/components/Text';
import { computeScore, scoreHistory } from '../src/lib/score';
import { useProfile } from '../src/store/profile';
import { useColors } from '../src/theme/ThemeProvider';
import { radius, spacing } from '../src/theme';

export default function ScoreScreen() {
  const c = useColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { profile, logs } = useProfile();

  const score = useMemo(() => computeScore(profile, logs), [profile, logs]);
  const history = useMemo(() => scoreHistory(profile, logs, 30), [profile, logs]);
  const chartWidth = width - spacing.xl * 2 - (spacing.lg + 2) * 2;

  return (
    <Screen scroll>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={c.textSecondary} />
        </Pressable>
        <Text variant="heading">Metabolic Score</Text>
      </View>

      <Card style={{ alignItems: 'center', marginTop: spacing.lg, paddingVertical: spacing.xl }}>
        <Ring percent={score.total} size={168} stroke={16} label={String(score.total)} caption={score.band} />
        <Text variant="caption" tone="secondary" style={{ marginTop: spacing.lg, textAlign: 'center' }}>
          How well today&apos;s habits support your metabolism and treatment.
        </Text>
      </Card>

      {score.actions.length > 0 ? (
        <>
          <SectionTitle>+{score.available} points available today</SectionTitle>
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {score.actions.map((a, i) => (
              <Pressable
                key={a.id}
                onPress={() =>
                  a.kind
                    ? router.push({ pathname: '/quick-add', params: { kind: a.kind } })
                    : undefined
                }
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.lg,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: c.border,
                }}
              >
                <Ionicons name="add-circle-outline" size={22} color={c.primary} />
                <Text variant="body" style={{ flex: 1 }}>
                  {a.title}
                </Text>
                <View
                  style={{
                    paddingHorizontal: spacing.sm,
                    paddingVertical: 3,
                    borderRadius: radius.pill,
                    backgroundColor: c.primarySoft,
                  }}
                >
                  <Text variant="micro" tone="primary">
                    +{a.points}
                  </Text>
                </View>
              </Pressable>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Breakdown</SectionTitle>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
        {score.lines.map((l, i) => (
          <View
            key={l.id}
            style={{
              paddingVertical: spacing.lg,
              gap: spacing.sm,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: c.border,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.md }}>
              <Text variant="bodyStrong" style={{ flex: 1 }}>
                {l.label}
              </Text>
              <Text variant="bodyStrong" tone={l.earned === l.max ? 'primary' : 'default'}>
                +{l.earned}
              </Text>
              <Text variant="caption" tone="tertiary">
                / {l.max}
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: c.track, overflow: 'hidden' }}>
              <View
                style={{
                  width: `${Math.round(l.ratio * 100)}%`,
                  height: '100%',
                  borderRadius: 3,
                  backgroundColor: c.primary,
                }}
              />
            </View>
            <Text variant="caption" tone="secondary">
              {l.detail} · {l.blurb}
            </Text>
          </View>
        ))}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            paddingVertical: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: c.border,
          }}
        >
          <Text variant="bodyStrong">Total</Text>
          <Text variant="bodyStrong">{score.total} / 100</Text>
        </View>
      </Card>

      <SectionTitle>Last 30 days</SectionTitle>
      <Card>
        <LineChart data={history} width={chartWidth} height={150} domain={[0, 100]} />
      </Card>

      <SectionTitle>What changed your score</SectionTitle>
      <ProGate feature="overview.top-lever">
        <Card>
          <Text variant="body">
            {score.actions[0]
              ? `${score.actions[0].title} — worth ${score.actions[0].points} points, the biggest single gain available to you today.`
              : 'Nothing left to improve today. Hold this pattern for the week.'}
          </Text>
        </Card>
      </ProGate>

      <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.xl }}>
        The Calqulate Metabolic Score is a habit measure, not a medical assessment. It does not
        diagnose anything and should not replace advice from your prescriber.
      </Text>
    </Screen>
  );
}
