import { LocateFixed } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text } from 'react-native';

import { currentStateCode } from '@/lib/location';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

/** "Use my location" link under a State field: fills in the state the phone is in. */
export function StateFromLocation({ onState }: { onState: (code: string) => void }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  async function detect() {
    setBusy(true);
    try {
      const result = await currentStateCode();
      if (result.kind === 'ok') onState(result.code);
      else if (result.kind === 'denied') {
        Alert.alert('Location access is off', 'Turn it on in Settings, or type your state.', [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ]);
      } else {
        Alert.alert("Couldn't tell which state you're in", 'Type the 2-letter code instead.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Fill in my state from my location"
      onPress={() => void detect()}
      disabled={busy}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}
    >
      <LocateFixed size={18} color={colors.goldDark} strokeWidth={2} />
      <Text style={styles.label}>{busy ? 'Finding your state…' : 'Use my location'}</Text>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    link: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: typography.minTouchTarget,
      marginTop: -spacing.md,
    },
    pressed: { opacity: 0.7 },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
  });
