import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../theme/ThemeProvider';
import { spacing } from '../theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: ViewStyle;
  footer?: ReactNode;
};

export function Screen({ children, scroll, padded = true, style, footer }: Props) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const pad = padded ? spacing.xl : 0;

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[
        { paddingHorizontal: pad, paddingBottom: spacing.xxxl + insets.bottom },
        style,
      ]}
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, { paddingHorizontal: pad }, style]}>{children}</View>
  );

  return (
    <View style={[styles.flex, { backgroundColor: c.bg, paddingTop: insets.top }]}>
      {body}
      {footer ? (
        <View
          style={{
            paddingHorizontal: pad || spacing.xl,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            paddingTop: spacing.md,
          }}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({ flex: { flex: 1 } });
