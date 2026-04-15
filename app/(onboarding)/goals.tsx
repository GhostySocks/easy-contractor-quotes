import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useOnboardingDraft, type TradeCode } from '@/lib/onboarding-store';
import { strings } from '@/lib/strings';
import { spacing } from '@/lib/theme';

const trades: TradeCode[] = ['handyman', 'plumber', 'electrician', 'hvac', 'landscaping', 'other'];

export default function Goals() {
  const selected = useOnboardingDraft((s) => s.trade);
  const setTrade = useOnboardingDraft((s) => s.setTrade);

  return (
    <OnboardingFrame
      progress={0.4}
      stepLabel="Step 2 of 5"
      title={strings.goals.title}
      subtitle={strings.goals.subtitle}
      footer={
        <PrimaryButton
          label={strings.goals.cta}
          disabled={!selected}
          onPress={() => router.push('/(onboarding)/business-profile')}
        />
      }
    >
      <View style={styles.grid}>
        {trades.map((trade) => (
          <Chip
            key={trade}
            label={strings.goals.trades[trade]}
            selected={selected === trade}
            onPress={() => setTrade(trade)}
            style={styles.gridItem}
          />
        ))}
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.xl,
  },
  gridItem: {
    flexBasis: '48%',
    paddingVertical: spacing.lg,
  },
});
