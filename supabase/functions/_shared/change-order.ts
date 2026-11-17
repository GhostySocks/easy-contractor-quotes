/**
 * Change orders: a priced, signed change to a job that already has a signed
 * agreement. Pure, unit-tested (lib/__tests__/change-order.test.ts). The app
 * uses it for the live preview and the server for what is saved, so the
 * contractor never sees one number and signs another.
 *
 * The signed agreement is never edited. Each change order is its own
 * numbered document with its own signature; once signed it changes the job's
 * total and joins the invoice. A line may be a credit (negative).
 *
 * LEGAL REVIEW: the wording in renderChangeOrder is plain-English boilerplate
 * drafted for this app and has NOT been reviewed by an attorney, like the
 * agreement it changes (see contract-template.ts).
 */

export type ChangeOrderLine = {
  label: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
};

export type ChangeOrderTotals = {
  subtotal_cents: number;
  tax_cents: number;
  /** What this change adds to (or, when negative, takes off) the job total. */
  total_cents: number;
  previous_total_cents: number;
  new_total_cents: number;
};

export const MAX_CHANGE_LINES = 12;
export const MAX_DESCRIPTION_CHARS = 1500;
export const MAX_EXTRA_DAYS = 365;
const MAX_LABEL_CHARS = 200;
/** One line of a change can't exceed the largest whole job the app will quote. */
const MAX_LINE_CENTS = 100_000_000;

function isInt(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n);
}

/**
 * Keep only well-formed lines and recompute each total from qty × unit price,
 * so a client can't send a total that disagrees with its own math. Unit prices
 * may be negative (a credit); quantities may not. Returns null when nothing
 * usable is left or there are too many lines.
 */
export function cleanLines(raw: unknown): ChangeOrderLine[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_CHANGE_LINES) return null;
  const lines: ChangeOrderLine[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return null;
    const r = item as Record<string, unknown>;
    const label = typeof r.label === 'string' ? r.label.trim().slice(0, MAX_LABEL_CHARS) : '';
    if (!label) return null;
    if (typeof r.qty !== 'number' || !Number.isFinite(r.qty) || r.qty <= 0 || r.qty > 100_000) {
      return null;
    }
    if (!isInt(r.unit_price_cents) || r.unit_price_cents === 0) return null;
    const total = Math.round(r.qty * r.unit_price_cents);
    if (Math.abs(total) > MAX_LINE_CENTS) return null;
    // The table is markdown; a pipe or line break in a label would break a row.
    lines.push({
      label: label.replace(/[|\r\n]+/g, ' '),
      qty: r.qty,
      unit_price_cents: r.unit_price_cents,
      total_cents: total,
    });
  }
  return lines;
}

/**
 * The money for a change order. Tax follows the contractor's rate, the same
 * as on the quote, so a credit also gives back its share of tax.
 */
export function changeOrderTotals(
  lines: readonly ChangeOrderLine[],
  taxRatePercent: number,
  previousTotalCents: number,
): ChangeOrderTotals {
  const subtotal = lines.reduce((sum, l) => sum + l.total_cents, 0);
  const rate = Number.isFinite(taxRatePercent) && taxRatePercent > 0 ? taxRatePercent : 0;
  const tax = Math.round((subtotal * rate) / 100);
  const total = subtotal + tax;
  return {
    subtotal_cents: subtotal,
    tax_cents: tax,
    total_cents: total,
    previous_total_cents: previousTotalCents,
    new_total_cents: previousTotalCents + total,
  };
}

/** Whole days added to the job, 0 to a year; anything else is 0. */
export function cleanExtraDays(raw: unknown): number {
  return isInt(raw) && raw > 0 && raw <= MAX_EXTRA_DAYS ? raw : 0;
}

export function cleanDescription(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().slice(0, MAX_DESCRIPTION_CHARS);
  return text.length >= 5 ? text : null;
}

