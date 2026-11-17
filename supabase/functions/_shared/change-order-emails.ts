import { signedMoney } from './change-order.ts';
import {
  button,
  type BusinessContact,
  contactLine,
  documentBlock,
  emailLayout,
  EMAIL_COLORS,
  factsPanel,
  heading,
  paragraph,
} from './email.ts';
import { escapeHtml, markdownToHtml } from './markdown.ts';
import { recordRows, type SigningRecord } from './signing-record.ts';

/**
 * The emails around a change order: the request to sign, the customer's
 * signed copy, and the contractor's notice that it was signed or declined.
 * Pure, unit-tested (lib/__tests__/change-order-emails.test.ts).
 */

export type BuiltEmail = { subject: string; html: string };

export type ChangeOrderEmailInput = {
  businessName: string;
  logoUrl?: string | null;
  contact?: BusinessContact | null;
  customerName: string | null;
  number: number;
  description: string;
  /** What this change adds or takes off, in cents. */
  changeCents: number;
  previousTotalCents: number;
  newTotalCents: number;
  /** The signing link, which shows the signed copy once signed. */
  url: string;
};

function money(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${(Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0];
  return first ? first : null;
}

function summaryRows(input: ChangeOrderEmailInput) {
  return [
    { label: 'Total before', value: money(input.previousTotalCents) },
    { label: 'This change', value: signedMoney(input.changeCents) },
    { label: 'New total', value: money(input.newTotalCents) },
  ];
}

function amountBlock(label: string, text: string): string {
  const c = EMAIL_COLORS;
  return `<div style="margin:0 0 20px;">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${c.goldDark};">${escapeHtml(label)}</div>
<div style="font-size:36px;line-height:1.2;font-weight:700;color:${c.ink};">${escapeHtml(text)}</div>
</div>`;
}

/** Asks the customer to review and sign a change order. */
export function changeOrderRequestEmail(input: ChangeOrderEmailInput): BuiltEmail {
  const first = firstName(input.customerName);
  const body = [
    heading(`A change to your job with ${input.businessName}`),
    paragraph(first ? `Hi ${first},` : 'Hi,'),
    paragraph(
      `${input.businessName} has written up a change to your job. Please review it and sign ` +
        'if you agree. The work it describes will not start until you do.',
    ),
    paragraph(input.description),
    amountBlock(`Change order ${input.number}`, signedMoney(input.changeCents)),
    factsPanel('What it does to the total', summaryRows(input)),
    button('Review and sign', input.url),
    paragraph(
      'Everything else in your agreement stays the same. If you do not agree, you can decline ' +
        `on the same page, or reply to this email to talk it over with ${input.businessName}.`,
    ),
  ].join('\n');
  return {
    subject: `Change order ${input.number} from ${input.businessName}: ${signedMoney(input.changeCents)}`,
    html: emailLayout({
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      contact: contactLine(input.businessName, input.contact),
      preheader: `${signedMoney(input.changeCents)}. New total ${money(input.newTotalCents)}. Review and sign online.`,
      bodyHtml: body,
      footer: `${input.businessName} sent you this change order using Easy Contractor Quotes.`,
    }),
  };
}

export type SignedChangeOrderInput = ChangeOrderEmailInput & {
  bodyMarkdown: string;
  record: SigningRecord;
  /** True when an open invoice was updated with this change. */
  invoiceUpdated?: boolean;
};

/** The customer's copy of a signed change order. */
export function changeOrderSignedCustomerEmail(input: SignedChangeOrderInput): BuiltEmail {
  const first = firstName(input.customerName);
  const body = [
    heading(`Your signed change order ${input.number}`),
    paragraph(first ? `Hi ${first},` : 'Hi,'),
    paragraph(
      `Thanks for signing. This is your copy of change order ${input.number} with ` +
        `${input.businessName}. Keep this email for your records.`,
    ),
    paragraph(
      `Your signature makes this change binding. Your new job total is ${money(input.newTotalCents)}, ` +
        `and ${input.businessName} will send an invoice when the work is complete.`,
    ),
    factsPanel('What it does to the total', summaryRows(input)),
    factsPanel('Signing record', recordRows(input.record)),
    button('View signed change order', input.url),
    documentBlock(markdownToHtml(input.bodyMarkdown)),
  ].join('\n');
  return {
    subject: `Your signed change order ${input.number} with ${input.businessName}`,
    html: emailLayout({
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      contact: contactLine(input.businessName, input.contact),
      preheader: `Your signed copy. New job total ${money(input.newTotalCents)}.`,
      bodyHtml: body,
      footer: `You are receiving this because you signed a change order with ${input.businessName}. Sent with Easy Contractor Quotes.`,
    }),
  };
}

/** Tells the contractor a change order was signed and what changed as a result. */
export function changeOrderSignedContractorEmail(input: SignedChangeOrderInput): BuiltEmail {
  const who = input.customerName ?? 'Your customer';
  const body = [
    heading(`${who} signed change order ${input.number}`),
    paragraph(
      `${who} signed change order ${input.number} (${signedMoney(input.changeCents)}). ` +
        `The job total is now ${money(input.newTotalCents)}. You can start the work it describes.`,
    ),
    paragraph(
      input.invoiceUpdated
        ? "This job's invoice has been updated with the change. If you already sent the invoice, send it again so your customer has the new total."
        : 'The change will be on the invoice when you complete the job.',
    ),
    factsPanel('What it does to the total', summaryRows(input)),
    factsPanel('Signing record', recordRows(input.record)),
    button('View signed change order', input.url),
  ].join('\n');
  return {
    subject: `${who} signed change order ${input.number}: ${signedMoney(input.changeCents)}`,
    html: emailLayout({
      businessName: input.businessName,
      preheader: `New job total ${money(input.newTotalCents)}.`,
      bodyHtml: body,
      footer:
        'You are receiving this because a customer signed one of your change orders. Sent with Easy Contractor Quotes.',
    }),
  };
}

/** Tells the contractor a change order was declined. */
export function changeOrderDeclinedEmail(input: ChangeOrderEmailInput): BuiltEmail {
  const who = input.customerName ?? 'Your customer';
  const body = [
    heading(`${who} declined change order ${input.number}`),
    paragraph(
      `${who} declined change order ${input.number} (${signedMoney(input.changeCents)}). ` +
        `The job stays at ${money(input.previousTotalCents)} and nothing else has changed.`,
    ),
    paragraph(
      'Do not start the work it describes. You can edit the change order in the app and send ' +
        'it again, or delete it.',
    ),
    paragraph(input.description),
  ].join('\n');
  return {
    subject: `${who} declined change order ${input.number}`,
    html: emailLayout({
      businessName: input.businessName,
      preheader: `The job stays at ${money(input.previousTotalCents)}.`,
      bodyHtml: body,
      footer:
        'You are receiving this because a customer declined one of your change orders. Sent with Easy Contractor Quotes.',
    }),
  };
}
