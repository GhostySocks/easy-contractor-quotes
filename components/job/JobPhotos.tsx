import { Image } from 'expo-image';
import { Camera, Trash2, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-store';
import { MAX_JOB_PHOTOS } from '@/lib/photo-math';
import { deleteJobPhotos, promptForPhotos, signedPhotoUrls, uploadJobPhoto } from '@/lib/photos';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  paths: string[];
  /** Persist the new list of storage paths. Resolves false if the save failed. */
  onChange: (paths: string[]) => Promise<boolean>;
};

const TILE = 96;

/**
 * Job photos: thumbnails from private storage, tap for full screen, add more
 * from camera or library, delete from the full-screen view.
 */
export function JobPhotos({ paths, onChange }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(0);
  const [viewing, setViewing] = useState<string | null>(null);

  useEffect(() => {
    const missing = paths.filter((p) => !urls[p]);
    if (missing.length === 0) return;
    void signedPhotoUrls(missing).then((signed) => setUrls((prev) => ({ ...prev, ...signed })));
  }, [paths, urls]);

  async function handleAdd() {
    if (!user) return;
    const picked = await promptForPhotos(MAX_JOB_PHOTOS - paths.length);
    if (picked.length === 0) return;
    setUploading((n) => n + picked.length);
    const added: string[] = [];
    await Promise.all(
      picked.map(async (p) => {
        try {
          added.push(await uploadJobPhoto(p, user.id));
        } catch (err) {
          console.warn('[job-photos] upload failed', err);
        } finally {
          setUploading((n) => n - 1);
        }
      }),
    );
    if (added.length === 0) {
      Alert.alert("Couldn't upload", 'Check your connection and try again.');
      return;
    }
    const ok = await onChange([...paths, ...added]);
    if (!ok) void deleteJobPhotos(added);
  }

  function handleDelete(path: string) {
    Alert.alert('Delete this photo?', 'It will be removed from the job.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setViewing(null);
          const ok = await onChange(paths.filter((p) => p !== path));
          if (ok) void deleteJobPhotos([path]);
        },
      },
    ]);
  }

  const canAdd = paths.length + uploading < MAX_JOB_PHOTOS;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Photos</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {paths.map((path, i) => (
          <Pressable
            key={path}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Photo ${i + 1} of ${paths.length}. Open full screen`}
            onPress={() => setViewing(path)}
            style={styles.tile}
          >
            {urls[path] ? (
              <Image source={{ uri: urls[path] }} style={styles.image} contentFit="cover" />
            ) : (
              <View style={styles.placeholder}>
                <ActivityIndicator color={colors.gold} />
              </View>
            )}
          </Pressable>
        ))}
        {Array.from({ length: uploading }).map((_, i) => (
          <View key={`up-${i}`} style={[styles.tile, styles.placeholder]}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ))}
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo to this job"
            onPress={() => void handleAdd()}
            style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.pressed]}
          >
            <Camera size={24} color={colors.goldDark} strokeWidth={2} />
            <Text style={styles.addLabel}>Add</Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Modal
        visible={viewing !== null}
        animationType="fade"
        onRequestClose={() => setViewing(null)}
        statusBarTranslucent
      >
        <SafeAreaView style={styles.viewer} edges={['top', 'bottom']}>
          <View style={styles.viewerBar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close photo"
              onPress={() => setViewing(null)}
              hitSlop={12}
              style={styles.viewerButton}
            >
              <X size={24} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
            {viewing ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete photo"
                onPress={() => handleDelete(viewing)}
                hitSlop={12}
                style={styles.viewerButton}
              >
                <Trash2 size={22} color="#FFFFFF" strokeWidth={2} />
              </Pressable>
            ) : null}
          </View>
          {viewing && urls[viewing] ? (
            <Image
              source={{ uri: urls[viewing] }}
              style={styles.viewerImage}
              contentFit="contain"
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    row: {
      gap: spacing.sm,
    },
    tile: {
      width: TILE,
      height: TILE,
      borderRadius: radii.md,
      overflow: 'hidden',
      backgroundColor: colors.surface,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    addTile: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.gold,
    },
    addLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
    pressed: {
      opacity: 0.7,
    },
    // The viewer is always black regardless of theme, like a camera roll.
    viewer: {
      flex: 1,
      backgroundColor: '#000000',
    },
    viewerBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    viewerButton: {
      width: 48,
      height: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
    viewerImage: {
      flex: 1,
    },
  });
