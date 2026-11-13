import { isAuthApiError } from '@supabase/supabase-js';

import { loginExpiresSoon, OFFLINE_MESSAGE, OfflineError } from './function-call';
import { supabase } from './supabase';
import { withTimeout } from './with-timeout';

/** How long the login check may take before we call it a weak signal. */
const LOGIN_CHECK_MS = 15_000;

export const SIGNED_OUT_MESSAGE = 'Your login expired. Sign out from Settings and sign back in.';

/**
 * Make sure the login is usable before calling the server: getSession renews
 * an expired one itself, and one about to expire is renewed now. Both are
 * time-limited, because a renewal stuck from the app sitting in the
 * background is what made Generate fail until a force quit.
 */
export async function ensureLogin(): Promise<void> {
  try {
    const { data, error } = await withTimeout(
      supabase.auth.getSession(),
      LOGIN_CHECK_MS,
      'Checking your login',
    );
    if (error) throw error;
    const session = data.session;
    if (!session) throw new Error(SIGNED_OUT_MESSAGE);
    if (loginExpiresSoon(session.expires_at, Date.now())) {
      const renewed = await withTimeout(
        supabase.auth.refreshSession(),
        LOGIN_CHECK_MS,
        'Renewing your login',
      );
      if (renewed.error) throw renewed.error;
    }
  } catch (err) {
    if (isAuthApiError(err)) throw new Error(SIGNED_OUT_MESSAGE);
    if (err instanceof Error && err.message === SIGNED_OUT_MESSAGE) throw err;
    // Timed out or couldn't reach Supabase.
    throw new OfflineError(OFFLINE_MESSAGE);
  }
}
