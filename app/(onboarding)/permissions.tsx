import { router } from 'expo-router';
import { Bell, Calendar, MapPin, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { strings } from '@/lib/strings';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Row = {
  key: 'location' | 'notifications' | 'calendar';
  Icon: LucideIcon;
  title: string;
  body: string;
  defaultOn: boolean;
};

const rows: Row[] = [
  {
    key: 'location',
    Icon: MapPin,
    title: strings.permissions.location.title,
    body: strings.permissions.location.body,
    defaultOn: true,
  },
  {
    key: 'notifications',
    Icon: Bell,
    title: strings.permissions.notifications.title,
    body: strings.permissions.notifications.body,
    defaultOn: true,
  },
  {
    key: 'calendar',
    Icon: Calendar,
    title: strings.permissions.calendar.title,
    body: strings.permissions.calendar.body,
    defaultOn: false,
  },
];

/**
 * Design handoff §4.6: don't pre-request any OS permissions on mount. Call the
 * expo-location / expo-notifications / expo-calendar APIs only when the user
 * flips each toggle. For M1a the toggles only update local state; the actual
 * native prompts will be wired up in M1b once we need location auto-fill.
 */
export default function Permissions() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [state, setState] = useState<Record<Row['key'], boolean>>({
    location: true,
    notifications: true,
    calendar: false,
  });

  return (
    <OnboardingFrame
      progress={1.0}
      stepLabel="Step 5 of 5"
      title={strings.permissions.title}
      subtitle={strings.permissions.subtitle}
      footer={
        <PrimaryButton
          label={strings.permissions.cta}
          onPress={() => router.push('/(auth)/sign-up')}
        />
      }
    >
      <View style={styles.list}>
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            <View style={styles.iconBadge}>
              <row.Icon size={22} color={colors.goldDark} strokeWidth={2} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle}>{row.title}</Text>
              <Text style={styles.rowSub}>{row.body}</Text>
            </View>
            <Switch
              value={state[row.key]}
              onValueChange={(value) => setState((prev) => ({ ...prev, [row.key]: value }))}
              accessibilityLabel={`${row.title} toggle`}
              trackColor={{ false: colors.divider, true: colors.gold }}
            />
          </View>
        ))}
      </View>
    </OnboardingFrame>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    list: {
      gap: spacing.md,
      paddingTop: spacing.xl,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.surface,
      borderColor: colors.divider,
      borderWidth: 1,
      borderRadius: radii.lg,
      padding: spacing.lg,
    },
    iconBadge: {
      width: 40,
      height: 40,
      borderRadius: radii.md,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      fontSize: typography.sizes.h3,
      fontWeight: '700',
      color: colors.ink,
    },
    rowSub: {
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
  });
