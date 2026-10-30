import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Biometric unlock (CLAUDE.md §3.7: on by default after first sign-in,
 * password as the fallback). The preference is a convenience setting, not a
 * secret, so AsyncStorage is fine; the Supabase session itself is what's
 * protected.
 */

/** Coming back after this long in the background asks again. */
export const RELOCK_AFTER_MS = 60_000;

export type LockInputs = {
  enabled: boolean;
  /** Device has biometric hardware and the user has enrolled a face or finger. */
  available: boolean;
  signedIn: boolean;
  /** When the app last went to the background; null on a cold start. */
  backgroundedAt: number | null;
  now: number;
  /** Already unlocked during this foreground session. */
  unlocked: boolean;
};

/** Whether to show the lock screen right now. Pure, unit-tested. */
export function shouldLock(i: LockInputs): boolean {
  if (!i.enabled || !i.available || !i.signedIn) return false;
  if (i.backgroundedAt === null) return !i.unlocked;
  return i.now - i.backgroundedAt >= RELOCK_AFTER_MS;
}

type BiometricPref = {
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
};

export const useBiometricPref = create<BiometricPref>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled }),
    }),
    {
      name: 'ecq.biometric-lock',
      version: 1,
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ enabled: s.enabled }),
    },
  ),
);
