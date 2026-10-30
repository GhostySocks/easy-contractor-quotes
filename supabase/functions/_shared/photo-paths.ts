/**
 * Job photo storage rules shared by the edge functions and the app
 * (lib/photo-math.ts re-exports these). No imports, so it bundles on both
 * Deno and Metro.
 */

export const MAX_PHOTOS = 4;
export const PHOTO_BUCKET = 'job-photos';

/** Photos a client may attach: strings in the caller's own folder, at most MAX_PHOTOS. */
export function sanitizePhotoPaths(paths: unknown, userId: string): string[] {
  if (!Array.isArray(paths)) return [];
  const prefix = `${userId}/`;
  return paths
    .filter(
      (p): p is string =>
        typeof p === 'string' && p.startsWith(prefix) && !p.includes('..') && p.length < 200,
    )
    .slice(0, MAX_PHOTOS);
}
