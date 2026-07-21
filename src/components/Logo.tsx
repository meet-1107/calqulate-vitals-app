import { View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Text } from './Text';
import { useTheme } from '../theme/ThemeProvider';
import { palette, spacing } from '../theme';

/**
 * Calqulate mark, drawn as vector rather than shipped as a bitmap so it stays
 * sharp at every size and can pick up the dark-mode surface behind it.
 *
 * The emblem is an open green ring with a yellow leaf closing its top, a figure
 * with raised arms inside, and leaves growing from the right. Geometry is in a
 * 0-100 box so `size` scales everything uniformly.
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <LinearGradient id="ring" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.green700} />
          <Stop offset="1" stopColor={palette.green500} />
        </LinearGradient>
        <LinearGradient id="sun" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.yellow300} />
          <Stop offset="1" stopColor={palette.yellow500} />
        </LinearGradient>
        <LinearGradient id="leaf" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.green600} />
          <Stop offset="1" stopColor={palette.green300} />
        </LinearGradient>
        <LinearGradient id="figure" x1="0" y1="1" x2="1" y2="0">
          <Stop offset="0" stopColor={palette.green700} />
          <Stop offset="1" stopColor={palette.green500} />
        </LinearGradient>
      </Defs>

      {/* Ring, open at the top where the yellow leaf sits. */}
      <Path
        d="M 34.5 23.2 A 31 31 0 1 0 79.1 39.4"
        stroke="url(#ring)"
        strokeWidth={9}
        strokeLinecap="round"
        fill="none"
      />

      {/* Yellow leaf closing the ring. */}
      <Path d="M 30 30 C 43 10, 70 10, 83 34 C 65 22, 47 20, 30 30 Z" fill="url(#sun)" />

      {/* Figure: head plus raised arms tapering to the body. */}
      <Path
        d="M 37 33 C 44 48, 51 56, 57 61 C 63 55, 71 46, 79 32 C 76 50, 68 62, 58 70 C 48 62, 40 50, 37 33 Z"
        fill="url(#figure)"
      />
      <Circle cx="61" cy="34" r="8" fill="url(#figure)" />

      {/* Leaves growing from the right, and the large sweep below. */}
      <Path d="M 81 38 C 83 25, 88 16, 95 11 C 97 25, 92 35, 81 38 Z" fill="url(#leaf)" />
      <Path d="M 84 46 C 88 36, 93 32, 100 31 C 97 42, 91 49, 84 46 Z" fill="url(#leaf)" />
      <Path d="M 34 86 C 50 84, 68 74, 80 59 C 79 78, 61 91, 40 90 Z" fill="url(#leaf)" />
    </Svg>
  );
}

/** Wordmark. The q is always yellow — it is the one letter people remember. */
export function Wordmark({ size = 34 }: { size?: number }) {
  const { scheme } = useTheme();
  const ink = scheme === 'dark' ? '#EAF3EF' : palette.green700;
  const style = { fontSize: size, lineHeight: size * 1.2, fontWeight: '700' as const, letterSpacing: -0.5 };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
      <Text style={[style, { color: ink }]}>Cal</Text>
      <Text style={[style, { color: palette.yellow500 }]}>q</Text>
      <Text style={[style, { color: ink }]}>ulate</Text>
    </View>
  );
}

/** Full lockup: mark over wordmark, with the GLP-1 Tracker rule. */
export function Logo({
  size = 96,
  tagline = true,
  style,
}: {
  size?: number;
  tagline?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();

  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <LogoMark size={size} />
      <View style={{ marginTop: spacing.md }}>
        <Wordmark size={size * 0.36} />
      </View>
      {tagline ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 }}>
          <View style={{ width: 18, height: 1.5, backgroundColor: colors.textTertiary }} />
          <Text variant="micro" tone="secondary" style={{ letterSpacing: 1.6 }}>
            GLP-1 TRACKER
          </Text>
          <View style={{ width: 18, height: 1.5, backgroundColor: colors.textTertiary }} />
        </View>
      ) : null}
    </View>
  );
}

/** Horizontal lockup for the top bar. */
export function LogoLockup({ size = 30 }: { size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <LogoMark size={size} />
      <Wordmark size={size * 0.62} />
    </View>
  );
}
