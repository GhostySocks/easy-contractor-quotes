import {
  addChangeOrderToInvoice,
  changeOrderTotals,
  cleanDescription,
  cleanExtraDays,
  cleanLines,
  invoiceWithChangeOrders,
  renderChangeOrder,
  signedMoney,
  type ChangeOrderLine,
} from '../../supabase/functions/_shared/change-order';
import { priceRows, tokenize, type TableBlock } from '../contract-markdown';

const add: ChangeOrderLine = {
  label: 'Add a second gate',
  qty: 1,
  unit_price_cents: 65000,
  total_cents: 65000,
};
const credit: ChangeOrderLine = {
  label: 'Customer supplied the hardware',
  qty: 1,
  unit_price_cents: -20000,
  total_cents: -20000,
};

describe('cleanLines', () => {
  it('recomputes each total from qty × unit price, ignoring the total sent', () => {
    expect(
      cleanLines([{ label: ' Labor ', qty: 2.5, unit_price_cents: 6500, total_cents: 1 }]),
    ).toEqual([{ label: 'Labor', qty: 2.5, unit_price_cents: 6500, total_cents: 16250 }]);
  });

  it('allows a credit: a negative unit price', () => {
    expect(cleanLines([credit])).toEqual([credit]);
  });

  it('refuses no lines, a blank label, a zero price, or a zero or negative quantity', () => {
    expect(cleanLines([])).toBeNull();
    expect(cleanLines(null)).toBeNull();
    expect(cleanLines([{ ...add, label: '  ' }])).toBeNull();
    expect(cleanLines([{ ...add, unit_price_cents: 0 }])).toBeNull();
    expect(cleanLines([{ ...add, qty: 0 }])).toBeNull();
    expect(cleanLines([{ ...add, qty: -1 }])).toBeNull();
  });

  it('refuses fractional cents and absurd amounts', () => {
    expect(cleanLines([{ ...add, unit_price_cents: 10.5 }])).toBeNull();
    expect(cleanLines([{ ...add, unit_price_cents: 2_000_000_000 }])).toBeNull();
  });

  it('refuses more lines than a change order should have', () => {
    expect(cleanLines(Array.from({ length: 13 }, () => add))).toBeNull();
  });

  it('takes pipes and line breaks out of a label, which would break the table', () => {
    const label = cleanLines([{ ...add, label: 'Gate | latch\nextra' }])?.[0].label;
    expect(label).not.toMatch(/[|\n]/);
    expect(label?.replace(/\s+/g, ' ')).toBe('Gate latch extra');
  });
});

describe('changeOrderTotals', () => {
  it('adds the change to the job total, with tax at the contractor’s rate', () => {
    expect(changeOrderTotals([add], 7, 992960)).toEqual({
      subtotal_cents: 65000,
      tax_cents: 4550,
      total_cents: 69550,
      previous_total_cents: 992960,
      new_total_cents: 1062510,
    });
  });

  it('takes a credit off the total and gives back its share of tax', () => {
    const t = changeOrderTotals([credit], 7, 992960);
    expect(t.total_cents).toBe(-21400);
    expect(t.new_total_cents).toBe(971560);
  });

  it('nets additions and credits together', () => {
    expect(changeOrderTotals([add, credit], 0, 100000)).toMatchObject({
      subtotal_cents: 45000,
      tax_cents: 0,
      new_total_cents: 145000,
    });
  });

  it('charges no tax for a zero, missing or bad rate', () => {
    expect(changeOrderTotals([add], 0, 0).tax_cents).toBe(0);
    expect(changeOrderTotals([add], Number.NaN, 0).tax_cents).toBe(0);
    expect(changeOrderTotals([add], -5, 0).tax_cents).toBe(0);
  });
});

describe('cleanExtraDays and cleanDescription', () => {
  it('keeps whole days up to a year, else none', () => {
    expect(cleanExtraDays(3)).toBe(3);
    expect(cleanExtraDays(0)).toBe(0);
    expect(cleanExtraDays(-2)).toBe(0);
    expect(cleanExtraDays(1.5)).toBe(0);
    expect(cleanExtraDays(4000)).toBe(0);
    expect(cleanExtraDays('3')).toBe(0);
  });

  it('needs a real description', () => {
    expect(cleanDescription('  Add a second gate on the east side.  ')).toBe(
      'Add a second gate on the east side.',
    );
    expect(cleanDescription('ok')).toBeNull();
    expect(cleanDescription(undefined)).toBeNull();
  });
});

describe('signedMoney', () => {
  it('always shows which way the change goes', () => {
    expect(signedMoney(65000)).toBe('+$650.00');
    expect(signedMoney(-21400)).toBe('-$214.00');
    expect(signedMoney(0)).toBe('+$0.00');
  });
});

