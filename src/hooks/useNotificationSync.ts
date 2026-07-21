import { useEffect } from 'react';
import { Platform } from 'react-native';
import { registerDevice } from '../lib/api';
import { getMedication } from '../lib/medications';
import { registerForPush, syncReminders } from '../lib/notifications';
import { useProfile } from '../store/profile';

/**
 * Keeps the local reminder schedule in step with the user's settings, and
 * registers the device for remote push once notifications are allowed.
 */
export function useNotificationSync() {
  const { ready, profile, patchProfile } = useProfile();
  const { notifications, reminderTime } = profile.settings;
  const reminderHour = Number(reminderTime.split(':')[0]) || 9;

  useEffect(() => {
    if (!ready || !profile.onboarded) return;
    syncReminders({
      enabled: notifications,
      injectionDay: profile.injectionDay,
      injectionHour: profile.injectionHour,
      reminderHour,
      medicationName: getMedication(profile.medication).name,
      proteinGoal: profile.goals.proteinG,
    }).catch(() => {});
  }, [
    ready,
    profile.onboarded,
    notifications,
    profile.injectionDay,
    profile.injectionHour,
    reminderHour,
    profile.medication,
    profile.goals.proteinG,
  ]);

  useEffect(() => {
    if (!ready || !notifications || profile.pushToken) return;
    let cancelled = false;

    registerForPush().then((token) => {
      if (cancelled || !token) return;
      patchProfile({ pushToken: token });
      registerDevice({ email: profile.email, token, platform: Platform.OS });
    });

    return () => {
      cancelled = true;
    };
  }, [ready, notifications, profile.pushToken, profile.email, patchProfile]);
}
