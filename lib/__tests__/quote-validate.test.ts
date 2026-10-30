import {
  normalizeQuote,
  type QuoteOutput,
  validateQuote,
} from '../../supabase/functions/_shared/quote-validate';

const good: QuoteOutput = {
  scope_of_work:
    'Replace the kitchen faucet with a customer-supplied unit, repair the leaking drain trap, and test for leaks.',
  line_items: [
    { label: 'Labor 2h', qty: 2, unit_price_cents: 9500, total_cents: 19000 },
    { label: 'Materials (trap kit)', qty: 1, unit_price_cents: 2400, total_cents: 2400 },
  ],
  subtotal_cents: 21400,
  tax_cents: 0,
  total_cents: 21400,
  total_low_cents: 17120,
  total_high_cents: 26750,
};

describe('validateQuote', () => {
  it('accepts a consistent quote', () => {
    expect(validateQuote(good)).toEqual({ ok: true });
  });

  it('rejects line items whose qty × unit does not equal total', () => {
    const q = { ...good, line_items: [{ ...good.line_items[0], total_cents: 18000 }] };
    const r = validateQuote(q);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toMatch(/qty × unit/);
  });

  it('rejects a subtotal that is not the sum of the items', () => {
    const r = validateQuote({ ...good, subtotal_cents: 20000, total_cents: 20000 });
    expect(r.ok).toBe(false);
  });

  it('rejects a total that does not include tax', () => {
    const r = validateQuote({ ...good, tax_cents: 1500 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toMatch(/subtotal \+ tax/);
  });

  it('rejects dollars-instead-of-cents style totals', () => {
    const r = validateQuote({
      ...good,
      line_items: [{ label: 'Labor', qty: 1, unit_price_cents: 214, total_cents: 214 }],
      subtotal_cents: 214,
      total_cents: 214,
      total_low_cents: 171,
      total_high_cents: 268,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join()).toMatch(/implausibly low/);
  });

  it('rejects a price range that does not bracket the total', () => {
    const r = validateQuote({ ...good, total_low_cents: 25000 });
    expect(r.ok).toBe(false);
  });

  it('rejects an empty or one-line scope', () => {
    const r = validateQuote({ ...good, scope_of_work: 'Fix sink.' });
    expect(r.ok).toBe(false);
  });

  it('rejects missing output', () => {
    expect(validateQuote(null).ok).toBe(false);
    expect(validateQuote({}).ok).toBe(false);
  });
});

describe('normalizeQuote', () => {
  it('recomputes every derived number from the line items', () => {
    const broken: QuoteOutput = {
      ...good,
      line_items: [
        { label: 'Labor 3h', qty: 3, unit_price_cents: 9500, total_cents: 1 },
        { label: 'Materials', qty: 1, unit_price_cents: 4800, total_cents: 99 },
      ],
      subtotal_cents: 5,
      tax_cents: 0,
      total_cents: 7,
      total_low_cents: 0,
      total_high_cents: 0,
    };
    const fixed = normalizeQuote(broken);
    expect(fixed).not.toBeNull();
    expect(fixed!.line_items[0].total_cents).toBe(28500);
    expect(fixed!.subtotal_cents).toBe(33300);
    expect(fixed!.total_cents).toBe(33300);
    expect(fixed!.total_low_cents).toBe(26640);
    expect(fixed!.total_high_cents).toBe(41625);
    expect(validateQuote(fixed!)).toEqual({ ok: true });
  });

  it('keeps a valid tax amount', () => {
    const fixed = normalizeQuote({ ...good, tax_cents: 1765, total_cents: 0 });
    expect(fixed!.tax_cents).toBe(1765);
    expect(fixed!.total_cents).toBe(23165);
  });

  it('gives up when the line items themselves are unusable', () => {
    expect(normalizeQuote({ ...good, line_items: [] })).toBeNull();
    expect(
      normalizeQuote({
        ...good,
        line_items: [{ label: 'x', qty: 1, unit_price_cents: 10, total_cents: 10 }],
      }),
    ).toBeNull();
  });
});
