import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Text } from './Text';
import { LogoMark } from './Logo';
import { formatWeight } from '../lib/units';
import type { WeeklyReport } from '../lib/weeklyReport';
import { palette, radius, spacing } from '../theme';

/**
 * The shareable card.
 *
 * Deliberately light-mode regardless of the app theme —
 * a dark card looks broken on a white social background, and this image leaves
 * the app.
 */

const INK = palette.ink900;
const MUTED = '#5E6E68';

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#E7EEEB' }} />;
}

function Row({
  label,
  value,
  sub,
  tint,
  big,
}: {
  label: string;
  value: string;
  sub?: string;
  tint?: string;
  big?: boolean;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: big ? spacing.md : spacing.sm + 2,
      }}
    >
      <Text variant="caption" style={{ color: MUTED }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <Text
          style={{
            fontSize: big ? 22 : 18,
            lineHeight: big ? 28 : 24,
            fontWeight: '700',
            color: tint ?? INK,
          }}
        >
          {value}
        </Text>
        {sub ? (
          <Text variant="caption" style={{ color: MUTED }}>
            {sub}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Design width. Narrower devices scale down rather than clip. */
export const REPORT_WIDTH = 360;

export function ReportCard({
  report,
  name,
  width = REPORT_WIDTH,
}: {
  report: WeeklyReport;
  name?: string;
  width?: number;
}) {
  const { units } = report;
  const signed = (v: number | null, digits = 1) =>
    v == null ? '—' : `${v <= 0 ? '↓' : '↑'} ${formatWeight(Math.abs(v), units, digits)} ${units}`;

  return (
    <View
      style={{
        width,
        backgroundColor: '#FFFFFF',
        borderRadius: radius.xl,
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['#E9F7F1', '#FDF9EC']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.xl, alignItems: 'center', gap: spacing.sm }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <LogoMark size={22} />
          <Text variant="micro" style={{ color: MUTED, letterSpacing: 1.4 }}>
            GLP-1 WEEKLY REPORT
          </Text>
        </View>

        <Text style={{ fontSize: 64, lineHeight: 70, fontWeight: '800', color: palette.green600 }}>
          {report.score}
        </Text>
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: 4,
            borderRadius: radius.pill,
            backgroundColor: palette.green600,
          }}
        >
          <Text variant="bodyStrong" style={{ color: '#FFFFFF' }}>
            {report.grade}
          </Text>
        </View>
        <Text variant="micro" style={{ color: MUTED }}>
          METABOLIC SCORE · {report.weekLabel}
        </Text>
      </LinearGradient>

      <View style={{ paddingHorizontal: spacing.xl, paddingVertical: spacing.lg }}>
        <Row label="Weight" value={signed(report.weightChange)} big tint={palette.green600} />
        <Divider />
        <Row label="Fat" value={signed(report.fatChange)} tint={palette.green600} />
        <Divider />
        <Row
          label="Muscle"
          value={
            report.muscleChange == null
              ? '—'
              : Math.abs(report.muscleChange) < 0.2
                ? 'Held'
                : signed(report.muscleChange)
          }
          tint={
            report.muscleChange == null || report.muscleChange >= -0.2 ? palette.green600 : palette.yellow600
          }
        />
        <Divider />
        <Row
          label={report.medicationName}
          value={`${report.medicationPct}%`}
          sub={report.medicationVerdict}
          tint={palette.green600}
        />
        <Divider />
        <Row label="Protein" value={`${report.proteinPct}%`} />
        <Divider />
        <Row label="Hydration" value={`${report.hydrationPct}%`} />
      </View>

      <View
        style={{
          backgroundColor: '#F1F6F4',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.lg,
          gap: 6,
        }}
      >
        <Text variant="body" style={{ color: INK, lineHeight: 21 }}>
          {report.summary}
        </Text>
        <Text variant="micro" style={{ color: MUTED }}>
          {report.summarySource}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.xl,
          paddingVertical: spacing.md,
        }}
      >
        <Text variant="micro" style={{ color: MUTED }}>
          {name ? `${name} · Calqulate` : 'Calqulate'}
        </Text>
        <Text variant="micro" style={{ color: MUTED }}>
          calqulate.net
        </Text>
      </View>
    </View>
  );
}
