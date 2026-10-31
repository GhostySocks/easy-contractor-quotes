/**
 * Stop waiting on work that never settles. A Supabase call can hang when the
 * login refresh it waits on gets stuck (the app sat in the background
 * overnight), and a screen awaiting it would spin forever. Pure, unit-tested.
 */
export class TimeoutError extends Error {}

export function withTimeout<T>(work: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new TimeoutError(
            `${what} is taking too long. Check your signal, or close and reopen the app, then try again.`,
          ),
        ),
      ms,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
