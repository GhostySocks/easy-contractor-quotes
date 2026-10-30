# CLAUDE.md — Easy Contractor Quotes

Operating manual for terminal Claude. Read this fully before writing any code.

**Last updated:** April 15, 2026
**Version:** 1.0

---

## 1. Project Overview

- **App name:** Easy Contractor Quotes
- **Tagline:** Quote. Schedule. Get Paid. Done.
- **Platform target:** Mobile-first (iOS + Android). Web app planned for M4+ on the same Expo codebase. See §11.
- **Bundle ID (iOS/Android):** `co.inexile.easycontractorquotes`
- **Domain (reserved for web):** `easycontractorquotes.com`
- **Core promise:** quote any job in 60 seconds or less using AI, with a lightweight CRM, scheduling, contracts, and payments built in.

Build on Expo (React Native + Expo Router) so the web target can be enabled later without a second repo. Document all web-specific divergences in §11 as they arise.

---

## 2. Tech Stack

| Layer                             | Choice                               | Version                                      | Notes                                                                                                                                                                                                                                                                                  |
| --------------------------------- | ------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App framework                     | Expo (React Native)                  | SDK 54                                       | Expo Router for file-based routing                                                                                                                                                                                                                                                     |
| Language                          | TypeScript                           | 5.9+                                         | `strict: true`                                                                                                                                                                                                                                                                         |
| State / data                      | TanStack Query + Zustand             | latest                                       | Query for server state, Zustand for UI state                                                                                                                                                                                                                                           |
| Backend                           | Supabase                             | latest                                       | Postgres, Auth, Storage, Edge Functions                                                                                                                                                                                                                                                |
| Payments (mobile)                 | RevenueCat + App Store / Play Store  | latest                                       | Single subscription SKU — see §6                                                                                                                                                                                                                                                       |
| Payments (web, future)            | Stripe                               | latest                                       | Same entitlement name, different SKU                                                                                                                                                                                                                                                   |
| Accept-payments (customer-facing) | Stripe Connect (destination charges) | latest                                       | Funds land in user's Stripe account, not ours                                                                                                                                                                                                                                          |
| AI                                | Anthropic Claude (quotes)            | claude-haiku-5-5, fallback claude-sonnet-5-5 | All calls via Supabase Edge Function — never ship keys to client. Output is validated (`_shared/quote-validate.ts`); Sonnet runs only when Haiku's output fails. Contracts and state notes are templates, not model output (`_shared/contract-template.ts`, `_shared/state-notes.ts`). |
| E-signature                       | `react-native-signature-canvas`      | latest                                       | Store SVG + timestamp + IP; no DocuSign dependency                                                                                                                                                                                                                                     |
| SMS / email                       | Twilio + Resend                      | latest                                       | Via Edge Functions                                                                                                                                                                                                                                                                     |
| Calendar                          | `react-native-calendars`             | latest                                       |                                                                                                                                                                                                                                                                                        |
| Analytics                         | PostHog                              | latest                                       |                                                                                                                                                                                                                                                                                        |
| Error tracking                    | Sentry                               | latest                                       |                                                                                                                                                                                                                                                                                        |
| Testing                           | Jest + Detox                         | latest                                       | Unit + E2E                                                                                                                                                                                                                                                                             |
| CI / builds                       | EAS Build + EAS Submit               | latest                                       |                                                                                                                                                                                                                                                                                        |

> Note: CLAUDE.md v1.0 originally pinned Expo SDK 52. Bootstrapped on SDK 54 (current stable) as of April 15, 2026.

---

## 3. Critical Security Rules

