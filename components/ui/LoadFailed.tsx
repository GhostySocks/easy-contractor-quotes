import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GhostButton } from '@/components/ui/GhostButton';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  /** What didn't load, as in "Couldn't load this quote." */
  what: string;
  onRetry: () => void;
};

/**
 * Full-screen state for a detail screen whose record didn't load. The usual
 * cause is signal on a job site, not a missing record, so it offers a retry
 * rather than saying "not found".
 */
export function LoadFailed({ what, onRetry }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => router.back()}
        style={styles.back}
        hitSlop={12}
      >
        <ChevronLeft size={22} color={colors.ink2} strokeWidth={2} />
      </Pressable>
      <View style={styles.center}>
        <Text style={styles.title}>Couldn&apos;t load this {what}</Text>
        <Text style={styles.body}>Check your signal and try again.</Text>
        <GhostButton label="Try again" onPress={onRetry} style={styles.retry} />
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    back: {
      width: 60,
      height: 60,
      alignItems: 'center',
      justifyContent: 'center',
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      padding: spacing.xl,
    },
    title: {
      fontFamily: typography.fonts.display,
      fontSize: typography.sizes.h3,
      color: colors.ink,
      textAlign: 'center',
    },
    body: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.ink2,
      textAlign: 'center',
    },
    retry: {
      marginTop: spacing.lg,
      alignSelf: 'stretch',
    },
  });
