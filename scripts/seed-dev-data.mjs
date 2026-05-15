/**
 * Seed dev customers, jobs, quotes, and invoices for the dev user so the
 * Home, Jobs, Calendar, and Customers tabs all have realistic content.
 *
 * Idempotent: every seeded row is tagged with the marker '__seed__' (customers
 * via tags[], jobs via a notes prefix, quotes/invoices via FK to seeded jobs).
 * Re-running wipes the prior seed for the dev user, then re-inserts.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-dev-data.mjs
 *
 * Optional env overrides:
 *   DEV_USER_EMAIL=...   (default: hello@inexile.co)
 */

import { createClient } from '@supabase/supabase-js';

const SEED_TAG = '__seed__';
const SEED_NOTES_PREFIX = '[seed] ';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
  process.exit(1);
}

const email = process.env.DEV_USER_EMAIL ?? 'hello@inexile.co';

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const user = await findUserByEmail(email);
if (!user) {
  console.error(`No auth user found for ${email}. Run scripts/seed-dev-user.mjs first.`);
  process.exit(1);
}

await wipePriorSeed(user.id);
const customers = await insertCustomers(user.id);
const jobs = await insertJobs(user.id, customers);
await insertAvailability(user.id, jobs);
const quotes = await insertQuotes(user.id, jobs);
const contracts = await insertContracts(user.id, jobs, quotes);
await insertInvoices(user.id, jobs, quotes);
await updateCustomerRollups(user.id, customers);

console.log('');
console.log('Dev data ready for', email);
console.log('  customers:', customers.length);
console.log('  jobs:     ', jobs.length);
console.log('  quotes:   ', quotes.length);
console.log('  contracts:', contracts.length);

// ---

async function findUserByEmail(email) {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      console.error('listUsers failed:', error);
      process.exit(1);
    }
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) return null;
    page += 1;
  }
  return null;
}

async function wipePriorSeed(userId) {
  // Delete in FK order: invoices -> quotes -> availability -> jobs -> customers.
  const { data: seedCustomers, error: cErr } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', userId)
    .contains('tags', [SEED_TAG]);
  if (cErr) die('listing seed customers', cErr);
  const customerIds = (seedCustomers ?? []).map((c) => c.id);

  const { data: seedJobs, error: jErr } = await admin
    .from('jobs')
    .select('id')
    .eq('user_id', userId)
    .like('notes', `${SEED_NOTES_PREFIX}%`);
  if (jErr) die('listing seed jobs', jErr);
  const jobIds = (seedJobs ?? []).map((j) => j.id);

  if (jobIds.length) {
    await del('invoices', admin.from('invoices').delete().eq('user_id', userId).in('job_id', jobIds));
    // Contracts: only unsigned ones can be deleted (RLS + trigger), but service
    // role bypasses RLS — the trigger only fires on UPDATE, not DELETE, so this
    // is safe for both signed and unsigned seed contracts.
    await del('contracts', admin.from('contracts').delete().eq('user_id', userId).in('job_id', jobIds));
    await del('quotes', admin.from('quotes').delete().eq('user_id', userId).in('job_id', jobIds));
    await del('availability', admin.from('availability').delete().eq('user_id', userId).in('job_id', jobIds));
    await del('jobs', admin.from('jobs').delete().eq('user_id', userId).in('id', jobIds));
  }
  if (customerIds.length) {
    await del('customers', admin.from('customers').delete().eq('user_id', userId).in('id', customerIds));
  }
}

async function del(label, query) {
  const { error } = await query;
  if (error) die(`deleting ${label}`, error);
}

