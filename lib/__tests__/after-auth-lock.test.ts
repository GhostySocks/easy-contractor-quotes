import { afterAuthLock } from '../after-auth-lock';

describe('afterAuthLock', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('does not run the work while the login event is still being handled', () => {
    const work = jest.fn(async () => {});
    afterAuthLock(work);
    // Supabase holds its login lock until the listener returns. Work that
    // reads from Supabase would wait on that lock forever if it ran now.
    expect(work).not.toHaveBeenCalled();
  });

  it('gives the listener nothing to wait on', () => {
    const never = () => new Promise<void>(() => {});
    expect(afterAuthLock(never)).toBeUndefined();
  });

  it('runs the work right after', () => {
    const work = jest.fn(async () => {});
    afterAuthLock(work);
    jest.runOnlyPendingTimers();
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('reports work that fails instead of leaving an unhandled rejection', async () => {
    const onError = jest.fn();
    afterAuthLock(async () => Promise.reject(new Error('lookup failed')), onError);
    jest.runOnlyPendingTimers();
    for (let i = 0; i < 10; i++) await Promise.resolve();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'lookup failed' }));
  });
});
