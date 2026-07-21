import { Text as RNText, type TextProps } from 'react-native';
import { useColors } from '../theme/ThemeProvider';
import { type as typeScale } from '../theme';

type Variant = keyof typeof typeScale;
type Tone = 'default' | 'secondary' | 'tertiary' | 'primary' | 'pro' | 'inverse';

export function Text({
  variant = 'body',
  tone = 'default',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const c = useColors();
  const color =
    tone === 'secondary'
      ? c.textSecondary
      : tone === 'tertiary'
        ? c.textTertiary
        : tone === 'primary'
          ? c.primary
          : tone === 'pro'
            ? c.pro
            : tone === 'inverse'
              ? c.onPrimary
              : c.text;

  return <RNText {...rest} style={[typeScale[variant], { color }, style]} />;
}
