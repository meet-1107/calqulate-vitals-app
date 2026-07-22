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
import { useColors } from '../../src/theme/ThemeProvider';
import { radius, spacing } from '../../src/theme';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function InjectionScreen() {
  const router = useRouter();
  const { profile, patchProfile } = useProfile();
  const c = useColors();

  const [date, setDate] = useState<Date | null>(
    profile.nextInjectionAt != null ? new Date(profile.nextInjectionAt) : null
  );

  const submit = () => {
    if (!date) return;
    // Store the date at the chosen reminder hour. Saving the raw calendar date
    // left it at midnight, so the next-dose card read "Thursday 12:00 am" for
    // someone who had just picked 9:00 AM two fields below.
    const scheduled = new Date(date);
    scheduled.setHours(profile.injectionHour, 0, 0, 0);
    patchProfile({
      nextInjectionAt: scheduled.getTime(),
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

      {/* The time was previously an unlabelled wheel that looked pre-filled, so
          it read as a default rather than a question — and the chosen hour was
          never applied to the stored date. Both are now explicit. */}
      <View style={{ marginTop: spacing.xxl }}>
        <Text variant="heading">What time do you take it?</Text>
        <Text variant="caption" tone="secondary" style={{ marginTop: spacing.xs }}>
          Your reminder and your dose curve both use this time.
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing.lg,
          padding: spacing.lg,
          borderRadius: radius.lg,
          backgroundColor: c.primarySoft,
        }}
      >
        <Text variant="caption" tone="secondary">
          Selected
        </Text>
        <Text variant="heading" tone="primary">
          {formatHour(profile.injectionHour)}
        </Text>
      </View>

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
