import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase client.
 *
 * Auth session is persisted via AsyncStorage on native and localStorage on web
 * (handled automatically by supabase-js when a storage adapter is provided).
 * We deliberately do NOT use expo-secure-store for the *session token* because
 * Supabase refreshes tokens frequently and the keychain writes are slow; the
 * biometric unlock (CLAUDE.md §3) gates access to the app on launch, not the
 * bearer of the token in storage.
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. ' +
      'Fill .env.local before running against a real backend.',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type SupabaseClient = typeof supabase;
