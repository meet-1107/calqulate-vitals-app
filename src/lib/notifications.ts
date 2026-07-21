/**
 * Push and reminders.
 *
 * Two distinct channels, deliberately:
 *
 *  - **Remote (Firebase Cloud Messaging)** — anything the backend decides:
 *    campaign sends from the admin panel, weekly insight pushes, subscription
 *    notices. Android goes through FCM natively; iOS goes through APNs with FCM
 *    as the sender. We register for a native device token and hand it to the
 *    backend, which stores it in `devices`.
 *
 *  - **Local** — dose day, weigh-in, and hydration reminders. These are pure
 *    functions of data already on the device, so scheduling them locally means
 *    they fire correctly with no network and no server cost.
 *
 * Requires a development build. Remote push does not work in Expo Go — the
 * registration call below returns null there rather than throwing.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DAY_LABELS } from './dates';

export const REMINDER_IDS = {
  injection: 'reminder.injection',
  weighIn: 'reminder.weigh-in',
  hydration: 'reminder.hydration',
  morning: 'reminder.morning',
} as const;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('reminders', {
    name: 'Reminders',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 100, 200],
    lightColor: '#0F9F73',
  });
}

export async function requestPermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  if (!existing.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

/**
 * Registers this device with FCM/APNs and returns the token to send to the
 * backend. Returns null in Expo Go, on simulators, or without permission —
 * all expected, none of them errors.
 */
export async function registerForPush(): Promise<string | null> {
  if (!Device.isDevice) return null;
  if (!(await requestPermission())) return null;
  await ensureAndroidChannel();

  try {
    const { data } = await Notifications.getDevicePushTokenAsync();
    return typeof data === 'string' ? data : null;
  } catch {
    return null;
  }
}

type ReminderConfig = {
  enabled: boolean;
  injectionDay: number | null;
  injectionHour: number;
  reminderHour: number;
  medicationName: string;
  proteinGoal: number;
};

/**
 * Rebuilds the whole local schedule. Cancelling first is intentional — it keeps
 * this idempotent, so callers can run it on every settings change without
 * stacking duplicate notifications.
 */
export async function syncReminders(config: ReminderConfig) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!config.enabled) return;
  if (!(await requestPermission())) return;
  await ensureAndroidChannel();

  const schedule = (
    identifier: string,
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
  ) =>
    Notifications.scheduleNotificationAsync({
      identifier,
      content: { title, body },
      trigger,
    });

  await schedule(
    REMINDER_IDS.morning,
    'Good morning 🌿',
    `Today's protein goal is ${config.proteinGoal} g.`,
    {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: config.reminderHour,
      minute: 0,
    },
  );

  await schedule(REMINDER_IDS.weighIn, 'Ready for today’s weigh-in?', 'It takes ten seconds.', {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: Math.min(23, config.reminderHour + 1),
    minute: 0,
  });

  await schedule(
    REMINDER_IDS.hydration,
    'Hydration check',
    "You're halfway through the day — how's your water?",
    { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 14, minute: 0 },
  );

  if (config.injectionDay != null) {
    await schedule(
      REMINDER_IDS.injection,
      'Today is your injection day',
      `${config.medicationName} · ${DAY_LABELS[config.injectionDay]}`,
      {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        // expo-notifications weekdays are 1-7 with Sunday = 1.
        weekday: config.injectionDay + 1,
        hour: config.injectionHour,
        minute: 0,
      },
    );
  }
}

export async function cancelAllReminders() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
