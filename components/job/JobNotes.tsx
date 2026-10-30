import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  initial: string | null;
  /** Persist the notes. Resolves false if the save failed. */
  onSave: (notes: string | null) => Promise<boolean>;
};

const DEBOUNCE_MS = 800;

/** Free-text notes on a job, autosaved shortly after typing stops. */
export function JobNotes({ initial, onSave }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [text, setText] = useState(initial ?? '');
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saved = useRef(initial ?? '');

  useEffect(() => {
    if (text === saved.current) return;
    const handle = setTimeout(async () => {
      setStatus('saving');
      const value = text.trim() ? text : null;
      const ok = await onSave(value);
      if (ok) {
        saved.current = text;
        setStatus('saved');
      } else {
        setStatus('error');
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [text, onSave]);

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.label}>Notes</Text>
        <Text style={[styles.status, status === 'error' && styles.error]}>
          {status === 'saving'
            ? 'Saving…'
            : status === 'saved'
              ? 'Saved'
              : status === 'error'
                ? "Couldn't save"
                : ''}
        </Text>
      </View>
      <TextInput
        value={text}
        onChangeText={setText}
        multiline
        placeholder="Gate code, parts to pick up, anything to remember…"
        placeholderTextColor={colors.ink3}
        style={styles.input}
        textAlignVertical="top"
        accessibilityLabel="Job notes"
      />
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    wrap: {
      gap: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    status: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.label,
      color: colors.ink3,
    },
    error: {
      color: colors.danger,
    },
    input: {
      minHeight: 110,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.ink,
      lineHeight: 24,
    },
  });
