import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { Alert, Linking } from 'react-native';

import {
  LOGO_LONG_EDGE,
  logoPath,
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

/**
 * Ask camera or library with one prompt and return the picked photos. Shows
 * the "turn access on in Settings" alert when permission is denied.
 */
export function promptForPhotos(remaining: number, title = 'Add a photo'): Promise<PickedPhoto[]> {
  return new Promise((resolve) => {
    const run = (source: PhotoSource) =>
      void pickPhotos(source, remaining, () =>
        Alert.alert(
          source === 'camera' ? 'Camera access is off' : 'Photo access is off',
          'Turn it on in Settings to attach photos.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        ),
      ).then(resolve);
    Alert.alert(title, undefined, [
      { text: 'Take photo', onPress: () => run('camera') },
      { text: 'Choose from library', onPress: () => run('library') },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}

/** Business logo: resized to 512 px, kept as PNG for transparency. Returns the storage path. */
export async function uploadLogo(photo: PickedPhoto, userId: string): Promise<string> {
  const context = ImageManipulator.manipulate(photo.uri);
  const resize = resizeTarget(photo.width, photo.height, LOGO_LONG_EDGE);
  if (resize) context.resize(resize);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.PNG });

  const bytes = await new File(saved.uri).bytes();
  const path = logoPath(userId, newPhotoId());
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, bytes, {
    contentType: 'image/png',
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

/**
 * Short-lived URLs for displaying private photos. Keyed by path; a path that
 * fails to sign is left out.
 */
export async function signedPhotoUrls(
  paths: string[],
  expiresInSeconds = 60 * 60,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, expiresInSeconds);
  if (error || !data) {
    console.warn('[photos] sign failed', error?.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const row of data) {
    if (row.path && row.signedUrl && !row.error) out[row.path] = row.signedUrl;
  }
  return out;
}

/** Best-effort delete; a leftover file is harmless and invisible to others. */
export async function deleteJobPhotos(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) console.warn('[photos] delete failed', error.message);
}
