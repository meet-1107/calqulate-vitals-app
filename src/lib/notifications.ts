/**
 * Push and reminders.
 *
 * Two distinct channels, deliberately:
 *
 *  - **Remote (Firebase Cloud Messaging)** — anything the backend decides:
 *    campaign sends from the admin panel, weekly insight pushes, subscription
 *    notices. Android goes through FCM natively; iOS goes through APNs with FCM
 *    as the sender.
 *
 *  - **Local** — dose day, weigh-in, and hydration reminders. These are pure
 *    functions of data already on the device, so scheduling them locally means
 *    they fire correctly with no network and no server cost.
 *
 * EVERYTHING HERE IS LAZY AND DEFENSIVE.
 *
 * `expo-notifications` throws on Android in Expo Go — remote push was removed
 * from it in SDK 53. An earlier version of this file imported the module at the
 * top and called `setNotificationHandler` at module scope, so that throw
 * propagated into every route that imported it and the entire app rendered a
 * blank screen. A notification helper must never be able to take down the app
 * it is decorating, so the module is imported on demand inside try/catch and
 * every entry point degrades to a no-op.
 */

import Constants, { ExecutionEnvironment } from 'expo-constants';
import type * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { DAY_LABELS } from './dates';

/**
 * Expo Go on Android cannot load expo-notifications at all.
 *
 * The package ships a side-effect module, DevicePushTokenAutoRegistration.fx,
 * which calls addPushTokenListener during import; on Android in Expo Go that
 * throws, and because the throw happens inside a promise callback during module
 * evaluation it escapes a try/catch around the dynamic import entirely — it
 * surfaces as an uncaught error and takes the screen down.
 *
 * So the module is never imported there. Detecting the environment first is the
 * only reliable guard; catching afterwards is too late.
 */
const IS_EXPO_GO_ANDROID =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

export const REMINDER_IDS = {
  injection: 'reminder.injection',
  weighIn: 'reminder.weigh-in',
  hydration: 'reminder.hydration',
  morning: 'reminder.morning',
} as const;

type Module = typeof ExpoNotifications;

let cached: Module | null = null;
let unavailable = false;
let handlerSet = false;

/** Resolves the native module, or null where it cannot run. */
async function load(): Promise<Module | null> {
  if (cached) return cached;
  if (unavailable) return null;
  if (IS_EXPO_GO_ANDROID) {
    unavailable = true;
    return null;
  }

  try {
    const mod = (await import('expo-notifications')) as Module;
    cached = mod;
    ensureHandler(mod);
    return mod;
  } catch {
    // Expo Go on Android, or a build without the module. Not an error state.
    unavailable = true;
    return null;
  }
}

/** Sets the foreground presentation rule once, never at import time. */
function ensureHandler(mod: Module) {
  if (handlerSet) return;
  try {
    mod.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
    handlerSet = true;
  } catch {
    /* presentation rules are cosmetic — never worth a crash */
  }
}

/** True when notifications can actually work on this build. */
export async function isAvailable() {
  return (await load()) !== null;
}

async function ensureAndroidChannel(mod: Module) {
  if (Platform.OS !== 'android') return;
  try {
    await mod.setNotificationChannelAsync('reminders', {
      name: 'Reminders',
      importance: mod.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 200, 100, 200],
      lightColor: '#0F9F73',
    });
  } catch {
    /* channel creation is best effort */
  }
}

export async function requestPermission(): Promise<boolean> {
  const mod = await load();
  if (!mod) return false;

  try {
    const existing = await mod.getPermissionsAsync();
    if (existing.granted) return true;
    if (!existing.canAskAgain) return false;
    const asked = await mod.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/**
 * Registers this device with FCM/APNs and returns the token to send to the
 * backend. Returns null in Expo Go, on simulators, or without permission — all
 * expected, none of them errors.
 */
export async function registerForPush(): Promise<string | null> {
  const mod = await load();
  if (!mod) return null;

  try {
    const Device = await import('expo-device');
    if (!Device.isDevice) return null;
    if (!(await requestPermission())) return null;
    await ensureAndroidChannel(mod);

    const { data } = await mod.getDevicePushTokenAsync();
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
  /** Injectables remind on their day; pills remind every day. */
  route: 'injection' | 'oral';
};

/**
 * Rebuilds the whole local schedule. Cancelling first is intentional — it keeps
 * this idempotent, so callers can run it on every settings change without
 * stacking duplicate notifications.
 */
export async function syncReminders(config: ReminderConfig) {
  const mod = await load();
  if (!mod) return;

  try {
    await mod.cancelAllScheduledNotificationsAsync();
    if (!config.enabled) return;
    if (!(await requestPermission())) return;
    await ensureAndroidChannel(mod);

    const schedule = (
      identifier: string,
      title: string,
      body: string,
      trigger: ExpoNotifications.NotificationTriggerInput,
    ) => mod.scheduleNotificationAsync({ identifier, content: { title, body }, trigger });

    await schedule(
      REMINDER_IDS.morning,
      'Good morning 🌿',
      `Today's protein goal is ${config.proteinGoal} g.`,
      {
        type: mod.SchedulableTriggerInputTypes.DAILY,
        hour: config.reminderHour,
        minute: 0,
      },
    );

    await schedule(REMINDER_IDS.weighIn, 'Ready for today’s weigh-in?', 'It takes ten seconds.', {
      type: mod.SchedulableTriggerInputTypes.DAILY,
      hour: Math.min(23, config.reminderHour + 1),
      minute: 0,
    });

    await schedule(
      REMINDER_IDS.hydration,
      'Hydration check',
      "You're halfway through the day — how's your water?",
      { type: mod.SchedulableTriggerInputTypes.DAILY, hour: 14, minute: 0 },
    );

    // A daily pill and a weekly shot need different reminders. Reminding an
    // oral user once a week would miss six doses out of seven.
    if (config.route === 'oral') {
      await schedule(
        REMINDER_IDS.injection,
        `Time for your ${config.medicationName}`,
        'Empty stomach, small sip of water, then wait 30 minutes before eating.',
        {
          type: mod.SchedulableTriggerInputTypes.DAILY,
          hour: config.injectionHour,
          minute: 0,
        },
      );
    } else if (config.injectionDay != null) {
      await schedule(
        REMINDER_IDS.injection,
        'Today is your injection day',
        `${config.medicationName} · ${DAY_LABELS[config.injectionDay]}`,
        {
          type: mod.SchedulableTriggerInputTypes.WEEKLY,
          // expo-notifications weekdays are 1-7 with Sunday = 1.
          weekday: config.injectionDay + 1,
          hour: config.injectionHour,
          minute: 0,
        },
      );
    }
  } catch {
    /* a reminder that fails to schedule must not break the screen that asked */
  }
}

export async function cancelAllReminders() {
  const mod = await load();
  if (!mod) return;
  try {
    await mod.cancelAllScheduledNotificationsAsync();
  } catch {
    /* nothing to do */
  }
}
