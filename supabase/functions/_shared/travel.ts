/**
 * Travel charge on a quote. Pure, unit-tested (lib/__tests__/travel.test.ts);
 * the app uses it for the preview and ai-quote uses it for the saved line, so
 * both always agree.
 *
 * The contractor decides per quote: charge or not, a flat fee or a per-mile
 * rate, once for the job or for each day on site. The model never prices
 * travel; this is the contractor's own rate times the distance.
 */

export type TravelInput = {
  mode: 'flat' | 'per_mile';
  /** Flat: the fee per trip. Per mile: the rate for one mile. In cents. */
  rate_cents: number;
  per: 'job' | 'day';
  /** Days on site; only counted when `per` is 'day'. */
  days: number;
  /** One-way miles from the business address to the job site. */
  miles_one_way: number;
};

export type TravelLineItem = {
  label: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
  /** Price range buckets (Low / High) leave this line alone. */
  fixed: true;
};

const MAX_FLAT_CENTS = 1_000_000; // $10,000 a trip
const MAX_PER_MILE_CENTS = 5_000; // $50 a mile
const MAX_DAYS = 365;
const MAX_MILES = 3_000;

/** Straight-line distance understates the drive; roads add about a quarter. */
const ROAD_FACTOR = 1.25;
const EARTH_RADIUS_MILES = 3958.8;

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

/** Accept only a well-formed travel choice; anything else means no travel. */
export function sanitizeTravel(raw: unknown): TravelInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.mode !== 'flat' && r.mode !== 'per_mile') return null;
  if (r.per !== 'job' && r.per !== 'day') return null;
  const maxRate = r.mode === 'flat' ? MAX_FLAT_CENTS : MAX_PER_MILE_CENTS;
  if (!isInt(r.rate_cents) || r.rate_cents <= 0 || r.rate_cents > maxRate) return null;
  const days = r.per === 'day' ? r.days : 1;
  if (!isInt(days) || days < 1 || days > MAX_DAYS) return null;
  const miles = typeof r.miles_one_way === 'number' ? Math.round(r.miles_one_way) : 0;
  if (miles < 0 || miles > MAX_MILES) return null;
  if (r.mode === 'per_mile' && miles === 0) return null;
  return { mode: r.mode, rate_cents: r.rate_cents, per: r.per, days, miles_one_way: miles };
}

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** The line added to the quote, with the math in the label. */
export function travelLineItem(t: TravelInput): TravelLineItem {
  const trips = t.per === 'day' ? t.days : 1;
  const name = t.per === 'day' ? 'Travel per day' : 'Travel';
  if (t.mode === 'flat') {
    return {
      label: name,
      qty: trips,
      unit_price_cents: t.rate_cents,
      total_cents: t.rate_cents * trips,
      fixed: true,
    };
  }
  const roundTrip = t.miles_one_way * 2;
  const unit = roundTrip * t.rate_cents;
  return {
    label: `${name} (${roundTrip} mi round trip × ${dollars(t.rate_cents)}/mi)`,
    qty: trips,
    unit_price_cents: unit,
    total_cents: unit * trips,
    fixed: true,
  };
}

type Totals = {
  line_items: {
    label: string;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
    fixed?: boolean;
  }[];
  subtotal_cents: number;
  total_cents: number;
  total_low_cents: number;
  total_high_cents: number;
};

/**
 * Add the travel line to a generated quote. Travel isn't a guess, so it's
 * added to the low and high totals in full rather than scaled with them.
 */
export function addTravel<Q extends Totals>(quote: Q, travel: TravelInput | null): Q {
  if (!travel) return quote;
  const item = travelLineItem(travel);
  return {
    ...quote,
    line_items: [...quote.line_items, item],
    subtotal_cents: quote.subtotal_cents + item.total_cents,
    total_cents: quote.total_cents + item.total_cents,
    total_low_cents: quote.total_low_cents + item.total_cents,
    total_high_cents: quote.total_high_cents + item.total_cents,
  };
}

export type LatLng = { lat: number; lng: number };

/**
 * About how many miles the drive is, one way: straight-line distance plus a
 * quarter for roads. An estimate the contractor can correct, not a route.
 */
export function roadMiles(from: LatLng, to: LatLng): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(to.lat - from.lat);
  const dLng = rad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(a)));
  return Math.round(straight * ROAD_FACTOR);
}
