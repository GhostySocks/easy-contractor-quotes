import type { LineItem } from './ai';
import { computeSubtotalCents, computeTaxCents, computeTotalCents } from './pricing';

/**
 * Totals for an invoice edited to actuals. Pure, unit-tested.
 *
 * The invoice keeps the tax rate the quote was priced at: it's implied from
 * the quote's own subtotal and tax, so changing line items rescales tax
 * instead of guessing a new rate.
 */

/** Tax rate (percent, 2 decimals) implied by an existing subtotal and tax. */
export function impliedTaxRate(subtotalCents: number, taxCents: number): number {
  if (subtotalCents <= 0 || taxCents <= 0) return 0;
  return Math.round((taxCents / subtotalCents) * 100 * 100) / 100;
}

export type InvoiceTotals = {
  line_items: LineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
};

export function invoiceTotals(items: LineItem[], taxRatePercent: number): InvoiceTotals {
  const line_items = items.map((i) => ({
    ...i,
    total_cents: Math.round(i.unit_price_cents * i.qty),
  }));
  const subtotal_cents = computeSubtotalCents(line_items);
  const tax_cents = computeTaxCents(subtotal_cents, taxRatePercent);
  return {
    line_items,
    subtotal_cents,
    tax_cents,
    total_cents: computeTotalCents(subtotal_cents, tax_cents),
  };
}

/** An invoice can be edited only while nobody has seen it and nothing is paid. */
export function invoiceEditable(invoice: { sent_at: string | null; status: string }): boolean {
  return !invoice.sent_at && invoice.status === 'unpaid';
}
