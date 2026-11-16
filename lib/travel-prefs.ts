import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * How the contractor last charged for travel, kept on the phone so the next
 * quote starts from it. Whether to charge at all is asked fresh every time
 * and is never remembered.
 */
type TravelPrefs = {
  mode: 'flat' | 'per_mile';
  per: 'job' | 'day';
  /** Dollars as typed, one per mode, so switching modes doesn't mix them up. */
  flatRate: string;
  mileRate: string;
  remember: (used: { mode: 'flat' | 'per_mile'; per: 'job' | 'day'; rate: string }) => void;
};

export const useTravelPrefs = create<TravelPrefs>()(
  persist(
    (set) => ({
      mode: 'per_mile',
      per: 'job',
      flatRate: '',
      mileRate: '',
      remember: ({ mode, per, rate }) =>
        set(mode === 'flat' ? { mode, per, flatRate: rate } : { mode, per, mileRate: rate }),
    }),
    {
      name: 'ecq.travel-prefs',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ mode, per, flatRate, mileRate }) => ({ mode, per, flatRate, mileRate }),
    },
  ),
);
