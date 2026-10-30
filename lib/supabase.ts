import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client.
 *
 * Auth session persists via AsyncStorage on native and localStorage (via
 * AsyncStorage's web shim) in the browser. During any server-render pass
 * (Node.js, no `window`) the storage becomes a no-op so module evaluation
 * doesn't throw; hydration picks up the real session once we're on the
 * client.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
      'Fill .env.local before running against a real backend.',
  );
}

type Storage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const noopStorage: Storage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
};

const hasWindow = typeof window !== 'undefined';
const storage: Storage = hasWindow ? AsyncStorage : noopStorage;

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type SupabaseClient = typeof supabase;

/**
 * Whether a login is saved on this device, checked locally with no network.
 * supabase-js stores the session under `sb-<project ref>-auth-token`. Used at
 * startup to tell "restoring a login on a slow network" (keep waiting) apart
 * from "never signed in" (go to Welcome).
 */
export async function hasStoredSession(): Promise<boolean> {
  if (!supabaseUrl) return false;
  try {
    const ref = new URL(supabaseUrl).hostname.split('.')[0];
    return (await storage.getItem(`sb-${ref}-auth-token`)) !== null;
  } catch {
    return false;
  }
}
