import { escapeHtml } from './markdown.ts';

/**
 * The shared look of every email the app sends for a contractor, and the one
 * place that talks to Resend. The layout builders are pure and unit-tested
 * (lib/__tests__/signed-emails.test.ts); sendEmail is the only I/O.
 *
 * Email clients ignore stylesheets and most modern CSS, so everything is
 * tables and inline styles, in the app's own colors (CLAUDE.md §4).
 */

export const EMAIL_COLORS = {
  gold: '#D4AF37',
  goldDark: '#7F6519',
  goldTint: '#FBF4D9',
  ink: '#1A1A1A',
  ink2: '#4A4A4A',
  ink3: '#6E6E6E',
  surface: '#FFFFFF',
  surface2: '#F7F5EF',
  divider: '#E8E4D7',
  success: '#0A7E3A',
} as const;

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";

export type EmailLayoutInput = {
  /** Shown in the dark header band: the contractor's business. */
  businessName: string;
  /** Short line of preview text some inboxes show after the subject. */
  preheader: string;
  /** Already-safe HTML for the body. Build it with the helpers below. */
  bodyHtml: string;
  /** Plain-text footer line, e.g. why they got this email. */
  footer: string;
};

export function emailLayout(input: EmailLayoutInput): string {
  const c = EMAIL_COLORS;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:${c.surface2};color:${c.ink};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.surface2};padding:24px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
<tr><td style="background:${c.ink};border-radius:14px 14px 0 0;padding:20px 28px;">
<span style="font-size:20px;font-weight:700;color:${c.goldTint};">${escapeHtml(input.businessName)}</span>
</td></tr>
<tr><td style="background:${c.gold};height:4px;line-height:4px;font-size:0;">&nbsp;</td></tr>
<tr><td style="background:${c.surface};border-radius:0 0 14px 14px;padding:28px;font-size:17px;line-height:1.55;">
${input.bodyHtml}
</td></tr>
<tr><td style="padding:16px 28px;font-size:13px;line-height:1.5;color:${c.ink3};text-align:center;">
${escapeHtml(input.footer)}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function paragraph(text: string): string {
  return `<p style="margin:0 0 16px;">${escapeHtml(text)}</p>`;
}

export function heading(text: string): string {
  return `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:${EMAIL_COLORS.ink};">${escapeHtml(text)}</h1>`;
}

/** The gold call-to-action button, with the link spelled out beneath for clients that block it. */
export function button(label: string, url: string): string {
  const c = EMAIL_COLORS;
  const safeUrl = escapeHtml(url);
  return `<p style="margin:8px 0 12px;">
<a href="${safeUrl}" style="display:inline-block;background:${c.gold};color:${c.ink};font-weight:700;font-size:17px;padding:16px 28px;border-radius:20px;text-decoration:none;">${escapeHtml(label)}</a>
</p>
<p style="margin:0 0 20px;font-size:13px;color:${c.ink3};">If the button doesn't work, copy this link:<br/><span style="word-break:break-all;">${safeUrl}</span></p>`;
}

/** A label / value list in a soft panel: job summaries and the signing record. */
export function factsPanel(title: string, rows: { label: string; value: string }[]): string {
  const c = EMAIL_COLORS;
  const lines = rows
    .map(
      (r) =>
        `<tr><td style="padding:6px 12px 6px 0;font-size:14px;color:${c.ink3};vertical-align:top;white-space:nowrap;">${escapeHtml(r.label)}</td>` +
        `<td style="padding:6px 0;font-size:15px;color:${c.ink};font-weight:600;word-break:break-word;">${escapeHtml(r.value)}</td></tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.surface2};border:1px solid ${c.divider};border-radius:14px;margin:0 0 20px;">
<tr><td style="padding:16px 20px;">
<div style="font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${c.goldDark};margin:0 0 8px;">${escapeHtml(title)}</div>
<table role="presentation" cellpadding="0" cellspacing="0">${lines}</table>
</td></tr>
</table>`;
}

/** Contract text (already rendered from markdown) restyled for email clients. */
export function documentBlock(html: string): string {
  const c = EMAIL_COLORS;
  const styled = html
    .replace(/<h1>/g, `<h2 style="margin:0 0 12px;font-size:20px;color:${c.ink};">`)
    .replace(/<\/h1>/g, '</h2>')
    .replace(/<h2>/g, `<h3 style="margin:22px 0 8px;font-size:17px;color:${c.ink};">`)
    .replace(/<\/h2>/g, '</h3>')
    .replace(/<h3>/g, `<h4 style="margin:18px 0 6px;font-size:15px;color:${c.ink2};">`)
    .replace(/<\/h3>/g, '</h4>')
    .replace(/<p>/g, '<p style="margin:0 0 12px;font-size:15px;line-height:1.55;">')
    .replace(/<ul>/g, '<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;">')
    .replace(
      /<table>/g,
      `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px;font-size:14px;">`,
    )
    .replace(
      /<th( style="text-align:right")?>/g,
      (_m, right: string | undefined) =>
        `<th style="text-align:${right ? 'right' : 'left'};padding:8px 6px;border-bottom:2px solid ${c.divider};color:${c.ink3};font-weight:600;">`,
    )
    .replace(
      /<td( style="text-align:right")?>/g,
      (_m, right: string | undefined) =>
        `<td style="text-align:${right ? 'right' : 'left'};padding:8px 6px;border-bottom:1px solid ${c.divider};">`,
    );
  return `<div style="border-top:1px solid ${c.divider};padding-top:20px;margin-top:4px;">${styled}</div>`;
}

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Easy Contractor Quotes <no-reply@easycontractorquotes.com>';

/** Send one email through Resend. Throws with Resend's reason when it refuses. */
export async function sendEmail(input: {
  to: string;
  toName?: string | null;
  subject: string;
  html: string;
}): Promise<void> {
  // @ts-expect-error — Deno env access
  const apiKey = Deno.env.get('RESEND_API_KEY');
  // @ts-expect-error — Deno env access
  const from = Deno.env.get('RESEND_FROM_EMAIL') ?? DEFAULT_FROM;
  if (!apiKey) throw new Error('RESEND_API_KEY is not configured');

  // A display name with quotes or angle brackets would corrupt the header.
  const name = input.toName?.replace(/["<>\r\n]/g, '').trim();
  const resp = await fetch(RESEND_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from,
      to: name ? `${name} <${input.to}>` : input.to,
      subject: input.subject,
      html: input.html,
    }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Resend ${resp.status}: ${body.slice(0, 200)}`);
  }
}