1. **Never commit keys.** Everything goes in `.env.local` (gitignored). See `.env.example` for required keys.
2. **No secrets in the client bundle.** AI API keys, Twilio keys, Stripe secret keys, and Supabase service-role keys live server-side only (Edge Functions). The client only ever sees `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `EXPO_PUBLIC_SUPABASE_URL`.
3. **RLS is mandatory on every table.** Every table in §7 has a `user_id` column and a policy restricting reads/writes to `auth.uid() = user_id`. No table ships without RLS enabled.
4. **Entitlement gating is server-validated.** Never trust the RevenueCat client SDK alone — the server re-verifies the active entitlement via webhook into Supabase (`subscriptions` table) before returning quote/contract/AI responses.
5. **Customer PII** (phone, email, address) is encrypted at rest via Supabase's `pgcrypto` extension on the `customers.phone` and `customers.email` columns.
6. **Signed contracts are write-once.** Once `contracts.signed_at` is set, the row becomes immutable (enforced by a trigger). Audit log any amendment as a new contract version.
7. **Biometric login** required by default after first sign-in (LocalAuthentication API). Fallback to email/password.

---

## 4. Design System

Locked. Do not change colors, fonts, or spacing without a PRD update.

### Colors

| Token         | Hex       | Use                                              |
| ------------- | --------- | ------------------------------------------------ |
| `--gold`      | `#D4AF37` | Primary brand, main CTA, active tab, key numbers |
| `--gold-dark` | `#A88828` | Pressed state, headings on light backgrounds     |
| `--gold-tint` | `#FBF4D9` | Soft backgrounds, cards on dark                  |
| `--ink`       | `#1A1A1A` | Primary text                                     |
| `--ink-2`     | `#4A4A4A` | Secondary text                                   |
| `--ink-3`     | `#8A8A8A` | Tertiary text, placeholders                      |
| `--surface`   | `#FFFFFF` | Default surface                                  |
| `--surface-2` | `#F7F5EF` | Off-white section backgrounds                    |
| `--divider`   | `#E8E4D7` | Hairlines                                        |
| `--success`   | `#0A7E3A` | Paid status, positive deltas                     |
| `--warn`      | `#C88A00` | Pending / awaiting signature                     |
| `--danger`    | `#B3261E` | Unpaid past due, destructive                     |
| `--sky`       | `#E6F0FA` | Info badges                                      |

Dark mode: invert ink/surface pairs, keep gold identical.

### Typography

- **Display / headlines:** Inter Tight 700
- **Body / UI:** Inter 500 / 600
- **Numerics** (money, timers, counts): Inter 700 tabular-nums
- **Minimum body size:** 18 pt (accessibility — contractors are often 35–55 and working outdoors)
- **Touch targets:** minimum 60 pt tall — no exceptions

### Spacing

4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64 px scale. No arbitrary pixel values.

### Radius

`sm: 8`, `md: 14`, `lg: 20`, `xl: 28`. The New Quote FAB uses a 32 px radius.

### Animation curves

- Default: `cubic-bezier(0.2, 0.8, 0.2, 1)` — 250 ms
- FAB press: spring, stiffness 320, damping 22
- Screen push: 350 ms ease-in-out
- Paywall reveal: 450 ms
- Gold shimmer on splash logo: 1200 ms, easeInOut, infinite

### Iconography

`lucide-react-native`. Never mix icon sets. Stroke width 2 everywhere.

---

## 5. Screen Inventory & Routes

Expo Router file convention. `(tabs)` is the authenticated tab group.

```
app/
  _layout.tsx
  index.tsx                     -> Splash (redirects based on auth + subscription)
  (auth)/
    sign-in.tsx                 -> Returning user sign-in (added M1a)
    sign-up.tsx                 -> New user account creation before paywall (added M1a)
  (onboarding)/
    welcome.tsx                 -> Hero / value prop
    goals.tsx                   -> Trade selection
    business-profile.tsx        -> Name, logo, state (drives contract templates)
    walkthrough.tsx             -> FAB preview / coach mark (added M1a; was ON-04 in PRD)
    permissions.tsx             -> Location, notifications, calendar (MOBILE ONLY)
  paywall.tsx                   -> Hard paywall, no skip (single $9.99/mo tier)
  paywall-v2.tsx                -> A/B variant with monthly/annual toggle
  app-paused.tsx                -> Lapsed subscription re-activation
  (tabs)/
    _layout.tsx                 -> Bottom tab bar (4 tabs + center FAB)
    home.tsx                    -> Today's jobs, money pending, schedule preview
    jobs.tsx                    -> Library — full job list
    calendar.tsx                -> Journal — calendar + day view
    customers.tsx               -> CRM — customer list (§9)
  quote/
    new.tsx                     -> AI new-quote flow (Feature Screen)
    [id].tsx                    -> Quote detail / edit
  job/
    [id].tsx                    -> Job detail, status timeline, attachments
  customer/
    [id].tsx                    -> Customer profile
  contract/
    [id].tsx                    -> Contract view + e-sign
  settings/
    index.tsx
    business.tsx
    payments.tsx                -> Stripe Connect onboarding
    subscription.tsx            -> Manage RevenueCat subscription
```

