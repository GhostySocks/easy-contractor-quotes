import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import type { PermissionStatus } from './permission-toggle';

export type PermissionKey = 'location' | 'notifications' | 'calendar';

const CHECK: Record<PermissionKey, () => Promise<PermissionStatus>> = {
  location: Location.getForegroundPermissionsAsync,
  notifications: Notifications.getPermissionsAsync,
  calendar: Calendar.getCalendarPermissionsAsync,
};

const ASK: Record<PermissionKey, () => Promise<PermissionStatus>> = {
  location: Location.requestForegroundPermissionsAsync,
  notifications: () => Notifications.requestPermissionsAsync(),
  calendar: Calendar.requestCalendarPermissionsAsync,
};

const UNKNOWN: PermissionStatus = { granted: false, canAskAgain: true };

/** The phone's current answer, without prompting. */
export async function checkPermission(key: PermissionKey): Promise<PermissionStatus> {
  try {
    return await CHECK[key]();
  } catch (err) {
    console.warn(`[permissions] ${key} check failed`, err);
    return UNKNOWN;
  }
}

/** Show the phone's prompt and return the answer. */
export async function askPermission(key: PermissionKey): Promise<PermissionStatus> {
  try {
    return await ASK[key]();
  } catch (err) {
    console.warn(`[permissions] ${key} request failed`, err);
    return UNKNOWN;
  }
}
