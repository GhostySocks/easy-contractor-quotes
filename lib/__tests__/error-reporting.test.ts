import { sentryOptions } from '../error-reporting';

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
