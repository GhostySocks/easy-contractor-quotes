import { directReport, sentryOptions } from '../error-reporting';

describe('sentryOptions', () => {
  it('stays off without a DSN, so local builds report nothing', () => {
    expect(sentryOptions({ dsn: undefined, variant: undefined, dev: false })).toBeNull();
    expect(sentryOptions({ dsn: '', variant: 'internal', dev: false })).toBeNull();
  });

  it('stays off in development, even with a DSN', () => {
    expect(
      sentryOptions({ dsn: 'https://k@o1.ingest.sentry.io/1', variant: undefined, dev: true }),
    ).toBeNull();
  });

  it('tags tester builds so their errors are easy to find', () => {
    const options = sentryOptions({
      dsn: 'https://k@o1.ingest.sentry.io/1',
      variant: 'internal',
      dev: false,
    });
    expect(options).toMatchObject({
      dsn: 'https://k@o1.ingest.sentry.io/1',
      environment: 'internal',
    });
  });

  it('calls store builds production', () => {
    const options = sentryOptions({
      dsn: 'https://k@o1.ingest.sentry.io/1',
      variant: undefined,
      dev: false,
    });
    expect(options?.environment).toBe('production');
  });

  it('never sends personal details by default', () => {
    const options = sentryOptions({
      dsn: 'https://k@o1.ingest.sentry.io/1',
      variant: undefined,
      dev: false,
    });
    expect(options?.sendDefaultPii).toBe(false);
  });
});

describe('directReport', () => {
  const at = '2026-11-13T01:00:00.000Z';

  it('builds a request straight to the Sentry project the DSN names', () => {
    const req = directReport(
      'https://abc123@o42.ingest.us.sentry.io/777',
      'internal',
      'e'.repeat(32),
      at,
    );
    expect(req?.url).toBe(
      'https://o42.ingest.us.sentry.io/api/777/envelope/?sentry_key=abc123&sentry_version=7',
    );
    const [header, itemHeader, event] = req!.body
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(header.event_id).toBe('e'.repeat(32));
    expect(itemHeader.type).toBe('event');
    expect(event).toMatchObject({ environment: 'internal', timestamp: at, level: 'info' });
  });

  it('is nothing without a usable DSN', () => {
    expect(directReport(undefined, 'internal', 'e'.repeat(32), at)).toBeNull();
    expect(directReport('not a dsn', 'internal', 'e'.repeat(32), at)).toBeNull();
  });
});
