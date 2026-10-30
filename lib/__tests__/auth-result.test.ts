import { signInErrorMessage, signUpOutcome } from '../auth-result';

describe('signUpOutcome', () => {
  it('is signed in only when Supabase returns a session', () => {
    expect(
      signUpOutcome({
        error: null,
        data: { session: { access_token: 'x' }, user: { identities: [{}] } },
      }),
    ).toEqual({ kind: 'signed-in' });
  });

  it('spots an email that already has an account (no identities, no error)', () => {
    expect(
      signUpOutcome({ error: null, data: { session: null, user: { identities: [] } } }),
    ).toEqual({
      kind: 'exists',
    });
  });

  it('asks to confirm the email when there is a new user but no session', () => {
    expect(
      signUpOutcome({ error: null, data: { session: null, user: { identities: [{}] } } }),
    ).toEqual({ kind: 'confirm-email' });
    expect(signUpOutcome({ error: null, data: { session: null, user: null } })).toEqual({
      kind: 'confirm-email',
    });
  });

  it('passes errors through', () => {
    expect(
      signUpOutcome({
        error: { message: 'Password too short' },
        data: { session: null, user: null },
      }),
    ).toEqual({ kind: 'error', message: 'Password too short' });
  });
});

describe('signInErrorMessage', () => {
  it('explains a wrong email or password', () => {
    expect(signInErrorMessage('Invalid login credentials')).toMatch(/don't match/);
  });

  it('explains an unconfirmed email and network trouble', () => {
    expect(signInErrorMessage('Email not confirmed')).toMatch(/Confirm your email/);
    expect(signInErrorMessage('TypeError: Network request failed')).toMatch(/signal/);
  });

  it('leaves other messages alone', () => {
    expect(signInErrorMessage('Something else')).toBe('Something else');
  });
});