async function insertCustomers(userId) {
  const rows = [
    {
      name: 'Sarah Chen',
      phone: '+15035551204',
      email: 'sarah.chen@example.com',
      address_line1: '418 SE Belmont St',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97214',
      notes: 'Prefers texts. Gate code 4421.',
      tags: [SEED_TAG, 'repeat'],
    },
    {
      name: 'Marcus Johnson',
      phone: '+15035552871',
      email: 'mjohnson@example.com',
      address_line1: '2210 NW Lovejoy St',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97210',
      notes: 'Pay on completion. Two dogs.',
      tags: [SEED_TAG, 'vip'],
    },
    {
      name: 'Diane Whitaker',
      phone: '+15035550944',
      email: 'diane.w@example.com',
      address_line1: '88 NE 28th Ave',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97232',
      notes: null,
      tags: [SEED_TAG],
    },
    {
      name: 'Hector Ruiz',
      phone: '+15035558820',
      email: 'hruiz.builds@example.com',
      address_line1: '5601 N Williams Ave',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97217',
      notes: 'Contractor referral. Always pays Net-7.',
      tags: [SEED_TAG, 'repeat'],
    },
    {
      name: 'Emily Park',
      phone: '+15035554019',
      email: 'emily.park@example.com',
      address_line1: '1145 SE Division St',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97202',
      notes: null,
      tags: [SEED_TAG],
    },
    {
      name: 'Frank DeLuca',
      phone: '+15035556677',
      email: 'fdeluca@example.com',
      address_line1: '914 SW Vista Ave',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97205',
      notes: 'Older home, watch for galvanized pipe.',
      tags: [SEED_TAG],
    },
    {
      name: 'Priya Patel',
      phone: '+15035553344',
      email: 'priya.patel@example.com',
      address_line1: '3320 NE Alameda St',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97212',
      notes: 'Referred by Sarah Chen.',
      tags: [SEED_TAG, 'repeat'],
    },
    {
      name: "Bobby O'Connor",
      phone: '+15035551122',
      email: 'bobby.oc@example.com',
      address_line1: '7244 SE Foster Rd',
      city: 'Portland',
      state_code: 'OR',
      postal_code: '97206',
      notes: null,
      tags: [SEED_TAG],
    },
  ].map((r) => ({ ...r, user_id: userId }));

  const { data, error } = await admin.from('customers').insert(rows).select();
  if (error) die('inserting customers', error);
  return data;
}

