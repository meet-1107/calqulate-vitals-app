import type { ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme';
import { Text } from './Text';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  padded?: boolean;
};

export function Card({ children, style, onPress, padded = true }: Props) {
  const c = useColors();
  const { scheme } = useTheme();

  const base: ViewStyle = {
    backgroundColor: c.card,
    borderRadius: radius.xl,
    padding: padded ? spacing.lg + 2 : 0,
    borderWidth: scheme === 'dark' ? 1 : 0,
    borderColor: c.border,
    ...(scheme === 'light' ? shadow(c.shadow, 1) : null),
  };

  if (!onPress) return <View style={[base, style]}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [base, pressed && { opacity: 0.9 }, style]}
    >
      {children}
    </Pressable>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: spacing.md,
        marginTop: spacing.xl,
      }}
    >
      <Text variant="heading">{children}</Text>
      {action}
    </View>
  );
}
