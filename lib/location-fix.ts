/**
 * Whether a GPS fix is good enough to name the job's street address. Pure,
 * unit-tested; lib/location.ts uses it.
 *
 * A tester's "Use my location" filled in nearby houses, not the one he stood
 * at: it accepted a 2-minute-old fix good to 100 m. A house lot is ~20 m
 * wide, so anything looser lands on a neighbor.
 */

/** Wider than this and the reverse-geocoded address is likely a neighbor's. */
export const MAX_ADDRESS_ERROR_M = 35;
/** Older than this and the contractor may have moved since. */
export const MAX_FIX_AGE_MS = 20_000;

export type Fix = { accuracy: number | null; timestamp: number };

export function fixQuality(fix: Fix | null, nowMs: number): 'precise' | 'approximate' | 'stale' {
  if (!fix || nowMs - fix.timestamp > MAX_FIX_AGE_MS) return 'stale';
  if (fix.accuracy === null || fix.accuracy > MAX_ADDRESS_ERROR_M) return 'approximate';
  return 'precise';
}
