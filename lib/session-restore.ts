import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';

/**
 * Which login to open the app with. Pure, unit-tested.
 *
 * When the hourly login renewal fails at startup, Supabase reports "no session"
 * plus an error, but keeps the saved login. A network failure says nothing
 * about the login itself, so it must not look like being signed out: open with
 * the saved one and let the auto-refresh keep trying. If the server rejected
 * the login, Supabase has already removed it and the person has to sign in.
 */
export function sessionAtStartup(
  loaded: { session: Session | null; error: unknown },
  saved: Session | null,
): Session | null {
  if (loaded.session) return loaded.session;
  return isAuthRetryableFetchError(loaded.error) ? saved : null;
}

/** The login supabase-js saved on this device, or null if there's no usable one. */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as Partial<Session> | null;
    return session?.access_token && session.refresh_token && session.user?.id
      ? (session as Session)
      : null;
  } catch {
    return null;
  }
}
