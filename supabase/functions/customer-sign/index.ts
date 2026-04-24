// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

/**
 * Public (unauthenticated) signing page for the customer. Served as HTML
 * since the customer does not have the mobile app installed. The mobile
 * app uses `/sign-contract` with a JWT; this is the token-based twin.
 *
 * URL shape: /functions/v1/customer-sign?token=<signing_token>
 */

// @ts-expect-error — Deno.serve is provided by the runtime
Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  if (req.method !== 'GET') {
    return htmlResponse(renderError('Method not allowed.'), 405);
  }
  if (!token) {
    return htmlResponse(renderError('Missing signing token.'), 400);
  }

  try {
    const admin = createServiceClient();

    const { data: contract, error: fetchErr } = await admin
      .from('contracts')
      .select(
        'id, user_id, customer_id, body_markdown, kind, state_code, ' +
          'signing_token_expires_at, signed_at',
      )
      .eq('signing_token', token)
      .maybeSingle();

    if (fetchErr || !contract) {
      return htmlResponse(renderError('This signing link is invalid or has been revoked.'), 404);
    }
    if (contract.signed_at) {
      return htmlResponse(renderError('This contract has already been signed. Thanks!'), 410);
    }
    if (
      contract.signing_token_expires_at &&
      new Date(contract.signing_token_expires_at).getTime() < Date.now()
    ) {
      return htmlResponse(
        renderError('This signing link has expired. Contact the contractor for a new one.'),
        410,
      );
    }

    const [{ data: profile }, { data: customer }] = await Promise.all([
      admin.from('profiles').select('business_name').eq('id', contract.user_id).maybeSingle(),
      contract.customer_id
        ? admin.from('customers').select('name').eq('id', contract.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const submitUrl = `${url.origin}${url.pathname.replace('/customer-sign', '/customer-sign-submit')}`;

    return htmlResponse(
      renderSigningPage({
        token,
        submitUrl,
        businessName: profile?.business_name ?? 'Your contractor',
        customerName: customer?.name ?? 'Customer',
        kindTitle: contract.kind === 'release' ? 'Release of liability' : 'Work agreement',
        bodyHtml: markdownToHtml(contract.body_markdown),
      }),
      200,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return htmlResponse(renderError(`Something went wrong: ${escapeHtml(message)}`), 500);
  }
});

function createServiceClient() {
  // @ts-expect-error — Deno env access
  const serviceUrl = Deno.env.get('SUPABASE_URL') ?? '';
  // @ts-expect-error — Deno env access
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return createClient(serviceUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function htmlResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // No external scripts other than the signature_pad CDN below.
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; " +
        "script-src 'unsafe-inline' https://esm.sh; connect-src 'self' https://*.supabase.co",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cache-Control': 'no-store',
    },
  });
}

function renderError(message: string): string {
  return baseHtml(
    'Signing unavailable',
    `
      <main class="error">
        <h1>Can't sign right now</h1>
        <p>${escapeHtml(message)}</p>
      </main>
    `,
  );
}

type SigningPageInput = {
  token: string;
  submitUrl: string;
  businessName: string;
  customerName: string;
  kindTitle: string;
  bodyHtml: string;
};

function renderSigningPage(input: SigningPageInput): string {
  const inner = `
    <header class="site-header">
      <span class="brand-mark">ECQ</span>
      <span class="brand-name">${escapeHtml(input.businessName)}</span>
    </header>

    <main class="document">
      <p class="eyebrow">${escapeHtml(input.kindTitle)}</p>
      <h1>For ${escapeHtml(input.customerName)}</h1>
      <article class="body">${input.bodyHtml}</article>
    </main>

    <section class="sign-panel" id="sign-panel">
      <h2>Sign here</h2>
      <canvas id="pad" width="600" height="220"></canvas>
      <div class="sign-actions">
        <button type="button" id="clear" class="btn btn-ghost">Clear</button>
        <button type="button" id="submit" class="btn btn-primary" disabled>
          Agree &amp; sign
        </button>
      </div>
      <p class="legal">
        By tapping "Agree &amp; sign" you agree to the terms above. Your signature,
        the time it was made, and your IP are recorded for the audit log.
      </p>
      <div id="status" class="status" aria-live="polite"></div>
    </section>

    <script type="module">
      import SignaturePad from 'https://esm.sh/signature_pad@4.1.7?bundle';

      const canvas = document.getElementById('pad');
      const pad = new SignaturePad(canvas, {
        penColor: '#1A1A1A',
        backgroundColor: '#FFFFFF',
      });
      const submitBtn = document.getElementById('submit');
      const status = document.getElementById('status');

      function resize() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        canvas.width = canvas.offsetWidth * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        canvas.getContext('2d').scale(ratio, ratio);
        pad.clear();
        submitBtn.disabled = true;
      }
      window.addEventListener('resize', resize);
      resize();

      pad.addEventListener('afterUpdateStroke', () => {
        submitBtn.disabled = pad.isEmpty();
      });

      document.getElementById('clear').addEventListener('click', () => {
        pad.clear();
        submitBtn.disabled = true;
      });

      submitBtn.addEventListener('click', async () => {
        if (pad.isEmpty()) return;
        submitBtn.disabled = true;
        status.textContent = 'Signing…';
        try {
          const svg = pad.toSVG();
          const resp = await fetch(${JSON.stringify(input.submitUrl)}, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: ${JSON.stringify(input.token)},
              signature_svg: svg,
            }),
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || resp.statusText);
          }
          document.getElementById('sign-panel').innerHTML =
            '<div class="done"><h2>Signed ✓</h2><p>You can close this page. Your contractor will get a confirmation.</p></div>';
        } catch (err) {
          status.textContent = 'Something went wrong. Please try again.';
          submitBtn.disabled = false;
        }
      });
    </script>
  `;
  return baseHtml(`Sign — ${input.kindTitle}`, inner);
}

