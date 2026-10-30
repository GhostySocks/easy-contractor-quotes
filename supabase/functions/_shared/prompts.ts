/**
 * Pure prompt-building helpers for the ai-quote Edge Function.
 *
 * Kept free of any Deno-only imports so the functions can be unit-tested
 * from Node/Jest in lib/__tests__/ without a Deno runtime.
 */

export type CustomerHistory = {
  customer_name: string;
  prior_job_count: number;
  last_job_at?: string | null;
  lifetime_value_cents?: number | null;
};

export type QuotePromptInput = {
  trade: string;
  state_code: string;
  scope_text: string;
  city?: string | null;
  customer_history?: CustomerHistory | null;
};

export const QUOTE_TOOL_NAME = 'return_quote';

/**
 * JSON schema for the tool Anthropic is forced to call. Using tool_choice
 * locked to this tool gives us structured output without free-form JSON
 * parsing and its failure modes.
 */
export const QUOTE_TOOL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    scope_of_work: {
      type: 'string',
      description: '3-5 plain-English sentences describing what will be done.',
    },
    line_items: {
      type: 'array',
      description: '2-5 items: labor, materials, travel/disposal.',
      items: {
        type: 'object',
        properties: {
          label: { type: 'string' },
          qty: { type: 'number' },
          unit_price_cents: { type: 'integer' },
          total_cents: { type: 'integer' },
        },
        required: ['label', 'qty', 'unit_price_cents', 'total_cents'],
      },
    },
    subtotal_cents: { type: 'integer' },
    tax_cents: { type: 'integer' },
    total_cents: { type: 'integer' },
    total_low_cents: { type: 'integer' },
    total_high_cents: { type: 'integer' },
  },
  required: [
    'scope_of_work',
    'line_items',
    'subtotal_cents',
    'tax_cents',
    'total_cents',
    'total_low_cents',
    'total_high_cents',
  ],
};

const TRADE_HINTS: Record<string, string> = {
  handyman: 'multi-skill residential repair; labor by the hour or half-day',
  plumber: 'licensed plumbing; material cost visible; permit disclosed when applicable',
  electrician: 'licensed electrical; code compliance noted; permit when required',
  hvac: 'licensed HVAC; equipment + labor separated; refrigerant and disposal noted',
  landscaping: 'seasonal labor rates; material (mulch, soil, plantings) is a significant line',
  other: 'general trade services; labor + materials line items',
};

export function buildSystemPrompt(input: { trade: string; state_code: string }): string {
  const tradeKey = input.trade.toLowerCase();
  const tradeHint = TRADE_HINTS[tradeKey] ?? TRADE_HINTS.other;
  const stateKey = input.state_code.toUpperCase();

  return [
    'You are a pricing assistant for a solo contractor running an AI-powered quoting app for small residential jobs.',
    '',
    'Given a job description, generate a professional quote with a scope-of-work paragraph, a line-item breakdown, and a price range.',
    '',
    `Trade context: ${tradeHint}.`,
    `Job location: ${stateKey}.`,
    '',
    'Guidance:',
    '- Prices reflect typical solo-contractor rates for this trade and region — not commercial contractors, not DIY big-box.',
    '- Scope of work: 3-5 plain-English sentences describing what will be done.',
    '- 2-5 line items typical (labor, materials, travel/disposal).',
    '- Label line items clearly (e.g. "Labor 2h", "Materials (drywall patch kit)", "Travel & disposal").',
    '- total_low_cents = round(total_cents * 0.8). total_high_cents = round(total_cents * 1.25).',
    '- All amounts are positive integer cents. No floats, no currency symbols.',
    '- tax_cents: 0 unless the contractor explicitly said otherwise. They collect tax manually for now.',
    '',
    `Return via the ${QUOTE_TOOL_NAME} tool only. Do not output plain text.`,
  ].join('\n');
}

export function buildUserMessage(input: QuotePromptInput): string {
  const parts: string[] = [];
  parts.push(`Job description:\n${input.scope_text.trim()}`);
  if (input.city) {
    parts.push(`\nLocation: ${input.city}, ${input.state_code.toUpperCase()}`);
  }
  if (input.customer_history && input.customer_history.prior_job_count > 0) {
    const h = input.customer_history;
    const fragments = [
      `Repeat customer: ${h.customer_name}.`,
      `${h.prior_job_count} prior job${h.prior_job_count === 1 ? '' : 's'}.`,
    ];
    if (h.lifetime_value_cents) {
      fragments.push(`Lifetime value $${(h.lifetime_value_cents / 100).toFixed(2)}.`);
    }
    if (h.last_job_at) {
      fragments.push(`Last job ${h.last_job_at.slice(0, 10)}.`);
    }
    parts.push(`\n${fragments.join(' ')}`);
  }
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Contract generation (M1c)
// ---------------------------------------------------------------------------

export type ContractKind = 'work' | 'release';

export type ContractLineItem = {
  label: string;
  qty: number;
  unit_price_cents: number;
  total_cents: number;
};

export type ContractPromptInput = {
  kind: ContractKind;
  state_code: string;
  contractor: {
    business_name: string;
    trade: string;
  };
  customer: {
    name: string;
    address_line1?: string | null;
    city?: string | null;
    state_code?: string | null;
  };
  quote: {
    scope_of_work: string;
    line_items: ContractLineItem[];
    total_cents: number;
  };
};

export const CONTRACT_TOOL_NAME = 'return_contract';

export const CONTRACT_TOOL_INPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    body_markdown: {
      type: 'string',
      description:
        'The full contract document as GitHub-flavored markdown. Must include clearly ' +
        'labeled sections for parties, scope, price, timeline, warranty, cancellation, ' +
        'and signature blocks.',
    },
  },
  required: ['body_markdown'],
};

