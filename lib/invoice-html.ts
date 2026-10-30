import type { LineItem } from './ai';
import { formatCents } from './pricing';

/**
 * Printable invoice HTML for the share-as-PDF action. Pure, unit-tested.
 * Light theme on purpose: it's a document for the customer, and it prints.
 * Brand colors from CLAUDE.md §4.
 */

export type InvoiceDocInput = {
  invoiceNumber: string;
  issuedAt: string;
  status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  paidAt: string | null;
  business: { name: string; stateCode: string | null; logoDataUri: string | null };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  scope: string | null;
  lineItems: LineItem[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function invoiceHtml(d: InvoiceDocInput): string {
  const e = escapeHtml;
  const paid = d.status === 'paid';
  const customerLines = d.customer
    ? [d.customer.name, d.customer.address, d.customer.email, d.customer.phone]
        .filter((x): x is string => !!x)
        .map((x) => `<div>${e(x).replace(/\n/g, '<br>')}</div>`)
        .join('')
    : '<div>Customer</div>';
  const rows = d.lineItems
    .map(
      (i) =>
        `<tr><td>${e(i.label)}</td><td class="n">${e(String(i.qty))}</td>` +
        `<td class="n">${formatCents(i.unit_price_cents)}</td>` +
        `<td class="n">${formatCents(i.total_cents)}</td></tr>`,
    )
    .join('');

  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Invoice ${e(d.invoiceNumber)}</title>
<style>
  @page { margin: 48px; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1A1A1A; font-size: 13px; line-height: 1.45; margin: 0; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 16px; }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { max-height: 56px; max-width: 140px; }
  .brand .name { font-size: 20px; font-weight: 800; }
  h1 { font-size: 28px; margin: 0; letter-spacing: -0.5px; text-align: right; }
  .meta { color: #4A4A4A; text-align: right; }
  .badge { display: inline-block; margin-top: 6px; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; }
  .badge.paid { background: #E3F2E8; color: #0A7E3A; }
  .badge.due { background: #FBF4D9; color: #A88828; }
  .cols { display: flex; gap: 32px; margin: 24px 0; }
  .label { font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #8A8A8A; margin-bottom: 4px; }
  .scope { background: #F7F5EF; border-radius: 8px; padding: 12px 14px; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #8A8A8A; border-bottom: 1px solid #E8E4D7; padding: 8px 0; }
  td { border-bottom: 1px solid #E8E4D7; padding: 10px 0; vertical-align: top; }
  .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; padding-left: 12px; }
  .totals { margin-left: auto; width: 260px; margin-top: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-variant-numeric: tabular-nums; }
  .totals .grand { border-top: 2px solid #1A1A1A; margin-top: 6px; padding-top: 8px; font-size: 18px; font-weight: 800; }
  .foot { margin-top: 40px; color: #8A8A8A; font-size: 11px; }
</style></head>
<body>
  <div class="top">
    <div class="brand">
      ${d.business.logoDataUri ? `<img src="${e(d.business.logoDataUri)}" alt="">` : ''}
      <div class="name">${e(d.business.name)}</div>
    </div>
    <div>
      <h1>Invoice</h1>
      <div class="meta">#${e(d.invoiceNumber)} · ${e(longDate(d.issuedAt))}</div>
      <div class="meta"><span class="badge ${paid ? 'paid' : 'due'}">${
        paid ? `PAID${d.paidAt ? ` ${e(longDate(d.paidAt)).toUpperCase()}` : ''}` : 'AMOUNT DUE'
      }</span></div>
    </div>
  </div>
  <div class="cols">
    <div><div class="label">Bill to</div>${customerLines}</div>
  </div>
  ${d.scope ? `<div class="label">Work performed</div><div class="scope">${e(d.scope)}</div>` : ''}
  <table>
    <thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Unit price</th><th class="n">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${formatCents(d.subtotalCents)}</span></div>
    <div><span>Tax</span><span>${formatCents(d.taxCents)}</span></div>
    <div class="grand"><span>${paid ? 'Total paid' : 'Total due'}</span><span>${formatCents(d.totalCents)}</span></div>
  </div>
  <div class="foot">Thank you for your business.</div>
</body></html>`;
}
