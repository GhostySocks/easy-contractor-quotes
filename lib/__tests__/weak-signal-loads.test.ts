import { usableCachedSubscription } from '../subscription-cache';

// Every Supabase query resolves to a network failure.
jest.mock('../supabase', () => {
  const failed = { data: null, count: null, error: { message: 'Network request failed' } };
  const query: unknown = new Proxy(function () {}, {
    get: (_t, prop) =>
      prop === 'then' ? (resolve: (v: unknown) => void) => resolve(failed) : () => query,
  });
  return { supabase: { from: () => query } };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { listActiveJobs, listAllJobs, listJobsByDateRange } = require('../jobs');
const { listCustomers } = require('../customers');
const { fetchUnpaidSummary, listInvoices } = require('../invoices');
const { fetchUnsignedContractCount } = require('../contracts');
const { listDraftQuotes } = require('../quotes');
const { listBlocks } = require('../availability');
const { fetchProfile, loadProfile } = require('../profile');
/* eslint-enable @typescript-eslint/no-require-imports */

describe('a failed load is not an empty list', () => {
  it.each([
    ['listActiveJobs', () => listActiveJobs()],
    ['listAllJobs', () => listAllJobs()],
    ['listJobsByDateRange', () => listJobsByDateRange('a', 'b')],
    ['listCustomers', () => listCustomers()],
    ['listInvoices', () => listInvoices()],
    ['fetchUnpaidSummary', () => fetchUnpaidSummary()],
    ['fetchUnsignedContractCount', () => fetchUnsignedContractCount()],
    ['listDraftQuotes', () => listDraftQuotes()],
    ['listBlocks', () => listBlocks('a', 'b')],
    ['loadProfile', () => loadProfile('u1')],
  ])('%s rejects', async (_name, run) => {
    await expect(run()).rejects.toThrow('Network request failed');
  });

  it('fetchProfile still returns null for callers that treat a profile as optional', async () => {
    await expect(fetchProfile('u1')).resolves.toBeNull();
  });
});

describe('usableCachedSubscription', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  const row = (status: string, current_period_end: string | null) =>
    ({ status, current_period_end }) as never;

  it('trusts an active or grace status within its period', () => {
    expect(usableCachedSubscription(row('active', '2026-11-20T00:00:00Z'), now)).not.toBeNull();
    expect(usableCachedSubscription(row('in_grace', '2026-11-20T00:00:00Z'), now)).not.toBeNull();
    expect(usableCachedSubscription(row('active', null), now)).not.toBeNull();
  });

  it('allows a week past the period for a renewal it has not heard about', () => {
    expect(usableCachedSubscription(row('active', '2026-11-01T00:00:00Z'), now)).not.toBeNull();
    expect(usableCachedSubscription(row('active', '2026-10-20T00:00:00Z'), now)).toBeNull();
  });

  it('never revives a lapsed subscription, or nothing at all', () => {
    expect(usableCachedSubscription(row('expired', '2026-11-20T00:00:00Z'), now)).toBeNull();
    expect(usableCachedSubscription(row('cancelled', null), now)).toBeNull();
    expect(usableCachedSubscription(null, now)).toBeNull();
  });
});
