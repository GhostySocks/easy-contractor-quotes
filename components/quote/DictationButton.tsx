import { Mic, Square } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { appendDictation, dictationErrorMessage } from '@/lib/dictation';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type SpeechModule = typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule;
type Subscription = { remove: () => void };

/**
 * The native module isn't in Expo Go, so it's loaded on first use and the
 * button hides itself when it's missing (same approach as lib/revenuecat.ts).
 */
let cached: SpeechModule | null | undefined;
function speech(): SpeechModule | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('expo-speech-recognition').ExpoSpeechRecognitionModule as SpeechModule;
  } catch {
    cached = null;
  }
  return cached;
}

type Props = {
  /** Current text of the field; dictation is appended to it, never replacing it. */
  value: string;
  onChange: (text: string) => void;
  /** Lets the screen lock the text box while listening, so typing and talking don't fight. */
  onListeningChange?: (listening: boolean) => void;
  disabled?: boolean;
};

/**
 * Talk instead of type, for the New Quote job description. Uses the phone's
 * own speech recognition (free, no server). Words appear live while speaking
 * and are added after whatever is already typed. Tap again to stop.
 */
export function DictationButton({ value, onChange, onListeningChange, disabled }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [listening, setListening] = useState(false);
  const base = useRef('');
  const subs = useRef<Subscription[]>([]);
  const module = speech();

  const setListen = useCallback(
    (on: boolean) => {
      setListening(on);
      onListeningChange?.(on);
    },
    [onListeningChange],
  );

  const detach = useCallback(() => {
    for (const s of subs.current) s.remove();
    subs.current = [];
  }, []);

  // Stop listening if the screen goes away mid-sentence.
  useEffect(
    () => () => {
      detach();
      speech()?.abort();
    },
    [detach],
  );

  if (!module) return null;

  async function start() {
    if (!module) return;
    if (!module.isRecognitionAvailable()) {
      Alert.alert(
        "Speech recognition isn't available",
        "This phone doesn't have a speech service turned on. You can still use your keyboard's mic.",
      );
      return;
    }
    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone access is off', 'Turn it on in Settings to talk instead of type.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
      return;
    }

    base.current = value;
    detach();
    subs.current = [
      module.addListener('result', (e) => {
        const spoken = e.results[0]?.transcript ?? '';
        if (e.isFinal) {
          base.current = appendDictation(base.current, spoken);
          onChange(base.current);
        } else {
          onChange(appendDictation(base.current, spoken));
        }
      }),
      module.addListener('error', (e) => {
        const message = dictationErrorMessage(e.error);
        if (message) Alert.alert("Didn't catch that", message);
      }),
      module.addListener('end', () => {
        detach();
        setListen(false);
      }),
    ];

    module.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      addsPunctuation: true,
    });
    setListen(true);
  }

  function stop() {
    module?.stop();
  }

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop talking' : 'Talk to describe the job'}
        accessibilityState={{ busy: listening }}
        onPress={() => (listening ? stop() : void start())}
        disabled={disabled}
        style={({ pressed }) => [
          styles.button,
          listening && styles.buttonListening,
          pressed && styles.pressed,
          disabled && styles.disabled,
        ]}
      >
        {listening ? (
          <Square size={18} color={colors.onGold} fill={colors.onGold} strokeWidth={2} />
        ) : (
          <Mic size={20} color={colors.goldDark} strokeWidth={2} />
        )}
        <Text style={[styles.label, listening && styles.labelListening]}>
          {listening ? 'Listening… tap to stop' : 'Talk instead of type'}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      marginTop: -spacing.sm,
    },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: typography.minTouchTarget,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: colors.surface,
    },
    buttonListening: {
      backgroundColor: colors.gold,
      borderColor: colors.gold,
    },
    pressed: { opacity: 0.8 },
    disabled: { opacity: 0.5 },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
    labelListening: {
      color: colors.onGold,
    },
  });
