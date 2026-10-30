import { X } from 'lucide-react-native';
import { Modal, Pressable, StyleSheet, Text, TouchableWithoutFeedback, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Props = {
  visible: boolean;
  title: string;
  /** Currently selected moment, if any; the calendar opens on its day. */
  currentIso: string | null;
  /** Earliest pickable day, as YYYY-MM-DD. */
  minDate?: string;
  onClose: () => void;
  /** Receives the picked day as YYYY-MM-DD. */
  onPick: (day: string) => void;
  /** When set, shows a destructive action under the calendar (e.g. "Clear date"). */
  clearLabel?: string;
  onClear?: () => void;
};

/** Bottom sheet with a month calendar. Same look as the job scheduler. */
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
  const currentDay = isoDay(currentIso ? new Date(currentIso) : new Date());

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
                current={currentDay}
                minDate={minDate}
                onDayPress={(d: DateData) => onPick(d.dateString)}
                markedDates={
                  currentIso
                    ? {
                        [currentDay]: {
                          selected: true,
                          selectedColor: colors.ink,
                          selectedTextColor: colors.gold,
                        },
                      }
                    : undefined
                }
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

/** 9:00 AM local on the given YYYY-MM-DD, as an ISO timestamp (the app's default start time). */
export function morningOf(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 9, 0, 0).toISOString();
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: colors.scrim,
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '85%',
      backgroundColor: colors.surface,
      borderTopLeftRadius: radii.xl,
      borderTopRightRadius: radii.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.huge,
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
    clear: {
      marginHorizontal: spacing.xl,
      marginTop: spacing.md,
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
