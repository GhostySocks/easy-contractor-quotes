import { Image } from 'expo-image';
import { Camera, X } from 'lucide-react-native';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MAX_PHOTOS } from '@/lib/photo-math';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export type StripPhoto = {
  /** Local file uri, shown as the thumbnail. */
  uri: string;
  /** Storage path once uploaded; null while uploading. */
  path: string | null;
  failed?: boolean;
};

type Props = {
  photos: StripPhoto[];
  onAdd: () => void;
  onRemove: (index: number) => void;
};

const TILE = 88;

/** Horizontal row of job photo thumbnails with an add tile, up to MAX_PHOTOS. */
export function PhotoStrip({ photos, onAdd, onRemove }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const canAdd = photos.length < MAX_PHOTOS;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>
        Photos <Text style={styles.optional}>(optional, up to {MAX_PHOTOS})</Text>
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {photos.map((p, i) => (
          <View key={p.uri} style={styles.tile}>
            <Image source={{ uri: p.uri }} style={styles.image} contentFit="cover" />
            {p.path === null && !p.failed ? (
              <View style={styles.overlay}>
                <ActivityIndicator color={colors.gold} />
              </View>
            ) : null}
            {p.failed ? (
              <View style={[styles.overlay, styles.failedOverlay]}>
                <Text style={styles.failedLabel}>Upload failed</Text>
              </View>
            ) : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              onPress={() => onRemove(i)}
              hitSlop={10}
              style={styles.remove}
            >
              <X size={14} color={colors.surface} strokeWidth={3} />
            </Pressable>
          </View>
        ))}
        {canAdd ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add a photo"
            onPress={onAdd}
            style={({ pressed }) => [styles.tile, styles.addTile, pressed && styles.pressed]}
          >
            <Camera size={24} color={colors.goldDark} strokeWidth={2} />
            <Text style={styles.addLabel}>Add</Text>
          </Pressable>
        ) : null}
      </ScrollView>
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
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    optional: {
      fontFamily: typography.fonts.body,
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
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
    },
    failedOverlay: {
      padding: spacing.xs,
    },
    failedLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      color: colors.surface,
      textAlign: 'center',
    },
    remove: {
      position: 'absolute',
      top: spacing.xs,
      right: spacing.xs,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.scrim,
      alignItems: 'center',
      justifyContent: 'center',
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
  });
