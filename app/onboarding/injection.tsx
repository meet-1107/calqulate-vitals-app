import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../src/components/Button';
import { CalendarPicker } from '../../src/components/CalendarPicker';
import { Screen } from '../../src/components/Screen';
import { Text } from '../../src/components/Text';
import { WheelPicker } from '../../src/components/WheelPicker';
import { OnboardingHeader } from '../../src/components/OnboardingHeader';
import { formatHour } from '../../src/lib/dates';
import { useProfile } from '../../src/store/profile';
import { spacing } from '../../src/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function InjectionScreen() {
  const router = useRouter();
  const { profile, patchProfile } = useProfile();

  const [date, setDate] = useState<Date | null>(
    profile.nextInjectionAt != null ? new Date(profile.nextInjectionAt) : null
  );

  const submit = () => {
    if (!date) return;
    patchProfile({
      nextInjectionAt: date.getTime(),
      // Weekly cadence: the picked date's weekday drives recurring reminders.
      injectionDay: date.getDay(),
    });
    router.push('/onboarding/areas');
  };

  return (
    <Screen
      scroll
      footer={<Button title="Continue" disabled={date == null} onPress={submit} />}
    >
      <OnboardingHeader step={5} />
      <Text variant="title">When is your next scheduled injection?</Text>

      <View style={{ marginTop: spacing.xl }}>
        <CalendarPicker value={date} onChange={setDate} minDate={new Date()} />
      </View>

      <Text variant="heading" style={{ marginTop: spacing.xxl }}>
        Reminder time
      </Text>
      <View style={{ marginTop: spacing.md }}>
        <WheelPicker
          values={HOURS}
          value={profile.injectionHour}
          format={formatHour}
          onChange={(h) => patchProfile({ injectionHour: h })}
        />
      </View>
    </Screen>
  );
}
