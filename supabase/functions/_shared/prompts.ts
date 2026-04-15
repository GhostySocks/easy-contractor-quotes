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
    state_notes: {
      type: ['string', 'null'],
      description: 'Brief state-specific disclosure, or null if none applies.',
    },
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

const STATE_NOTE_HINTS: Record<string, string> = {
  TX: "mention mechanic's lien rights for jobs over $250 and prompt permits for gas/electric/plumbing",
  CA: 'mention 3-day right-to-cancel and CSLB license requirement for jobs over $500',
  FL: 'mention construction lien rights and 3-day cancellation period',
  NY: 'mention Home Improvement Contract requirement for jobs over $500',
  NC: 'mention general-contractor license for jobs over $30,000',
};

export function buildSystemPrompt(input: { trade: string; state_code: string }): string {
  const tradeKey = input.trade.toLowerCase();
  const tradeHint = TRADE_HINTS[tradeKey] ?? TRADE_HINTS.other;
  const stateKey = input.state_code.toUpperCase();
  const stateHint = STATE_NOTE_HINTS[stateKey] ?? null;

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
    stateHint
      ? `- state_notes: ${stateHint}.`
      : '- state_notes: null unless a state-specific disclosure clearly applies.',
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