async function insertJobs(userId, customers) {
  const byName = Object.fromEntries(customers.map((c) => [c.name, c]));
  const now = Date.now();
  const days = (n) => new Date(now + n * 86400000).toISOString();
  const hours = (n) => new Date(now + n * 3600000).toISOString();

  const rows = [
    // Today / imminent — show up on Home
    {
      customer: 'Sarah Chen',
      title: 'Replace bathroom vanity + faucet',
      description: '36" vanity swap, hook up existing supply lines, new faucet.',
      status: 'scheduled',
      scheduled_at: hours(3),
      total_cents: 78500,
    },
    {
      customer: 'Marcus Johnson',
      title: 'Deck staining — back deck',
      description: '~240 sq ft pressure wash + semi-transparent stain.',
      status: 'scheduled',
      scheduled_at: hours(6),
      total_cents: 62000,
    },
    // Tomorrow + this week — upcoming
    {
      customer: 'Diane Whitaker',
      title: 'Kitchen sink + disposal install',
      description: 'Customer supplied sink. New 3/4 hp disposal. Reroute drain.',
      status: 'scheduled',
      scheduled_at: days(1),
      total_cents: 42000,
    },
    {
      customer: 'Hector Ruiz',
      title: 'Subfloor patch + LVP install — laundry room',
      description: '60 sq ft. Pull washer/dryer, patch, lay LVP.',
      status: 'scheduled',
      scheduled_at: days(2),
      total_cents: 91500,
    },
    {
      customer: 'Emily Park',
      title: 'Ceiling fan install — 2 bedrooms',
      description: 'Hardwire two fans, existing fixture boxes rated for fans.',
      status: 'scheduled',
      scheduled_at: days(4),
      total_cents: 38000,
    },
    {
      customer: 'Priya Patel',
      title: 'Front door weatherstripping + threshold',
      description: 'Full reseal, swap threshold, paint touch-up.',
      status: 'scheduled',
      scheduled_at: days(6),
      total_cents: 24500,
    },
    // In-progress — straddling today
    {
      customer: 'Frank DeLuca',
      title: 'Bathroom tile regrout — full',
      description: 'Day 2 of 3. Demo done, regrout walls + floor.',
      status: 'in_progress',
      scheduled_at: hours(-26),
      total_cents: 145000,
    },
    // Draft / todo (no schedule yet) — show in Library + Calendar unscheduled picker
    {
      customer: "Bobby O'Connor",
      title: 'Estimate: garage shelving build-out',
      description: '20 lf wall-mount shelving, customer to confirm scope.',
      status: 'todo',
      scheduled_at: null,
      total_cents: null,
    },
    {
      customer: 'Emily Park',
      title: 'Replace kitchen backsplash',
      description: '~22 sq ft subway tile. Customer picking material this week.',
      status: 'todo',
      scheduled_at: null,
      total_cents: 68000,
    },
    {
      customer: 'Diane Whitaker',
      title: 'Fix sagging gutter — north side',
      description: '~16 lf, replace hangers + reseal end caps.',
      status: 'todo',
      scheduled_at: null,
      total_cents: 21000,
    },
    {
      customer: 'Frank DeLuca',
      title: 'Estimate: replace water heater (50gal gas)',
      description: 'Walkthrough done, waiting on customer go-ahead.',
      status: 'todo',
      scheduled_at: null,
      total_cents: null,
    },
    {
      customer: 'Priya Patel',
      title: 'Patch + paint dining room ceiling',
      description: 'Old water-stain patch, two coats ceiling white.',
      status: 'todo',
      scheduled_at: null,
      total_cents: 34000,
    },
    // Recently completed / awaiting payment — drives "money pending"
    {
      customer: 'Sarah Chen',
      title: 'Quick fix — leaky kitchen faucet cartridge',
      description: 'Cartridge replacement + supply line swap.',
      status: 'completed',
      scheduled_at: days(-3),
      completed_at: days(-3),
      total_cents: 18500,
    },
    {
      customer: 'Hector Ruiz',
      title: 'Punch list: trim + caulk — upstairs hall',
      description: 'Finish carpentry for spec home. 12 lf trim, caulk + paint.',
      status: 'completed',
      scheduled_at: days(-5),
      completed_at: days(-5),
      total_cents: 56000,
    },
    // Old completed-but-unpaid → "overdue" counter on the money pending card
    {
      customer: 'Frank DeLuca',
      title: 'Replace exterior hose bibb + supply line',
      description: 'Frost-free bibb, copper supply, 3/4" sweat.',
      status: 'completed',
      scheduled_at: days(-42),
      completed_at: days(-41),
      total_cents: 32500,
    },
    // Paid — historical, drives customer lifetime value rollups
    {
      customer: 'Sarah Chen',
      title: 'Replace exterior porch light fixtures',
      description: 'Two fixtures, customer supplied.',
      status: 'paid',
      scheduled_at: days(-21),
      completed_at: days(-20),
      total_cents: 22000,
    },
    {
      customer: 'Marcus Johnson',
      title: 'Fence gate rebuild',
      description: '6 ft cedar gate, heavy-duty hinges + latch.',
      status: 'paid',
      scheduled_at: days(-34),
      completed_at: days(-33),
      total_cents: 48500,
    },
    {
      customer: 'Priya Patel',
      title: 'Pendant light install over island',
      description: 'Three pendants on existing circuit.',
      status: 'paid',
      scheduled_at: days(-48),
      completed_at: days(-47),
      total_cents: 31000,
    },
  ];

  const inserts = rows.map((r) => ({
    user_id: userId,
    customer_id: byName[r.customer]?.id ?? null,
    title: r.title,
    description: r.description,
    status: r.status,
    scheduled_at: r.scheduled_at,
    completed_at: r.completed_at ?? null,
    total_cents: r.total_cents,
    notes: `${SEED_NOTES_PREFIX}${r.customer}`,
  }));

  const { data, error } = await admin.from('jobs').insert(inserts).select();
  if (error) die('inserting jobs', error);
  return data;
}

async function insertAvailability(userId, jobs) {
  const blocks = jobs
    .filter((j) => j.scheduled_at && (j.status === 'scheduled' || j.status === 'in_progress'))
    .map((j) => {
      const starts = new Date(j.scheduled_at);
      const ends = new Date(starts.getTime() + 3 * 3600000);
      return {
        user_id: userId,
        job_id: j.id,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        kind: 'booked',
      };
    });
  if (!blocks.length) return;
  const { error } = await admin.from('availability').insert(blocks);
  if (error) die('inserting availability', error);
}

