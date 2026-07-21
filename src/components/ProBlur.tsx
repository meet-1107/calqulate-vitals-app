/**
 * Pro-gated chart wrapper: the content renders underneath, slightly blurred,
 * with an upgrade banner — the user sees exactly what they're missing.
 */

import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

export function ProBlur({
  locked,
  onUpgrade,
  label = 'Unlock with Pro',
  children,
}: {
  locked: boolean;
  onUpgrade: () => void;
  label?: string;
  children: ReactNode;
}) {
  const c = useColors();
  const { scheme } = useTheme();

  if (!locked) return <>{children}</>;

  return (
    <View>
      <View>
        {children}
        <BlurView
          intensity={14}
          tint={scheme === 'dark' ? 'dark' : 'light'}
          experimentalBlurMethod="dimezisBlurView"
          style={[StyleSheet.absoluteFill, { borderRadius: radius.md, overflow: 'hidden' }]}
        />
      </View>
      <Pressable
        onPress={onUpgrade}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          marginTop: spacing.md,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.md,
          borderRadius: radius.md,
          backgroundColor: c.proSoft,
        }}
      >
        <Ionicons name="lock-closed" size={14} color={c.pro} />
        <Text variant="caption" tone="pro" style={{ flex: 1 }}>
          {label}
        </Text>
        <Text variant="caption" tone="pro" style={{ fontWeight: '700' }}>
          Upgrade
        </Text>
      </Pressable>
    </View>
  );
}
