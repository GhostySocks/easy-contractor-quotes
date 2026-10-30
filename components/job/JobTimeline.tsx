import { StyleSheet, Text, View } from 'react-native';

import type { TimelineEvent } from '@/lib/job-timeline';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

const DOT = 12;

/** Vertical list of what happened on a job, oldest first, current step in gold. */
export function JobTimeline({ events }: { events: TimelineEvent[] }) {
  const styles = useStyles(makeStyles);
  if (events.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>History</Text>
      <View>
        {events.map((e, i) => {
          const last = i === events.length - 1;
          const upcoming = e.at !== null && Date.parse(e.at) > Date.now();
          return (
            <View key={e.key} style={styles.row}>
              <View style={styles.rail}>
                <View
                  style={[
                    styles.dot,
                    e.current && styles.dotCurrent,
                    upcoming && styles.dotUpcoming,
                  ]}
                />
                {!last ? <View style={styles.line} /> : null}
              </View>
              <View style={styles.body}>
                <Text style={[styles.title, e.current && styles.titleCurrent]}>{e.label}</Text>
                {e.at ? <Text style={styles.when}>{formatWhen(e.at)}</Text> : null}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
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
      flexDirection: 'row',
      gap: spacing.md,
    },
    rail: {
      width: DOT,
      alignItems: 'center',
    },
    dot: {
      width: DOT,
      height: DOT,
      borderRadius: DOT / 2,
      backgroundColor: colors.ink3,
      marginTop: 5,
    },
    dotCurrent: {
      backgroundColor: colors.gold,
    },
    dotUpcoming: {
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderColor: colors.ink3,
    },
    line: {
      flex: 1,
      width: 2,
      backgroundColor: colors.divider,
      marginVertical: 2,
    },
    body: {
      flex: 1,
      paddingBottom: spacing.md,
      gap: 2,
    },
    title: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink2,
    },
    titleCurrent: {
      color: colors.ink,
    },
    when: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
  });
