import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

type Props = {
  value: Date | null;
  onChange: (d: Date) => void;
  /** Days before this date are disabled. */
  minDate?: Date;
};

export function CalendarPicker({ value, onChange, minDate }: Props) {
  const c = useColors();
  const { scheme } = useTheme();
  const today = new Date();
  const anchor = value ?? today;
  const [view, setView] = useState(() => new Date(anchor.getFullYear(), anchor.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const min = minDate
    ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()).getTime()
    : null;

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const isSelected = (d: number) =>
    value != null && value.getFullYear() === year && value.getMonth() === month && value.getDate() === d;
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
  const isDisabled = (d: number) => min != null && new Date(year, month, d).getTime() < min;

  return (
    <View
      style={{
        borderRadius: radius.xl,
        padding: spacing.lg,
        backgroundColor: scheme === 'dark' ? c.card : c.cardAlt,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable
          hitSlop={12}
          accessibilityLabel="Previous month"
          onPress={() => setView(new Date(year, month - 1, 1))}
        >
          <Ionicons name="chevron-back" size={22} color={c.textSecondary} />
        </Pressable>
        <Text variant="bodyStrong">
          {MONTHS[month]} {year}
        </Text>
        <Pressable
          hitSlop={12}
          accessibilityLabel="Next month"
          onPress={() => setView(new Date(year, month + 1, 1))}
        >
          <Ionicons name="chevron-forward" size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', marginTop: spacing.lg }}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ width: `${100 / 7}%`, alignItems: 'center' }}>
            <Text variant="micro" tone="tertiary">
              {w}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
        {cells.map((d, i) => {
          if (d == null) return <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1 }} />;
          const selected = isSelected(d);
          const disabled = isDisabled(d);
          return (
            <View key={i} style={{ width: `${100 / 7}%`, aspectRatio: 1, padding: 2 }}>
              <Pressable
                disabled={disabled}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled }}
                onPress={() => {
                  Haptics.selectionAsync().catch(() => {});
                  onChange(new Date(year, month, d));
                }}
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.md,
                  backgroundColor: selected ? c.primary : 'transparent',
                  borderWidth: !selected && isToday(d) ? 1.5 : 0,
                  borderColor: c.primary,
                }}
              >
                <Text
                  variant="caption"
                  style={{
                    color: selected ? c.onPrimary : disabled ? c.textTertiary : c.text,
                  }}
                >
                  {d}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}
