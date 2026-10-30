/**
 * What a Supabase sign-up response actually means. Pure, unit-tested.
 *
 * Supabase only returns a session when the account is usable right away.
 * With "Confirm email" on, a new account comes back with a user and no
 * session; and an email that's already registered comes back looking like a
 * success (a user with no identities, no error) so outsiders can't probe which
 * emails have accounts. The app must not treat either as signed in.
 */
export type SignUpOutcome =
  | { kind: 'signed-in' }
  | { kind: 'exists' }
  | { kind: 'confirm-email' }
  | { kind: 'error'; message: string };

type Response = {
  error: { message: string } | null;
  data: {
    session: unknown | null;
    user: { identities?: unknown[] | null } | null;
  };
};

export function signUpOutcome(res: Response): SignUpOutcome {
  if (res.error) return { kind: 'error', message: res.error.message };
  if (res.data.session) return { kind: 'signed-in' };
  const identities = res.data.user?.identities;
  if (res.data.user && Array.isArray(identities) && identities.length === 0)
    return { kind: 'exists' };
  return { kind: 'confirm-email' };
}

/** Friendlier sign-in errors for the messages people actually hit. */
export function signInErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return "That email and password don't match. Passwords are case-sensitive.";
  }
  if (m.includes('email not confirmed')) {
    return 'Confirm your email first: open the link we sent you, then sign in.';
  }
  if (m.includes('network') || m.includes('fetch')) {
    return "Couldn't reach the server. Check your signal and try again.";
  }
  return message;
}
