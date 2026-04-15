# PRD.md — Easy Contractor Quotes

**Version:** 1.0
**Date:** April 15, 2026
**Status:** Draft (for Claude consumption + terminal handoff)
**Owner:** Christian (hello@inexile.co)

This document is the Claude-readable product requirements. The human-readable `.docx` version lives outside the repo. Keep this file in sync whenever a product decision is made.

---

## 1. Product Overview

Easy Contractor Quotes is a mobile-first (iOS + Android at launch; web in M4+) app for solo handymen, small crews, and independent contractors. It compresses the admin overhead of running a one- or two-person trade business — quoting, contracts, invoicing, scheduling, and customer memory — into a few thumb-sized taps.

**Core promise:** quote any job in 60 seconds or less using AI, send it, get it signed, get paid — without touching a desktop.

### 1.1 Positioning

| Field                | Value                             |
| -------------------- | --------------------------------- |
| App name             | Easy Contractor Quotes            |
| Tagline              | Quote. Schedule. Get Paid. Done.  |
| Bundle ID            | `co.inexile.easycontractorquotes` |
| Domain (web, future) | `easycontractorquotes.com`        |
| Primary category     | Business                          |
| Secondary category   | Productivity                      |

### 1.2 Platform target

Mobile only at launch. Web app planned for M4+ using the same Expo codebase with web target enabled (one repo, one CLAUDE.md, one PRD). All decisions today must preserve the option to ship web without a rewrite.

### 1.3 Business objectives

- 80% of quotes completed in ≤60 seconds end-to-end
- Average time-from-quote-to-invoice under 30 seconds
- 70% of completed jobs paid within 7 days
- NPS ≥70 at 6 months
- 5% free-trial to paid conversion at the aggressive $9.99 price point

---

## 2. Target Users

### 2.1 Primary persona — "Mike the Handyman"

- 35–55, solo or 1–2 person crew
- Phone-native, laptop-averse
- Running a real business but allergic to software that feels like software
- Cares about: speed, looking professional to the customer, getting paid on time
- Currently uses: paper, text messages, maybe HandyQuoter free tier

### 2.2 Secondary personas

Small landscaping, plumbing, and electrical contractors with the same workflow. Mobile detailers, appliance repair, HVAC sole operators.

### 2.3 Anti-personas (we do not build for these)

- Multi-crew operators with 10+ employees (Jobber / Housecall Pro territory)
- Commercial-scale field service (ServiceTitan territory)
- Customers of the contractor (no customer portal in-scope)

---

## 3. Subscription Model

Single paid tier. No free version. 7-day free trial with card-on-file.

