/**
 * Seed a dev user + active subscription row.
 *
 * Runs with the service-role key so it can bypass RLS and call the admin
 * auth endpoints. The service-role key must be provided via .env.local —
 * never hardcoded.
 *
 * Usage:
 *   node --env-file=.env.local scripts/seed-dev-user.mjs
 *
 * Optional env overrides:
 *   DEV_USER_EMAIL=...     (default: hello@inexile.co)
 *   DEV_USER_PASSWORD=...  (default: a generated strong password, printed at the end)
 *
 * The script is idempotent: if the user already exists, its password is
 * reset and the subscription row is upserted with status = active.
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local');
  process.exit(1);
}

const email = process.env.DEV_USER_EMAIL ?? 'hello@inexile.co';
const password = process.env.DEV_USER_PASSWORD ?? generatePassword();

const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const user = await ensureUser(email, password);
await upsertSubscription(user.id);

console.log('');
console.log('Dev user ready.');
console.log('  email:    ', email);
console.log('  password: ', password);
console.log('  user_id:  ', user.id);
console.log('  sub:       active until', new Date(Date.now() + 30 * 86400000).toISOString());

// ---

async function ensureUser(email, password) {
  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (!error) {
    return created.user;
  }

  const msg = error.message.toLowerCase();
  const alreadyExists = msg.includes('already') || msg.includes('registered') || msg.includes('exists');
  if (!alreadyExists) {
    console.error('createUser failed:', error);
    process.exit(1);
  }

  const existing = await findUserByEmail(email);
  if (!existing) {
    console.error('user reportedly exists but could not be found by email');
    process.exit(1);
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updateError) {
    console.error('updateUser failed:', updateError);
    process.exit(1);
  }
  return existing;
}

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

async function upsertSubscription(userId) {
  const nowIso = new Date().toISOString();
  const thirtyDaysIso = new Date(Date.now() + 30 * 86400000).toISOString();
  const { error } = await admin.from('subscriptions').upsert(
    {
      user_id: userId,
      status: 'active',
      product_id: 'ecq_pro_monthly_999',
      platform: 'ios',
      current_period_end: thirtyDaysIso,
      trial_ends_at: null,
      updated_at: nowIso,
    },
    { onConflict: 'user_id' },
  );
  if (error) {
    console.error('subscription upsert failed:', error);
    process.exit(1);
  }
}

function generatePassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return 'ECQ-' + out + '!';
}