function baseHtml(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --gold: #D4AF37;
        --gold-dark: #A88828;
        --ink: #1A1A1A;
        --ink-2: #4A4A4A;
        --ink-3: #8A8A8A;
        --surface: #FFFFFF;
        --surface-2: #F7F5EF;
        --divider: #E8E4D7;
        --success: #0A7E3A;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--surface-2);
        color: var(--ink);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 17px;
        line-height: 1.55;
      }
      .site-header {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        background: var(--ink);
        color: var(--gold);
      }
      .brand-mark {
        font-weight: 800;
        letter-spacing: 1px;
        background: var(--gold);
        color: var(--ink);
        padding: 4px 8px;
        border-radius: 8px;
      }
      .brand-name { color: #FBF4D9; font-weight: 600; }
      main, .sign-panel {
        max-width: 720px;
        margin: 0 auto;
        padding: 24px 20px;
      }
      .eyebrow {
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: var(--gold-dark);
        font-weight: 700;
        font-size: 12px;
        margin: 0 0 4px;
      }
      h1 { margin: 0 0 24px; font-size: 24px; }
      .body h2 { margin-top: 28px; font-size: 18px; }
      .body h3 { margin-top: 20px; font-size: 16px; color: var(--ink-2); }
      .body p { margin: 0 0 14px; }
      .body ul { padding-left: 20px; }
      .sign-panel {
        background: var(--surface);
        border-top: 1px solid var(--divider);
        padding-top: 20px;
        padding-bottom: 48px;
      }
      .sign-panel h2 { margin: 0 0 12px; font-size: 20px; }
      canvas {
        display: block;
        width: 100%;
        height: 220px;
        border: 1px solid var(--divider);
        border-radius: 14px;
        background: var(--surface);
        touch-action: none;
      }
      .sign-actions {
        display: flex;
        gap: 12px;
        margin-top: 14px;
      }
      .btn {
        flex: 1;
        min-height: 60px;
        border-radius: 20px;
        border: none;
        font-size: 17px;
        font-weight: 700;
        cursor: pointer;
      }
      .btn-primary { background: var(--gold); color: var(--ink); }
      .btn-primary:disabled { background: var(--divider); color: var(--ink-3); cursor: not-allowed; }
      .btn-ghost { background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--divider); }
      .legal { color: var(--ink-3); font-size: 13px; margin-top: 12px; text-align: center; }
      .status { margin-top: 10px; text-align: center; color: var(--ink-2); }
      .done { text-align: center; padding: 48px 0; color: var(--success); }
      .done h2 { font-size: 28px; margin: 0 0 8px; }
      .error { padding: 48px 20px; text-align: center; }
    </style>
  </head>
  <body>${inner}</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Minimal server-side markdown renderer. Handles headings (#, ##, ###),
 * paragraphs, and bullet lists — the only syntax the ai-contract prompt
 * is told to emit. Escapes HTML in every text value to prevent XSS from
 * model output.
 */
function markdownToHtml(md: string): string {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      out.push(`<p>${escapeHtml(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      out.push(`<ul>${list.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`);
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (h3) {
      flushParagraph();
      flushList();
      out.push(`<h3>${escapeHtml(h3[1])}</h3>`);
    } else if (h2) {
      flushParagraph();
      flushList();
      out.push(`<h2>${escapeHtml(h2[1])}</h2>`);
    } else if (h1) {
      flushParagraph();
      flushList();
      out.push(`<h1>${escapeHtml(h1[1])}</h1>`);
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return out.join('\n');
}
