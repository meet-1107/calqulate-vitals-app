/**
 * Calqulate design tokens.
 * Apple Health spacing, Oura cards, Whoop hierarchy.
 * Green = primary action. Gold = Pro.
 */

/**
 * Calqulate brand palette — a clinical teal-green primary with a warm yellow
 * accent, matching calqulate.net. Green carries every primary action; yellow is
 * reserved for Vitals (premium) so the two never compete for the same meaning.
 *
 * Steps are chosen per mode, not flipped: the dark values are lighter and less
 * saturated so they hold contrast against a near-black surface.
 */
export const palette = {
  green50: '#E9F7F1',
  green100: '#CCEDE0',
  green300: '#5CCFA5',
  green400: '#2FBF8F',
  green500: '#0F9F73',
  green600: '#0B7E5B',
  green700: '#075C43',

  yellow100: '#FDF3D2',
  yellow300: '#F7D264',
  yellow400: '#F0C23A',
  yellow500: '#D9A400',
  yellow600: '#A87E00',

  ink900: '#0B1512',
  coral400: '#E8836F',
  violet400: '#9A8CE0',
};

const light = {
  bg: '#FFFFFF',
  bgElevated: '#F5F8F7',
  card: '#FFFFFF',
  cardAlt: '#F1F6F4',
  text: palette.ink900,
  textSecondary: '#5E6E68',
  textTertiary: '#93A19B',
  border: '#E7EEEB',
  primary: palette.green500,
  primarySoft: palette.green50,
  onPrimary: '#FFFFFF',
  /** Vitals accent. Yellow is legible on dark ink, never on white. */
  pro: palette.yellow500,
  proSoft: palette.yellow100,
  onPro: palette.ink900,
  danger: '#C4442C',
  track: '#E9EFEC',
  shadow: palette.ink900,
};

const dark: typeof light = {
  bg: '#080F0D',
  bgElevated: '#101815',
  card: '#121A17',
  cardAlt: '#19231F',
  text: '#F1F6F4',
  textSecondary: '#95A79F',
  textTertiary: '#65756E',
  border: '#1F2A26',
  primary: palette.green300,
  primarySoft: '#0E241C',
  onPrimary: '#03130D',
  pro: palette.yellow300,
  proSoft: '#241D08',
  onPro: palette.ink900,
  danger: '#E8735A',
  track: '#1F2A26',
  shadow: '#000000',
};

export type Colors = typeof light;
export const themes = { light, dark };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
};

/** Minimum touch target per design principles. */
export const HIT = 48;

export const type = {
  hero: { fontSize: 40, lineHeight: 44, fontWeight: '700' as const, letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' as const, letterSpacing: -0.6 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' as const, letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' as const },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.6 },
};

/** 300-400ms micro-animations. */
export const motion = { fast: 200, base: 320, slow: 420 };

export const shadow = (color: string, level: 1 | 2 = 1) => ({
  shadowColor: color,
  shadowOpacity: level === 1 ? 0.05 : 0.09,
  shadowRadius: level === 1 ? 12 : 24,
  shadowOffset: { width: 0, height: level === 1 ? 4 : 10 },
  elevation: level === 1 ? 2 : 6,
});