function money(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "+$650.00" or "-$200.00": a change always shows which way it goes. */
export function signedMoney(cents: number): string {
  return cents < 0 ? money(cents) : `+${money(cents)}`;
}

function longDate(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export type ChangeOrderDocInput = {
  number: number;
  business_name: string;
  customer_name: string;
  /** When the original agreement was signed, if known. */
  agreement_signed_at?: string | null;
  /** "9 Lake Rd, Mansfield, OH 44903", or null. */
  job_site?: string | null;
  state_code: string;
  description: string;
  lines: ChangeOrderLine[];
  totals: ChangeOrderTotals;
  extra_days: number;
  generated_at?: string;
};

/** The document the customer reads and signs, as markdown. */
export function renderChangeOrder(input: ChangeOrderDocInput): string {
  const t = input.totals;
  const out: string[] = [];
  out.push(`# Change Order ${input.number}`);
  out.push('');
  const agreement = input.agreement_signed_at
    ? `the work agreement signed on ${longDate(input.agreement_signed_at)}`
    : 'the work agreement';
  out.push(
    `This change order is made on ${longDate(input.generated_at)} between ` +
      `**${input.business_name}** (the "Contractor") and **${input.customer_name}** ` +
      `(the "Customer"). It changes ${agreement} between them.`,
  );
  if (input.job_site) {
    out.push('');
    out.push(`**Job site:** ${input.job_site}`);
  }
  out.push('');
  out.push('## What Is Changing');
  out.push('');
  out.push(input.description.trim());
  out.push('');
  out.push('## Price of This Change');
  out.push('');
  out.push('| Item | Qty | Unit price | Total |');
  out.push('| --- | ---: | ---: | ---: |');
  for (const l of input.lines) {
    out.push(`| ${l.label} | ${l.qty} | ${money(l.unit_price_cents)} | ${money(l.total_cents)} |`);
  }
  if (t.tax_cents !== 0) out.push(`| Tax | | | ${money(t.tax_cents)} |`);
  out.push(`| **This change** | | | **${signedMoney(t.total_cents)}** |`);
  out.push('');
  out.push('## New Job Total');
  out.push('');
  out.push(`- Total before this change: ${money(t.previous_total_cents)}`);
  out.push(`- This change: ${signedMoney(t.total_cents)}`);
  out.push(`- **New total: ${money(t.new_total_cents)}**`);
  if (input.extra_days > 0) {
    out.push('');
    out.push('## Timeline');
    out.push('');
    out.push(
      `This change adds about ${input.extra_days} working ` +
        `${input.extra_days === 1 ? 'day' : 'days'} to the job.`,
    );
  }
  out.push('');
  out.push('## Terms');
  out.push('');
  out.push(
    'Everything in the work agreement stays the same except what this change order says. ' +
      'The work described here will not start until the Customer has signed. ' +
      `This change order is governed by the laws of the state of ${input.state_code.toUpperCase()}.`,
  );
  out.push('');
  out.push('## Signatures');
  out.push('');
  out.push('By signing, each party agrees to this change and to the new job total.');
  out.push('');
  out.push(`**Contractor:** ${input.business_name}, by sending this change order for signature.`);
  out.push('');
  out.push(
    `**Customer:** ${input.customer_name}, by electronic signature. The signature, the date and ` +
      'time it was made, and its signing record are kept with this change order.',
  );
  return out.join('\n');
}

export type InvoiceLine = ChangeOrderLine & { fixed?: boolean };

/** How a change order's lines are labelled once they join the invoice. */
export function invoiceLinesFor(number: number, lines: readonly ChangeOrderLine[]): InvoiceLine[] {
  return lines.map((l) => ({ ...l, label: `Change order ${number}: ${l.label}` }));
}

const CO_LABEL = /^Change order (\d+): /;

/**
 * An invoice with a signed change order added. Safe to run twice: a change
 * order whose lines are already there is not added again.
 * Tax is added from the change order's own tax so the invoice total moves by
 * exactly the amount the customer signed for.
 */
export function addChangeOrderToInvoice<
  I extends {
    line_items: InvoiceLine[];
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
  },
>(
  invoice: I,
  changeOrder: {
    number: number;
    lines: readonly ChangeOrderLine[];
    tax_cents: number;
  },
): I {
  // A signed change order never changes, so if its lines are already on the
  // invoice its money is already in the totals too.
  const mine = (l: InvoiceLine) => CO_LABEL.exec(l.label)?.[1] === String(changeOrder.number);
  if (invoice.line_items.some(mine)) return invoice;
  const added = invoiceLinesFor(changeOrder.number, changeOrder.lines);
  const subtotal = added.reduce((sum, l) => sum + l.total_cents, 0);
  return {
    ...invoice,
    line_items: [...invoice.line_items, ...added],
    subtotal_cents: invoice.subtotal_cents + subtotal,
    tax_cents: invoice.tax_cents + changeOrder.tax_cents,
    total_cents: invoice.total_cents + subtotal + changeOrder.tax_cents,
  };
}

/**
 * Line items for a new invoice: the quote's lines, then every signed change
 * order's, in order. Totals are the quote's plus each change.
 */
export function invoiceWithChangeOrders(
  quote: {
    line_items: InvoiceLine[];
    subtotal_cents: number;
    tax_cents: number;
    total_cents: number;
  },
  signed: readonly {
    number: number;
    line_items: ChangeOrderLine[];
    tax_cents: number;
  }[],
) {
  let invoice = {
    line_items: [...quote.line_items],
    subtotal_cents: quote.subtotal_cents,
    tax_cents: quote.tax_cents,
    total_cents: quote.total_cents,
  };
  for (const co of [...signed].sort((a, b) => a.number - b.number)) {
    invoice = addChangeOrderToInvoice(invoice, {
      number: co.number,
      lines: co.line_items,
      tax_cents: co.tax_cents,
    });
  }
  return invoice;
}
