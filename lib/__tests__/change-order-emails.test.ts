import {
  changeOrderDeclinedEmail,
  changeOrderRequestEmail,
  changeOrderSignedContractorEmail,
  changeOrderSignedCustomerEmail,
  type ChangeOrderEmailInput,
  type SignedChangeOrderInput,
} from '../../supabase/functions/_shared/change-order-emails';

const base: ChangeOrderEmailInput = {
  businessName: 'Motter Handyman',
  contact: { phone: '555 123 4567', email: 'mike@example.com' },
  customerName: 'Jane Doe',
  number: 2,
  description: 'Add a second walk gate on the east side.',
  changeCents: 69550,
  previousTotalCents: 992960,
  newTotalCents: 1062510,
  url: 'https://example.supabase.co/functions/v1/customer-sign?token=abc',
};

const signed: SignedChangeOrderInput = {
  ...base,
  bodyMarkdown: '# Change Order 2\n\n## What Is Changing\n\nAdd a second walk gate.',
  record: {
    signer_name: 'Jane Doe',
    signed_consent_at: '2026-11-17T15:00:00.000Z',
    signed_at: '2026-11-17T15:00:00.000Z',
    signed_ip: '203.0.113.7',
    signed_user_agent: null,
    signature_method: 'typed',
    body_sha256: 'b'.repeat(64),
  },
};

describe('changeOrderRequestEmail', () => {
  const email = changeOrderRequestEmail(base);

  it('says which change order and which way the price moves, in the subject', () => {
    expect(email.subject).toBe('Change order 2 from Motter Handyman: +$695.50');
  });

  it('shows the description, the before, the change and the new total', () => {
    expect(email.html).toContain('Add a second walk gate on the east side.');
    expect(email.html).toContain('$9,929.60');
    expect(email.html).toContain('+$695.50');
    expect(email.html).toContain('$10,625.10');
  });

  it('says work waits for a signature and that they can decline', () => {
    expect(email.html).toContain('will not start until you do');
    expect(email.html).toContain('you can decline');
    expect(email.html).toContain('Review and sign');
    expect(email.html).toContain(base.url);
  });

  it('shows a credit as a reduction', () => {
    const credit = changeOrderRequestEmail({
      ...base,
      changeCents: -21400,
      newTotalCents: 971560,
    });
    expect(credit.subject).toBe('Change order 2 from Motter Handyman: -$214.00');
    expect(credit.html).toContain('$9,715.60');
  });

  it('escapes what the contractor typed', () => {
    const html = changeOrderRequestEmail({ ...base, description: '<script>x</script> gate' }).html;
    expect(html).not.toContain('<script>');
  });
});

describe('signed change order emails', () => {
  it('gives the customer the document, the record and the new total', () => {
    const email = changeOrderSignedCustomerEmail(signed);
    expect(email.subject).toBe('Your signed change order 2 with Motter Handyman');
    expect(email.html).toContain('Hi Jane,');
    expect(email.html).toContain('Your new job total is $10,625.10');
    expect(email.html).toContain('Add a second walk gate.');
    expect(email.html).toContain('Document fingerprint');
    expect(email.html).toContain('Typed name');
  });

  it('tells the contractor the new total and that the work can start', () => {
    const email = changeOrderSignedContractorEmail(signed);
    expect(email.subject).toBe('Jane Doe signed change order 2: +$695.50');
    expect(email.html).toContain('The job total is now $10,625.10');
    expect(email.html).toContain('The change will be on the invoice when you complete the job.');
  });

  it('tells the contractor to resend an invoice that was updated', () => {
    const email = changeOrderSignedContractorEmail({ ...signed, invoiceUpdated: true });
    expect(email.html).toContain('invoice has been updated');
    expect(email.html).toContain('send it again');
  });
});

describe('changeOrderDeclinedEmail', () => {
  const email = changeOrderDeclinedEmail(base);

  it('says it was declined, the job is unchanged, and not to start the work', () => {
    expect(email.subject).toBe('Jane Doe declined change order 2');
    expect(email.html).toContain('The job stays at $9,929.60');
    expect(email.html).toContain('Do not start the work');
  });

  it('still reads properly without a customer name', () => {
    expect(changeOrderDeclinedEmail({ ...base, customerName: null }).subject).toBe(
      'Your customer declined change order 2',
    );
  });
});