Route-to-mockup mapping (HTML mockups in the handoff):

| Mockup file                       | Route                |
| --------------------------------- | -------------------- |
| `ecq_splash.html`                 | `/`                  |
| `ecq_welcome.html`                | `/welcome`           |
| `ecq_goals.html`                  | `/goals`             |
| `ecq_business_profile.html`       | `/business-profile`  |
| `ecq_onboarding_walkthrough.html` | last onboarding step |
| `ecq_permissions.html`            | `/permissions`       |
| `ecq_paywall.html`                | `/paywall`           |
| `ecq_paywall_v2.html`             | `/paywall-v2`        |
| `ecq_home.html`                   | `/(tabs)/home`       |
| `ecq_library.html`                | `/(tabs)/jobs`       |
| `ecq_journal.html`                | `/(tabs)/calendar`   |
| `ecq_customers.html`              | `/(tabs)/customers`  |
| `ecq_new_quote.html`              | `/quote/new`         |
| `ecq_app_paused.html`             | `/app-paused`        |

---

## 6. Subscription Model

Single paid tier. No free version. 7-day free trial is the only on-ramp.

| Field            | Value                         |
| ---------------- | ----------------------------- |
| Tier name        | Pro (the only tier)           |
| Monthly price    | $9.99 USD                     |
| Annual price     | $99.99 USD (~2 months free)   |
| Free trial       | 7 days, card-on-file required |
| Entitlement name | `pro_access`                  |

### Product IDs

| Platform             | Product ID                  | Duration |
| -------------------- | --------------------------- | -------- |
| iOS                  | `ecq_pro_monthly_999`       | 1 month  |
| iOS                  | `ecq_pro_annual_9999`       | 1 year   |
| Android              | `ecq_pro_monthly_999`       | 1 month  |
| Android              | `ecq_pro_annual_9999`       | 1 year   |
| Stripe (web, future) | `price_ecq_pro_monthly_999` | 1 month  |
| Stripe (web, future) | `price_ecq_pro_annual_9999` | 1 year   |

### Entitlement check (canonical snippet)

```ts
import Purchases from 'react-native-purchases';

export async function isSubscribed(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return info.entitlements.active['pro_access'] !== undefined;
}
```

**Always server-verify.** Before returning AI output or e-sign contract URLs, the Edge Function re-checks `subscriptions.status = 'active'` for the caller's `user_id`. RevenueCat's webhook is the source of truth for writes to that table.

---

## 7. Database Schema (Supabase / Postgres)

All tables have `id uuid default gen_random_uuid() primary key`, `user_id uuid references auth.users not null`, `created_at timestamptz default now()`, and RLS enabled with `auth.uid() = user_id`.

Canonical SQL lives in `/supabase/migrations/`. Table list:

- `profiles` — business profile, 1:1 with auth user
- `customers` — CRM customers (PII columns encrypted via pgcrypto)
- `jobs` — central entity
- `quotes` — AI-generated, one-to-many with jobs
- `contracts` — state-specific, AI-generated, e-signed (write-once after signing)
- `invoices` — auto from quote + actuals
- `subscriptions` — mirror of RevenueCat, source of truth for entitlement (service_role writes only)
- `availability` — calendar blocks

Every migration MUST include the RLS policy in the same file. Never ship a table without RLS.

---

## 8. Locked Copy Strings

Terminal Claude must never change these without human sign-off. Source of truth: `lib/strings.ts`.

| Key                  | String                                                                        |
| -------------------- | ----------------------------------------------------------------------------- |
| `app.tagline`        | Quote. Schedule. Get Paid. Done.                                              |
| `cta.newQuote`       | New Quote                                                                     |
| `cta.sendQuote`      | Send Quote                                                                    |
| `cta.requestPayment` | Request Payment                                                               |
| `cta.signNow`        | Sign now                                                                      |
| `paywall.headline`   | Built for contractors who actually work.                                      |
| `paywall.priceLine`  | $9.99 / month. 7-day free trial. Cancel anytime.                              |
| `paywall.trustLine`  | No free tier, no ads, no selling your customers.                              |
| `empty.jobs`         | Tap the gold button to quote your first job in 60 seconds.                    |
| `error.aiTimeout`    | Quote is taking a moment. We'll finish it in the background and let you know. |

