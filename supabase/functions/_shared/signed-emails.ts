import { button, documentBlock, emailLayout, factsPanel, heading, paragraph } from './email.ts';
import { markdownToHtml } from './markdown.ts';
import { recordRows, type SigningRecord } from './signing-record.ts';

/**
 * The two emails sent when a contract is signed: the customer's signed copy
 * and the contractor's notice. Pure, unit-tested
 * (lib/__tests__/signed-emails.test.ts). Sending is in signed-notice.ts.
 */

export type SignedEmailInput = {
  businessName: string;
  logoUrl?: string | null;
  customerName: string;
  /** "Work agreement" or "Release of liability". */
  kindTitle: string;
  bodyMarkdown: string;
  /** Total of the quote behind the contract, in cents, when known. */
  totalCents: number | null;
  record: SigningRecord;
  /** Read-only page showing the signed document and signature. */
  viewUrl: string;
};

export type BuiltEmail = { subject: string; html: string };

function money(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** What signing means and what happens next, in the customer's copy. */
export const BINDING_NOTE =
  'Your signature makes this a binding agreement between you and the contractor.';

export function invoiceNote(businessName: string): string {
  return `${businessName} will send you an invoice when the work is complete.`;
}

/** The customer's copy: the whole agreement, their signing record, and a link back to it. */
export function customerSignedEmail(input: SignedEmailInput): BuiltEmail {
  const kind = input.kindTitle.toLowerCase();
  const first = input.customerName.trim().split(/\s+/)[0];
  const body = [
    heading(`Your signed ${kind}`),
    paragraph(first ? `Hi ${first},` : 'Hi,'),
    paragraph(
      `Thanks for signing. This is your copy of the ${kind} with ${input.businessName}. ` +
        'Keep this email for your records.',
    ),
    paragraph(`${BINDING_NOTE} ${invoiceNote(input.businessName)}`),
    factsPanel('Signing record', recordRows(input.record)),
    button('View signed agreement', input.viewUrl),
    documentBlock(markdownToHtml(input.bodyMarkdown)),
  ].join('\n');
  return {
    subject: `Your signed ${kind} with ${input.businessName}`,
    html: emailLayout({
      businessName: input.businessName,
      logoUrl: input.logoUrl,
      preheader: `Your signed copy. ${invoiceNote(input.businessName)}`,
      bodyHtml: body,
      footer: `You are receiving this because you signed an agreement with ${input.businessName}. Sent with Easy Contractor Quotes.`,
    }),
  };
}

/** The contractor's notice: who signed, for how much, and the same record. */
export function contractorSignedEmail(input: SignedEmailInput): BuiltEmail {
  const kind = input.kindTitle.toLowerCase();
  const amount = input.totalCents !== null ? ` for ${money(input.totalCents)}` : '';
  const body = [
    heading(`${input.customerName} signed`),
    paragraph(
      `${input.customerName} signed the ${kind}${amount}. The quote is marked accepted and the ` +
        'job is in your Jobs list, ready to schedule or start.',
    ),
    paragraph(
      'The signed agreement is locked and can no longer be edited. Send the invoice from the ' +
        'job when the work is complete.',
    ),
    factsPanel('Signing record', recordRows(input.record)),
    button('View signed agreement', input.viewUrl),
  ].join('\n');
  return {
    subject: `${input.customerName} signed${amount}`,
    html: emailLayout({
      businessName: input.businessName,
      preheader: `${input.customerName} signed the ${kind}${amount}.`,
      bodyHtml: body,
      footer:
        'You are receiving this because a customer signed one of your agreements. Sent with Easy Contractor Quotes.',
    }),
  };
}