| Feature      | Pro (the only tier)                         |
| ------------ | ------------------------------------------- |
| Price        | $9.99 / month or $99.99 / year              |
| Trial        | 7 days, card required                       |
| Users        | 1 (solo) + unlimited customers              |
| Quotes       | Unlimited                                   |
| AI contracts | Unlimited, state-specific                   |
| E-signature  | Included                                    |
| Payments     | Stripe Connect (user's own account)         |
| CRM          | Customer memory + notes + tags + CSV export |
| Calendar     | Included                                    |

### 3.1 Product IDs

| Platform             | Product ID                  | Price  | Duration |
| -------------------- | --------------------------- | ------ | -------- |
| iOS                  | `ecq_pro_monthly_999`       | $9.99  | 1 month  |
| iOS                  | `ecq_pro_annual_9999`       | $99.99 | 1 year   |
| Android              | `ecq_pro_monthly_999`       | $9.99  | 1 month  |
| Android              | `ecq_pro_annual_9999`       | $99.99 | 1 year   |
| Stripe (web, future) | `price_ecq_pro_monthly_999` | $9.99  | 1 month  |
| Stripe (web, future) | `price_ecq_pro_annual_9999` | $99.99 | 1 year   |

Entitlement name (all platforms): `pro_access`.

### 3.2 Positioning vs competitors

$9.99 is intentionally aggressive. HandyQuoter has a free tier + upsell; Jobber starts at ~$49/mo; Housecall Pro $65+; ServiceTitan $300+/seat. Our pitch: "The paid one that doesn't sell your leads."

---

## 4. Feature Tables

### 4.1 Onboarding

| ID    | Priority | Feature                | Acceptance criteria                                                                                           |
| ----- | -------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| ON-01 | P0       | Welcome + value prop   | Single screen, one primary CTA. ≥60 pt button.                                                                |
| ON-02 | P0       | Trade selection        | 6 chips: Handyman, Plumber, Electrician, Landscaping, HVAC, Other. Single-select, stored to `profiles.trade`. |
| ON-03 | P0       | Business profile       | Collects business name, logo (optional), 2-letter state code. State drives contract templates.                |
| ON-04 | P0       | Onboarding walkthrough | 3-tap animated guide to: New Quote FAB, Jobs list, Payments. Skippable.                                       |
| ON-05 | P0       | Permissions            | Requests location (GPS auto-address), push (job reminders), calendar (native sync). Mobile only.              |
| ON-06 | P0       | Paywall                | Hard paywall after permissions. No skip. $9.99/mo pre-selected, annual toggle visible.                        |

### 4.2 AI Quoting (the core loop)

| ID    | Priority | Feature                 | Acceptance criteria                                                                                                        |
| ----- | -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| QT-01 | P0       | New Quote FAB           | Present on every tab. Gold, 72×72 pt, center position, floats above tab bar.                                               |
| QT-02 | P0       | 5-field quote form      | Job type, address (GPS prefill), description + photos, start date, customer.                                               |
| QT-03 | P0       | AI generation ≤60s      | P50 ≤20s, P95 ≤60s. Streaming UI with skeleton + progress. Timeout → background + push. Metric: `quotes.ai_generation_ms`. |
| QT-04 | P0       | Line-item output        | Labor, materials, tax breakdown. Editable before send.                                                                     |
| QT-05 | P0       | Price range             | AI returns low / most likely / high. User picks one to send.                                                               |
| QT-06 | P0       | Scope of work paragraph | 3–5 sentence plain-English scope. Editable.                                                                                |
| QT-07 | P0       | State-specific notes    | Permit, warranty, disclosure notes pulled from state templates.                                                            |
| QT-08 | P0       | One-tap send            | SMS + email via Twilio + Resend. Link goes to signable contract + accept button.                                           |
| QT-09 | P1       | Save as draft           | Quote status `draft` until sent. Drafts visible under Jobs → Drafts filter.                                                |
| QT-10 | P1       | Reuse prior quote       | On customer profile: "Quote again." Prefills from most recent quote.                                                       |

### 4.3 Invoices & Payments

| ID    | Priority | Feature                     | Acceptance criteria                                                                       |
| ----- | -------- | --------------------------- | ----------------------------------------------------------------------------------------- |
| IN-01 | P0       | Auto-invoice on "Completed" | Invoice auto-generated mirroring quote + any edited actuals.                              |
| IN-02 | P0       | PDF + email/SMS delivery    | Branded with profile logo. PDF stored in Supabase Storage.                                |
| IN-03 | P0       | Request Payment             | From job detail → Stripe Connect destination charge. Funds land in user's Stripe account. |
| IN-04 | P0       | Payments tab                | Paid / Unpaid split with totals. Overdue banner if >7 days.                               |
| IN-05 | P1       | Partial payments            | Support deposits (e.g. 25% on accept, balance on completion).                             |
| IN-06 | P1       | Tap-to-pay on iPhone        | Via Stripe Terminal SDK. Requires Stripe Terminal entitlement.                            |

### 4.4 Jobs & CRM

| ID    | Priority | Feature          | Acceptance criteria                                                                   |
| ----- | -------- | ---------------- | ------------------------------------------------------------------------------------- |
| JB-01 | P0       | Jobs list        | Sortable by date, status, customer. Search by customer or job name.                   |
| JB-02 | P0       | Status workflow  | `todo` → `scheduled` → `in_progress` → `completed` → `paid`. `cancelled` as terminal. |
| JB-03 | P0       | Job detail       | Timeline, notes, photos, attached contract, attached invoice.                         |
| JB-04 | P0       | Customer memory  | Name, address, phone, email, notes, tags. Auto-populates in New Quote.                |
| JB-05 | P0       | Customer profile | Lifetime value, last job date, repeat badge, full job history.                        |
| JB-06 | P1       | CRM CSV export   | Settings → Export. CSV download of all customers. Included in Pro.                    |
| JB-07 | P1       | Customer tags    | Free-form (e.g. `commercial`, `repeat`, `net-30`). Filterable.                        |

### 4.5 Calendar & Scheduling

| ID    | Priority | Feature              | Acceptance criteria                                             |
| ----- | -------- | -------------------- | --------------------------------------------------------------- |
| CL-01 | P0       | Calendar tab         | Month view + day detail. Jobs appear as gold pills.             |
| CL-02 | P0       | Drag-to-schedule     | Drag a job to a date in the day view to schedule.               |
| CL-03 | P0       | Availability blocks  | Mark days/windows as unavailable.                               |
| CL-04 | P0       | Travel buffer        | Configurable default (15/30/60 min) auto-added around jobs.     |
| CL-05 | P0       | Job reminders        | Push 30 min before. SMS to customer 1 hr before (configurable). |
| CL-06 | P1       | Native calendar sync | Two-way sync with iOS/Android default calendar.                 |

### 4.6 Contracts & E-Sign

| ID    | Priority | Feature                | Acceptance criteria                                                          |
| ----- | -------- | ---------------------- | ---------------------------------------------------------------------------- |
| CN-01 | P0       | Work contract template | State-specific scope, price, timeline, warranty. Generated with every quote. |
| CN-02 | P0       | Release of liability   | State-specific waiver. Optional, togglable per quote.                        |
| CN-03 | P0       | Edit-before-send       | User edits any 2 lines inline. Larger edits → full markdown editor.          |
| CN-04 | P0       | Customer e-sign        | Customer taps link → views → draws signature → submits.                      |
| CN-05 | P0       | Signature storage      | SVG + timestamp + IP persisted. Row becomes immutable on sign.               |
| CN-06 | P1       | Contract versioning    | Edits after sign create a new version with its own signature.                |

### 4.7 App paused / lapsed subscription

| ID    | Priority | Feature            | Acceptance criteria                                                                      |
| ----- | -------- | ------------------ | ---------------------------------------------------------------------------------------- |
| AP-01 | P0       | App paused screen  | Shown when `subscriptions.status != 'active'`. Locks all writes. Shows re-subscribe CTA. |
| AP-02 | P0       | Read-only fallback | Customer and job data stays readable so user can finish in-progress work.                |

---

## 5. Non-Functional Requirements

| Area          | Requirement                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| Performance   | Every screen loads <1s P95. AI quote P50 ≤20s, P95 ≤60s.                                                    |
| Offline       | Mobile: create quotes, edit customers, mark jobs complete offline. Sync on reconnect with last-write-wins.  |
| Security      | Encrypted PII (pgcrypto on phone + email). RLS on every table. Biometric login. Signed contracts immutable. |
| Accessibility | WCAG 2.1 AA. 18 pt minimum body. 60 pt minimum touch targets. VoiceOver + TalkBack labels.                  |
| Localization  | English (US) only at launch. i18n-ready — no hard-coded copy outside `lib/strings.ts`.                      |
| Compliance    | GDPR and CCPA ready. User data export + delete from Settings.                                               |
| Scalability   | 10,000 MAU without infra changes.                                                                           |

---

## 6. Technical Architecture

See `CLAUDE.md` §2 for the canonical stack and §7 for the DB schema.

### 6.1 Project folder structure

```
/
├── app/                          # Expo Router routes (see CLAUDE.md §5)
├── components/
│   ├── ui/                       # buttons, inputs, cards
│   ├── quote/                    # quote form, line items editor
│   ├── contract/                 # signature canvas, markdown renderer
│   └── crm/                      # customer card, lifetime value widget
├── features/
│   ├── auth/
│   ├── quotes/
│   ├── contracts/
│   ├── invoices/
│   ├── jobs/
│   ├── customers/
│   └── calendar/
├── lib/
│   ├── supabase.ts
│   ├── revenuecat.ts
│   ├── ai.ts                     # client for the Edge Functions (not the API key)
│   ├── stripe.ts
│   └── strings.ts                # locked copy (CLAUDE.md §8)
├── supabase/
│   ├── migrations/               # timestamped SQL
│   └── functions/
│       ├── generate-quote/
│       ├── generate-contract/
│       ├── revenuecat-webhook/
│       └── stripe-webhook/
├── assets/
├── .env.example
├── app.json
├── eas.json
└── CLAUDE.md, PRD.md, README.md
```

---

## 7. Launch Milestones

| Milestone                    | Scope                                                                                    | Target  |
| ---------------------------- | ---------------------------------------------------------------------------------------- | ------- |
| **M0 — Bootstrapped**        | Repo init, `.env.local`, Supabase project, basic auth, splash + welcome + paywall routes | Week 1  |
| **M1 — Quote core loop**     | New Quote FAB → AI generation → send → customer signs → invoice generated                | Week 4  |
| **M2 — Jobs + CRM**          | Jobs list, job detail, customers tab, customer profile, CSV export                       | Week 6  |
| **M3 — Calendar + payments** | Calendar tab with drag-to-schedule, Stripe Connect onboarding, Request Payment flow      | Week 8  |
| **M4 — Web target enabled**  | Same Expo codebase, responsive layouts, Stripe web subscription                          | Week 12 |
| **M5 — Polish + App Store**  | Subscription lifecycle, biometric login, accessibility audit, Sentry triage              | Week 14 |

---

## 8. Risks & Mitigations

| Risk                                                 | Severity | Mitigation                                                                                                                                                |
| ---------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI generates wrong state-specific contract           | High     | Legal review of each state template. Disclaimer. User edits before send. Start with 5 states; expand by demand.                                           |
| $9.99 below sustainable CAC for paid ads             | High     | Organic first (SEO + creator partnerships + in-trades referrals). Hold paid spend until LTV is measured.                                                  |
| AI latency breaks the 60s promise on mobile networks | Medium   | Edge Function streams partial output. Background generation with push notif fallback. Persist partial state.                                              |
| Solo operators won't pay $9.99 without trying free   | Medium   | 7-day free trial with card-on-file. Framing: "no free tier because we don't sell your customers." A/B paywall copy.                                       |
| Supabase RLS misconfig leaks data cross-tenant       | Critical | RLS mandatory. Automated test: `select count(*) from <t>` as user B against user A's data must return 0. CI blocks merges adding tables without policies. |
| HandyQuoter ships a feature we don't have            | Medium   | Weekly competitive audit in `docs/competitive/`. New P0 features go through the PRD process.                                                              |
| State contract templates go stale                    | Medium   | Annual legal review scheduled. Version each template.                                                                                                     |

---

## 9. Open Questions

1. Which 5 states ship at launch for contract templates? (TX, CA, FL, NY + 5th TBD — recommend NC based on contractor density.)
2. Do we support multi-user / crew accounts in M5, or defer to v2?
3. iPhone Tap-to-Pay in M3 or M5?
4. Native calendar two-way sync or read-only for launch?
5. Do we gate CSV export to annual subscribers only? (Currently included in both.)

**Resolved:**

- Single paid tier at $9.99/mo, $99.99/yr.
- CRM in scope.
- Web app as M4+ milestone on same codebase.
- Primary competitor is HandyQuoter; Jobber / Housecall Pro / ServiceTitan are secondary.
