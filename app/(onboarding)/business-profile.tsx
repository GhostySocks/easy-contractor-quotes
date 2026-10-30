import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Input } from '@/components/ui/Input';
import { LogoPicker } from '@/components/ui/LogoPicker';
import { OnboardingFrame } from '@/components/ui/OnboardingFrame';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useOnboardingDraft } from '@/lib/onboarding-store';
import { promptForPhotos } from '@/lib/photos';
import { strings } from '@/lib/strings';
import { spacing } from '@/lib/theme';

export default function BusinessProfile() {
  const name = useOnboardingDraft((s) => s.business_name);
  const state = useOnboardingDraft((s) => s.state_code);
  const logo = useOnboardingDraft((s) => s.logo_local);
  const setName = useOnboardingDraft((s) => s.setBusinessName);
  const setState = useOnboardingDraft((s) => s.setStateCode);
  const setLogo = useOnboardingDraft((s) => s.setLogoLocal);

  async function pickLogo() {
    const [picked] = await promptForPhotos(1, 'Add your logo');
    if (picked) setLogo(picked);
  }

  const canContinue = name.trim().length > 0 && state.length === 2;

  return (
    <OnboardingFrame
      progress={0.6}
      stepLabel="Step 3 of 5"
      title={strings.businessProfile.title}
      subtitle={strings.businessProfile.subtitle}
      footer={
        <PrimaryButton
          label={strings.businessProfile.cta}
          disabled={!canContinue}
          onPress={() => router.push('/(onboarding)/walkthrough')}
        />
      }
    >
      <View style={styles.form}>
        <Input
          label={strings.businessProfile.nameLabel}
          placeholder={strings.businessProfile.namePlaceholder}
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Input
          label={strings.businessProfile.stateLabel}
          placeholder={strings.businessProfile.statePlaceholder}
          value={state}
          onChangeText={setState}
          autoCapitalize="characters"
          maxLength={2}
          returnKeyType="done"
        />
        <LogoPicker
          imageUri={logo?.uri ?? null}
          onPick={() => void pickLogo()}
          onRemove={() => setLogo(null)}
        />
      </View>
    </OnboardingFrame>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
  },
});
