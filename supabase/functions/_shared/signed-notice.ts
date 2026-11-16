// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { type SupabaseClient } from 'jsr:@supabase/supabase-js@2';

import { logoUrlFor, sendEmail } from './email.ts';
import { contractorSignedEmail, customerSignedEmail } from './signed-emails.ts';

/**
 * After a contract is signed (by link or in person): email the customer
 * their signed copy and tell the contractor. Best effort. The signature is
 * already saved; a failed email is logged and never fails the signing.
 *
 * Runs with the service-role client, like post-sign.ts: the customer has no
 * login, and the contractor's email lives in auth.users.
 */
export async function sendSignedEmails(
  admin: SupabaseClient,
  contractId: string,
  viewUrl: string,
): Promise<{ customer_emailed: boolean; contractor_emailed: boolean }> {
  const result = { customer_emailed: false, contractor_emailed: false };
  try {
    const { data: contract } = await admin
      .from('contracts')
      .select(
        'id, user_id, customer_id, quote_id, kind, body_markdown, signed_at, signed_ip, ' +
          'signer_name, signed_consent_at, signed_user_agent, signature_method, body_sha256',
      )
      .eq('id', contractId)
      .maybeSingle();
    if (!contract?.signed_at) return result;

    const [{ data: profile }, { data: customer }, { data: quote }, { data: owner }] =
      await Promise.all([
        admin
          .from('profiles')
          .select('business_name, logo_url, business_phone, business_email')
          .eq('id', contract.user_id)
          .maybeSingle(),
        contract.customer_id
          ? admin
              .from('customers')
              .select('name, email')
              .eq('id', contract.customer_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        contract.quote_id
          ? admin.from('quotes').select('total_cents').eq('id', contract.quote_id).maybeSingle()
          : Promise.resolve({ data: null }),
        admin.auth.admin.getUserById(contract.user_id),
      ]);

    const input = {
      businessName: (profile?.business_name as string | undefined) ?? 'Your contractor',
      logoUrl: await logoUrlFor(admin, profile?.logo_url as string | null | undefined),
      contact: {
        phone: profile?.business_phone as string | null | undefined,
        email: profile?.business_email as string | null | undefined,
      },
      customerName:
        (contract.signer_name as string | null) ??
        (customer?.name as string | undefined) ??
        'Your customer',
      kindTitle: contract.kind === 'release' ? 'Release of liability' : 'Work agreement',
      bodyMarkdown: contract.body_markdown as string,
      totalCents: typeof quote?.total_cents === 'number' ? quote.total_cents : null,
      record: {
        signer_name: contract.signer_name,
        signed_consent_at: contract.signed_consent_at ?? null,
        signed_at: contract.signed_at,
        signed_ip: contract.signed_ip,
        signed_user_agent: contract.signed_user_agent,
        signature_method: contract.signature_method,
        body_sha256: contract.body_sha256,
      },
      viewUrl,
    };

    const contractorEmail = owner?.user?.email?.trim();
    const customerEmail = (customer?.email as string | null | undefined)?.trim();
    if (customerEmail) {
      try {
        await sendEmail({
          to: customerEmail,
          toName: customer?.name as string | undefined,
          replyTo: (profile?.business_email as string | null | undefined) || contractorEmail,
          ...customerSignedEmail(input),
        });
        result.customer_emailed = true;
      } catch (err) {
        console.warn('[signed-notice] customer copy failed', (err as Error).message);
      }
    }

    if (contractorEmail) {
      try {
        await sendEmail({ to: contractorEmail, ...contractorSignedEmail(input) });
        result.contractor_emailed = true;
      } catch (err) {
        console.warn('[signed-notice] contractor notice failed', (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[signed-notice] failed', (err as Error).message);
  }
  return result;
}
