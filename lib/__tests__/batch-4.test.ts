import { shouldLock, RELOCK_AFTER_MS } from '../biometric-lock';
import { addressFromGeocode, type GeocodedAddress } from '../geo-address';
import { daysOverdue, groupInvoices, isOverdue, type PaymentInvoice } from '../payments-math';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const DAY = 86_400_000;
const now = Date.parse('2026-10-30T12:00:00Z');
const ago = (days: number) => new Date(now - days * DAY).toISOString();

describe('payments', () => {
  const inv = (
    id: string,
    status: PaymentInvoice['status'],
    total: number,
    sent: number | null,
    paid: number | null = null,
    created = 20,
  ): PaymentInvoice => ({
    id,
    status,
    total_cents: total,
    sent_at: sent === null ? null : ago(sent),
    paid_at: paid === null ? null : ago(paid),
    created_at: ago(created),
  });

  it('is overdue 7 days after sending, never before it is sent', () => {
    expect(isOverdue(inv('a', 'unpaid', 1, 8), now)).toBe(true);
    expect(isOverdue(inv('a', 'unpaid', 1, 6), now)).toBe(false);
    expect(isOverdue(inv('a', 'unpaid', 1, null), now)).toBe(false);
    expect(isOverdue(inv('a', 'paid', 1, 30, 1), now)).toBe(false);
    expect(daysOverdue(ago(10), now)).toBe(3);
    expect(daysOverdue(ago(2), now)).toBe(0);
  });

  it('groups and totals overdue, unpaid and recently paid', () => {
    const rows = [
      inv('old-overdue', 'unpaid', 10000, 20),
      inv('new-overdue', 'partial', 5000, 9),
      inv('unpaid-a', 'unpaid', 3000, 2, null, 3),
      inv('unpaid-b', 'unpaid', 2000, null, null, 1),
      inv('paid-recent', 'paid', 7000, 10, 5),
      inv('paid-old', 'paid', 9999, 60, 45),
      inv('refunded', 'refunded', 1234, 5),
    ];
    const g = groupInvoices(rows, now);
    expect(g.overdue.map((r) => r.id)).toEqual(['old-overdue', 'new-overdue']);
    expect(g.unpaid.map((r) => r.id)).toEqual(['unpaid-b', 'unpaid-a']);
    expect(g.paid.map((r) => r.id)).toEqual(['paid-recent']);
    expect(g.totals).toEqual({ overdueCents: 15000, unpaidCents: 5000, paidLast30Cents: 7000 });
  });
});

describe('addressFromGeocode', () => {
  const base: GeocodedAddress = {
    name: null,
    streetNumber: null,
    street: null,
    city: null,
    subregion: null,
    district: null,
    region: 'TX',
    postalCode: null,
  };

  it('uses street number + street (Android style)', () => {
    expect(
      addressFromGeocode({ ...base, streetNumber: '12', street: 'Oak St', city: 'Austin' }),
    ).toEqual({ line1: '12 Oak St', city: 'Austin' });
  });

  it('falls back to name when it is a street address (iOS style)', () => {
    expect(addressFromGeocode({ ...base, name: '12 Oak St', city: 'Austin' })).toEqual({
      line1: '12 Oak St',
      city: 'Austin',
    });
  });

  it('ignores a place name and uses district when city is missing', () => {
    expect(addressFromGeocode({ ...base, name: 'Home Depot', district: 'Round Rock' })).toEqual({
      line1: '',
      city: 'Round Rock',
    });
  });

  it('returns null when nothing useful came back', () => {
    expect(addressFromGeocode(base)).toBeNull();
  });
});

describe('shouldLock', () => {
  const base = {
    enabled: true,
    available: true,
    signedIn: true,
    backgroundedAt: null,
    now,
    unlocked: false,
  };

  it('locks on a cold start until unlocked', () => {
    expect(shouldLock(base)).toBe(true);
    expect(shouldLock({ ...base, unlocked: true })).toBe(false);
  });

  it('relocks only after a minute in the background', () => {
    expect(shouldLock({ ...base, unlocked: true, backgroundedAt: now - 10_000 })).toBe(false);
    expect(shouldLock({ ...base, unlocked: true, backgroundedAt: now - RELOCK_AFTER_MS })).toBe(
      true,
    );
  });

  it('never locks when off, unsupported, or signed out', () => {
    expect(shouldLock({ ...base, enabled: false })).toBe(false);
    expect(shouldLock({ ...base, available: false })).toBe(false);
    expect(shouldLock({ ...base, signedIn: false })).toBe(false);
  });
});
