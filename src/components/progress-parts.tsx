import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { palette, radius, spacing } from '../theme';
import type { Achievement, Explored, Milestone } from '../lib/progress';

/** Journey timeline — milestones with real dates, connected. */
export function Timeline({ milestones }: { milestones: Milestone[] }) {
  const c = useColors();
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {milestones.map((m, i) => (
        <View key={m.id} style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
            <View
              style={{
                flex: 1,
                height: 2,
                backgroundColor: i === 0 ? 'transparent' : m.reached ? c.primary : c.track,
              }}
            />
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: m.reached ? c.primarySoft : c.bgElevated,
                borderWidth: 2,
                borderColor: m.reached ? c.primary : c.track,
              }}
            >
              <Ionicons
                name={(m.reached ? m.icon : 'ellipse-outline') as keyof typeof Ionicons.glyphMap}
                size={15}
                color={m.reached ? c.primary : c.textTertiary}
              />
            </View>
            <View
              style={{
                flex: 1,
                height: 2,
                backgroundColor:
                  i === milestones.length - 1
                    ? 'transparent'
                    : milestones[i + 1].reached
                      ? c.primary
                      : c.track,
              }}
            />
          </View>
          <Text
            variant="micro"
            tone={m.reached ? 'default' : 'tertiary'}
            style={{ textAlign: 'center', marginTop: spacing.sm }}
            numberOfLines={2}
          >
            {m.label}
          </Text>
          <Text variant="micro" tone="tertiary" style={{ textAlign: 'center' }}>
            {m.at ? fmt(m.at) : (m.subtitle ?? '—')}
          </Text>
        </View>
      ))}
    </View>
  );
}

const TINTS: Record<Achievement['tint'], string> = {
  green: palette.green500,
  blue: '#3B82D6',
  violet: '#8B5CF6',
  gold: palette.yellow500,
  teal: '#0D9DA3',
};

/** Achievement badge — earned ones carry colour, locked ones do not. */
export function Badge({ item }: { item: Achievement }) {
  const c = useColors();
  const tint = TINTS[item.tint];

  return (
    <View style={{ width: 104, alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          width: 74,
          height: 74,
          borderRadius: 22,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: item.earned ? tint : c.bgElevated,
          borderWidth: item.earned ? 0 : 1,
          borderColor: c.border,
        }}
      >
        <Ionicons
          name={(item.earned ? item.icon : 'lock-closed') as keyof typeof Ionicons.glyphMap}
          size={30}
          color={item.earned ? '#FFFFFF' : c.textTertiary}
        />
      </View>
      <Text
        variant="micro"
        tone={item.earned ? 'default' : 'tertiary'}
        style={{ textAlign: 'center' }}
        numberOfLines={2}
      >
        {item.title}
      </Text>
      {!item.earned ? (
        <View style={{ width: 56, height: 3, borderRadius: 2, backgroundColor: c.track }}>
          <View
            style={{
              width: `${Math.round(item.progress * 100)}%`,
              height: 3,
              borderRadius: 2,
              backgroundColor: c.textTertiary,
            }}
          />
        </View>
      ) : null}
    </View>
  );
}

/**
 * Correlation scatter.
 *
 * A scatter with a fitted line, not two series on a dual axis: dual axes let
 * any two measures be made to look related by choosing the scales, which is
 * exactly wrong for a tool whose job is judging whether a relationship is real.
 */
export function Scatter({ data, width, height = 200 }: { data: Explored; width: number; height?: number }) {
  const c = useColors();
  const { scheme } = useTheme();
  const pad = 34;

  if (data.points.length < 4) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text variant="caption" tone="tertiary" style={{ textAlign: 'center' }}>
          Not enough days where both were logged
        </Text>
      </View>
    );
  }

  const xs = data.points.map((p) => p.x);
  const ys = data.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  const px = (v: number) => pad + ((v - minX) / spanX) * (width - pad - 8);
  const py = (v: number) => height - pad - ((v - minY) / spanY) * (height - pad - 12);

  // Least-squares line, drawn only when the association clears the noise bar.
  let fit: string | null = null;
  if (data.stat && Math.abs(data.stat.r) >= 0.3) {
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
    const my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let num = 0;
    let den = 0;
    for (let i = 0; i < xs.length; i++) {
      num += (xs[i] - mx) * (ys[i] - my);
      den += (xs[i] - mx) ** 2;
    }
    const slope = den === 0 ? 0 : num / den;
    const at = (x: number) => my + slope * (x - mx);
    fit = `M ${px(minX)} ${py(at(minX))} L ${px(maxX)} ${py(at(maxX))}`;
  }

  return (
    <Svg width={width} height={height}>
      {[0, 0.5, 1].map((f) => (
        <Line
          key={f}
          x1={pad}
          y1={py(minY + spanY * f)}
          x2={width}
          y2={py(minY + spanY * f)}
          stroke={c.track}
          strokeWidth={1}
        />
      ))}
      <SvgText x={pad - 6} y={py(maxY) + 4} fill={c.textTertiary} fontSize="10" textAnchor="end">
        {maxY.toFixed(0)}
      </SvgText>
      <SvgText x={pad - 6} y={py(minY) + 4} fill={c.textTertiary} fontSize="10" textAnchor="end">
        {minY.toFixed(0)}
      </SvgText>

      {fit ? <Path d={fit} stroke={c.primary} strokeWidth={2} strokeDasharray="5 4" fill="none" /> : null}

      {data.points.map((p, i) => (
        <Circle
          key={i}
          cx={px(p.x)}
          cy={py(p.y)}
          r={4}
          fill={c.primary}
          opacity={scheme === 'dark' ? 0.75 : 0.55}
        />
      ))}

      <SvgText x={pad} y={height - 8} fill={c.textTertiary} fontSize="10">
        {data.xLabel} →
      </SvgText>
      <SvgText x={width} y={height - 8} fill={c.textTertiary} fontSize="10" textAnchor="end">
        ↑ {data.yLabel}
      </SvgText>
    </Svg>
  );
}
