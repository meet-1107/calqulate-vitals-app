import { Stack } from 'expo-router';
import { useColors } from '../../src/theme/ThemeProvider';

export default function OnboardingLayout() {
  const c = useColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: c.bg },
        animation: 'slide_from_right',
      }}
    />
  );
}
