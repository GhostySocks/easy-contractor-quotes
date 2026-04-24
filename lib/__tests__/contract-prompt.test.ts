import {
  buildContractSystemPrompt,
  buildContractUserMessage,
  CONTRACT_TOOL_INPUT_SCHEMA,
  CONTRACT_TOOL_NAME,
} from '../../supabase/functions/_shared/prompts';

describe('buildContractSystemPrompt', () => {
  it('names the kind appropriately for a work agreement', () => {
    const p = buildContractSystemPrompt({ kind: 'work', state_code: 'TX' });
    expect(p).toContain('WORK AGREEMENT');
    expect(p).toContain('scope of work');
  });

  it('names the kind appropriately for a release of liability', () => {
    const p = buildContractSystemPrompt({ kind: 'release', state_code: 'TX' });
    expect(p).toContain('RELEASE OF LIABILITY');
  });

  it('inlines a state-specific clause hint for each launch state', () => {
    const tx = buildContractSystemPrompt({ kind: 'work', state_code: 'tx' });
    expect(tx).toContain("mechanic's lien");

    const ca = buildContractSystemPrompt({ kind: 'work', state_code: 'CA' });
    expect(ca).toContain('3-day right-to-cancel');

    const fl = buildContractSystemPrompt({ kind: 'work', state_code: 'FL' });
    expect(fl).toContain('construction-lien');

    const ny = buildContractSystemPrompt({ kind: 'work', state_code: 'NY' });
    expect(ny).toContain('Home Improvement Contract');

    const nc = buildContractSystemPrompt({ kind: 'work', state_code: 'NC' });
    expect(nc).toContain('general-contractor license');
  });

  it('falls back to neutral guidance for states without a clause hint', () => {
    const p = buildContractSystemPrompt({ kind: 'work', state_code: 'AK' });
    expect(p).toContain('No state-specific clause');
  });

  it('normalizes state case', () => {
    const lower = buildContractSystemPrompt({ kind: 'work', state_code: 'tx' });
    expect(lower).toContain('State of work: TX.');
  });

  it('names the tool the model is required to use', () => {
    const p = buildContractSystemPrompt({ kind: 'work', state_code: 'TX' });
    expect(p).toContain(CONTRACT_TOOL_NAME);
  });
});

describe('buildContractUserMessage', () => {
  const base = {
    kind: 'work' as const,
    state_code: 'TX',
    contractor: { business_name: 'Motter Contracting', trade: 'handyman' },
    customer: { name: 'Sarah Moore' },
    quote: {
      scope_of_work: 'Patch drywall and repaint bedroom.',
      line_items: [
        { label: 'Labor 4h', qty: 4, unit_price_cents: 7500, total_cents: 30000 },
        { label: 'Materials', qty: 1, unit_price_cents: 4500, total_cents: 4500 },
      ],
      total_cents: 34500,
    },
  };

  it('names both parties', () => {
    const m = buildContractUserMessage(base);
    expect(m).toContain('Motter Contracting');
    expect(m).toContain('Sarah Moore');
  });

  it('renders line items and a total in dollars', () => {
    const m = buildContractUserMessage(base);
    expect(m).toContain('Labor 4h: 4 × $75.00 = $300.00');
    expect(m).toContain('Materials: 1 × $45.00 = $45.00');
    expect(m).toContain('Total: $345.00');
  });

  it('omits the customer address when no fields are set', () => {
    const m = buildContractUserMessage(base);
    expect(m).toContain('Customer: Sarah Moore');
    expect(m).not.toContain('Customer: Sarah Moore — ');
  });

  it('joins non-empty customer address fields', () => {
    const m = buildContractUserMessage({
      ...base,
      customer: {
        name: 'Sarah Moore',
        address_line1: '123 Main St',
        city: 'Austin',
        state_code: 'TX',
      },
    });
    expect(m).toContain('Customer: Sarah Moore — 123 Main St, Austin, TX');
  });

  it('trims leading/trailing whitespace from the scope paragraph', () => {
    const m = buildContractUserMessage({
      ...base,
      quote: { ...base.quote, scope_of_work: '  patch walls  ' },
    });
    expect(m).toContain('\npatch walls\n');
    expect(m).not.toContain('\n  patch walls');
  });
});

describe('CONTRACT_TOOL_INPUT_SCHEMA', () => {
  it('requires body_markdown', () => {
    expect(CONTRACT_TOOL_INPUT_SCHEMA.required).toEqual(['body_markdown']);
  });
});
