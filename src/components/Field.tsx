import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { HIT, radius, spacing, type as typeScale } from '../theme';

export function Field({
  label,
  style,
  ...rest
}: TextInputProps & { label: string }) {
  const c = useColors();
  const { scheme } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
      <TextInput
        placeholderTextColor={c.textTertiary}
        {...rest}
        onFocus={(e) => {
          setFocused(true);
          rest.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          rest.onBlur?.(e);
        }}
        style={[
          typeScale.body,
          {
            minHeight: HIT + 4,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.lg,
            color: c.text,
            backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
            borderWidth: 1.5,
            borderColor: focused ? c.primary : 'transparent',
          },
          style,
        ]}
      />
    </View>
  );
}
