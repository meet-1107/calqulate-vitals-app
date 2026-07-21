import { Tabs, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/build/react-navigation/bottom-tabs';
import { Text } from '../../src/components/Text';
import { useColors, useTheme } from '../../src/theme/ThemeProvider';
import { HIT, radius, shadow, spacing } from '../../src/theme';

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  progress: ['trending-up', 'trending-up-outline'],
  medication: ['medkit', 'medkit-outline'],
  profile: ['person', 'person-outline'],
};

const LABELS: Record<string, string> = {
  index: 'Home',
  progress: 'Progress',
  medication: 'Medication',
  profile: 'Profile',
};

function TabBar({ state, navigation }: BottomTabBarProps) {
  const c = useColors();
  const { scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // The FAB sits between the second and third tab.
  const left = state.routes.slice(0, 2);
  const right = state.routes.slice(2);

  const renderTab = (route: (typeof state.routes)[number]) => {
    const index = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === index;
    const [active, inactive] = ICONS[route.name] ?? ICONS.index;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          if (!focused) navigation.navigate(route.name);
        }}
        style={{ flex: 1, alignItems: 'center', gap: 3, minHeight: HIT, paddingTop: spacing.sm }}
      >
        <Ionicons
          name={focused ? active : inactive}
          size={23}
          color={focused ? c.primary : c.textTertiary}
        />
        <Text variant="micro" style={{ color: focused ? c.primary : c.textTertiary }}>
          {LABELS[route.name]}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingBottom: Math.max(insets.bottom, spacing.md),
        paddingTop: spacing.xs,
        backgroundColor: c.card,
        borderTopWidth: scheme === 'dark' ? 1 : 0,
        borderTopColor: c.border,
        ...(scheme === 'light' ? shadow(c.shadow, 2) : null),
      }}
    >
      {left.map(renderTab)}
      <View style={{ width: 76, alignItems: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick add"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
            router.push('/quick-add');
          }}
          style={({ pressed }) => ({
            width: 58,
            height: 58,
            marginTop: -22,
            borderRadius: radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.primary,
            transform: [{ scale: pressed ? 0.94 : 1 }],
            ...shadow(c.primary, 2),
          })}
        >
          <Ionicons name="add" size={32} color={c.onPrimary} />
        </Pressable>
      </View>
      {right.map(renderTab)}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="medication" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
