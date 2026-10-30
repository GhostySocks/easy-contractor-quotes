import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { CustomerRow } from './customers';
import { invoiceHtml } from './invoice-html';
import type { InvoiceRow } from './invoices';
import { PHOTO_BUCKET } from './photo-math';
import { fetchProfile } from './profile';
import { supabase } from './supabase';

/**
 * Render the invoice to a PDF on the phone and open the share sheet (Messages,
 * Mail, Files, a printer). Works without an email provider configured.
 */
export async function shareInvoicePdf(
  invoice: InvoiceRow,
  customer: CustomerRow | null,
  scope: string | null,
): Promise<void> {
  const profile = await fetchProfile(invoice.user_id);
  const logoDataUri = profile?.logo_url ? await storageDataUri(profile.logo_url) : null;

  const html = invoiceHtml({
    invoiceNumber: invoice.id.slice(0, 8).toUpperCase(),
    issuedAt: invoice.created_at,
    status: invoice.status,
    paidAt: invoice.paid_at,
    business: {
      name: profile?.business_name || 'Invoice',
      stateCode: profile?.state_code ?? null,
      logoDataUri,
    },
    customer: customer
      ? {
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          address: formatAddress(customer),
        }
      : null,
    scope,
    lineItems: invoice.line_items,
    subtotalCents: invoice.subtotal_cents,
    taxCents: invoice.tax_cents,
    totalCents: invoice.total_cents,
  });

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, {
    mimeType: 'application/pdf',
    UTI: 'com.adobe.pdf',
    dialogTitle: 'Share invoice',
  });
}

function formatAddress(c: CustomerRow): string | null {
  const cityState = [c.city, c.state_code].filter(Boolean).join(', ');
  const last = [cityState, c.postal_code].filter(Boolean).join(' ');
  const lines = [c.address_line1, c.address_line2, last].filter(Boolean);
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * The PDF renderer can't reliably fetch remote images, so the logo is inlined
 * as a data URI. Any failure just leaves the logo off.
 */
async function storageDataUri(path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
    if (error || !data) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(data);
    });
  } catch {
    return null;
  }
}