describe('renderChangeOrder', () => {
  const totals = changeOrderTotals([add, credit], 7, 992960);
  const md = renderChangeOrder({
    number: 2,
    business_name: 'Motter Handyman',
    customer_name: 'Jane Doe',
    agreement_signed_at: '2026-11-16T19:05:00.000Z',
    job_site: '9 Lake Rd, Mansfield, OH 44903',
    state_code: 'oh',
    description: 'Add a second walk gate on the east side. Customer supplies the hardware.',
    lines: [add, credit],
    totals,
    extra_days: 1,
    generated_at: '2026-11-17T12:00:00Z',
  });

  it('is numbered and names the parties, the agreement it changes and the job site', () => {
    expect(md).toContain('# Change Order 2');
    expect(md).toContain('**Motter Handyman**');
    expect(md).toContain('**Jane Doe**');
    expect(md).toContain('the work agreement signed on November 16, 2026');
    expect(md).toContain('**Job site:** 9 Lake Rd, Mansfield, OH 44903');
  });

  it('shows the before, the change and the new total', () => {
    expect(md).toContain('- Total before this change: $9,929.60');
    expect(md).toContain(`- This change: ${signedMoney(totals.total_cents)}`);
    expect(md).toContain('- **New total: $10,411.10**');
  });

  it('lists every line, the credit as a negative, then tax and the change', () => {
    expect(md).toContain('| Add a second gate | 1 | $650.00 | $650.00 |');
    expect(md).toContain('| Customer supplied the hardware | 1 | -$200.00 | -$200.00 |');
    expect(md).toContain('| Tax | | | $31.50 |');
    expect(md).toContain('| **This change** | | | **+$481.50** |');
  });

  it('draws as a price table in the app, with the change as the total row', () => {
    const table = tokenize(md).find((b) => b.type === 'table') as TableBlock;
    const rows = priceRows(table);
    expect(rows).toHaveLength(4);
    expect(rows?.[3]).toEqual({
      label: 'This change',
      detail: null,
      total: '+$481.50',
      isTotal: true,
    });
  });

  it('says the rest of the agreement stands and work waits for a signature', () => {
    expect(md).toContain('Everything in the work agreement stays the same');
    expect(md).toContain('will not start until the Customer has signed');
    expect(md).toContain('laws of the state of OH');
  });

  it('mentions added days only when there are some, and tax only when charged', () => {
    expect(md).toContain('adds about 1 working day to the job');
    const plain = renderChangeOrder({
      number: 1,
      business_name: 'A',
      customer_name: 'B',
      state_code: 'OH',
      description: 'Swap the gate latch.',
      lines: [add],
      totals: changeOrderTotals([add], 0, 100000),
      extra_days: 0,
    });
    expect(plain).not.toContain('## Timeline');
    expect(plain).not.toContain('| Tax |');
    expect(plain).toContain('changes the work agreement between them');
  });
});

describe('invoices', () => {
  const quote = {
    line_items: [{ label: 'Labor', qty: 1, unit_price_cents: 100000, total_cents: 100000 }],
    subtotal_cents: 100000,
    tax_cents: 7000,
    total_cents: 107000,
  };

  it('adds a signed change order as labelled lines and moves the total by what was signed', () => {
    const out = addChangeOrderToInvoice(quote, { number: 1, lines: [add], tax_cents: 4550 });
    expect(out.line_items[1].label).toBe('Change order 1: Add a second gate');
    expect(out.subtotal_cents).toBe(165000);
    expect(out.tax_cents).toBe(11550);
    expect(out.total_cents).toBe(176550);
  });

  it('does not add the same change order twice', () => {
    const once = addChangeOrderToInvoice(quote, { number: 1, lines: [add], tax_cents: 4550 });
    const twice = addChangeOrderToInvoice(once, { number: 1, lines: [add], tax_cents: 4550 });
    expect(twice).toEqual(once);
  });

  it('keeps change orders 1 and 11 apart', () => {
    const one = addChangeOrderToInvoice(quote, { number: 1, lines: [add], tax_cents: 0 });
    const eleven = addChangeOrderToInvoice(one, { number: 11, lines: [credit], tax_cents: 0 });
    expect(eleven.line_items).toHaveLength(3);
    expect(eleven.total_cents).toBe(107000 + 65000 - 20000);
  });

  it('builds a new invoice from the quote and every signed change order, in order', () => {
    const out = invoiceWithChangeOrders(quote, [
      { number: 2, line_items: [credit], tax_cents: -1400 },
      { number: 1, line_items: [add], tax_cents: 4550 },
    ]);
    expect(out.line_items.map((l) => l.label)).toEqual([
      'Labor',
      'Change order 1: Add a second gate',
      'Change order 2: Customer supplied the hardware',
    ]);
    expect(out.total_cents).toBe(107000 + 69550 - 21400);
    expect(quote.line_items).toHaveLength(1);
  });
});
