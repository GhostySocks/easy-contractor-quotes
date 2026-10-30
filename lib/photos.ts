import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import {
  newPhotoId,
  PHOTO_BUCKET,
  PHOTO_JPEG_QUALITY,
  photoPath,
  resizeTarget,
} from './photo-math';
import { supabase } from './supabase';

export type PhotoSource = 'camera' | 'library';

export type PickedPhoto = {
  uri: string;
  width: number;
  height: number;
};

/**
 * Open the camera or photo library. Returns [] if the user cancels or denies
 * permission; `onDenied` lets the caller explain how to turn access back on.
 */
export async function pickPhotos(
  source: PhotoSource,
  remaining: number,
  onDenied?: () => void,
): Promise<PickedPhoto[]> {
  if (remaining <= 0) return [];

  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    onDenied?.();
    return [];
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    // We compress ourselves after resizing; keep the source sharp.
    quality: 1,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync({
          ...options,
          allowsMultipleSelection: remaining > 1,
          selectionLimit: remaining,
        });
  if (result.canceled) return [];
  return result.assets
    .slice(0, remaining)
    .map((a) => ({ uri: a.uri, width: a.width, height: a.height }));
}

/**
 * Shrink to ~1024 px on the long edge, re-encode as JPEG, and upload to the
 * private job-photos bucket under the user's folder. Returns the storage path.
 */
export async function uploadJobPhoto(photo: PickedPhoto, userId: string): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const resize = resizeTarget(photo.width, photo.height);
  if (resize) context.resize(resize);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: SaveFormat.JPEG,
    compress: PHOTO_JPEG_QUALITY,
  });

  const bytes = await new File(saved.uri).bytes();
  const path = photoPath(userId, newPhotoId());
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/** Best-effort delete; a leftover file is harmless and invisible to others. */
export async function deleteJobPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) console.warn('[photos] delete failed', error.message);
}
