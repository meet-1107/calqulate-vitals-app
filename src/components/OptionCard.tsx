import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { HIT, radius, spacing } from '../theme';

type Props = {
  label: string;
  sublabel?: string;
  selected?: boolean;
  onPress: () => void;
};

/** Apple-style single-select card. One tap, no confirm step. */
export function OptionCard({ label, sublabel, selected, onPress }: Props) {
  const c = useColors();
  const { scheme } = useTheme();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => ({
        minHeight: HIT + 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md + 2,
        borderRadius: radius.lg,
        backgroundColor: selected ? c.primarySoft : scheme === 'dark' ? c.card : c.cardAlt,
        borderWidth: 1.5,
        borderColor: selected ? c.primary : 'transparent',
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{label}</Text>
        {sublabel ? (
          <Text variant="caption" tone="secondary" style={{ marginTop: 2 }}>
            {sublabel}
          </Text>
        ) : null}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={24}
        color={selected ? c.primary : c.textTertiary}
      />
    </Pressable>
  );
}
