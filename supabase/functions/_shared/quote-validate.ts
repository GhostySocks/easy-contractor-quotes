/**
 * Sanity checks on a model-generated quote. The quote path runs on Haiku
 * first for cost and speed; anything that fails these checks is regenerated
 * on the fallback model, and if it still fails we normalize the arithmetic
 * rather than ship a quote whose line items don't add up.
 *
 * All amounts are integer cents.
 */
export type QuoteLineItem = {
  label: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
};

export type QuoteOutput = {
  scope_of_work: string;
  line_items: QuoteLineItem[];
  subtotal_cents: number;
  tax_cents: number;
  total_cents: number;
  total_low_cents: number;
  total_high_cents: number;
};

export type ValidationResult = { ok: true } | { ok: false; reasons: string[] };

const MIN_SCOPE_CHARS = 40;
const MAX_SCOPE_CHARS = 1500;
const MAX_LINE_ITEMS = 8;
// Guard against a model emitting dollars where cents were asked for, or a
// runaway number. $50 to $50,000 covers residential handyman-to-HVAC jobs.
const MIN_TOTAL_CENTS = 5_000;
const MAX_TOTAL_CENTS = 5_000_000;

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

export function validateQuote(q: Partial<QuoteOutput> | null | undefined): ValidationResult {
  const reasons: string[] = [];
  if (!q) return { ok: false, reasons: ['empty output'] };

  const scope = typeof q.scope_of_work === 'string' ? q.scope_of_work.trim() : '';
  if (scope.length < MIN_SCOPE_CHARS) reasons.push('scope_of_work too short');
  if (scope.length > MAX_SCOPE_CHARS) reasons.push('scope_of_work too long');

  const items = Array.isArray(q.line_items) ? q.line_items : [];
  if (items.length === 0) reasons.push('no line items');
  if (items.length > MAX_LINE_ITEMS) reasons.push('too many line items');

  let sum = 0;
  items.forEach((item, i) => {
    if (!item || typeof item.label !== 'string' || !item.label.trim()) {
      reasons.push(`line ${i}: missing label`);
    }
    if (typeof item?.qty !== 'number' || !(item.qty > 0)) reasons.push(`line ${i}: bad qty`);
    if (!isInt(item?.unit_price_cents) || item.unit_price_cents < 0) {
      reasons.push(`line ${i}: bad unit_price_cents`);
    }
    if (!isInt(item?.total_cents) || item.total_cents < 0) {
      reasons.push(`line ${i}: bad total_cents`);
    }
    if (
      isInt(item?.unit_price_cents) &&
      typeof item?.qty === 'number' &&
      isInt(item?.total_cents)
    ) {
      const expected = Math.round(item.unit_price_cents * item.qty);
      if (Math.abs(expected - item.total_cents) > 1) {
        reasons.push(`line ${i}: qty × unit ≠ total`);
      }
      sum += item.total_cents;
    }
  });

  if (!isInt(q.subtotal_cents)) reasons.push('subtotal_cents not an integer');
  else if (Math.abs(q.subtotal_cents - sum) > items.length) {
    reasons.push('subtotal ≠ sum of line items');
  }

  if (!isInt(q.tax_cents) || q.tax_cents < 0) reasons.push('tax_cents invalid');

  if (!isInt(q.total_cents)) reasons.push('total_cents not an integer');
  else {
    if (isInt(q.subtotal_cents) && isInt(q.tax_cents)) {
      if (Math.abs(q.total_cents - (q.subtotal_cents + q.tax_cents)) > 1) {
        reasons.push('total ≠ subtotal + tax');
      }
    }
    if (q.total_cents < MIN_TOTAL_CENTS) reasons.push('total implausibly low');
    if (q.total_cents > MAX_TOTAL_CENTS) reasons.push('total implausibly high');
  }

  if (!isInt(q.total_low_cents) || !isInt(q.total_high_cents)) {
    reasons.push('price range not integers');
  } else if (
    isInt(q.total_cents) &&
    !(q.total_low_cents <= q.total_cents && q.total_cents <= q.total_high_cents)
  ) {
    reasons.push('price range does not bracket total');
  }

  return reasons.length === 0 ? { ok: true } : { ok: false, reasons };
}

/**
 * Last resort when both models return inconsistent arithmetic but the line
 * items themselves look fine: recompute every derived number from the items.
 * Returns null if the items can't be trusted either.
 */
export function normalizeQuote(q: QuoteOutput): QuoteOutput | null {
  const items = (q.line_items ?? []).filter(
    (i) => i && typeof i.label === 'string' && i.qty > 0 && isInt(i.unit_price_cents),
  );
  if (items.length === 0 || items.length > MAX_LINE_ITEMS) return null;
  const fixed = items.map((i) => ({ ...i, total_cents: Math.round(i.unit_price_cents * i.qty) }));
  const subtotal = fixed.reduce((a, i) => a + i.total_cents, 0);
  const tax = isInt(q.tax_cents) && q.tax_cents >= 0 ? q.tax_cents : 0;
  const total = subtotal + tax;
  if (total < MIN_TOTAL_CENTS || total > MAX_TOTAL_CENTS) return null;
  return {
    scope_of_work: q.scope_of_work,
    line_items: fixed,
    subtotal_cents: subtotal,
    tax_cents: tax,
    total_cents: total,
    total_low_cents: Math.round(total * 0.8),
    total_high_cents: Math.round(total * 1.25),
  };
}
