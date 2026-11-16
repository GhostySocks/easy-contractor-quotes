import {
  addTravel,
  roadMiles,
  sanitizeTravel,
  travelLineItem,
  type TravelInput,
} from '../../supabase/functions/_shared/travel';
import { scaleLineItems } from '../pricing';

const perMile: TravelInput = {
  mode: 'per_mile',
  rate_cents: 150,
  per: 'job',
  days: 1,
  miles_one_way: 42,
};

describe('travelLineItem', () => {
  it('charges a per-mile rate for the round trip, once', () => {
    expect(travelLineItem(perMile)).toEqual({
      label: 'Travel (84 mi round trip × $1.50/mi)',
      qty: 1,
      unit_price_cents: 12600,
      total_cents: 12600,
      fixed: true,
    });
  });

  it('charges a per-mile rate for each day on site', () => {
    const item = travelLineItem({ ...perMile, per: 'day', days: 3 });
    expect(item.label).toBe('Travel per day (84 mi round trip × $1.50/mi)');
    expect(item.qty).toBe(3);
    expect(item.total_cents).toBe(37800);
  });

  it('charges a flat fee once', () => {
    expect(travelLineItem({ ...perMile, mode: 'flat', rate_cents: 7500 })).toMatchObject({
      label: 'Travel',
      qty: 1,
      unit_price_cents: 7500,
      total_cents: 7500,
    });
  });

  it('charges a flat fee for each day on site', () => {
    const item = travelLineItem({
      mode: 'flat',
      rate_cents: 5000,
      per: 'day',
      days: 4,
      miles_one_way: 0,
    });
    expect(item).toMatchObject({ label: 'Travel per day', qty: 4, total_cents: 20000 });
  });

  it('keeps qty × unit price = total, which the quote checks rely on', () => {
    const item = travelLineItem({ ...perMile, per: 'day', days: 7 });
    expect(item.qty * item.unit_price_cents).toBe(item.total_cents);
  });
});

describe('sanitizeTravel', () => {
  it('passes a good choice through', () => {
    expect(sanitizeTravel(perMile)).toEqual(perMile);
  });

  it('means no travel when nothing or junk is sent', () => {
    expect(sanitizeTravel(null)).toBeNull();
    expect(sanitizeTravel(undefined)).toBeNull();
    expect(sanitizeTravel('yes')).toBeNull();
    expect(sanitizeTravel({ ...perMile, mode: 'free' })).toBeNull();
  });

  it('refuses a zero, negative or fractional rate', () => {
    expect(sanitizeTravel({ ...perMile, rate_cents: 0 })).toBeNull();
    expect(sanitizeTravel({ ...perMile, rate_cents: -100 })).toBeNull();
    expect(sanitizeTravel({ ...perMile, rate_cents: 1.5 })).toBeNull();
  });

  it('refuses an absurd rate, so a typo cannot add thousands', () => {
    expect(sanitizeTravel({ ...perMile, rate_cents: 500_000 })).toBeNull();
    expect(sanitizeTravel({ ...perMile, mode: 'flat', rate_cents: 5_000_000 })).toBeNull();
  });

  it('needs a distance for a per-mile charge but not for a flat fee', () => {
    expect(sanitizeTravel({ ...perMile, miles_one_way: 0 })).toBeNull();
    expect(sanitizeTravel({ ...perMile, mode: 'flat', miles_one_way: 0 })).not.toBeNull();
  });

  it('ignores days when charging once, and needs at least one when per day', () => {
    expect(sanitizeTravel({ ...perMile, days: 9 })?.days).toBe(1);
    expect(sanitizeTravel({ ...perMile, per: 'day', days: 0 })).toBeNull();
    expect(sanitizeTravel({ ...perMile, per: 'day', days: 5 })?.days).toBe(5);
  });
});

describe('addTravel', () => {
  const quote = {
    scope_of_work: 'Fix the fence.',
    line_items: [{ label: 'Labor 4h', qty: 4, unit_price_cents: 9000, total_cents: 36000 }],
    subtotal_cents: 36000,
    tax_cents: 0,
    total_cents: 36000,
    total_low_cents: 28800,
    total_high_cents: 45000,
  };

  it('leaves the quote alone when the contractor said no', () => {
    expect(addTravel(quote, null)).toBe(quote);
  });

  it('adds the line and the same amount to every total', () => {
    const out = addTravel(quote, perMile);
    expect(out.line_items).toHaveLength(2);
    expect(out.subtotal_cents).toBe(48600);
    expect(out.total_cents).toBe(48600);
    expect(out.total_low_cents).toBe(28800 + 12600);
    expect(out.total_high_cents).toBe(45000 + 12600);
  });

  it('is not scaled by the Low and High price buckets', () => {
    const items = addTravel(quote, perMile).line_items;
    const low = scaleLineItems(items, 'low');
    expect(low[0].total_cents).toBe(28800);
    expect(low[1].total_cents).toBe(12600);
  });
});

describe('roadMiles', () => {
  it('is zero for the same spot', () => {
    expect(roadMiles({ lat: 40.8, lng: -82.3 }, { lat: 40.8, lng: -82.3 })).toBe(0);
  });

  it('estimates a known drive within reason (Columbus to Cleveland is about 143 road miles)', () => {
    const miles = roadMiles({ lat: 39.9612, lng: -82.9988 }, { lat: 41.4993, lng: -81.6944 });
    expect(miles).toBeGreaterThan(130);
    expect(miles).toBeLessThan(170);
  });
});
