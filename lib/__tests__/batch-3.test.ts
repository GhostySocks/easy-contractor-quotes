import type { LineItem } from '../ai';
import { escapeHtml, invoiceHtml, type InvoiceDocInput } from '../invoice-html';
import { impliedTaxRate, invoiceEditable, invoiceTotals } from '../invoice-math';
import { buildTimeline } from '../job-timeline';

describe('invoice math', () => {
  const items: LineItem[] = [
    { label: 'Labor', qty: 3, unit_price_cents: 9500, total_cents: 0 },
    { label: 'Materials', qty: 1, unit_price_cents: 4800, total_cents: 4800 },
  ];

  it('implies the tax rate the quote used', () => {
    expect(impliedTaxRate(21400, 1766)).toBe(8.25);
    expect(impliedTaxRate(21400, 0)).toBe(0);
    expect(impliedTaxRate(0, 100)).toBe(0);
  });

  it('recomputes line totals, subtotal, tax and total from actuals', () => {
    expect(invoiceTotals(items, 8.25)).toEqual({
      line_items: [
        { label: 'Labor', qty: 3, unit_price_cents: 9500, total_cents: 28500 },
        { label: 'Materials', qty: 1, unit_price_cents: 4800, total_cents: 4800 },
      ],
      subtotal_cents: 33300,
      tax_cents: 2747,
      total_cents: 36047,
    });
  });

  it('only allows edits before sending or payment', () => {
    expect(invoiceEditable({ sent_at: null, status: 'unpaid' })).toBe(true);
    expect(invoiceEditable({ sent_at: '2026-10-30T00:00:00Z', status: 'unpaid' })).toBe(false);
    expect(invoiceEditable({ sent_at: null, status: 'paid' })).toBe(false);
  });
});

describe('buildTimeline', () => {
  const now = Date.parse('2026-10-30T12:00:00Z');
  const job = {
    status: 'paid',
    created_at: '2026-10-01T10:00:00Z',
    scheduled_at: '2026-10-05T14:00:00Z',
    completed_at: '2026-10-05T18:00:00Z',
  };

  it('orders every recorded step and marks the latest as current', () => {
    const t = buildTimeline({
      job,
      contract: { signed_at: '2026-10-01T09:59:00Z' },
      invoice: {
        created_at: '2026-10-05T18:00:01Z',
        sent_at: '2026-10-06T08:00:00Z',
        paid_at: '2026-10-10T08:00:00Z',
      },
      now,
    });
    expect(t.map((e) => e.key)).toEqual([
      'signed',
      'created',
      'scheduled',
      'completed',
      'invoiced',
      'sent',
      'paid',
    ]);
    expect(t.filter((e) => e.current).map((e) => e.key)).toEqual(['paid']);
    expect(t.find((e) => e.key === 'scheduled')?.label).toBe('Started on schedule');
  });

  it('shows an upcoming start without making it current', () => {
    const t = buildTimeline({
      job: {
        ...job,
        status: 'scheduled',
        scheduled_at: '2026-11-04T14:00:00Z',
        completed_at: null,
      },
      now,
    });
    expect(t.map((e) => [e.key, !!e.current])).toEqual([
      ['created', true],
      ['scheduled', false],
    ]);
    expect(t[1].label).toBe('Scheduled to start');
  });

  it('ends with Cancelled for a cancelled job', () => {
    const t = buildTimeline({
      job: { ...job, status: 'cancelled', scheduled_at: null, completed_at: null },
      now,
    });
    expect(t.map((e) => e.key)).toEqual(['created', 'cancelled']);
    expect(t[1]).toMatchObject({ at: null, current: true });
  });
});

describe('invoiceHtml', () => {
  const doc: InvoiceDocInput = {
    invoiceNumber: 'A1B2C3',
    issuedAt: '2026-10-30T12:00:00Z',
    status: 'unpaid',
    paidAt: null,
    business: { name: 'Mike’s <Handyman>', stateCode: 'TX', logoDataUri: null },
    customer: {
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: null,
      address: '12 Oak St\nAustin, TX',
    },
    scope: 'Replace faucet & test.',
    lineItems: [{ label: 'Labor <2h>', qty: 2, unit_price_cents: 9500, total_cents: 19000 }],
    subtotalCents: 19000,
    taxCents: 1568,
    totalCents: 20568,
  };

  it('escapes user text so it cannot inject markup', () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe(
      '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;',
    );
    const html = invoiceHtml(doc);
    expect(html).toContain('Mike’s &lt;Handyman&gt;');
    expect(html).toContain('Labor &lt;2h&gt;');
    expect(html).not.toContain('<Handyman>');
  });

  it('shows the amounts, the customer, and an amount-due badge', () => {
    const html = invoiceHtml(doc);
    expect(html).toContain('$190.00');
    expect(html).toContain('$205.68');
    expect(html).toContain('12 Oak St<br>Austin, TX');
    expect(html).toContain('AMOUNT DUE');
    expect(html).toContain('Total due');
  });

  it('marks a paid invoice as paid', () => {
    const html = invoiceHtml({ ...doc, status: 'paid', paidAt: '2026-11-01T12:00:00Z' });
    expect(html).toContain('PAID NOVEMBER 1, 2026');
    expect(html).toContain('Total paid');
  });

  it('includes the logo only when there is one', () => {
    expect(invoiceHtml(doc)).not.toContain('<img');
    expect(
      invoiceHtml({
        ...doc,
        business: { ...doc.business, logoDataUri: 'data:image/png;base64,AAA' },
      }),
    ).toContain('<img src="data:image/png;base64,AAA"');
  });
});
