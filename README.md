# Easy Contractor Quotes

Mobile-first quoting app for solo handymen and small crews. Quote any job in 60 seconds with AI, send it, get it signed, get paid — without touching a desktop.

> **Tagline:** Quote. Schedule. Get Paid. Done.

## Status

Android internal test builds are in use (EAS `internal` profile, shared by link). Working end to end:

- **Quoting:** AI quotes (Claude Haiku with validation, Sonnet fallback) from a description, job type, start date and up to 4 photos; price ranges, tax from the business profile, drafts, Quote again.
- **Contracts:** work agreement or release of liability from templates, customer e-sign by link or in person, write-once once signed, amendments as new versions.
- **Jobs:** created on signing, scheduling with start times, photos, notes, history, cancel / reopen, reminders, add to phone calendar.
- **Invoices and payments:** invoice on completion, edit to actuals, share as PDF, mark paid, Payments screen with 7-day overdue.
- **CRM:** customers tab with tags, profiles, edit screen, contact details remembered from use, CSV export.
- **App:** onboarding with logo, dark mode by default, Face ID / fingerprint unlock, read-only browsing while a subscription is paused.

Not built yet: Stripe payments, RevenueCat purchases (testers use the internal-build bypass), email delivery (needs a Resend key), server-side write blocking for lapsed subscriptions, PII encryption, offline quoting, iOS builds, web. The punch list tracks the order.

## Source of truth

- [`CLAUDE.md`](./CLAUDE.md) — operating manual (tech stack, security rules, design tokens, route map, DB schema, locked copy, model-recommendation rule)
- [`PRD.md`](./PRD.md) — product requirements

If the two conflict: CLAUDE.md wins on implementation, PRD.md wins on scope.

## Prerequisites

- Node 20+ (tested on Node 24)
- npm 10+
- An Expo account (for EAS builds) and the linked Supabase project
- Android: Android Studio + an emulator, or a phone with an internal APK
- iOS: Xcode + iOS Simulator (macOS only)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in values
npx expo start
```

Press `a` for Android, `i` for iOS, `w` for web. Native modules (photos, location, notifications, PDF, biometrics) need a development or internal build rather than Expo Go.

## Builds

```bash
npx eas build --platform android --profile internal   # tester APK, shared by link
```

The `internal` profile sets `EXPO_PUBLIC_APP_VARIANT=internal`, which lets testers past the paywall without RevenueCat. Store builds use the `production` profile and never honor the bypass.

## Backend changes

```bash
npx supabase db push --linked                  # apply new migrations
npx supabase functions deploy <name>           # deploy an edge function
```

## Scripts

| Command             | Purpose                      |
| ------------------- | ---------------------------- |
| `npm start`         | Launch the Expo dev server   |
| `npm run android`   | Launch Android emulator      |
| `npm run ios`       | Launch iOS simulator         |
| `npm run web`       | Launch web preview           |
| `npm test`          | Run Jest unit tests          |
| `npm run lint`      | Run ESLint                   |
| `npm run typecheck` | Run `tsc --noEmit`           |
| `npm run format`    | Run Prettier on source files |

## Project layout

```
app/                   Expo Router routes (see CLAUDE.md §5)
components/            Shared UI (ui/, quote/, job/, contract/)
lib/                   Data layer, pure logic (unit-tested), theme, strings
supabase/
  migrations/          Timestamped SQL with RLS policies
  functions/           Edge Functions (ai-quote, ai-contract, signing, sending, webhooks)
  functions/_shared/   Prompts, contract templates, validation shared with tests
assets/                App icon, splash, brand logos
```

## Security posture

- No API keys in the client bundle. The client only ever sees `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Every Postgres table has RLS enabled on `auth.uid() = user_id`; job photos and logos live in a private bucket with owner-only storage policies.
- Subscription entitlement (`pro_access`) is server-validated via RevenueCat webhook into the `subscriptions` table. The webhook requires its secret.
- Signed contracts are write-once. `contracts.signed_at` rows are made immutable by trigger; amendments are new versions.
- Biometric unlock is on by default after sign-in.
