import { TimeoutError, withTimeout } from '../with-timeout';

describe('withTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('passes the result through when the work finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 1000, 'Saving')).resolves.toBe('ok');
  });

  it('passes errors through', async () => {
    await expect(withTimeout(Promise.reject(new Error('nope')), 1000, 'Saving')).rejects.toThrow(
      'nope',
    );
  });

  it('gives up on work that never settles, like a stuck login refresh', async () => {
    const stuck = withTimeout(new Promise<never>(() => {}), 15_000, 'Saving the customer');
    jest.advanceTimersByTime(15_000);
    await expect(stuck).rejects.toBeInstanceOf(TimeoutError);
    await expect(stuck).rejects.toThrow(/Saving the customer/);
  });
});
