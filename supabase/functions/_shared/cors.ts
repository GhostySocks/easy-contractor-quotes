export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-revenuecat-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function handleOptions(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
