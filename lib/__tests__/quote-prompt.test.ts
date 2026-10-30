import {
  buildSystemPrompt,
  buildUserMessage,
  QUOTE_TOOL_INPUT_SCHEMA,
  QUOTE_TOOL_NAME,
} from '../../supabase/functions/_shared/prompts';

describe('buildSystemPrompt', () => {
  it('inlines trade-specific context', () => {
    const p = buildSystemPrompt({ trade: 'plumber', state_code: 'TX' });
    expect(p).toContain('licensed plumbing');
    expect(p).toContain('Job location: TX');
  });

  it('falls back to the generic trade hint for unknown trades', () => {
    const p = buildSystemPrompt({ trade: 'unicorn-whispering', state_code: 'CA' });
    expect(p).toContain('general trade services');
  });

  it('does not ask the model for state notes (they are a static lookup)', () => {
    const p = buildSystemPrompt({ trade: 'handyman', state_code: 'CA' });
    expect(p).not.toContain('state_notes');
    expect(QUOTE_TOOL_INPUT_SCHEMA.properties).not.toHaveProperty('state_notes');
  });

  it('names the tool the model is required to use', () => {
    const p = buildSystemPrompt({ trade: 'handyman', state_code: 'TX' });
    expect(p).toContain(QUOTE_TOOL_NAME);
  });

  it('normalizes trade case', () => {
    const lower = buildSystemPrompt({ trade: 'HVAC', state_code: 'TX' });
    expect(lower).toContain('licensed HVAC');
  });

  it('normalizes state case', () => {
    const p = buildSystemPrompt({ trade: 'handyman', state_code: 'tx' });
    expect(p).toContain('Job location: TX');
  });
});

describe('buildUserMessage', () => {
  it('includes the raw scope text', () => {
    const m = buildUserMessage({
      trade: 'handyman',
      state_code: 'TX',
      scope_text: '  mount a 65 inch TV  ',
    });
    expect(m).toContain('mount a 65 inch TV');
    // Trimmed, not leaking trailing whitespace
    expect(m.split('\n')[1]).toBe('mount a 65 inch TV');
  });

  it('appends the location when a city is known', () => {
    const m = buildUserMessage({
      trade: 'handyman',
      state_code: 'tx',
      scope_text: 'job',
      city: 'Austin',
    });
    expect(m).toContain('Location: Austin, TX');
  });

  it('omits the location line when city is null', () => {
    const m = buildUserMessage({
      trade: 'handyman',
      state_code: 'TX',
      scope_text: 'job',
      city: null,
    });
    expect(m).not.toContain('Location:');
  });

  it('includes repeat-customer context when prior jobs > 0', () => {
    const m = buildUserMessage({
      trade: 'handyman',
      state_code: 'TX',
      scope_text: 'job',
      customer_history: {
        customer_name: 'Sarah Moore',
        prior_job_count: 3,
        last_job_at: '2026-03-01T12:00:00Z',
        lifetime_value_cents: 124500,
      },
    });
    expect(m).toContain('Repeat customer: Sarah Moore');
    expect(m).toContain('3 prior jobs');
    expect(m).toContain('Lifetime value $1245.00');
    expect(m).toContain('Last job 2026-03-01');
  });

  it('handles singular prior job count', () => {
    const m = buildUserMessage({
      trade: 'handyman',
      state_code: 'TX',
      scope_text: 'job',
      customer_history: {
        customer_name: 'Sarah Moore',
        prior_job_count: 1,
      },
    });
    expect(m).toContain('1 prior job.');
    expect(m).not.toContain('prior jobs');
  });

  it('skips customer context for a first-time customer', () => {
    const m = buildUserMessage({
      trade: 'handyman',
      state_code: 'TX',
      scope_text: 'job',
      customer_history: { customer_name: 'New Person', prior_job_count: 0 },
    });
    expect(m).not.toContain('Repeat customer');
  });
});

describe('QUOTE_TOOL_INPUT_SCHEMA', () => {
  it('requires every field the app uses to render the result screen', () => {
    expect(QUOTE_TOOL_INPUT_SCHEMA.required).toEqual([
      'scope_of_work',
      'line_items',
      'subtotal_cents',
      'tax_cents',
      'total_cents',
      'total_low_cents',
      'total_high_cents',
    ]);
  });

  it('constrains line_items to the 4 fields the line-item editor expects', () => {
    const itemProps = QUOTE_TOOL_INPUT_SCHEMA.properties.line_items.items.properties;
    expect(Object.keys(itemProps).sort()).toEqual(
      ['label', 'qty', 'total_cents', 'unit_price_cents'].sort(),
    );
  });
});
