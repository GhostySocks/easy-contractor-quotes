// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';
import {
  buildContractSystemPrompt,
  buildContractUserMessage,
  CONTRACT_TOOL_INPUT_SCHEMA,
  CONTRACT_TOOL_NAME,
  type ContractKind,
  type ContractLineItem,
} from '../_shared/prompts.ts';

type ContractInput = {
  kind: ContractKind;
  quote_id: string;
};

type ContractToolOutput = {
  body_markdown: string;
};

type AnthropicResponse = {
  content: Array<{
    type: string;
    name?: string;
    input?: unknown;
  }>;
};

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId, supabase } = await requireActiveSubscription(req);
    const input = (await req.json()) as ContractInput;

    if (input.kind !== 'work' && input.kind !== 'release') {
      throw new HttpError(400, 'kind must be "work" or "release"');
    }
    if (!input.quote_id) {
      throw new HttpError(400, 'quote_id is required');
    }

    const context = await loadContractContext(supabase, input.quote_id);

    const systemPrompt = buildContractSystemPrompt({
      kind: input.kind,
      state_code: context.state_code,
    });
    const userMessage = buildContractUserMessage({
      kind: input.kind,
      state_code: context.state_code,
      contractor: context.contractor,
      customer: context.customer,
      quote: context.quote,
    });

    // @ts-expect-error — Deno env access
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) {
      throw new HttpError(500, 'ANTHROPIC_API_KEY is not configured on this project');
    }

    const { body_markdown } = await callAnthropic(apiKey, systemPrompt, userMessage);

    const { data: inserted, error: insertError } = await supabase
      .from('contracts')
      .insert({
        user_id: userId,
        quote_id: input.quote_id,
        customer_id: context.customer_id,
        kind: input.kind,
        state_code: context.state_code,
        body_markdown,
      })
      .select('id, body_markdown')
      .single();

    if (insertError || !inserted) {
      throw new HttpError(500, `insert contract failed: ${insertError?.message ?? 'no row'}`);
    }

    return new Response(JSON.stringify(inserted), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    if (err instanceof HttpError) {
      return new Response(err.message, { status: err.status, headers: corsHeaders });
    }
    const message = err instanceof Error ? err.message : 'unknown error';
    return new Response(message, { status: 500, headers: corsHeaders });
  }
});

type ContractContext = {
  state_code: string;
  customer_id: string | null;
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

async function loadContractContext(
  supabase: SupabaseClient,
  quoteId: string,
): Promise<ContractContext> {
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('user_id, customer_id, scope_of_work, line_items, total_cents')
    .eq('id', quoteId)
    .maybeSingle();
  if (quoteError || !quote) {
    throw new HttpError(404, `quote not found: ${quoteError?.message ?? quoteId}`);
  }
  if (!quote.scope_of_work) {
    throw new HttpError(
      400,
      'quote has no scope_of_work — finish the quote before generating a contract',
    );
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('business_name, trade, state_code')
    .eq('id', quote.user_id)
    .maybeSingle();

  const businessName = (profile?.business_name ?? 'Contractor').toString();
  const trade = (profile?.trade ?? 'handyman').toString();
  const stateCode = (profile?.state_code ?? 'TX').toString().toUpperCase();

  let customerName = 'Customer';
  let customerAddress: {
    line1?: string | null;
    city?: string | null;
    state_code?: string | null;
  } = {};
  if (quote.customer_id) {
    const { data: customer } = await supabase
      .from('customers')
      .select('name, address_line1, city, state_code')
      .eq('id', quote.customer_id)
      .maybeSingle();
    if (customer) {
      customerName = customer.name;
      customerAddress = {
        line1: customer.address_line1,
        city: customer.city,
        state_code: customer.state_code,
      };
    }
  }

  return {
    state_code: stateCode,
    customer_id: quote.customer_id ?? null,
    contractor: {
      business_name: businessName,
      trade,
    },
    customer: {
      name: customerName,
      address_line1: customerAddress.line1 ?? null,
      city: customerAddress.city ?? null,
      state_code: customerAddress.state_code ?? null,
    },
    quote: {
      scope_of_work: quote.scope_of_work,
      line_items: (quote.line_items ?? []) as ContractLineItem[],
      total_cents: quote.total_cents,
    },
  };
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<ContractToolOutput> {
  const resp = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2500,
      system: systemPrompt,
      tools: [
        {
          name: CONTRACT_TOOL_NAME,
          description: 'Return the full contract body as markdown.',
          input_schema: CONTRACT_TOOL_INPUT_SCHEMA,
        },
      ],
      tool_choice: { type: 'tool', name: CONTRACT_TOOL_NAME },
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new HttpError(502, `Anthropic error ${resp.status}: ${body.slice(0, 400)}`);
  }

  const result = (await resp.json()) as AnthropicResponse;
  const toolUse = result.content.find(
    (c) => c.type === 'tool_use' && c.name === CONTRACT_TOOL_NAME,
  );
  if (!toolUse || !toolUse.input) {
    throw new HttpError(502, 'Anthropic response did not include the expected tool use');
  }
  return toolUse.input as ContractToolOutput;
}
