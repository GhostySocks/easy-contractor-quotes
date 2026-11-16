// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
// @ts-expect-error — Deno-only import resolved by the Supabase edge runtime
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { escapeHtml, markdownToHtml } from '../_shared/markdown.ts';
import { BINDING_NOTE, invoiceNote } from '../_shared/signed-emails.ts';
import { recordRows, signatureImageSrc, type SigningRecord } from '../_shared/signing-record.ts';

/**
 * Public (unauthenticated) signing page for the customer. Served as HTML
 * since the customer does not have the mobile app installed. The mobile
 * app uses `/sign-contract` with a JWT; this is the token-based twin.
 *
 * Before signing it shows the agreement and collects a typed name, consent
 * to sign electronically, and a drawn or typed signature. After signing the
 * same link shows the read-only signed copy with its signing record, which
 * is where the "View signed agreement" button in the emails leads.
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
          'signing_token_expires_at, signed_at, signed_ip, signature_svg, ' +
          'signer_name, signed_user_agent, signature_method, body_sha256',
      )
      .eq('signing_token', token)
      .maybeSingle();

    if (fetchErr || !contract) {
      return htmlResponse(renderError('This signing link is invalid or has been revoked.'), 404);
    }

    const [{ data: profile }, { data: customer }] = await Promise.all([
      admin.from('profiles').select('business_name').eq('id', contract.user_id).maybeSingle(),
      contract.customer_id
        ? admin.from('customers').select('name').eq('id', contract.customer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const businessName = profile?.business_name ?? 'Your contractor';
    const kindTitle = contract.kind === 'release' ? 'Release of liability' : 'Work agreement';
    const bodyHtml = markdownToHtml(contract.body_markdown);

    // Once signed, the link is the customer's own copy. It keeps working past
    // the signing deadline, which only limits how long an offer stays open.
    if (contract.signed_at) {
      return htmlResponse(
        renderSignedCopy({
          businessName,
          customerName: contract.signer_name ?? customer?.name ?? 'Customer',
          kindTitle,
          bodyHtml,
          signatureSvg: contract.signature_svg,
          record: {
            signer_name: contract.signer_name,
            signed_at: contract.signed_at,
            signed_ip: contract.signed_ip,
            signed_user_agent: contract.signed_user_agent,
            signature_method: contract.signature_method,
            body_sha256: contract.body_sha256,
          },
        }),
        200,
      );
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

    const submitUrl = `${url.origin}${url.pathname.replace('/customer-sign', '/customer-sign-submit')}`;

    return htmlResponse(
      renderSigningPage({
        token,
        submitUrl,
        businessName,
        customerName: customer?.name ?? 'Customer',
        kindTitle,
        bodyHtml,
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
      // No third-party scripts: the signature pad is the few lines below, so
      // nothing outside this function can change what a customer signs with.
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; " +
        "script-src 'unsafe-inline'; connect-src 'self' https://*.supabase.co",
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
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

function siteHeader(businessName: string): string {
  return `
    <header class="site-header">
      <span class="brand-mark">ECQ</span>
      <span class="brand-name">${escapeHtml(businessName)}</span>
    </header>`;
}

type SignedCopyInput = {
  businessName: string;
  customerName: string;
  kindTitle: string;
  bodyHtml: string;
  signatureSvg: string | null;
  record: SigningRecord;
};

function renderSignedCopy(input: SignedCopyInput): string {
  // The signature came from a browser we don't control, so it is only ever
  // shown as an image: an SVG inside <img> cannot run scripts.
  const src = signatureImageSrc(input.signatureSvg);
  const signature = src
    ? `<img class="signature" alt="Signature of ${escapeHtml(input.customerName)}" src="${src}" />`
    : '';
  const rows = recordRows(input.record)
    .map((r) => `<tr><th>${escapeHtml(r.label)}</th><td>${escapeHtml(r.value)}</td></tr>`)
    .join('');
  const inner = `
    ${siteHeader(input.businessName)}

    <main class="document">
      <p class="eyebrow signed-eyebrow">Signed ${escapeHtml(input.kindTitle.toLowerCase())}</p>
      <h1>For ${escapeHtml(input.customerName)}</h1>
      <p class="notice">
        This agreement is signed and locked. ${escapeHtml(BINDING_NOTE)}
        ${escapeHtml(invoiceNote(input.businessName))}
      </p>
      <article class="body">${input.bodyHtml}</article>
    </main>

    <section class="sign-panel">
      <h2>Signature</h2>
      ${signature}
      <table class="record">${rows}</table>
      <p class="legal">Print this page or save it as a PDF to keep a copy.</p>
    </section>
  `;
  return baseHtml(`Signed — ${input.kindTitle}`, inner);
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
    ${siteHeader(input.businessName)}

    <main class="document">
      <p class="eyebrow">${escapeHtml(input.kindTitle)}</p>
      <h1>For ${escapeHtml(input.customerName)}</h1>
      <article class="body">${input.bodyHtml}</article>
    </main>

    <section class="sign-panel" id="sign-panel">
      <h2>Sign here</h2>

      <label class="field-label" for="name">Your full name</label>
      <input id="name" class="text-field" type="text" autocomplete="name"
        placeholder="First and last name" maxlength="120" />

      <div class="mode-row" role="group" aria-label="How to sign">
        <button type="button" id="mode-draw" class="mode mode-on">Draw my signature</button>
        <button type="button" id="mode-type" class="mode">Use my typed name</button>
      </div>

      <div id="draw-area">
        <canvas id="pad" width="600" height="220" aria-label="Draw your signature here"></canvas>
        <p class="hint">Use your finger, or hold the mouse button and draw.</p>
      </div>
      <div id="type-area" class="typed-box" hidden>
        <span id="typed-preview" class="typed-preview"></span>
      </div>

      <label class="consent">
        <input type="checkbox" id="consent" />
        <span>I agree to sign this agreement electronically, and that my electronic
          signature counts the same as signing on paper.</span>
      </label>

      <div class="sign-actions">
        <button type="button" id="clear" class="btn btn-ghost">Clear</button>
        <button type="button" id="submit" class="btn btn-primary" disabled>
          Agree &amp; sign
        </button>
      </div>
      <p class="legal">
        By tapping "Agree &amp; sign" you agree to the terms above.
        ${escapeHtml(BINDING_NOTE)} ${escapeHtml(invoiceNote(input.businessName))}
        Your name, signature, the time, your IP address and your device are recorded
        with the agreement.
      </p>
      <div id="status" class="status" aria-live="polite"></div>
    </section>

    <script>
      const canvas = document.getElementById('pad');
      const ctx = canvas.getContext('2d');

      // The signature pad: each stroke is a list of points in CSS pixels,
      // drawn on the canvas as it's made and written out as an SVG path.
      const pad = {
        strokes: [],
        current: null,
        isEmpty() {
          return this.strokes.length === 0;
        },
        clear() {
          this.strokes = [];
          this.current = null;
          this.redraw();
        },
        redraw() {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.strokeStyle = '#1A1A1A';
          for (const stroke of this.strokes) {
            ctx.beginPath();
            ctx.moveTo(stroke[0][0], stroke[0][1]);
            for (const point of stroke) ctx.lineTo(point[0], point[1]);
            // A tap leaves a dot rather than nothing.
            if (stroke.length === 1) ctx.lineTo(stroke[0][0] + 0.1, stroke[0][1]);
            ctx.stroke();
          }
        },
        toSVG() {
          const w = Math.round(canvas.offsetWidth);
          const h = Math.round(canvas.offsetHeight);
          const d = this.strokes
            .map((stroke) =>
              stroke.length === 1
                ? 'M' + stroke[0].join(' ') + ' l0.1 0'
                : 'M' + stroke.map((point) => point.join(' ')).join(' L'),
            )
            .join(' ');
          return (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h +
            '" width="' + w + '" height="' + h + '">' +
            '<rect width="' + w + '" height="' + h + '" fill="#FFFFFF"/>' +
            '<path d="' + d + '" fill="none" stroke="#1A1A1A" stroke-width="2.5" ' +
            'stroke-linecap="round" stroke-linejoin="round"/></svg>'
          );
        },
      };
      function pointOf(event) {
        const box = canvas.getBoundingClientRect();
        return [
          Math.round((event.clientX - box.left) * 10) / 10,
          Math.round((event.clientY - box.top) * 10) / 10,
        ];
      }
      canvas.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        canvas.setPointerCapture(event.pointerId);
        pad.current = [pointOf(event)];
        pad.strokes.push(pad.current);
        pad.redraw();
        refresh();
      });
      canvas.addEventListener('pointermove', (event) => {
        if (!pad.current) return;
        pad.current.push(pointOf(event));
        pad.redraw();
      });
      const endStroke = () => {
        pad.current = null;
      };
      canvas.addEventListener('pointerup', endStroke);
      canvas.addEventListener('pointercancel', endStroke);
      const nameField = document.getElementById('name');
      const consent = document.getElementById('consent');
      const submitBtn = document.getElementById('submit');
      const clearBtn = document.getElementById('clear');
      const status = document.getElementById('status');
      const drawArea = document.getElementById('draw-area');
      const typeArea = document.getElementById('type-area');
      const typedPreview = document.getElementById('typed-preview');
      const modeDraw = document.getElementById('mode-draw');
      const modeType = document.getElementById('mode-type');
      let method = 'drawn';

      function nameOk() {
        return nameField.value.trim().replace(/[^\\p{L}]/gu, '').length >= 2;
      }
      function refresh() {
        typedPreview.textContent = nameField.value.trim();
        const signed = method === 'typed' ? nameOk() : !pad.isEmpty();
        submitBtn.disabled = !(nameOk() && consent.checked && signed);
      }
      function setMethod(next) {
        method = next;
        drawArea.hidden = next !== 'drawn';
        typeArea.hidden = next !== 'typed';
        clearBtn.hidden = next !== 'drawn';
        modeDraw.classList.toggle('mode-on', next === 'drawn');
        modeType.classList.toggle('mode-on', next === 'typed');
        refresh();
        if (next === 'drawn') {
          lastWidth = 0;
          resize();
        }
      }

      // Match the canvas to the screen's pixels. A changed width would leave
      // the strokes in the wrong place, so they are cleared; a phone's address
      // bar sliding away only changes the height and keeps the signature.
      let lastWidth = 0;
      function resize() {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const width = canvas.offsetWidth;
        if (width === 0 || width === lastWidth) return;
        lastWidth = width;
        canvas.width = width * ratio;
        canvas.height = canvas.offsetHeight * ratio;
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        pad.clear();
        refresh();
      }
      window.addEventListener('resize', resize);
      resize();

      nameField.addEventListener('input', refresh);
      consent.addEventListener('change', refresh);
      modeDraw.addEventListener('click', () => setMethod('drawn'));
      modeType.addEventListener('click', () => setMethod('typed'));
      clearBtn.addEventListener('click', () => {
        pad.clear();
        refresh();
      });

      submitBtn.addEventListener('click', async () => {
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        status.textContent = 'Signing…';
        try {
          const resp = await fetch(${JSON.stringify(input.submitUrl)}, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: ${JSON.stringify(input.token)},
              signer_name: nameField.value.trim(),
              consent: consent.checked,
              method,
              signature_svg: method === 'drawn' ? pad.toSVG() : null,
            }),
          });
          if (!resp.ok) {
            const text = await resp.text();
            throw new Error(text || resp.statusText);
          }
          const result = await resp.json().catch(() => ({}));
          const copy = result.customer_emailed
            ? 'A signed copy is on its way to your email.'
            : 'Reload this page any time to see your signed copy.';
          document.getElementById('sign-panel').innerHTML =
            '<div class="done"><h2>Signed ✓</h2><p>' + copy +
            '</p><p>Your contractor has been told, and will send an invoice when the work is complete.</p>' +
            '<p><a href="">View signed agreement</a></p></div>';
        } catch (err) {
          status.textContent = 'Something went wrong. Please try again.';
          refresh();
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
    <meta name="robots" content="noindex" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --gold: #D4AF37;
        --gold-dark: #7F6519;
        --gold-tint: #FBF4D9;
        --ink: #1A1A1A;
        --ink-2: #4A4A4A;
        --ink-3: #6E6E6E;
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
        font-size: 18px;
        line-height: 1.55;
      }
      [hidden] { display: none !important; }
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
      .brand-name { color: var(--gold-tint); font-weight: 600; }
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
      .signed-eyebrow { color: var(--success); }
      h1 { margin: 0 0 24px; font-size: 24px; }
      .notice {
        background: var(--gold-tint);
        border-radius: 14px;
        padding: 12px 16px;
        font-size: 16px;
      }
      .body h1 { font-size: 22px; margin: 0 0 16px; }
      .body h2 { margin-top: 28px; font-size: 18px; }
      .body h3 { margin-top: 20px; font-size: 16px; color: var(--ink-2); }
      .body p { margin: 0 0 14px; }
      .body ul { padding-left: 20px; }
      .body table {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 14px;
        font-size: 16px;
      }
      .body th, .body td {
        padding: 8px 6px;
        border-bottom: 1px solid var(--divider);
        text-align: left;
        vertical-align: top;
      }
      .body th { color: var(--ink-3); font-weight: 600; font-size: 14px; }
      .sign-panel {
        background: var(--surface);
        border-top: 1px solid var(--divider);
        padding-top: 20px;
        padding-bottom: 48px;
      }
      .sign-panel h2 { margin: 0 0 12px; font-size: 20px; }
      .field-label { display: block; font-weight: 600; font-size: 15px; color: var(--ink-2); margin: 0 0 6px; }
      .text-field {
        display: block;
        width: 100%;
        min-height: 60px;
        padding: 0 16px;
        font-size: 18px;
        font-family: inherit;
        color: var(--ink);
        border: 1px solid var(--divider);
        border-radius: 14px;
        background: var(--surface);
      }
      .text-field:focus { outline: none; border-color: var(--gold); }
      .mode-row { display: flex; gap: 8px; margin: 16px 0 12px; }
      .mode {
        flex: 1;
        min-height: 60px;
        border-radius: 14px;
        border: 1px solid var(--divider);
        background: var(--surface);
        color: var(--ink-2);
        font-size: 16px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
      }
      .mode-on { background: var(--gold-tint); border-color: var(--gold); color: var(--gold-dark); }
      canvas {
        display: block;
        width: 100%;
        height: 220px;
        border: 1px solid var(--divider);
        border-radius: 14px;
        background: var(--surface);
        touch-action: none;
      }
      .hint { color: var(--ink-3); font-size: 14px; margin: 6px 0 0; }
      .typed-box {
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 220px;
        border: 1px solid var(--divider);
        border-radius: 14px;
        padding: 12px;
      }
      .typed-preview {
        font-family: 'Brush Script MT', 'Segoe Script', 'Snell Roundhand', cursive;
        font-style: italic;
        font-size: 44px;
        line-height: 1.2;
        text-align: center;
        word-break: break-word;
      }
      .consent {
        display: flex;
        gap: 12px;
        align-items: flex-start;
        margin-top: 16px;
        min-height: 60px;
        font-size: 16px;
        cursor: pointer;
      }
      .consent input { width: 28px; height: 28px; margin: 2px 0 0; flex: none; accent-color: var(--gold-dark); }
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
        font-size: 18px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
      }
      .btn-primary { background: var(--gold); color: var(--ink); }
      .btn-primary:disabled { background: var(--divider); color: var(--ink-3); cursor: not-allowed; }
      .btn-ghost { background: var(--surface-2); color: var(--ink-2); border: 1px solid var(--divider); }
      .legal { color: var(--ink-3); font-size: 14px; margin-top: 12px; text-align: center; }
      .status { margin-top: 10px; text-align: center; color: var(--ink-2); }
      .done { text-align: center; padding: 48px 0; }
      .done h2 { font-size: 28px; margin: 0 0 8px; color: var(--success); }
      .done a { color: var(--gold-dark); font-weight: 600; }
      .error { padding: 48px 20px; text-align: center; }
      .signature {
        display: block;
        width: 100%;
        max-width: 420px;
        border: 1px solid var(--divider);
        border-radius: 14px;
        background: var(--surface);
      }
      .record { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 16px; }
      .record th {
        text-align: left;
        font-weight: 500;
        color: var(--ink-3);
        padding: 8px 12px 8px 0;
        white-space: nowrap;
        vertical-align: top;
      }
      .record td { padding: 8px 0; font-weight: 600; word-break: break-word; }
      .record tr + tr th, .record tr + tr td { border-top: 1px solid var(--divider); }
      @media print {
        .site-header { background: none; color: var(--ink); }
        .brand-name { color: var(--ink); }
        body { background: #fff; }
      }
    </style>
  </head>
  <body>${inner}</body>
</html>`;
}
