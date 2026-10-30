/**
 * The paywall bypass must never survive into a store build. These tests pin the
 * gating matrix in lib/dev-flags.ts: debug or internal variant + explicit flag.
 */

type Flags = typeof import('../dev-flags');

function load(env: { dev: boolean; variant?: string; bypass?: string }): Flags {
  const g = globalThis as { __DEV__?: boolean };
  const prevDev = g.__DEV__;
  const prevVariant = process.env.EXPO_PUBLIC_APP_VARIANT;
  const prevBypass = process.env.EXPO_PUBLIC_DEV_BYPASS_PAYWALL;

  g.__DEV__ = env.dev;
  if (env.variant === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = env.variant;
  if (env.bypass === undefined) delete process.env.EXPO_PUBLIC_DEV_BYPASS_PAYWALL;
  else process.env.EXPO_PUBLIC_DEV_BYPASS_PAYWALL = env.bypass;

  let mod!: Flags;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('../dev-flags');
  });

  g.__DEV__ = prevDev;
  if (prevVariant === undefined) delete process.env.EXPO_PUBLIC_APP_VARIANT;
  else process.env.EXPO_PUBLIC_APP_VARIANT = prevVariant;
  if (prevBypass === undefined) delete process.env.EXPO_PUBLIC_DEV_BYPASS_PAYWALL;
  else process.env.EXPO_PUBLIC_DEV_BYPASS_PAYWALL = prevBypass;

  return mod;
}

describe('DEV_BYPASS_PAYWALL', () => {
  it('is on in a debug build with the flag set', () => {
    expect(load({ dev: true, bypass: 'true' }).DEV_BYPASS_PAYWALL).toBe(true);
  });

  it('is on in a release internal build with the flag set', () => {
    expect(load({ dev: false, variant: 'internal', bypass: 'true' }).DEV_BYPASS_PAYWALL).toBe(true);
  });

  it('is off in a release internal build without the flag', () => {
    expect(load({ dev: false, variant: 'internal' }).DEV_BYPASS_PAYWALL).toBe(false);
  });

  it('is off in a release production build even when the flag leaks in', () => {
    expect(load({ dev: false, bypass: 'true' }).DEV_BYPASS_PAYWALL).toBe(false);
    expect(load({ dev: false, variant: 'production', bypass: 'true' }).DEV_BYPASS_PAYWALL).toBe(
      false,
    );
  });

  it('ignores unknown variants', () => {
    const flags = load({ dev: false, variant: 'staging', bypass: 'true' });
    expect(flags.APP_VARIANT).toBe('production');
    expect(flags.DEV_BYPASS_PAYWALL).toBe(false);
  });
});
