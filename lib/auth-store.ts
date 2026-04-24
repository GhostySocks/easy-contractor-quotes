import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { SubscriptionRow } from './entitlement';

export type AuthState = {
  session: Session | null;
  user: User | null;
  subscription: SubscriptionRow | null;
  bootstrapped: boolean;

  setSession: (session: Session | null) => void;
  setSubscription: (subscription: SubscriptionRow | null) => void;
  setBootstrapped: (value: boolean) => void;
  reset: () => void;
};

/**
 * Single source of truth for auth + subscription UI state.
 * Populated by the root layout's `useSessionBootstrap()` hook.
 */
export const useAuth = create<AuthState>((set) => ({
  session: null,
  user: null,
  subscription: null,
  bootstrapped: false,

  setSession: (session) => set({ session, user: session?.user ?? null }),
  setSubscription: (subscription) => set({ subscription }),
  setBootstrapped: (value) => set({ bootstrapped: value }),
  reset: () => set({ session: null, user: null, subscription: null }),
}));
