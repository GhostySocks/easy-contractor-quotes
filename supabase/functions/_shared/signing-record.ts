/**
 * What is recorded when a contract is signed, and how it is shown. Pure,
 * unit-tested (lib/__tests__/signing-record.test.ts).
 *
 * An electronic signature holds up on evidence: who signed, what exact text,
 * when, that they agreed to sign electronically, and from where. The drawn
 * (or typed) signature, time and IP were already kept; this adds the typed
 * name, the consent, the device, and a fingerprint of the text.
 */

export type SignatureMethod = 'drawn' | 'typed';

export type SigningRecord = {
  signer_name: string | null;
  signed_at: string;
  signed_ip: string | null;
  signed_user_agent: string | null;
  signature_method: SignatureMethod | null;
  body_sha256: string | null;
};

const MAX_NAME = 120;
const MAX_USER_AGENT = 400;
/** signature_pad SVGs for a real signature are a few KB; this is generous. */
export const MAX_SIGNATURE_SVG_CHARS = 300_000;

/** A full name as typed: trimmed, single-spaced, at least two letters. Null if not usable. */
export function cleanSignerName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw
    // Control characters have no place in a name and could break an email header.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NAME);
  return (name.match(/\p{L}/gu) ?? []).length >= 2 ? name : null;
}

export function cleanUserAgent(raw: string | null): string | null {
  const ua = raw?.trim().slice(0, MAX_USER_AGENT);
  return ua ? ua : null;
}

const SVG_DATA_URL = /^data:image\/svg\+xml;base64,[A-Za-z0-9+/]+=*$/;

/**
 * A drawn signature must be an SVG of a sane size. The signing web page sends
 * the markup itself; the app's signature pad sends it as a base64 data URL.
 * Either way it is only ever shown as an image.
 */
export function isAcceptableSignatureSvg(svg: unknown): svg is string {
  return (
    typeof svg === 'string' &&
    svg.length >= 20 &&
    svg.length <= MAX_SIGNATURE_SVG_CHARS &&
    (/^\s*<svg[\s>]/i.test(svg) || SVG_DATA_URL.test(svg))
  );
}

/**
 * What to put in <img src> to show a stored signature, or null if it isn't
 * one we recognize. An SVG shown through <img> cannot run scripts, which is
 * why a signature is never placed in a page as markup.
 */
export function signatureImageSrc(svg: string | null): string | null {
  if (!svg) return null;
  if (SVG_DATA_URL.test(svg)) return svg;
  if (!/^\s*<svg[\s>]/i.test(svg)) return null;
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** The signature image for someone who chose to sign with their typed name. */
export function typedSignatureSvg(name: string): string {
  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 220" width="600" height="220">' +
    '<rect width="600" height="220" fill="#FFFFFF"/>' +
    '<text x="300" y="128" text-anchor="middle" font-size="52" font-style="italic" ' +
    "font-family=\"'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive\" " +
    `fill="#1A1A1A">${escapeXml(name)}</text></svg>`
  );
}

/** "Chrome on Android" from a user-agent string; null when it says nothing useful. */
export function deviceLabel(userAgent: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser\//.test(ua)
      ? 'Samsung Internet'
      : /Firefox\/|FxiOS\//.test(ua)
        ? 'Firefox'
        : /Chrome\/|CriOS\//.test(ua)
          ? 'Chrome'
          : /Safari\//.test(ua)
            ? 'Safari'
            : null;
  const system = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Macintosh|Mac OS X/.test(ua)
            ? 'Mac'
            : /Linux/.test(ua)
              ? 'Linux'
              : null;
  if (browser && system) return `${browser} on ${system}`;
  return browser ?? system;
}

/** Signing time in plain words, in UTC so it reads the same for both parties. */
export function signedAtLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const time = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
  return `${date} at ${time} UTC`;
}

/** The rows of the signing record, in the order they are shown. Missing facts are left out. */
export function recordRows(r: SigningRecord): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (r.signer_name) rows.push({ label: 'Signed by', value: r.signer_name });
  rows.push({ label: 'Signed on', value: signedAtLabel(r.signed_at) });
  if (r.signature_method) {
    rows.push({
      label: 'Signature',
      value: r.signature_method === 'typed' ? 'Typed name' : 'Drawn by hand',
    });
  }
  if (r.signer_name) {
    rows.push({ label: 'Consent', value: 'Agreed to sign electronically' });
  }
  if (r.signed_ip) rows.push({ label: 'IP address', value: r.signed_ip });
  const device = deviceLabel(r.signed_user_agent);
  if (device) rows.push({ label: 'Device', value: device });
  if (r.body_sha256) {
    rows.push({ label: 'Document fingerprint', value: r.body_sha256.slice(0, 16) });
  }
  return rows;
}

/** SHA-256 of the exact contract text, as hex: proof of which wording was signed. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
