import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { wholeDay } from '@/lib/schedule-conflicts';
import { atDayAndMinutes, formatSlot, TIME_SLOTS } from '@/lib/schedule-time';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const LENGTHS = [
  { minutes: 60, label: '1 hour' },
  { minutes: 120, label: '2 hours' },
  { minutes: 240, label: '4 hours' },
] as const;

type Props = {
  visible: boolean;
  /** YYYY-MM-DD */
  day: string;
  dayLabel: string;
  onClose: () => void;
  onSave: (startsAt: string, endsAt: string) => Promise<void>;
};

/** Block off a whole day or part of one (PRD CL-03). */
export function BlockTimeSheet({ visible, day, dayLabel, onClose, onSave }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [allDay, setAllDay] = useState(true);
  const [start, setStart] = useState(12 * 60);
  const [length, setLength] = useState<number>(120);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAllDay(true);
      setStart(12 * 60);
      setLength(120);
    }
  }, [visible]);

  async function save() {
    setSaving(true);
    try {
      if (allDay) {
        const range = wholeDay(day);
        await onSave(range.starts_at, range.ends_at);
      } else {
        const startsAt = atDayAndMinutes(day, start);
        const endsAt = new Date(Date.parse(startsAt) + length * 60_000).toISOString();
        await onSave(startsAt, endsAt);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>Block off time</Text>
                  <Text style={styles.sub}>{dayLabel}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Close"
                  onPress={onClose}
                  hitSlop={12}
                  style={styles.close}
                >
                  <X size={20} color={colors.ink2} strokeWidth={2} />
                </Pressable>
              </View>

              <View style={styles.body}>
                <View style={styles.row}>
                  <Chip label="All day" selected={allDay} onPress={() => setAllDay(true)} />
                  <Chip
                    label="Part of the day"
                    selected={!allDay}
                    onPress={() => setAllDay(false)}
                  />
                </View>

                {!allDay ? (
                  <>
                    <Text style={styles.label}>FROM</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.row}
                    >
                      {TIME_SLOTS.map((slot) => (
                        <Chip
                          key={slot}
                          label={formatSlot(slot)}
                          selected={slot === start}
                          onPress={() => setStart(slot)}
                        />
                      ))}
                    </ScrollView>
                    <Text style={styles.label}>FOR</Text>
                    <View style={styles.row}>
                      {LENGTHS.map((l) => (
                        <Chip
                          key={l.minutes}
                          label={l.label}
                          selected={length === l.minutes}
                          onPress={() => setLength(l.minutes)}
                        />
                      ))}
                    </View>
                  </>
                ) : null}

                <Text style={styles.hint}>
                  You&apos;ll get a warning if you schedule a job in blocked time.
                </Text>
                <PrimaryButton
                  label={saving ? 'Saving…' : 'Block this time'}
                  onPress={() => void save()}
                  loading={saving}
                  disabled={saving}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: colors.scrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    headerText: { gap: 2, flex: 1 },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
      color: colors.ink,
    },
    sub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    close: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: { paddingHorizontal: spacing.xl, gap: spacing.md },
    row: { flexDirection: 'row', flexWrap: 'nowrap', gap: spacing.sm },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.8,
      color: colors.ink3,
      marginTop: spacing.xs,
    },
    hint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
  });
