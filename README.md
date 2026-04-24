# Easy Contractor Quotes

Mobile-first quoting app for solo handymen and small crews. Quote any job in 60 seconds with AI, send it, get it signed, get paid — without touching a desktop.

> **Tagline:** Quote. Schedule. Get Paid. Done.

## Status

M0 — Bootstrap. Route tree and design tokens wired. No real features yet.

## Source of truth

- [`CLAUDE.md`](./CLAUDE.md) — operating manual (tech stack, security rules, design tokens, route map, DB schema, locked copy)
- [`PRD.md`](./PRD.md) — product requirements

If the two conflict: CLAUDE.md wins on implementation, PRD.md wins on scope.

## Prerequisites

- Node 20+ (tested on Node 24)
- npm 10+
- iOS: Xcode + iOS Simulator (macOS only for full native builds)
- Android: Android Studio + an emulator
- Supabase project (for M1+)

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in values
npx expo start
```

Press `i` for iOS simulator, `a` for Android emulator, `w` for web.

## Scripts

| Command             | Purpose                      |
| ------------------- | ---------------------------- |
| `npm start`         | Launch the Expo dev server   |
| `npm run ios`       | Launch iOS simulator         |
| `npm run android`   | Launch Android emulator      |
| `npm run web`       | Launch web preview           |
| `npm run lint`      | Run ESLint                   |
| `npm run typecheck` | Run `tsc --noEmit`           |
| `npm run format`    | Run Prettier on source files |

## Project layout

```
app/                   Expo Router routes (see CLAUDE.md §5)
components/            Shared UI primitives
features/              Feature-scoped code (quotes, jobs, customers, ...)
lib/                   Clients (supabase, revenuecat, ai, stripe) + theme + strings
supabase/
  migrations/          Timestamped SQL with RLS policies
  functions/           Edge Functions (ai-quote, ai-contract, webhooks)
assets/                Images, fonts
```

## Security posture

- No API keys in the client bundle. The client only ever sees `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Every Postgres table has RLS enabled on `auth.uid() = user_id`.
- Subscription entitlement (`pro_access`) is server-validated via RevenueCat webhook into the `subscriptions` table. The client SDK alone is never trusted.
- Signed contracts are write-once. `contracts.signed_at` rows are made immutable by trigger.
