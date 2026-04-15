// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';

import { corsHeaders, handleOptions } from '../_shared/cors.ts';
import { HttpError, requireActiveSubscription } from '../_shared/entitlement.ts';

type ContractInput = {
  kind: 'work' | 'release';
  job_id: string;
  state_code: string;
};

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return handleOptions();
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const { userId } = await requireActiveSubscription(req);
    const input = (await req.json()) as ContractInput;
    const result = await generateContract(userId, input);
    return new Response(JSON.stringify(result), {
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

async function generateContract(_userId: string, input: ContractInput) {
  // TODO(M1c): wire Anthropic + pull the state-specific template from
  // Supabase storage (5 launch states per PRD §9 — TX, CA, FL, NY + 5th TBD).
  return {
    body_markdown: `# ${input.kind === 'work' ? 'Work Agreement' : 'Release of Liability'}

State: ${input.state_code}

_TODO(M1c): real state-specific language will be inserted here._`,
  };
}