async function insertQuotes(userId, jobs) {
  // One quote per job that has a total. Match status to the job.
  const rows = jobs
    .filter((j) => j.total_cents != null)
    .map((j) => {
      const subtotal = j.total_cents;
      const tax = Math.round(subtotal * 0.0); // Oregon has no statewide sales tax
      const lineItems = [
        { description: 'Labor', qty: 1, unit_cents: Math.round(subtotal * 0.6) },
        { description: 'Materials', qty: 1, unit_cents: subtotal - Math.round(subtotal * 0.6) },
      ];
      let status = 'draft';
      let sent_at = null;
      let accepted_at = null;
      if (j.status === 'scheduled' || j.status === 'in_progress') {
        status = 'accepted';
        sent_at = new Date(new Date(j.scheduled_at).getTime() - 2 * 86400000).toISOString();
        accepted_at = new Date(new Date(j.scheduled_at).getTime() - 1 * 86400000).toISOString();
      } else if (j.status === 'completed' || j.status === 'paid') {
        status = 'accepted';
        sent_at = new Date(new Date(j.scheduled_at ?? j.created_at).getTime() - 2 * 86400000).toISOString();
        accepted_at = new Date(new Date(j.scheduled_at ?? j.created_at).getTime() - 1 * 86400000).toISOString();
      }
      return {
        user_id: userId,
        job_id: j.id,
        customer_id: j.customer_id,
        ai_generation_ms: 1800 + Math.floor(Math.random() * 1200),
        scope_of_work: j.description,
        line_items: lineItems,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: subtotal + tax,
        total_low_cents: Math.round(subtotal * 0.9),
        total_high_cents: Math.round(subtotal * 1.15),
        status,
        sent_at,
        accepted_at,
      };
    });

  if (!rows.length) return [];
  const { data, error } = await admin.from('quotes').insert(rows).select();
  if (error) die('inserting quotes', error);
  return data;
}

async function insertContracts(userId, jobs, quotes) {
  // Seed two unsigned contracts on the next-up scheduled jobs so the Home
  // money-pending card shows a non-zero "Unsigned" count.
  const quoteByJob = Object.fromEntries(quotes.map((q) => [q.job_id, q]));
  const targets = jobs
    .filter((j) => j.status === 'scheduled' && quoteByJob[j.id])
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))
    .slice(0, 2);

  if (!targets.length) return [];

  const rows = targets.map((j) => ({
    user_id: userId,
    job_id: j.id,
    customer_id: j.customer_id,
    // quote_id omitted — column may not exist yet on remote (M1c migration drift).
    kind: 'work',
    state_code: 'OR',
    body_markdown: `# Work Agreement\n\n${j.title}\n\nThis is a seed contract for development. Replace with a real e-signed contract before going to production.`,
    signed_at: null,
    version: 1,
  }));

  const { data, error } = await admin.from('contracts').insert(rows).select();
  if (error) die('inserting contracts', error);
  return data;
}

async function insertInvoices(userId, jobs, quotes) {
  const quoteByJob = Object.fromEntries(quotes.map((q) => [q.job_id, q]));
  const rows = [];

  for (const j of jobs) {
    if (j.status !== 'completed' && j.status !== 'paid') continue;
    const q = quoteByJob[j.id];
    if (!q) continue;
    const isPaid = j.status === 'paid';
    rows.push({
      user_id: userId,
      job_id: j.id,
      customer_id: j.customer_id,
      quote_id: q.id,
      line_items: q.line_items,
      subtotal_cents: q.subtotal_cents,
      tax_cents: q.tax_cents,
      total_cents: q.total_cents,
      status: isPaid ? 'paid' : 'unpaid',
      sent_at: j.completed_at,
      paid_at: isPaid ? j.completed_at : null,
    });
  }

  if (!rows.length) return;
  const { error } = await admin.from('invoices').insert(rows);
  if (error) die('inserting invoices', error);
}

async function updateCustomerRollups(userId, customers) {
  // Compute lifetime_value_cents (sum of paid invoices) and last_job_at per customer.
  for (const c of customers) {
    const { data: paidInvoices, error: iErr } = await admin
      .from('invoices')
      .select('total_cents')
      .eq('user_id', userId)
      .eq('customer_id', c.id)
      .eq('status', 'paid');
    if (iErr) die('reading paid invoices', iErr);

    const ltv = (paidInvoices ?? []).reduce((sum, r) => sum + (r.total_cents ?? 0), 0);

    const { data: lastJob, error: jErr } = await admin
      .from('jobs')
      .select('scheduled_at, completed_at, created_at')
      .eq('user_id', userId)
      .eq('customer_id', c.id)
      .order('created_at', { ascending: false })
      .limit(1);
    if (jErr) die('reading last job', jErr);

    const last = lastJob?.[0];
    const lastTs = last?.completed_at ?? last?.scheduled_at ?? last?.created_at ?? null;

    const { error: uErr } = await admin
      .from('customers')
      .update({ lifetime_value_cents: ltv, last_job_at: lastTs })
      .eq('id', c.id);
    if (uErr) die('updating customer rollup', uErr);
  }
}

function die(context, error) {
  console.error(`failed while ${context}:`, error);
  process.exit(1);
}
