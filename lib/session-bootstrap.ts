import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from './auth-store';
import type { SubscriptionRow } from './entitlement';
import { initRevenueCat } from './revenuecat';
import { sessionAtStartup } from './session-restore';
import { readCachedSubscription, saveCachedSubscription } from './subscription-cache';
import { readStoredSession, supabase } from './supabase';

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
    // Opened with the saved login because renewing it hasn't worked yet. The
    // auto-refresh keeps trying; the listener below hears how it turns out.
    let openedFromSaved = false;

    async function openFromSaved(saved: Session) {
      openedFromSaved = true;
      setSubscription(await readCachedSubscription(saved.user.id));
      setSession(saved);
      initRevenueCat(saved.user.id);
    }

    async function init() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (cancelled) return;
        const session = sessionAtStartup(
          { session: data.session, error },
          await readStoredSession(),
        );
        if (cancelled) return;

        if (session && !data.session) {
          // No point asking for the subscription: renewal just failed, so the
          // request wouldn't carry a login. TOKEN_REFRESHED loads it.
          await openFromSaved(session);
        } else if (session) {
          setSession(session);
          await refreshSubscription(session.user.id, setSubscription);
          initRevenueCat(session.user.id);
        } else {
          setSession(null);
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
    // refresh over a slow mobile connection, so it gets longer, and giving up
    // opens the app with that login instead of sending them to Welcome.
    let failsafe: ReturnType<typeof setTimeout> | undefined;
    void readStoredSession().then((stored) => {
      if (cancelled) return;
      failsafe = setTimeout(
        () => {
          void readStoredSession().then(async (saved) => {
            if (cancelled || useAuth.getState().bootstrapped) return;
            if (saved) await openFromSaved(saved);
            setBootstrapped(true);
          });
        },
        stored ? 20_000 : 4_000,
      );
    });

    void init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return;
      // init() handles startup. This event arrives as null when renewal fails
      // on the network, which would undo keeping the saved login.
      if (event === 'INITIAL_SESSION') return;
      setSession(session);
      if (event === 'SIGNED_OUT' && openedFromSaved) {
        // The server turned down the saved login we opened with; nothing on
        // screen will work, so go back through the root guard to Welcome.
        openedFromSaved = false;
        router.replace('/');
      } else if (session) {
        openedFromSaved = false;
      }
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
    // A failed lookup says nothing about the subscription; don't call it paused.
    console.warn('[subscriptions] fetch failed', error.message);
    if (!useAuth.getState().subscription) set(await readCachedSubscription(userId));
    return;
  }
  const row = (data as SubscriptionRow) ?? null;
  set(row);
  void saveCachedSubscription(userId, row);
}
