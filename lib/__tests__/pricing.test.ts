import type { LineItem } from '../ai';
import {
  computeSubtotalCents,
  computeTaxCents,
  computeTotalCents,
  deriveRange,
  formatCents,
  scaleLineItems,
} from '../pricing';

const items: LineItem[] = [
  { label: 'Labor 2h', qty: 2, unit_price_cents: 9500, total_cents: 19000 },
  { label: 'Materials', qty: 1, unit_price_cents: 4800, total_cents: 4800 },
  { label: 'Travel', qty: 1, unit_price_cents: 3500, total_cents: 3500 },
];

describe('computeSubtotalCents', () => {
  it('sums line-item totals', () => {
    expect(computeSubtotalCents(items)).toBe(27300);
  });

  it('returns 0 for an empty list', () => {
    expect(computeSubtotalCents([])).toBe(0);
  });
});

describe('computeTaxCents', () => {
  it('rounds to the nearest cent', () => {
    // 27300 * 8.25% = 2252.25 → rounds to 2252
    expect(computeTaxCents(27300, 8.25)).toBe(2252);
  });

  it('handles zero tax', () => {
    expect(computeTaxCents(27300, 0)).toBe(0);
  });

  it('throws on a negative tax rate', () => {
    expect(() => computeTaxCents(27300, -1)).toThrow(/negative/);
  });
});

describe('computeTotalCents', () => {
  it('adds subtotal and tax', () => {
    expect(computeTotalCents(27300, 2252)).toBe(29552);
  });
});

describe('deriveRange', () => {
  it('spans -20% to +25% of the most-likely price', () => {
    expect(deriveRange(10000)).toEqual({
      low_cents: 8000,
      most_likely_cents: 10000,
      high_cents: 12500,
    });
  });

  it('rounds each bound', () => {
    const range = deriveRange(29552);
    expect(range.low_cents).toBe(23642);
    expect(range.high_cents).toBe(36940);
  });

  it('throws on a negative input', () => {
    expect(() => deriveRange(-1)).toThrow(/negative/);
  });
});

describe('formatCents', () => {
  it.each([
    [0, '$0.00'],
    [500, '$5.00'],
    [29552, '$295.52'],
    [1000000, '$10,000.00'],
    [-500, '-$5.00'],
  ])('formats %i as %s', (input, expected) => {
    expect(formatCents(input)).toBe(expected);
  });
});

describe('scaleLineItems', () => {
  const base: LineItem[] = [
    { label: 'Labor 2h', qty: 2, unit_price_cents: 9500, total_cents: 19000 },
    { label: 'Materials', qty: 1, unit_price_cents: 4800, total_cents: 4800 },
  ];

  it('returns the base items unchanged for most_likely', () => {
    expect(scaleLineItems(base, 'most_likely')).toEqual(base);
  });

  it('scales unit prices and recomputes totals for low', () => {
    const low = scaleLineItems(base, 'low');
    expect(low[0]).toEqual({
      label: 'Labor 2h',
      qty: 2,
      unit_price_cents: 7600,
      total_cents: 15200,
    });
    expect(low[1]).toEqual({
      label: 'Materials',
      qty: 1,
      unit_price_cents: 3840,
      total_cents: 3840,
    });
    expect(computeSubtotalCents(low)).toBe(19040);
  });

  it('scales up for high', () => {
    const high = scaleLineItems(base, 'high');
    expect(high[0].unit_price_cents).toBe(11875);
    expect(high[0].total_cents).toBe(23750);
    expect(high[1].unit_price_cents).toBe(6000);
  });

  it('always derives from the base, never compounds', () => {
    const twice = scaleLineItems(scaleLineItems(base, 'most_likely'), 'high');
    expect(twice).toEqual(scaleLineItems(base, 'high'));
    expect(base[0].unit_price_cents).toBe(9500);
  });
});
