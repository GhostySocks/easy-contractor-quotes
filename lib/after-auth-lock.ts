/**
 * Run work once Supabase has finished handling a login event. Pure,
 * unit-tested; lib/session-bootstrap.ts uses it.
 *
 * Supabase holds its login lock while it calls the onAuthStateChange
 * listener, and waits for the listener to finish. Every Supabase request
 * needs that lock to read the login. So a listener that awaits a Supabase
 * request waits on the lock, the lock waits on the listener, and nothing is
 * ever sent again until the app is force quit. That happened each time a
 * login was renewed: Generate failed with no request leaving the phone.
 *
 * The listener must return straight away and do its Supabase work here.
 */
export function afterAuthLock(
  work: () => Promise<void>,
  onError: (err: unknown) => void = (err) => console.warn('[auth] follow-up failed', err),
): void {
  setTimeout(() => {
    work().catch(onError);
  }, 0);
}
