/**
 * All user-visible text flows through this file so the app is i18n-ready from
 * day one (English-only at launch).
 *
 * Keys under `strings.locked` match CLAUDE.md §8 and MUST NOT be edited
 * without explicit human sign-off. Other keys are pulled from the design
 * handoff and can be updated with normal product review.
 */

export const strings = {
  app: {
    tagline: 'Quote. Schedule. Get Paid. Done.',
  },

  // CLAUDE.md §8 — locked copy. Do not edit without sign-off.
  locked: {
    ctaNewQuote: 'New Quote',
    ctaSendQuote: 'Send Quote',
    ctaRequestPayment: 'Request Payment',
    ctaSignNow: 'Sign now',
    paywallHeadline: 'Built for contractors who actually work.',
    paywallPriceLine: '$9.99 / month. 7-day free trial. Cancel anytime.',
    paywallTrustLine: 'No free tier, no ads, no selling your customers.',
    emptyJobs: 'Tap the gold button to quote your first job in 60 seconds.',
    errorAiTimeout: "Quote is taking a moment. We'll finish it in the background and let you know.",
  },

  // Design handoff §4 copy — quoted in mockups but not in CLAUDE.md §8.
  welcome: {
    hero: 'Quote any job in 60 seconds.',
    sub: 'Stop losing evenings to paperwork. Our AI writes the quote, the contract, and the invoice.',
    cta: 'Get started',
    alreadyHaveAccount: 'I already have an account',
  },

  goals: {
    title: 'What do you do?',
    subtitle: 'We tune pricing benchmarks to your trade.',
    trades: {
      handyman: 'Handyman',
      plumber: 'Plumbing',
      electrician: 'Electrical',
      hvac: 'HVAC',
      landscaping: 'Landscaping',
      other: 'Other',
    },
    cta: 'Continue',
  },

  businessProfile: {
    title: 'Your business',
    subtitle: 'State selection unlocks region-specific contract clauses.',
    nameLabel: 'Business name',
    namePlaceholder: 'Martinez Home Services',
    stateLabel: 'State',
    statePlaceholder: '2-letter code',
    cta: 'Continue',
  },

  walkthrough: {
    steps: [
      {
        title: 'One button. One quote.',
        body: 'Tap the gold button. AI does the rest.',
      },
      {
        title: 'Every job in one place.',
        body: 'Signed quotes become jobs. Schedule them, add photos and notes.',
      },
      {
        title: 'Finish the job, get paid.',
        body: 'Mark it done and the invoice is ready to send.',
      },
    ],
    next: 'Next',
    cta: 'Got it',
    skip: 'Skip',
  },

  permissions: {
    title: 'A couple of permissions',
    subtitle: 'We only ask for what we need to save you taps.',
    location: {
      title: 'Location',
      body: 'Auto-fill the job address from where you are parked.',
    },
    notifications: {
      title: 'Notifications',
      body: 'Heads-up 30 minutes before each job.',
    },
    calendar: {
      title: 'Calendar',
      body: 'Mirror jobs into your phone calendar.',
    },
    cta: 'Finish setup',
  },

  paywall: {
    hero: 'Start quoting like a pro.',
    priceLine: '$9.99/month · After 7-day free trial',
    trustLine: 'We never sell your leads. Cancel anytime.',
    cta: 'Start 7-day trial',
    restore: 'Restore purchases',
    features: [
      'AI quotes in seconds',
      'Unlimited jobs',
      'State-specific legal contracts',
      'Invoices + Stripe payments',
      'Customer CRM with CSV export',
    ],
  },

  appPaused: {
    pill: 'Subscription expired',
    title: 'Your Pro access is paused.',
    body: 'Your data is safe. Re-subscribe to keep quoting.',
    cta: 'Resume Pro',
    export: 'Export my data first',
    support: 'support@inexile.co',
  },

  auth: {
    signIn: {
      title: 'Sign in',
      subtitle: 'Welcome back.',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      cta: 'Sign in',
      toSignUp: 'Need an account?',
    },
    signUp: {
      title: 'Create your account',
      subtitle: 'One account. One login. One sub.',
      emailLabel: 'Email',
      passwordLabel: 'Password',
      cta: 'Continue',
      toSignIn: 'Already have one?',
    },
  },
} as const;

export type Strings = typeof strings;
