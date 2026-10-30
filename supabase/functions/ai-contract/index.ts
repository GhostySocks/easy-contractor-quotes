// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { amendmentBody, renderContract } from '../_shared/contract-template.ts';
import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';
import { type ContractKind, type ContractLineItem } from '../_shared/prompts.ts';

/**
 * Contract generation. Despite the route name (kept so the client is
 * unchanged), this no longer calls a model: the contract is a reviewed
 * template with the quote merged in (see _shared/contract-template.ts).
 * Instant, free, and the same wording for every customer in a state.
 */

type ContractInput = {
  kind: ContractKind;
  quote_id: string;
  /** Create the next version of this signed contract instead of a new one. */
  amend_contract_id?: string;
};

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId, supabase } = await requireActiveSubscription(req);
    const input = (await req.json()) as ContractInput;

    if (input.amend_contract_id) {
      const amended = await createAmendment(supabase, userId, input.amend_contract_id);
      return new Response(JSON.stringify(amended), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (input.kind !== 'work' && input.kind !== 'release') {
      throw new HttpError(400, 'kind must be "work" or "release"');
    }
    if (!input.quote_id) {
      throw new HttpError(400, 'quote_id is required');
    }

    const context = await loadContractContext(supabase, input.quote_id);

    const body_markdown = renderContract(input.kind, {
      kind: input.kind,
      state_code: context.state_code,
      contractor: context.contractor,
      customer: context.customer,
      quote: context.quote,
      generated_at: new Date().toISOString(),
    });

    const { data: inserted, error: insertError } = await supabase
      .from('contracts')
      .insert({
        user_id: userId,
        quote_id: input.quote_id,
        customer_id: context.customer_id,
        kind: input.kind,
        state_code: context.state_code,
        body_markdown,
        signing_token: mintSigningToken(),
        signing_token_expires_at: daysFromNowISO(30),
      })
      .select('id, body_markdown, signing_token')
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

  // The contract follows the contractor's state. If their profile has none
  // (onboarding never finished), use the customer's; never assume one.
  const stateCode = (profile?.state_code ?? customerAddress.state_code ?? '')
    .toString()
    .toUpperCase();
  if (stateCode.length !== 2) {
    throw new HttpError(400, 'Set your state in Settings > Business before creating a contract.');
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

/**
 * Copy a signed contract into the next version: same job, quote, customer,
 * kind and state; body starts from the signed text with an amendment note;
 * fresh signing link. The signed original is untouched (write-once).
 */
async function createAmendment(
  supabase: SupabaseClient,
  userId: string,
  contractId: string,
): Promise<{ id: string; body_markdown: string; signing_token: string }> {
  const { data: original, error } = await supabase
    .from('contracts')
    .select('id, quote_id, job_id, customer_id, kind, state_code, body_markdown, signed_at')
    .eq('id', contractId)
    .maybeSingle();
  if (error || !original) {
    throw new HttpError(404, `contract not found: ${error?.message ?? contractId}`);
  }
  if (!original.signed_at) {
    throw new HttpError(409, 'contract is not signed yet; edit it instead of amending');
  }

  // Next version across every contract for the same job (or quote).
  const scope = original.job_id
    ? { column: 'job_id', value: original.job_id }
    : { column: 'quote_id', value: original.quote_id };
  const { data: latest } = await supabase
    .from('contracts')
    .select('version')
    .eq(scope.column, scope.value)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();
  const version = ((latest?.version as number | null) ?? 1) + 1;

  const { data: inserted, error: insertError } = await supabase
    .from('contracts')
    .insert({
      user_id: userId,
      quote_id: original.quote_id,
      job_id: original.job_id,
      customer_id: original.customer_id,
      kind: original.kind,
      state_code: original.state_code,
      body_markdown: amendmentBody(original.body_markdown, version, original.signed_at),
      version,
      signing_token: mintSigningToken(),
      signing_token_expires_at: daysFromNowISO(30),
    })
    .select('id, body_markdown, signing_token')
    .single();
  if (insertError || !inserted) {
    throw new HttpError(500, `insert amendment failed: ${insertError?.message ?? 'no row'}`);
  }
  return inserted;
}

/**
 * 32 bytes of CSPRNG randomness, base64url-encoded → 43-character token.
 * Resistant to guessing; safe to put in a URL.
 */
function mintSigningToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function daysFromNowISO(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}
