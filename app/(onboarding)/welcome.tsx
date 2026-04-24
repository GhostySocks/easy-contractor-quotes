import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { strings } from '@/lib/strings';
import { colors, spacing, typography } from '@/lib/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.body}>
        <Text style={styles.eyebrow}>Step 1 of 5</Text>
        <Text style={styles.hero}>
          Quote any job in <Text style={styles.heroAccent}>60 seconds</Text>.
        </Text>
        <Text style={styles.sub}>{strings.welcome.sub}</Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton
          label={strings.welcome.cta}
          onPress={() => router.push('/(onboarding)/goals')}
        />
        <Pressable
          accessibilityRole="link"
          style={styles.link}
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text style={styles.linkLabel}>{strings.welcome.alreadyHaveAccount}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface2,
    paddingHorizontal: spacing.xl,
  },
  body: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
  },
  eyebrow: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.ink3,
  },
  hero: {
    fontSize: 36,
    lineHeight: 44,
    fontWeight: '800',
    color: colors.ink,
  },
  heroAccent: {
    color: colors.gold,
  },
  sub: {
    fontSize: typography.sizes.body,
    lineHeight: 26,
    color: colors.ink2,
  },
  footer: {
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  link: {
    alignItems: 'center',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkLabel: {
    color: colors.ink2,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '600',
  },
});
