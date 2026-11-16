import {
  invoiceEmail,
  jobSummary,
  quoteEmail,
  startLabel,
  type InvoiceEmailInput,
  type QuoteEmailInput,
} from '../../supabase/functions/_shared/customer-emails';
import { contactLine, emailLayout } from '../../supabase/functions/_shared/email';

const quote: QuoteEmailInput = {
  businessName: 'Motter Handyman',
  customerName: 'Jane Doe',
  totalCents: 491130,
  scopeOfWork: 'Replace the 120 ft privacy fence. Haul away the old one.',
  jobSite: '9 Lake Rd, Mansfield, OH 44903',
  start: 'Monday, November 23, 2026 at 9:00 AM',
  signUrl: 'https://example.supabase.co/functions/v1/customer-sign?token=abc',
};

describe('quoteEmail', () => {
  const email = quoteEmail(quote);

  it('puts the business and the price in the subject', () => {
    expect(email.subject).toBe('Your quote from Motter Handyman: $4,911.30');
  });

  it('greets by first name and shows the total, the job, where and when', () => {
    expect(email.html).toContain('Hi Jane,');
    expect(email.html).toContain('$4,911.30');
    expect(email.html).toContain('Replace the 120 ft privacy fence.');
    expect(email.html).toContain('9 Lake Rd, Mansfield, OH 44903');
    expect(email.html).toContain('Monday, November 23, 2026 at 9:00 AM');
  });

  it('has the Review and sign button and the link in plain text', () => {
    expect(email.html).toContain('Review and sign');
    expect(email.html.split(quote.signUrl).length).toBeGreaterThanOrEqual(3);
  });

  it('says nothing is charged on signing and an invoice follows', () => {
    expect(email.html).toContain('Nothing is charged when you sign');
    expect(email.html).toContain('will send an invoice when the work is complete');
  });

  it('leaves out the summary rows it has nothing for', () => {
    const bare = quoteEmail({ ...quote, scopeOfWork: null, jobSite: null, start: null });
    expect(bare.html).not.toContain('Summary');
    expect(bare.html).toContain('Review and sign');
  });

  it('greets plainly when there is no name', () => {
    expect(quoteEmail({ ...quote, customerName: null }).html).toContain('>Hi,<');
  });

  it('escapes whatever the contractor or customer typed', () => {
    const html = quoteEmail({
      ...quote,
      businessName: 'A & B <Fencing>',
      scopeOfWork: '<script>alert(1)</script> Fix it.',
    }).html;
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<Fencing>');
    expect(html).toContain('A &amp; B &lt;Fencing&gt;');
  });
});

describe('invoiceEmail', () => {
  const invoice: InvoiceEmailInput = {
    businessName: 'Motter Handyman',
    customerName: 'Jane Doe',
    shortId: 'A1B2C3D4',
    lineItems: [
      { label: 'Labor 32h', total_cents: 304000 },
      { label: 'Materials', total_cents: 155000 },
    ],
    subtotalCents: 459000,
    taxCents: 32130,
    totalCents: 491130,
  };
  const email = invoiceEmail(invoice);

  it('puts the business and the amount in the subject', () => {
    expect(email.subject).toBe('Invoice from Motter Handyman: $4,911.30');
  });

  it('lists every line, the subtotal, tax and total due', () => {
    expect(email.html).toContain('Labor 32h');
    expect(email.html).toContain('$3,040.00');
    expect(email.html).toContain('Subtotal');
    expect(email.html).toContain('$321.30');
    expect(email.html).toContain('Total due');
    expect(email.html).toContain('Invoice #A1B2C3D4');
  });

  it('leaves the tax row out when no tax is charged', () => {
    const noTax = invoiceEmail({ ...invoice, taxCents: 0, totalCents: 459000 });
    expect(noTax.html).not.toContain('>Tax<');
  });
});

describe('startLabel', () => {
  it("shows the day in the contractor's time zone, not UTC", () => {
    // 8 PM Eastern on the 23rd is already the 24th in UTC.
    expect(startLabel('2026-11-24T01:00:00.000Z', 'America/New_York')).toBe(
      'Monday, November 23, 2026 at 8:00 PM',
    );
  });

  it('shows nothing rather than a possibly wrong day when the zone is unknown or bad', () => {
    expect(startLabel('2026-11-24T01:00:00.000Z', null)).toBeNull();
    expect(startLabel('2026-11-24T01:00:00.000Z', 'Not/AZone')).toBeNull();
  });

  it('shows nothing without a date', () => {
    expect(startLabel(null, 'America/New_York')).toBeNull();
    expect(startLabel('garbage', 'America/New_York')).toBeNull();
  });
});

describe('jobSummary', () => {
  it('is the first sentence of the scope', () => {
    expect(jobSummary('Replace the fence. Haul away the old one.')).toBe('Replace the fence.');
  });

  it('is capped so a long first sentence does not flood the email', () => {
    expect((jobSummary('word '.repeat(80)) as string).length).toBeLessThanOrEqual(160);
  });

  it('is null for an empty scope', () => {
    expect(jobSummary('  ')).toBeNull();
    expect(jobSummary(null)).toBeNull();
  });
});

describe('emailLayout', () => {
  const base = {
    businessName: 'Motter Handyman',
    preheader: 'p',
    bodyHtml: '<p>x</p>',
    footer: 'f',
  };

  it('shows the logo beside the name when there is one', () => {
    const html = emailLayout({ ...base, logoUrl: 'https://x.test/logo.png?token=a&b=1' });
    expect(html).toContain('<img src="https://x.test/logo.png?token=a&amp;b=1"');
  });

  it('shows the name alone without a logo', () => {
    expect(emailLayout(base)).not.toContain('<img');
  });
});

describe('business contact', () => {
  it('puts the phone and email in the footer when the contractor set them', () => {
    const html = quoteEmail({
      ...quote,
      contact: { phone: '555 123 4567', email: 'mike@example.com' },
    }).html;
    expect(html).toContain('Motter Handyman · 555 123 4567 · mike@example.com');
  });

  it('shows just the one that is set', () => {
    expect(contactLine('Motter Handyman', { phone: '555 123 4567', email: ' ' })).toBe(
      'Motter Handyman · 555 123 4567',
    );
  });

  it('adds nothing when neither is set', () => {
    expect(contactLine('Motter Handyman', { phone: null, email: null })).toBeNull();
    expect(contactLine('Motter Handyman', null)).toBeNull();
    expect(quoteEmail(quote).html).not.toContain('·');
  });
});
