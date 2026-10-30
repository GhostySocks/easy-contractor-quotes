import type { LineItem } from './ai';

/**
 * Pure pricing helpers. Every function here must be deterministic and covered
 * by a unit test — pricing bugs silently cost contractors money.
 *
 * All math happens in *cents* to avoid float rounding. The public API never
 * returns a number of dollars — only cents.
 */

export function computeSubtotalCents(lineItems: readonly LineItem[]): number {
  let total = 0;
  for (const item of lineItems) {
    total += item.total_cents;
  }
  return total;
}

export function computeTaxCents(subtotalCents: number, taxRatePercent: number): number {
  if (taxRatePercent < 0) {
    throw new Error(`negative tax rate: ${taxRatePercent}`);
  }
  return Math.round((subtotalCents * taxRatePercent) / 100);
}

export function computeTotalCents(subtotalCents: number, taxCents: number): number {
  return subtotalCents + taxCents;
}

export type PriceRange = {
  low_cents: number;
  most_likely_cents: number;
  high_cents: number;
};

/**
 * Derive a default price range when the AI hasn't supplied one.
 * Low = -20 %, High = +25 % — the range the PRD §4.2 QT-05 describes as
 * "negotiation room" the app gives the contractor.
 */
export function deriveRange(mostLikelyCents: number): PriceRange {
  if (mostLikelyCents < 0) {
    throw new Error(`negative most-likely price: ${mostLikelyCents}`);
  }
  return {
    low_cents: Math.round(mostLikelyCents * 0.8),
    most_likely_cents: mostLikelyCents,
    high_cents: Math.round(mostLikelyCents * 1.25),
  };
}

export const BUCKET_FACTORS = {
  low: 0.8,
  most_likely: 1,
  high: 1.25,
} as const;

export type PriceBucket = keyof typeof BUCKET_FACTORS;

/**
 * Apply a price bucket to a set of line items. Every unit price is scaled by
 * the bucket's factor and totals are recomputed, so the itemized quote, the
 * subtotal, the tax and the total all agree on the price the contractor
 * picked. Pass the *most-likely* items as `base`; selecting a different
 * bucket always derives from those, never from already-scaled items.
 */
export function scaleLineItems(base: readonly LineItem[], bucket: PriceBucket): LineItem[] {
  const factor = BUCKET_FACTORS[bucket];
  return base.map((item) => {
    const unit = Math.round(item.unit_price_cents * factor);
    return { ...item, unit_price_cents: unit, total_cents: unit * item.qty };
  });
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  const dollarsFormatted = dollars.toLocaleString('en-US');
  const cash = `${dollarsFormatted}.${remainder.toString().padStart(2, '0')}`;
  return `${sign}$${cash}`;
}
