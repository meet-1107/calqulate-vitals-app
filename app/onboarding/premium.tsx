import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button } from '../../src/components/Button';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { useProfile } from '../../src/store/profile';
import { useColors } from '../../src/theme/ThemeProvider';
import { spacing } from '../../src/theme';

export default function AllSet() {
  const c = useColors();
  const router = useRouter();
  const { patchProfile } = useProfile();

  const finish = () => {
    patchProfile({ onboarded: true });
    router.replace('/(tabs)');
  };

  return (
    <Screen footer={<Button title="Continue" onPress={finish} />}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 96,
            height: 96,
            borderRadius: 48,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: c.primarySoft,
          }}
        >
          <Ionicons name="checkmark" size={48} color={c.primary} />
        </View>
        <Text variant="title" style={{ marginTop: spacing.xxl, textAlign: 'center' }}>
          You&apos;re all set.
        </Text>
        <Text
          variant="body"
          tone="secondary"
          style={{ marginTop: spacing.md, textAlign: 'center', paddingHorizontal: spacing.xl }}
        >
          We&apos;ll help you stay consistent and understand your progress over time.
        </Text>
      </View>
    </Screen>
  );
}
