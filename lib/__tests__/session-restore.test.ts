import { AuthApiError, AuthRetryableFetchError, type Session } from '@supabase/supabase-js';

import { parseStoredSession, sessionAtStartup } from '../session-restore';

const saved = {
  access_token: 'a',
  refresh_token: 'r',
  user: { id: 'u1' },
} as unknown as Session;
const fresh = { ...saved, access_token: 'b' } as Session;

describe('sessionAtStartup', () => {
  it('uses the session Supabase loaded', () => {
    expect(sessionAtStartup({ session: fresh, error: null }, saved)).toBe(fresh);
  });

  it('keeps the saved login when renewal failed because of the network', () => {
    const error = new AuthRetryableFetchError('Network request failed', 0);
    expect(sessionAtStartup({ session: null, error }, saved)).toBe(saved);
  });

  it('signs out when the server rejected the login', () => {
    const error = new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found');
    expect(sessionAtStartup({ session: null, error }, saved)).toBeNull();
  });

  it('is signed out with no saved login, whatever the error', () => {
    const error = new AuthRetryableFetchError('Network request failed', 0);
    expect(sessionAtStartup({ session: null, error }, null)).toBeNull();
    expect(sessionAtStartup({ session: null, error: null }, null)).toBeNull();
  });

  it('does not bring back a login Supabase says is gone', () => {
    expect(sessionAtStartup({ session: null, error: null }, saved)).toBeNull();
  });
});

describe('parseStoredSession', () => {
  it('reads a saved login', () => {
    expect(parseStoredSession(JSON.stringify(saved))).toEqual(saved);
  });

  it('ignores anything missing, corrupt or incomplete', () => {
    expect(parseStoredSession(null)).toBeNull();
    expect(parseStoredSession('not json')).toBeNull();
    expect(parseStoredSession('null')).toBeNull();
    expect(parseStoredSession(JSON.stringify({ access_token: 'a' }))).toBeNull();
    expect(
      parseStoredSession(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: {} })),
    ).toBeNull();
  });
});
