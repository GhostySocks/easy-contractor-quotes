import { isActive, type SubscriptionRow } from '../entitlement';

const baseRow: SubscriptionRow = {
  user_id: 'u_1',
  status: 'active',
  product_id: 'ecq_pro_monthly_999',
  platform: 'ios',
  current_period_end: '2026-05-15T00:00:00Z',
  trial_ends_at: null,
  updated_at: '2026-04-15T00:00:00Z',
};

describe('isActive', () => {
  it('is true for an active subscription', () => {
    expect(isActive(baseRow)).toBe(true);
  });

  it('is true during grace period (RevenueCat billing retry)', () => {
    expect(isActive({ ...baseRow, status: 'in_grace' })).toBe(true);
  });

  it.each(['expired', 'cancelled', 'unknown', ''])('is false for status %s', (status) => {
    expect(isActive({ ...baseRow, status })).toBe(false);
  });

  it('is false when no subscription row exists', () => {
    expect(isActive(null)).toBe(false);
    expect(isActive(undefined)).toBe(false);
  });
});
