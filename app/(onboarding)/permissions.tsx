import { router } from 'expo-router';
import { Bell, Calendar, MapPin, type LucideIcon } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking, StyleSheet, Switch, Text, View } from 'react-native';

import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { toggleAction } from '@/lib/permission-toggle';
import { askPermission, checkPermission, type PermissionKey } from '@/lib/permissions';
import { strings } from '@/lib/strings';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

type Row = {
  key: PermissionKey;
  Icon: LucideIcon;
  title: string;
  body: string;
};

const rows: Row[] = [
  {
    key: 'location',
    Icon: MapPin,
    title: strings.permissions.location.title,
    body: strings.permissions.location.body,
  },
  {
    key: 'notifications',
    Icon: Bell,
    title: strings.permissions.notifications.title,
    body: strings.permissions.notifications.body,
  },
  {
    key: 'calendar',
    Icon: Calendar,
    title: strings.permissions.calendar.title,
    body: strings.permissions.calendar.body,
  },
];

/**
 * Design handoff §4.6: don't pre-request any OS permissions on mount. The phone
 * prompts only when the user flips a toggle, and each toggle shows what the
 * phone actually allows, so they start off unless already granted.
 */
export default function Permissions() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [state, setState] = useState<Record<PermissionKey, boolean>>({
    location: false,
    notifications: false,
    calendar: false,
  });

  const refresh = useCallback(() => {
    for (const { key } of rows) {
      void checkPermission(key).then(({ granted }) =>
        setState((prev) => ({ ...prev, [key]: granted })),
      );
    }
  }, []);

  // On open, and on coming back from the phone's Settings.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  async function handleToggle(row: Row, turningOn: boolean) {
    const current = await checkPermission(row.key);
    if (toggleAction(turningOn, current) === 'ask') {
      const { granted } = await askPermission(row.key);
      setState((prev) => ({ ...prev, [row.key]: granted }));
      return;
    }
    setState((prev) => ({ ...prev, [row.key]: current.granted }));
    Alert.alert(row.title, "You can change this in your phone's Settings.", [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]);
  }

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
              onValueChange={(value) => void handleToggle(row, value)}
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
      fontFamily: typography.fonts.display,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    rowSub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
  });
