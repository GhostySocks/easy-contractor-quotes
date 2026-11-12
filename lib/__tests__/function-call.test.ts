import {
  callWithRetry,
  loginExpiresSoon,
  OfflineError,
  type InvokeOutcome,
} from '../function-call';

const NOW = Date.parse('2026-11-12T13:00:00Z');
const nowSec = NOW / 1000;

describe('loginExpiresSoon', () => {
  it('is fine with plenty of time left', () => {
    expect(loginExpiresSoon(nowSec + 3600, NOW)).toBe(false);
  });

  it('renews a login that expires within a minute', () => {
    expect(loginExpiresSoon(nowSec + 30, NOW)).toBe(true);
  });

  it('renews a login that already expired (the phone sat overnight)', () => {
    expect(loginExpiresSoon(nowSec - 8 * 3600, NOW)).toBe(true);
  });

  it('renews when the expiry is unknown', () => {
    expect(loginExpiresSoon(undefined, NOW)).toBe(true);
  });
});

describe('callWithRetry', () => {
  const ok = (data: string): InvokeOutcome<string> => ({ ok: true, data });
  const network: InvokeOutcome<string> = { ok: false, kind: 'network', message: 'fetch failed' };

  function deps(outcomes: InvokeOutcome<string>[], ensureLogin = jest.fn(async () => {})) {
    const invoke = jest.fn(async () => outcomes.shift()!);
    const wait = jest.fn(async () => {});
    return { ensureLogin, invoke, wait };
  }

  it('checks the login, then calls the server', async () => {
    const d = deps([ok('quote-1')]);
    await expect(callWithRetry(d)).resolves.toBe('quote-1');
    expect(d.ensureLogin).toHaveBeenCalledTimes(1);
    expect(d.invoke).toHaveBeenCalledTimes(1);
  });

  it('does not call the server when the login check fails', async () => {
    const d = deps(
      [ok('never')],
      jest.fn(async () => Promise.reject(new OfflineError('offline'))),
    );
    await expect(callWithRetry(d)).rejects.toBeInstanceOf(OfflineError);
    expect(d.invoke).not.toHaveBeenCalled();
  });

  it('retries once after a network failure, renewing the login first', async () => {
    const d = deps([network, ok('quote-2')]);
    await expect(callWithRetry(d)).resolves.toBe('quote-2');
    expect(d.invoke).toHaveBeenCalledTimes(2);
    expect(d.ensureLogin).toHaveBeenCalledTimes(2);
    expect(d.wait).toHaveBeenCalledTimes(1);
  });

  it('says to check the signal when the network fails twice', async () => {
    const d = deps([network, network]);
    await expect(callWithRetry(d)).rejects.toBeInstanceOf(OfflineError);
    expect(d.invoke).toHaveBeenCalledTimes(2);
  });

  it('does not retry an error the server sent back, and shows its message', async () => {
    const d = deps([{ ok: false, kind: 'server', message: 'subscription is not active' }]);
    await expect(callWithRetry(d)).rejects.toThrow('subscription is not active');
    expect(d.invoke).toHaveBeenCalledTimes(1);
  });
});
