/**
 * Pure helpers for job photos (no native imports, so they're unit-tested).
 * See lib/photos.ts for picking, resizing and uploading. Bucket name, the
 * per-quote limit and path sanitizing are shared with the edge functions.
 */
export {
  MAX_PHOTOS,
  PHOTO_BUCKET,
  sanitizePhotoPaths,
} from '../supabase/functions/_shared/photo-paths';

/** Long edge after resizing. ~1,400 Claude image tokens; ~150–250 KB as JPEG. */
export const PHOTO_LONG_EDGE = 1024;
export const PHOTO_JPEG_QUALITY = 0.7;

/**
 * The resize to apply so the long edge is at most `maxEdge`, keeping aspect
 * ratio. Returns null when the image is already small enough.
 */
export function resizeTarget(
  width: number,
  height: number,
  maxEdge = PHOTO_LONG_EDGE,
): { width: number } | { height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  if (Math.max(width, height) <= maxEdge) return null;
  return width >= height ? { width: maxEdge } : { height: maxEdge };
}

/** Storage path. The first folder must be the user's id (storage policies check it). */
export function photoPath(userId: string, fileId: string): string {
  return `${userId}/${fileId}.jpg`;
}

export function newPhotoId(now = Date.now(), rand = Math.random): string {
  return `${now.toString(36)}-${rand().toString(36).slice(2, 10)}`;
}
