import { useEffect } from 'react';

import { useAuth } from './auth-store';
import type { SubscriptionRow } from './entitlement';
import { initRevenueCat } from './revenuecat';
import { hasStoredSession, supabase } from './supabase';

/**
 * Bootstrap the auth + subscription state on app launch.
 *
 * - reads the existing Supabase session (if any) from AsyncStorage
 * - subscribes to auth changes so sign-in / sign-out is reflected immediately
 * - loads the matching row from the `subscriptions` table (server-validated
 *   source of truth for entitlement)
 * - initializes RevenueCat with the user id (for purchases + webhook routing)
 *
 * Call exactly once from the root layout.
 */
export function useSessionBootstrap(): void {
  const setSession = useAuth((s) => s.setSession);
  const setSubscription = useAuth((s) => s.setSubscription);
  const setBootstrapped = useAuth((s) => s.setBootstrapped);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(data.session ?? null);

        if (data.session?.user.id) {
          await refreshSubscription(data.session.user.id, setSubscription);
          initRevenueCat(data.session.user.id);
        } else {
          initRevenueCat(null);
        }
      } catch (err) {
        console.warn('[bootstrap] init failed; continuing unauthenticated', err);
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    }

    // Safety net: if a network call hangs (paused Supabase project, offline,
    // unreachable URL), still release the splash so nobody stares at the
    // loading bar forever. With a saved login, restoring it can mean a token
    // refresh over a slow mobile connection; giving up at 4 s sent signed-in
    // people to Welcome as if logged out, so they get much longer.
    let failsafe: ReturnType<typeof setTimeout> | undefined;
    void hasStoredSession().then((stored) => {
      if (cancelled) return;
      failsafe = setTimeout(
        () => {
          if (!cancelled) setBootstrapped(true);
        },
        stored ? 20_000 : 4_000,
      );
    });

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelled) return;
      setSession(session);
      if (session?.user.id) {
        await refreshSubscription(session.user.id, setSubscription);
        initRevenueCat(session.user.id);
      } else {
        setSubscription(null);
      }
    });

    return () => {
      cancelled = true;
      if (failsafe) clearTimeout(failsafe);
      listener.subscription.unsubscribe();
    };
  }, [setSession, setSubscription, setBootstrapped]);
}

async function refreshSubscription(
  userId: string,
  set: (s: SubscriptionRow | null) => void,
): Promise<void> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[subscriptions] fetch failed', error.message);
    set(null);
    return;
  }
  set((data as SubscriptionRow) ?? null);
}