// Short state-specific clause hints. The model is instructed to WEAVE these
// into the document, not copy them verbatim. Keep each one tight — the full
// legal review happens per-state annually (PRD §8).
const STATE_CONTRACT_HINTS: Record<string, string> = {
  TX:
    "Include a mechanic's lien notice for jobs over $250. Disclose that permits " +
    'are required for gas, electrical, and plumbing work.',
  CA:
    'Include the 3-day right-to-cancel notice (Home Solicitation Sales Act). Note that ' +
    'projects over $500 require a written contract with a CSLB-licensed contractor ' +
    'for applicable trades.',
  FL:
    'Include construction-lien rights notice per Florida Statutes Chapter 713. Include ' +
    'the 3-day cancellation right for home-solicitation transactions.',
  NY:
    'For jobs over $500, include a Home Improvement Contract conforming to GBL §395-a: ' +
    'itemized price, approximate start and completion dates, and a 3-day right to cancel.',
  NC:
    'For projects over $30,000, include a general-contractor license disclosure. Include ' +
    'a standard warranty and right-to-cure clause.',
};

const CONTRACT_KIND_HINTS: Record<ContractKind, string> = {
  work:
    'WORK AGREEMENT: scope of work, price and payment schedule, timeline, ' +
    'change-order handling, warranty, cancellation, and signature blocks for ' +
    'both parties.',
  release:
    'RELEASE OF LIABILITY: the customer acknowledges risks and releases the ' +
    'contractor from non-negligent claims arising from the work. Keep plain-English ' +
    'and state-appropriate.',
};

export function buildContractSystemPrompt(input: {
  kind: ContractKind;
  state_code: string;
}): string {
  const stateKey = input.state_code.toUpperCase();
  const stateHint = STATE_CONTRACT_HINTS[stateKey] ?? null;
  const kindHint = CONTRACT_KIND_HINTS[input.kind];

  return [
    'You are a contracts assistant for a solo contractor running an AI-powered quoting app.',
    '',
    `Generate a ${kindHint}`,
    '',
    `State of work: ${stateKey}.`,
    stateHint
      ? `State-specific guidance (weave into the body, do not copy verbatim): ${stateHint}`
      : 'No state-specific clause for this state — use a neutral, standard template.',
    '',
    'Guidance:',
    '- Plain English at roughly an 8th-grade reading level. No Latin.',
    '- Use markdown section headings (e.g. "## Scope of Work").',
    '- Reference the parties by name in the preamble.',
    '- Keep the document under 800 words — this is a residential contract, not a commercial one.',
    '- Do not invent license numbers, insurance policy numbers, or legal citations beyond those given.',
    '- Leave placeholder lines (e.g. "Contractor signature: ____________") for in-app e-signature.',
    '',
    `Return via the ${CONTRACT_TOOL_NAME} tool only. Do not output plain text.`,
  ].join('\n');
}

export function buildContractUserMessage(input: ContractPromptInput): string {
  const parts: string[] = [];

  parts.push(`Contractor: ${input.contractor.business_name} (${input.contractor.trade})`);

  const customerLoc = [input.customer.address_line1, input.customer.city, input.customer.state_code]
    .filter(Boolean)
    .join(', ');
  parts.push(
    customerLoc
      ? `Customer: ${input.customer.name} — ${customerLoc}`
      : `Customer: ${input.customer.name}`,
  );

  parts.push('');
  parts.push('Scope of work (from the accepted quote):');
  parts.push(input.quote.scope_of_work.trim());

  parts.push('');
  parts.push('Line items:');
  for (const item of input.quote.line_items) {
    parts.push(
      `- ${item.label}: ${item.qty} × $${(item.unit_price_cents / 100).toFixed(2)} = ` +
        `$${(item.total_cents / 100).toFixed(2)}`,
    );
  }
  parts.push(`Total: $${(input.quote.total_cents / 100).toFixed(2)}`);

  return parts.join('\n');
}
