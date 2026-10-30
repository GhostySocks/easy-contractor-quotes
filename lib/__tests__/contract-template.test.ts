import {
  amendmentBody,
  type ContractTemplateInput,
  renderContract,
  renderReleaseOfLiability,
  renderWorkAgreement,
} from '../../supabase/functions/_shared/contract-template';
import { stateNoteFor } from '../../supabase/functions/_shared/state-notes';

const base: ContractTemplateInput = {
  kind: 'work',
  state_code: 'TX',
  contractor: { business_name: 'Mike’s Handyman Service', trade: 'handyman' },
  customer: { name: 'Jane Doe', address_line1: '12 Oak St', city: 'Austin', state_code: 'TX' },
  quote: {
    scope_of_work: 'Replace the kitchen faucet and repair the drain trap.',
    line_items: [
      { label: 'Labor 2h', qty: 2, unit_price_cents: 9500, total_cents: 19000 },
      { label: 'Materials', qty: 1, unit_price_cents: 2400, total_cents: 2400 },
    ],
    total_cents: 21400,
  },
  generated_at: '2026-10-30T12:00:00Z',
};

describe('renderWorkAgreement', () => {
  const md = renderWorkAgreement(base);

  it('names both parties and the state in the preamble', () => {
    expect(md).toContain('**Mike’s Handyman Service**');
    expect(md).toContain('**Jane Doe, 12 Oak St, Austin, TX**');
    expect(md).toContain('state of TX');
  });

  it('includes every required section', () => {
    for (const h of [
      '## Scope of Work',
      '## Price and Payment',
      '## Timeline',
      '## Warranty',
      '## Cancellation',
      '## Signatures',
    ]) {
      expect(md).toContain(h);
    }
  });

  it('renders the line items and total as a table with formatted money', () => {
    expect(md).toContain('| Labor 2h | 2 | $95.00 | $190.00 |');
    expect(md).toContain('**$214.00**');
  });

  it('adds Texas lien and permit notices', () => {
    expect(md).toContain('## Texas Notices');
    expect(md).toMatch(/lien/i);
    expect(md).toMatch(/permit/i);
  });

  it('uses the 3-day cancellation clause in states that require it', () => {
    const ca = renderWorkAgreement({ ...base, state_code: 'CA' });
    expect(ca).toContain('within 3 business days');
    expect(ca).toContain('Contractors State License Board');
    expect(md).not.toContain('within 3 business days');
  });

  it('renders a neutral agreement for a state without specific clauses', () => {
    const ak = renderWorkAgreement({ ...base, state_code: 'AK' });
    expect(ak).not.toContain('Notices');
    expect(ak).toContain('## Cancellation');
  });

  it('is deterministic', () => {
    expect(renderWorkAgreement(base)).toBe(md);
  });

  it('stays well under the 800-word residential limit', () => {
    expect(md.split(/\s+/).length).toBeLessThan(800);
  });
});

describe('renderReleaseOfLiability', () => {
  const md = renderReleaseOfLiability({ ...base, kind: 'release' });

  it('is a release, keeps the negligence carve-out, and has signature blocks', () => {
    expect(md).toContain('# Release of Liability');
    expect(md).toMatch(/except for loss or damage caused by the Contractor’s negligence/);
    expect(md).toContain('## Signatures');
  });
});

describe('renderContract', () => {
  it('dispatches on kind', () => {
    expect(renderContract('work', base)).toContain('# Work Agreement');
    expect(renderContract('release', base)).toContain('# Release of Liability');
  });
});

describe('stateNoteFor', () => {
  it('returns static notes for covered states and null otherwise', () => {
    expect(stateNoteFor('ca')).toMatch(/3 business days/);
    expect(stateNoteFor('TX')).toMatch(/lien/);
    expect(stateNoteFor('AK')).toBeNull();
    expect(stateNoteFor(null)).toBeNull();
  });
});

describe('amendmentBody', () => {
  it('puts an amendment note on top of the signed text', () => {
    const body = amendmentBody('# Work Agreement\n\nScope…', 2, '2026-10-01T12:00:00Z');
    expect(body.startsWith('> **Amendment 1** to the agreement signed October 1, 2026.')).toBe(
      true,
    );
    expect(body).toContain('# Work Agreement\n\nScope…');
  });

  it('replaces an earlier amendment note instead of stacking them', () => {
    const v2 = amendmentBody('# Work Agreement', 2, '2026-10-01T12:00:00Z');
    const v3 = amendmentBody(v2, 3, '2026-10-15T12:00:00Z');
    expect(v3.match(/\*\*Amendment/g)).toHaveLength(1);
    expect(v3).toContain('**Amendment 2**');
  });
});
