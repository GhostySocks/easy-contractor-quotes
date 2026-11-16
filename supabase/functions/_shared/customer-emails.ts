import {
  button,
  type BusinessContact,
  contactLine,
  emailLayout,
  EMAIL_COLORS,
  factsPanel,
  heading,
  paragraph,
} from './email.ts';
import { escapeHtml } from './markdown.ts';

/**
 * The emails a contractor sends a customer on purpose: the quote (with its
 * agreement to sign) and the invoice. Pure, unit-tested
 * (lib/__tests__/customer-emails.test.ts). Sending is in send-quote and
 * send-invoice.
 */

export type BuiltEmail = { subject: string; html: string };

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

/** The big amount at the top of a quote or invoice. */
function amountBlock(label: string, cents: number): string {
  const c = EMAIL_COLORS;
  return `<div style="margin:0 0 20px;">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${c.goldDark};">${escapeHtml(label)}</div>
<div style="font-size:36px;line-height:1.2;font-weight:700;color:${c.ink};">${money(cents)}</div>
</div>`;
}

/**
 * A start date and time in the contractor's own time zone. Null when there is
 * no date, or no usable zone: a wrong day is worse than no day.
 */
export function startLabel(iso: string | null | undefined, timeZone: string | null | undefined) {
  if (!iso || !timeZone) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  try {
    const date = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone,
    });
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
    return `${date} at ${time}`;
  } catch {
    return null;
  }
}

/** The first sentence of the scope, for a one-line "what this is for". */
export function jobSummary(scope: string | null | undefined): string | null {
  const s = (scope ?? '').trim();
  if (!s) return null;
  const first = s.split(/(?<=[.!?])\s|\n/)[0].trim();
  return first.length > 160 ? `${first.slice(0, 157).trimEnd()}…` : first;
}

export type QuoteEmailInput = {
  businessName: string;
  logoUrl?: string | null;
  contact?: BusinessContact | null;
  customerName: string | null;
  totalCents: number;
  scopeOfWork: string | null;
  /** "9 Lake Rd, Mansfield, OH 44903", or null when the quote has no job site. */
  jobSite: string | null;
  /** Already formatted with startLabel, or null. */
  start: string | null;
  signUrl: string;
};

export function quoteEmail(input: QuoteEmailInput): BuiltEmail {
  const first = firstName(input.customerName);
  const facts: { label: string; value: string }[] = [];
  const summary = jobSummary(input.scopeOfWork);
  if (summary) facts.push({ label: 'The job', value: summary });
  if (input.jobSite) facts.push({ label: 'Where', value: input.jobSite });
  if (input.start) facts.push({ label: 'Start', value: input.start });

  const body = [
    heading(`Your quote from ${input.businessName}`),
    paragraph(first ? `Hi ${first},` : 'Hi,'),
    paragraph(
      'Here is your quote. The full details, price breakdown and terms are in the work ' +
        'agreement. Review it and sign when you are ready.',
    ),
    amountBlock('Quote total', input.totalCents),
    facts.length ? factsPanel('Summary', facts) : '',
    button('Review and sign', input.signUrl),
    paragraph(
      'Signing takes about a minute on your phone or computer. Nothing is charged when you ' +
        `sign; ${input.businessName} will send an invoice when the work is complete.`,
    ),
    paragraph(`Questions? Reply to this email to reach ${input.businessName}.`),
  ].join('\n');

  return {
    subject: `Your quote from ${input.businessName}: ${money(input.totalCents)}`,
    html: emailLayout({
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      contact: contactLine(input.businessName, input.contact),
      preheader: `${money(input.totalCents)}. Review the details and sign online.`,
      bodyHtml: body,
      footer: `${input.businessName} sent you this quote using Easy Contractor Quotes.`,
    }),
  };
}

export type InvoiceLine = { label: string; total_cents: number };

export type InvoiceEmailInput = {
  businessName: string;
  logoUrl?: string | null;
  contact?: BusinessContact | null;
  customerName: string | null;
  /** Short reference shown to the customer, e.g. "A1B2C3D4". */
  shortId: string;
  lineItems: InvoiceLine[];
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
};

function invoiceTable(input: InvoiceEmailInput): string {
  const c = EMAIL_COLORS;
  const row = (label: string, cents: number, strong = false) =>
    `<tr><td style="padding:10px 0;border-bottom:1px solid ${c.divider};font-size:${strong ? 18 : 16}px;${strong ? 'font-weight:700;' : `color:${c.ink2};`}">${escapeHtml(label)}</td>` +
    `<td style="padding:10px 0;border-bottom:1px solid ${c.divider};text-align:right;white-space:nowrap;font-size:${strong ? 18 : 16}px;font-weight:${strong ? 700 : 600};color:${c.ink};">${money(cents)}</td></tr>`;
  const lines = input.lineItems.map((i) => row(i.label, i.total_cents)).join('');
  const tax = input.taxCents > 0 ? row('Tax', input.taxCents) : '';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border-top:1px solid ${c.divider};">
${lines}
${row('Subtotal', input.subtotalCents)}
${tax}
${row('Total due', input.totalCents, true)}
</table>`;
}

export function invoiceEmail(input: InvoiceEmailInput): BuiltEmail {
  const first = firstName(input.customerName);
  const body = [
    heading(`Invoice from ${input.businessName}`),
    paragraph(first ? `Hi ${first},` : 'Hi,'),
    paragraph(`Thanks for your business. Here is the invoice for the work completed.`),
    amountBlock(`Invoice #${input.shortId}`, input.totalCents),
    invoiceTable(input),
    paragraph(`Questions about this invoice? Reply to this email to reach ${input.businessName}.`),
  ].join('\n');

  return {
    subject: `Invoice from ${input.businessName}: ${money(input.totalCents)}`,
    html: emailLayout({
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      contact: contactLine(input.businessName, input.contact),
      preheader: `${money(input.totalCents)} due for the work completed.`,
      bodyHtml: body,
      footer: `${input.businessName} sent you this invoice using Easy Contractor Quotes.`,
    }),
  };
}
