import { X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  atDayAndMinutes,
  DEFAULT_START_MINUTES,
  formatSlot,
  minutesOf,
  nearestSlot,
  TIME_SLOTS,
} from '@/lib/schedule-time';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  visible: boolean;
  title: string;
  /** Currently selected moment, if any; the calendar opens on its day and time. */
  currentIso: string | null;
  /** Earliest pickable day, as YYYY-MM-DD. */
  minDate?: string;
  onClose: () => void;
  /** Receives the chosen day and start time as an ISO timestamp. */
  onPick: (iso: string) => void;
  /** When set, shows a destructive action under the picker (e.g. "Clear date"). */
  clearLabel?: string;
  onClear?: () => void;
};

const SLOT_WIDTH = 96;

/** Bottom sheet: month calendar, a row of start times, and a confirm button. */
export function DateSheet({
  visible,
  title,
  currentIso,
  minDate,
  onClose,
  onPick,
  clearLabel,
  onClear,
}: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [day, setDay] = useState(() => isoDay(currentIso ? new Date(currentIso) : new Date()));
  const [minutes, setMinutes] = useState(() =>
    currentIso ? nearestSlot(minutesOf(currentIso)) : DEFAULT_START_MINUTES,
  );
  const timeScroll = useRef<ScrollView>(null);

  // Re-seed from the current value each time the sheet opens, and bring the
  // selected time into view.
  useEffect(() => {
    if (!visible) return;
    const start = currentIso ? nearestSlot(minutesOf(currentIso)) : DEFAULT_START_MINUTES;
    setDay(isoDay(currentIso ? new Date(currentIso) : new Date()));
    setMinutes(start);
    const index = Math.max(0, TIME_SLOTS.indexOf(start) - 1);
    setTimeout(
      () => timeScroll.current?.scrollTo({ x: index * (SLOT_WIDTH + spacing.sm), animated: false }),
      0,
    );
  }, [visible, currentIso]);

  const tooEarly = minDate !== undefined && day < minDate;

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
                <Text style={styles.title}>{title}</Text>
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
              <Calendar
                current={day}
                minDate={minDate}
                onDayPress={(d: DateData) => setDay(d.dateString)}
                markedDates={{
                  [day]: {
                    selected: true,
                    selectedColor: colors.ink,
                    selectedTextColor: colors.gold,
                  },
                }}
                firstDay={0}
                theme={{
                  backgroundColor: colors.surface,
                  calendarBackground: colors.surface,
                  selectedDayBackgroundColor: colors.selection,
                  selectedDayTextColor: colors.gold,
                  todayTextColor: colors.goldDark,
                  arrowColor: colors.ink,
                  monthTextColor: colors.ink,
                  dayTextColor: colors.ink,
                  textDisabledColor: colors.ink3,
                  textMonthFontWeight: '800' as const,
                }}
              />

              <Text style={styles.timeLabel}>START TIME</Text>
              <ScrollView
                ref={timeScroll}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.timeRow}
              >
                {TIME_SLOTS.map((slot) => {
                  const selected = slot === minutes;
                  return (
                    <Pressable
                      key={slot}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={formatSlot(slot)}
                      onPress={() => setMinutes(slot)}
                      style={[styles.slot, selected && styles.slotSelected]}
                    >
                      <Text style={[styles.slotLabel, selected && styles.slotLabelSelected]}>
                        {formatSlot(slot)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.actions}>
                <PrimaryButton
                  label={`Set ${formatShortDay(day)} · ${formatSlot(minutes)}`}
                  disabled={tooEarly}
                  onPress={() => onPick(atDayAndMinutes(day, minutes))}
                />
                {clearLabel && onClear ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={clearLabel}
                    onPress={onClear}
                    style={({ pressed }) => [styles.clear, pressed && styles.clearPressed]}
                  >
                    <Text style={styles.clearLabel}>{clearLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

/** Local calendar day as YYYY-MM-DD. */
export function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatShortDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '92%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxxl,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.md,
    },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
      color: colors.ink,
    },
    close: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    timeLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.8,
      color: colors.ink3,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    timeRow: {
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
    },
    slot: {
      width: SLOT_WIDTH,
      minHeight: typography.minTouchTarget,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    slotSelected: {
      backgroundColor: colors.goldTint,
      borderColor: colors.gold,
    },
    slotLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
      fontVariant: ['tabular-nums'],
    },
    slotLabelSelected: {
      color: colors.ink,
    },
    actions: {
      gap: spacing.md,
      paddingHorizontal: spacing.xl,
      marginTop: spacing.lg,
    },
    clear: {
      minHeight: 60,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    clearPressed: { opacity: 0.7 },
    clearLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.danger,
    },
  });
