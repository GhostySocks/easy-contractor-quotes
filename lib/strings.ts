/**
 * Locked copy strings per CLAUDE.md §8.
 * Do not change any string in this file without human sign-off.
 * All user-visible text in the app must route through this table so the app
 * is i18n-ready from day one (English-only at launch).
 */

export const strings = {
  app: {
    tagline: 'Quote. Schedule. Get Paid. Done.',
  },
  cta: {
    newQuote: 'New Quote',
    sendQuote: 'Send Quote',
    requestPayment: 'Request Payment',
    signNow: 'Sign now',
  },
  paywall: {
    headline: 'Built for contractors who actually work.',
    priceLine: '$9.99 / month. 7-day free trial. Cancel anytime.',
    trustLine: 'No free tier, no ads, no selling your customers.',
  },
  empty: {
    jobs: 'Tap the gold button to quote your first job in 60 seconds.',
  },
  error: {
    aiTimeout: "Quote is taking a moment. We'll finish it in the background and let you know.",
  },
} as const;

export type Strings = typeof strings;
