import { markdownToHtml } from '../../supabase/functions/_shared/markdown';
import {
  contractorSignedEmail,
  customerSignedEmail,
  type SignedEmailInput,
} from '../../supabase/functions/_shared/signed-emails';
import {
  cleanSignerName,
  deviceLabel,
  isAcceptableSignatureSvg,
  recordRows,
  sha256Hex,
  signatureImageSrc,
  signedAtLabel,
  typedSignatureSvg,
  type SigningRecord,
} from '../../supabase/functions/_shared/signing-record';

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; SM-S921U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36';
const IPHONE_SAFARI =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const WINDOWS_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0';

const record: SigningRecord = {
  signer_name: 'Jane Doe',
  signed_at: '2026-11-16T19:05:00.000Z',
  signed_ip: '203.0.113.7',
  signed_user_agent: ANDROID_CHROME,
  signature_method: 'drawn',
  body_sha256: 'a'.repeat(64),
};

describe('cleanSignerName', () => {
  it('trims and single-spaces a typed name', () => {
    expect(cleanSignerName('  Jane   Doe ')).toBe('Jane Doe');
  });

  it('keeps accents, hyphens and apostrophes', () => {
    expect(cleanSignerName("José O'Neil-Smith")).toBe("José O'Neil-Smith");
  });

  it('refuses a blank, a single letter, or something that is not a name', () => {
    expect(cleanSignerName('')).toBeNull();
    expect(cleanSignerName('J')).toBeNull();
    expect(cleanSignerName('12345')).toBeNull();
    expect(cleanSignerName(undefined)).toBeNull();
    expect(cleanSignerName({ name: 'Jane' })).toBeNull();
  });

  it('strips line breaks, which could forge an email header', () => {
    expect(cleanSignerName('Jane\r\nBcc: x@example.com')).toBe('Jane Bcc: x@example.com');
  });
});

