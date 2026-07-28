/**
 * Reminders at the time the app worked out you train.
 *
 * The user is never asked when to be reminded — that would be one more setting
 * to get wrong. The schedule comes from `deriveReminder`, which only produces
 * one once there is a real pattern in the sessions already logged.
 *
 * The module is loaded through a runtime require, like HealthKit, so a bundle
 * without expo-notifications still starts and simply reports reminders as
 * unavailable.
 */

/** Matches expo-notifications' weekly trigger exactly; weekday 1 is Sunday. */
type Trigger = {
  type: 'weekly';
  weekday: number;
  hour: number;
  minute: number;
};

type NativeNotifications = {
  getPermissionsAsync: () => Promise<{ status: string }>;
  requestPermissionsAsync: () => Promise<{ status: string }>;
  scheduleNotificationAsync: (request: {
    content: { title: string; body: string; sound?: boolean };
    trigger: Trigger;
  }) => Promise<string>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  getAllScheduledNotificationsAsync: () => Promise<unknown[]>;
  setNotificationHandler: (handler: unknown) => void;
};

let cached: NativeNotifications | null | undefined;

function loadNotifications(): NativeNotifications | null {
  if (cached !== undefined) return cached;
  try {
    const moduleName = 'expo-notifications';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loaded = (require as unknown as (name: string) => NativeNotifications)(moduleName);
    cached = loaded;
  } catch {
    cached = null;
  }
  return cached;
}

export function remindersAvailable(): boolean {
  return loadNotifications() !== null;
}

export type ReminderPlan = {
  hour: number;
  minute: number;
  /** 0 = Sunday. */
  weekdays: number[];
  label: string;
};

export type ScheduleOutcome =
  | { status: 'scheduled'; count: number }
  | { status: 'denied' }
  | { status: 'unavailable' }
  | { status: 'failed'; message: string };

/**
 * Replaces whatever was scheduled with the current pattern.
 *
 * Cancelling everything first is deliberate: the training pattern moves as the
 * user's life does, and a stale reminder at last month's time is worse than
 * none. Nothing else in the app schedules notifications, so there is nothing
 * of anyone else's to cancel.
 */
export async function scheduleTrainingReminders(plan: ReminderPlan): Promise<ScheduleOutcome> {
  const native = loadNotifications();
  if (!native) return { status: 'unavailable' };

  try {
    const existing = await native.getPermissionsAsync();
    const granted =
      existing.status === 'granted' ? true : (await native.requestPermissionsAsync()).status === 'granted';
    if (!granted) return { status: 'denied' };

    await native.cancelAllScheduledNotificationsAsync();

    for (const weekday of plan.weekdays) {
      await native.scheduleNotificationAsync({
        content: {
          title: 'Training day',
          body: `${plan.label}. Everything is laid out.`,
          sound: false,
        },
        // expo-notifications counts weekdays from 1 = Sunday.
        // A weekly trigger repeats on its own; there is no repeat flag to set.
        trigger: { type: 'weekly', weekday: weekday + 1, hour: plan.hour, minute: plan.minute },
      });
    }

    return { status: 'scheduled', count: plan.weekdays.length };
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : 'Could not schedule reminders' };
  }
}

export async function cancelTrainingReminders(): Promise<void> {
  const native = loadNotifications();
  if (!native) return;
  try {
    await native.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to do: the reminders either were never set or are already gone.
  }
}
