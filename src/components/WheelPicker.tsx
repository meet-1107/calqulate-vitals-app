import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { FlatList, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Text } from './Text';
import { useColors } from '../theme/ThemeProvider';
import { radius, spacing } from '../theme';

const ITEM_HEIGHT = 52;
const VISIBLE = 5;

type Props<T extends string | number> = {
  values: T[];
  value: T | null;
  onChange: (value: T) => void;
  format?: (value: T) => string;
  suffix?: string;
};

/** Snapping wheel in the style of the Apple Health value pickers. */
export function WheelPicker<T extends string | number>({
  values,
  value,
  onChange,
  format,
  suffix,
}: Props<T>) {
  const c = useColors();
  const ref = useRef<FlatList<T>>(null);
  const index = Math.max(0, values.findIndex((v) => v === value));

  useEffect(() => {
    if (value == null) return;
    const i = values.findIndex((v) => v === value);
    if (i >= 0) ref.current?.scrollToOffset({ offset: i * ITEM_HEIGHT, animated: false });
    // Only recentre when the value set itself changes, not on every selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  const settle = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const next = values[Math.max(0, Math.min(values.length - 1, i))];
    if (next !== value) {
      Haptics.selectionAsync().catch(() => {});
      onChange(next);
    }
  };

  return (
    <View style={{ height: ITEM_HEIGHT * VISIBLE }}>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: ITEM_HEIGHT * 2,
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          borderRadius: radius.md,
          backgroundColor: c.primarySoft,
        }}
      />
      <FlatList
        ref={ref}
        data={values}
        keyExtractor={(item) => String(item)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        initialScrollIndex={index}
        getItemLayout={(_, i) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * i, index: i })}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
        renderItem={({ item }) => {
          const active = item === value;
          return (
            <View style={{ height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs }}>
                <Text
                  style={{
                    fontSize: active ? 30 : 22,
                    lineHeight: active ? 36 : 28,
                    fontWeight: active ? '700' : '500',
                    color: active ? c.text : c.textTertiary,
                  }}
                >
                  {format ? format(item) : String(item)}
                </Text>
                {suffix ? (
                  <Text variant="body" tone={active ? 'secondary' : 'tertiary'}>
                    {suffix}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