---

## 9. CRM — What We Mean By It

The original PRD explicitly excluded a CRM. We are re-including a lightweight CRM. To stay true to the "one-handed on a job site" feel, the CRM is not a sales pipeline. It is:

- A Customers tab (4th tab next to Home, Jobs, Calendar — New Quote is the center FAB)
- Per-customer profile: contact info, address, lifetime value, last job date, notes, tags
- Auto-populated from every quote (no data entry ceremony)
- Surfaced inside New Quote: start typing a name → autocomplete existing customers → address, phone, notes auto-fill
- "Repeat customer" badge when count ≥ 2
- Export to CSV from Settings (paid feature — it's part of Pro)

**What the CRM is not:** no leads/pipeline stages, no marketing automation/blasts/drip campaigns, no team permissions, no deal sizes/forecasts/dashboards.

---

## 10. Competitive Landscape

| Competitor            | Positioning                         | Our differentiation                                                                                     |
| --------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| HandyQuoter (primary) | AI quoting, mobile-first, free tier | Feature parity, no free tier. Positioning: "the paid one — because the free app is selling your leads." |
| Jobber                | Full FSM, $49+/mo                   | Too complex, desktop-heavy. We win on speed and mobile-first UX.                                        |
| Housecall Pro         | Mid-market FSM, $65+/mo             | Too expensive for solo operators.                                                                       |
| ServiceTitan          | Enterprise, $300+/user/mo           | Completely different buyer.                                                                             |

Feature parity with HandyQuoter is a hard requirement. If a core HandyQuoter feature isn't in our PRD yet, flag it as a gap — don't silently skip it.

---

## 11. Platform Notes (Mobile Now, Web Later)

Web is planned for M4 or later. Decisions made now must not make web impossible:

- Expo with web target enabled (don't fork to Next.js later — we keep one codebase)
- Navigation: bottom tabs on mobile, top nav + sidebar on web (`Platform.OS === 'web'` branching in `app/(tabs)/_layout.tsx`)
- FAB becomes a prominent top-right button on web
- Breakpoints (web): 768 / 1024 / 1280 px
- Payments on web: Stripe (not in-app purchase). Same `pro_access` entitlement name.
- File uploads: Expo Image Picker on native, `<input type="file">` on web
- Offline: mobile supports offline quote creation + sync. Web launches without offline support.

---

## 12. How to Work With Me

- **"Build feature X"** → read the feature row in PRD.md §4, confirm acceptance criteria, check the mockup, then write the code. Never add fields to the DB schema without updating §7 in the same PR.
- **"A new screen"** → ask whether this is a new route or a modal over an existing one. Match the design tokens from §4 exactly. Do not invent colors.
- **"A migration"** → write it as a timestamped SQL file in `/supabase/migrations/`. Include the RLS policy in the same migration. Never run destructive migrations without confirmation.
- **"Fix this bug"** → write a failing test first, then fix.
- **"Ship to TestFlight / internal track"** → `eas build --platform <p> --profile preview`, verify, then `eas submit`. Never skip preview.

**Never do without explicit permission:** force-push, delete migrations, modify `.env.local` on the server, or ship code that bypasses entitlement checks.

### Model recommendation at the start of every feature

Before starting any punch-list item or feature, state in one line which Claude model the work should run on and why, then wait for the human to confirm or switch. The human decides; this is a recommendation, not a choice. Guide:

| Recommend | When                                                                                                                                                                                                              |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Haiku** | Mechanical, fully specified edits: renames, copy changes, adding a field that mirrors an existing one, test scaffolding, formatting.                                                                              |
| **Opus**  | The default for building to a spec: new screens, forms, data-layer functions, edge functions, library integrations (Stripe, calendar, PDF), bug fixes with a clear repro, most of Phases 1–3.                     |
| **Fable** | Judgment-heavy or high-blast-radius work: RLS / entitlement / security changes, PII encryption and key management, offline sync design, schema redesign, audits, anything where a wrong call leaks data or money. |

If a task changes character mid-way (an Opus task turns up a security question), say so and recommend switching rather than pressing on.

---

## 13. Environment Variables (`.env.local` template)

See `.env.example`. Keys beginning with `EXPO_PUBLIC_` are shipped in the client bundle and must not contain secrets. All other keys are server-only (Edge Function secrets).
