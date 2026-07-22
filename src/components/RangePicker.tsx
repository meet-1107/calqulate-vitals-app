import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from './Text';
import { useColors, useTheme } from '../theme/ThemeProvider';
import { radius, shadow, spacing } from '../theme';

export type Range = { label: string; days: number };

export const RANGES: Range[] = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'Last year', days: 365 },
  { label: 'All time', days: 36500 },
];

/** Dropdown pill for a time range — the chart header control. */
export function RangePicker({
  value,
  onChange,
  lockedFrom,
}: {
  value: number;
  onChange: (days: number) => void;
  /** Ranges longer than this show a lock (free-tier history cap). */
  lockedFrom?: number;
}) {
  const c = useColors();
  const { scheme } = useTheme();
  const [open, setOpen] = useState(false);
  const active = RANGES.find((r) => r.days === value) ?? RANGES[1];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Time range: ${active.label}`}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setOpen(true);
        }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.sm + 2,
          paddingHorizontal: spacing.md,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: scheme === 'dark' ? c.cardAlt : c.card,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text variant="caption" tone="secondary">
          {active.label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={c.textTertiary} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: '#0007', justifyContent: 'center', padding: spacing.xl }}
        >
          <View
            style={{
              backgroundColor: c.card,
              borderRadius: radius.xl,
              overflow: 'hidden',
              ...shadow(c.shadow, 2),
            }}
          >
            {RANGES.map((r, i) => {
              const locked = lockedFrom != null && r.days > lockedFrom;
              const selected = r.days === value;
              return (
                <Pressable
                  key={r.days}
                  onPress={() => {
                    onChange(r.days);
                    setOpen(false);
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.md,
                    paddingVertical: spacing.lg,
                    paddingHorizontal: spacing.xl,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: c.border,
                    backgroundColor: selected ? c.primarySoft : 'transparent',
                  }}
                >
                  <Text variant="body" style={{ flex: 1 }} tone={selected ? 'primary' : 'default'}>
                    {r.label}
                  </Text>
                  {locked ? <Ionicons name="lock-closed" size={14} color={c.pro} /> : null}
                  {selected ? <Ionicons name="checkmark" size={18} color={c.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}
