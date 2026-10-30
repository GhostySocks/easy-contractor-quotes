import { router } from 'expo-router';
import {
  Briefcase,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  BellRing,
  Fingerprint,
  LogOut,
  Moon,
  Smartphone,
  Sparkles,
  Sun,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/lib/auth-store';
import { useBiometricPref } from '@/lib/biometric-lock';
import { syncJobReminders, useReminderPref } from '@/lib/notifications';
import { exportCustomersCSV } from '@/lib/customers-export';
import { supabase } from '@/lib/supabase';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';
import type { ThemeMode } from '@/lib/theme-store';

const APPEARANCE_OPTIONS: { mode: ThemeMode; label: string; sub: string; Icon: LucideIcon }[] = [
  { mode: 'dark', label: 'Dark', sub: 'Deep black with gold. Easiest on the eyes.', Icon: Moon },
  { mode: 'light', label: 'Light', sub: 'Bright surfaces for full sun.', Icon: Sun },
  { mode: 'system', label: 'System', sub: 'Match your phone’s setting.', Icon: Smartphone },
];

export default function Settings() {
  const styles = useStyles(makeStyles);
  const { colors, mode, setMode } = useTheme();
  const user = useAuth((s) => s.user);
  const [exporting, setExporting] = useState(false);
  const biometricOn = useBiometricPref((s) => s.enabled);
  const setBiometricOn = useBiometricPref((s) => s.setEnabled);
  const remindersOn = useReminderPref((s) => s.enabled);
  const setRemindersOn = useReminderPref((s) => s.setEnabled);

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    const result = await exportCustomersCSV();
    setExporting(false);

    if (result.status === 'unsupported') {
      Alert.alert(
        'Sharing not available',
        "This device can't open the share sheet. Try again from your phone.",
      );
    } else if (result.status === 'error') {
      Alert.alert('Export failed', result.message);
    }
    // 'shared' and 'cancelled' both fall through silently — the share sheet
    // is its own feedback.
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/(onboarding)/welcome');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <BackButton />

        <View style={styles.titleBlock}>
          <Text style={styles.title}>Settings</Text>
          {user?.email ? <Text style={styles.subtitle}>{user.email}</Text> : null}
        </View>

        <Section title="Your business">
          <Row
            icon={<Briefcase size={20} color={colors.goldDark} strokeWidth={2} />}
            label="Business profile"
            sub="Name, logo, state, trade"
            onPress={() => router.push('/settings/business')}
          />
        </Section>

        <Section title="Appearance">
          {APPEARANCE_OPTIONS.map((option) => (
            <OptionRow
              key={option.mode}
              icon={<option.Icon size={20} color={colors.goldDark} strokeWidth={2} />}
              label={option.label}
              sub={option.sub}
              selected={mode === option.mode}
              onPress={() => setMode(option.mode)}
            />
          ))}
        </Section>

        <Section title="Notifications">
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <BellRing size={20} color={colors.goldDark} strokeWidth={2} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Job reminders</Text>
              <Text style={styles.rowSub}>A notification an hour before each scheduled job.</Text>
            </View>
            <Switch
              value={remindersOn}
              onValueChange={(on) => {
                setRemindersOn(on);
                // Turning off clears scheduled reminders now; turning on
                // reschedules them the next time Home is shown.
                if (!on) void syncJobReminders([]);
              }}
              trackColor={{ true: colors.gold, false: colors.divider }}
              thumbColor={colors.surface}
              accessibilityLabel="Job reminders"
            />
          </View>
        </Section>

        <Section title="Security">
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <Fingerprint size={20} color={colors.goldDark} strokeWidth={2} />
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowLabel}>Unlock with Face ID or fingerprint</Text>
              <Text style={styles.rowSub}>Asks when you open the app and after a minute away.</Text>
            </View>
            <Switch
              value={biometricOn}
              onValueChange={setBiometricOn}
              trackColor={{ true: colors.gold, false: colors.divider }}
              thumbColor={colors.surface}
              accessibilityLabel="Unlock with Face ID or fingerprint"
            />
          </View>
        </Section>

        <Section title="Money">
          <Row
            icon={<CreditCard size={20} color={colors.goldDark} strokeWidth={2} />}
            label="Payments"
            sub="Stripe Connect for accepting customer payments"
            onPress={() => router.push('/settings/payments')}
          />
          <Row
            icon={<Sparkles size={20} color={colors.goldDark} strokeWidth={2} />}
            label="Subscription"
            sub="Manage Pro plan"
            onPress={() => router.push('/settings/subscription')}
          />
        </Section>

        <Section title="Data">
          <Row
            icon={<Download size={20} color={colors.goldDark} strokeWidth={2} />}
            label={exporting ? 'Preparing CSV…' : 'Export customers'}
            sub="Download every customer as a CSV"
            onPress={handleExport}
            disabled={exporting}
          />
        </Section>

        <Section title="Account">
          <Row
            icon={<LogOut size={20} color={colors.danger} strokeWidth={2} />}
            label="Sign out"
            destructive
            onPress={handleSignOut}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function BackButton() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      onPress={() => router.back()}
      style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
      hitSlop={12}
    >
      <ChevronLeft size={22} color={colors.ink} strokeWidth={2.5} />
      <Text style={styles.backLabel}>Back</Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title.toUpperCase()}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  sub,
  onPress,
  disabled,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {onPress && !destructive ? (
        <ChevronRight size={18} color={colors.ink3} strokeWidth={2} />
      ) : null}
    </Pressable>
  );
}

/**
 * Radio-style row for mutually exclusive choices (Appearance). Same 60pt
 * target as `Row`; the active option gets a gold check and a gold-tint icon.
 */
function OptionRow({
  icon,
  label,
  sub,
  selected,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected, checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, selected && styles.rowIconSelected]}>{icon}</View>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <View style={styles.check}>
        {selected ? <Check size={22} color={colors.gold} strokeWidth={3} /> : null}
      </View>
    </Pressable>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface2,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.huge,
      gap: spacing.xl,
    },
    back: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      marginLeft: -spacing.xs,
      minHeight: 44,
    },
    backPressed: {
      opacity: 0.6,
    },
    backLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
      marginLeft: 2,
    },
    titleBlock: {
      gap: spacing.xs,
    },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.display,
      color: colors.ink,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    section: {
      gap: spacing.sm,
    },
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 0.8,
      color: colors.ink3,
      paddingHorizontal: spacing.sm,
    },
    sectionCard: {
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.divider,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      minHeight: typography.minTouchTarget,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    rowPressed: {
      backgroundColor: colors.surface2,
    },
    rowDisabled: {
      opacity: 0.5,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: radii.sm,
      backgroundColor: colors.goldTint,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowIconSelected: {
      borderWidth: 1,
      borderColor: colors.gold,
    },
    rowBody: {
      flex: 1,
      gap: 2,
    },
    rowLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    rowLabelDestructive: {
      color: colors.danger,
    },
    rowSub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    check: {
      width: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
