import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  planReminders,
  REMINDER_LEAD_MINUTES,
  type ReminderJob,
  type ReminderMap,
} from './reminder-plan';

/**
 * Local notifications: job reminders (an hour before a scheduled job) and
 * "your quote is ready" when a slow AI quote finishes after the screen gave
 * up waiting. Everything is scheduled on the phone, so no push server or
 * Firebase project is needed.
 */

const CHANNEL_ID = 'job-reminders';
const MAP_KEY = 'ecq.job-reminders.v1';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type ReminderPref = { enabled: boolean; setEnabled: (v: boolean) => void };

export const useReminderPref = create<ReminderPref>()(
  persist((set) => ({ enabled: true, setEnabled: (enabled) => set({ enabled }) }), {
    name: 'ecq.reminder-pref',
    version: 1,
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (s) => ({ enabled: s.enabled }),
  }),
);

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Job reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

/** Ask once, and only when there's something to deliver. */
async function canNotify(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync();
  return asked.granted;
}

async function readMap(): Promise<ReminderMap> {
  try {
    const raw = await AsyncStorage.getItem(MAP_KEY);
    return raw ? (JSON.parse(raw) as ReminderMap) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: ReminderMap): Promise<void> {
  try {
    await AsyncStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    // A lost map only means a reminder might be re-created; harmless.
  }
}

export type ReminderJobWithLabel = ReminderJob & {
  title: string;
  customer_name?: string | null;
};

/**
 * Bring scheduled reminders in line with `jobs`. Pass `knownJobIds` when the
 * list is partial (e.g. one job after editing it) so other jobs' reminders
 * are left alone; omit it when the list is every upcoming job.
 */
export async function syncJobReminders(
  jobs: ReminderJobWithLabel[],
  knownJobIds: Set<string> | null = null,
): Promise<void> {
  try {
    const map = await readMap();
    const enabled = useReminderPref.getState().enabled;
    const plan = enabled
      ? planReminders(jobs, map, Date.now(), knownJobIds)
      : { schedule: [], cancel: Object.keys(map) };

    for (const jobId of plan.cancel) {
      const entry = map[jobId];
      if (entry) await Notifications.cancelScheduledNotificationAsync(entry.notificationId);
      delete map[jobId];
    }

    if (plan.schedule.length > 0 && (await canNotify())) {
      await ensureChannel();
      const byId = new Map(jobs.map((j) => [j.id, j]));
      for (const item of plan.schedule) {
        const job = byId.get(item.jobId);
        if (!job) continue;
        const when = new Date(item.scheduledAt).toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
        });
        const notificationId = await Notifications.scheduleNotificationAsync({
          content: {
            title: `Job at ${when}`,
            body: [job.title, job.customer_name].filter(Boolean).join(' · '),
            data: { jobId: job.id },
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: item.fireAt,
            channelId: CHANNEL_ID,
          },
        });
        map[item.jobId] = { notificationId, scheduledAt: item.scheduledAt };
      }
    }
    await writeMap(map);
  } catch (err) {
    console.warn('[reminders] sync failed', err);
  }
}

/** Tell the contractor a quote finished after the New Quote screen stopped waiting. */
export async function notifyQuoteReady(quoteId: string): Promise<void> {
  try {
    if (!(await canNotify())) return;
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Your quote is ready',
        body: 'Tap to review it and send it to your customer.',
        data: { quoteId },
      },
      trigger: null,
    });
  } catch (err) {
    console.warn('[notifications] quote-ready failed', err);
  }
}

/** Open the job or quote a tapped notification is about. Call once in the root layout. */
export function useNotificationRouting(): void {
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        jobId?: string;
        quoteId?: string;
      };
      if (data.jobId) router.push({ pathname: '/job/[id]', params: { id: data.jobId } });
      else if (data.quoteId) router.push({ pathname: '/quote/[id]', params: { id: data.quoteId } });
    });
    return () => sub.remove();
  }, []);
}

export { REMINDER_LEAD_MINUTES };
