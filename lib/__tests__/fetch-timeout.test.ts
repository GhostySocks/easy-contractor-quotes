import {
  fetchWithTimeout,
  LONG_REQUEST_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  timeoutFor,
} from '../fetch-timeout';

const never = (_input: unknown, init?: RequestInit) =>
  new Promise<Response>((_, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });

describe('timeoutFor', () => {
  it('gives uploads and the AI longer than ordinary requests', () => {
    expect(timeoutFor('https://x.supabase.co/functions/v1/ai-quote')).toBe(LONG_REQUEST_TIMEOUT_MS);
    expect(timeoutFor('https://x.supabase.co/storage/v1/object/job-photos/a.jpg')).toBe(
      LONG_REQUEST_TIMEOUT_MS,
    );
    expect(timeoutFor('https://x.supabase.co/rest/v1/quotes')).toBe(REQUEST_TIMEOUT_MS);
    expect(timeoutFor('https://x.supabase.co/auth/v1/token')).toBe(REQUEST_TIMEOUT_MS);
  });
});

describe('fetchWithTimeout', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('gives up on a request that never answers', async () => {
    const pending = fetchWithTimeout(never as typeof fetch)('https://x.supabase.co/rest/v1/quotes');
    jest.advanceTimersByTime(REQUEST_TIMEOUT_MS);
    await expect(pending).rejects.toThrow('aborted');
  });

  it('gives up on an ordinary request within 10 seconds, so a retry gets a fresh connection', async () => {
    const pending = fetchWithTimeout(never as typeof fetch)('https://x.supabase.co/auth/v1/token');
    jest.advanceTimersByTime(10_000);
    await expect(pending).rejects.toThrow('aborted');
  });

  it('passes a response through and stops the timer', async () => {
    const ok = { ok: true } as Response;
    const res = await fetchWithTimeout((async () => ok) as typeof fetch)('https://x/rest/v1/q');
    expect(res).toBe(ok);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('still honors the caller cancelling', async () => {
    const caller = new AbortController();
    const pending = fetchWithTimeout(never as typeof fetch)('https://x/rest/v1/q', {
      signal: caller.signal,
    });
    caller.abort();
    await expect(pending).rejects.toThrow('aborted');
  });
});
