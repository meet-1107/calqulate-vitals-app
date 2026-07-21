import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import { HIT, radius, spacing } from '../theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'pro';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style }: Props) {
  const c = useColors();

  const bg = {
    primary: c.primary,
    secondary: c.cardAlt,
    ghost: 'transparent',
    pro: c.pro,
  }[variant];

  const fg = {
    primary: c.onPrimary,
    secondary: c.text,
    ghost: c.textSecondary,
    pro: c.onPro,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        pressed && { transform: [{ scale: 0.985 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text variant="bodyStrong" style={{ color: fg }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Row of full-width buttons stacked with consistent rhythm. */
export function ButtonStack({ children }: { children: React.ReactNode }) {
  return <View style={{ gap: spacing.sm }}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: HIT + 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
});
