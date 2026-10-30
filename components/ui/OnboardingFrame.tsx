import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

import { ProgressBar } from './ProgressBar';

type Props = {
  progress: number;
  stepLabel?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
};

/**
 * Shared chrome for the 5 onboarding steps — progress bar at top, title,
 * subtitle, content, and a CTA footer anchored above the home indicator.
 */
export function OnboardingFrame({ progress, stepLabel, title, subtitle, children, footer }: Props) {
  const styles = useStyles(makeStyles);
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <ProgressBar value={progress} />
        {stepLabel ? <Text style={styles.stepLabel}>{stepLabel}</Text> : null}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          <View style={styles.flex}>{children}</View>
        </View>

        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface2,
    },
    flex: {
      flex: 1,
    },
    header: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    stepLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    body: {
      flex: 1,
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      gap: spacing.md,
    },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h1,
      color: colors.ink,
    },
    subtitle: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.md,
    },
  });