describe('isAcceptableSignatureSvg', () => {
  it('accepts SVG markup from the signing page', () => {
    expect(
      isAcceptableSignatureSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M1 1"/></svg>'),
    ).toBe(true);
  });

  it('accepts the base64 SVG data URL the app signature pad sends', () => {
    expect(isAcceptableSignatureSvg('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(true);
  });

  it('refuses anything else: html, other image types, nothing, or something huge', () => {
    expect(isAcceptableSignatureSvg('<script>alert(1)</script><svg></svg>')).toBe(false);
    expect(isAcceptableSignatureSvg('data:text/html;base64,PHNjcmlwdD4=')).toBe(false);
    expect(isAcceptableSignatureSvg(null)).toBe(false);
    expect(isAcceptableSignatureSvg('<svg>' + 'x'.repeat(400_000) + '</svg>')).toBe(false);
  });
});

describe('signatureImageSrc', () => {
  it('turns SVG markup into an image data URL, never raw markup', () => {
    const src = signatureImageSrc(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>',
    );
    expect(src).toMatch(/^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/);
    expect(src).not.toContain('<');
  });

  it('passes an existing SVG data URL through', () => {
    const url = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    expect(signatureImageSrc(url)).toBe(url);
  });

  it('handles a typed name with accents', () => {
    expect(signatureImageSrc(typedSignatureSvg('José Núñez'))).toMatch(
      /^data:image\/svg\+xml;base64,/,
    );
  });

  it('is null for nothing or for something that is not an SVG', () => {
    expect(signatureImageSrc(null)).toBeNull();
    expect(signatureImageSrc('javascript:alert(1)')).toBeNull();
    expect(signatureImageSrc('data:image/svg+xml;base64,"><script>')).toBeNull();
  });
});

describe('typedSignatureSvg', () => {
  it('draws the name', () => {
    expect(typedSignatureSvg('Jane Doe')).toContain('>Jane Doe</text>');
  });

  it('escapes markup in the name', () => {
    const svg = typedSignatureSvg('<b>Jane</b> & "Co"');
    expect(svg).not.toContain('<b>');
    expect(svg).toContain('&lt;b&gt;Jane&lt;/b&gt; &amp; &quot;Co&quot;');
  });
});

describe('deviceLabel', () => {
  it('names the browser and the kind of device', () => {
    expect(deviceLabel(ANDROID_CHROME)).toBe('Chrome on Android');
    expect(deviceLabel(IPHONE_SAFARI)).toBe('Safari on iPhone');
    expect(deviceLabel(WINDOWS_EDGE)).toBe('Edge on Windows');
  });

  it('is null when there is nothing to go on', () => {
    expect(deviceLabel(null)).toBeNull();
    expect(deviceLabel('curl/8.0')).toBeNull();
  });
});

describe('recordRows', () => {
  it('lists the full record for a link signing', () => {
    expect(recordRows(record)).toEqual([
      { label: 'Signed by', value: 'Jane Doe' },
      { label: 'Signed on', value: signedAtLabel(record.signed_at) },
      { label: 'Signature', value: 'Drawn by hand' },
      { label: 'Consent', value: 'Agreed to sign electronically' },
      { label: 'IP address', value: '203.0.113.7' },
      { label: 'Device', value: 'Chrome on Android' },
      { label: 'Document fingerprint', value: 'aaaaaaaaaaaaaaaa' },
    ]);
  });

  it('says a typed name was used', () => {
    expect(recordRows({ ...record, signature_method: 'typed' })).toContainEqual({
      label: 'Signature',
      value: 'Typed name',
    });
  });

  it('shows only the date for a contract signed before the record existed, and claims no consent', () => {
    const old: SigningRecord = {
      signer_name: null,
      signed_at: record.signed_at,
      signed_ip: null,
      signed_user_agent: null,
      signature_method: null,
      body_sha256: null,
    };
    expect(recordRows(old)).toEqual([{ label: 'Signed on', value: signedAtLabel(old.signed_at) }]);
  });
});

describe('signedAtLabel', () => {
  it('reads the same for both parties, in UTC', () => {
    expect(signedAtLabel('2026-11-16T19:05:00.000Z')).toBe('November 16, 2026 at 7:05 PM UTC');
  });
});

describe('sha256Hex', () => {
  it('matches the published SHA-256 of "abc"', async () => {
    await expect(sha256Hex('abc')).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('changes when a single character of the contract changes', async () => {
    const a = await sha256Hex('Total: $4,911.30');
    const b = await sha256Hex('Total: $4,911.31');
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('markdownToHtml', () => {
  it('renders the line-item table as a table, with money right-aligned', () => {
    const html = markdownToHtml(
      [
        '| Item | Qty | Unit price | Total |',
        '| --- | ---: | ---: | ---: |',
        '| Labor 2h | 2 | $95.00 | $190.00 |',
        '| **Total** | | | **$190.00** |',
      ].join('\n'),
    );
    expect(html).toContain('<table>');
    expect(html).toContain('<th>Item</th>');
    expect(html).toContain('<td style="text-align:right">$190.00</td>');
    expect(html).toContain('<strong>Total</strong>');
    expect(html).not.toContain('---');
    expect(html).not.toContain('|');
  });

  it('renders headings, bold, paragraphs and bullets', () => {
    const html = markdownToHtml('# Work Agreement\n\n**Job site:** 9 Lake Rd\n\n- one\n- two');
    expect(html).toContain('<h1>Work Agreement</h1>');
    expect(html).toContain('<p><strong>Job site:</strong> 9 Lake Rd</p>');
    expect(html).toContain('<ul><li>one</li><li>two</li></ul>');
  });

  it('escapes HTML a contractor typed into the contract, including inside tables', () => {
    const html = markdownToHtml('Hello <script>alert(1)</script>\n\n| <img src=x onerror=1> |');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('signed emails', () => {
  const input: SignedEmailInput = {
    businessName: 'Mike’s Handyman',
    customerName: 'Jane Doe',
    kindTitle: 'Work agreement',
    bodyMarkdown: '# Work Agreement\n\n## Scope of Work\n\nFix the gate.',
    totalCents: 491130,
    record,
    viewUrl: 'https://example.supabase.co/functions/v1/customer-sign?token=abc',
  };

  it('gives the customer the whole agreement, the record, and what happens next', () => {
    const email = customerSignedEmail(input);
    expect(email.subject).toBe('Your signed work agreement with Mike’s Handyman');
    expect(email.html).toContain('Hi Jane,');
    expect(email.html).toContain('Fix the gate.');
    expect(email.html).toContain('binding agreement');
    expect(email.html).toContain('will send you an invoice when the work is complete');
    expect(email.html).toContain('Document fingerprint');
    expect(email.html).toContain(input.viewUrl);
  });

  it('tells the contractor who signed and for how much', () => {
    const email = contractorSignedEmail(input);
    expect(email.subject).toBe('Jane Doe signed for $4,911.30');
    expect(email.html).toContain('Jane Doe signed the work agreement for $4,911.30');
    expect(email.html).toContain('203.0.113.7');
  });

  it('leaves the amount out when the quote total is unknown', () => {
    expect(contractorSignedEmail({ ...input, totalCents: null }).subject).toBe('Jane Doe signed');
  });

  it('escapes names, so a customer cannot inject markup into the contractor’s email', () => {
    const email = contractorSignedEmail({ ...input, customerName: '<img src=x onerror=1>' });
    expect(email.html).not.toContain('<img src=x');
  });
});
