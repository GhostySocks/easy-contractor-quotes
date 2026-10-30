import { Image } from 'expo-image';
import { ImagePlus } from 'lucide-react-native';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  /** Local file uri or signed URL to show; null shows the empty state. */
  imageUri: string | null;
  busy?: boolean;
  onPick: () => void;
  onRemove?: () => void;
};

const SIZE = 96;

/** Square logo tile with change / remove actions. Picking is the caller's job. */
export function LogoPicker({ imageUri, busy, onPick, onRemove }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={imageUri ? 'Change business logo' : 'Add business logo'}
        onPress={onPick}
        disabled={busy}
        style={({ pressed }) => [styles.tile, !imageUri && styles.empty, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator color={colors.gold} />
        ) : imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" />
        ) : (
          <ImagePlus size={26} color={colors.goldDark} strokeWidth={2} />
        )}
      </Pressable>
      <View style={styles.text}>
        <Text style={styles.label}>Logo</Text>
        <Text style={styles.hint}>
          {imageUri
            ? 'Shown on your quotes and invoices.'
            : 'Optional. Shown on your quotes and invoices.'}
        </Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={onPick} disabled={busy} hitSlop={8}>
            <Text style={styles.action}>{imageUri ? 'Change' : 'Add logo'}</Text>
          </Pressable>
          {imageUri && onRemove ? (
            <Pressable accessibilityRole="button" onPress={onRemove} disabled={busy} hitSlop={8}>
              <Text style={[styles.action, styles.remove]}>Remove</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.lg,
    },
    tile: {
      width: SIZE,
      height: SIZE,
      borderRadius: radii.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    empty: {
      borderStyle: 'dashed',
      borderColor: colors.gold,
    },
    pressed: {
      opacity: 0.7,
    },
    image: {
      width: '86%',
      height: '86%',
    },
    text: {
      flex: 1,
      gap: 2,
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    hint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.lg,
      marginTop: spacing.xs,
    },
    action: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.goldDark,
      paddingVertical: spacing.xs,
    },
    remove: {
      color: colors.danger,
    },
  });
