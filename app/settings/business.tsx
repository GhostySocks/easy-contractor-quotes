import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { LogoPicker } from '@/components/ui/LogoPicker';
import { StateFromLocation } from '@/components/ui/StateFromLocation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { type TradeCode } from '@/lib/onboarding-store';
import { deleteJobPhotos, promptForPhotos, signedPhotoUrls, uploadLogo } from '@/lib/photos';
import { fetchProfile, updateProfile } from '@/lib/profile';
import { TRAVEL_BUFFER_OPTIONS } from '@/lib/schedule-conflicts';
import { strings } from '@/lib/strings';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const TRADES: TradeCode[] = ['handyman', 'plumber', 'electrician', 'hvac', 'landscaping', 'other'];

export default function BusinessSettings() {
  const styles = useStyles(makeStyles);
  const user = useAuth((s) => s.user);
  const [businessName, setBusinessName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [trade, setTrade] = useState<TradeCode | null>(null);
  const [taxRate, setTaxRate] = useState('');
  const [travelBuffer, setTravelBuffer] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetchProfile(user.id).then((profile) => {
      if (profile) {
        setBusinessName(profile.business_name);
        setStateCode(profile.state_code);
        setTrade((profile.trade as TradeCode | null) ?? null);
        setTaxRate(
          Number(profile.default_tax_rate ?? 0) > 0 ? String(profile.default_tax_rate) : '',
        );
        setTravelBuffer(profile.travel_buffer_minutes ?? 30);
        if (profile.logo_url) {
          setLogoPath(profile.logo_url);
          void signedPhotoUrls([profile.logo_url]).then((u) =>
            setLogoUri(u[profile.logo_url as string] ?? null),
          );
        }
      }
      setLoading(false);
    });
  }, [user]);

  // The logo saves on its own, immediately, separate from the Save button.
  async function handlePickLogo() {
    if (!user || logoBusy) return;
    const [picked] = await promptForPhotos(1, 'Business logo');
    if (!picked) return;
    setLogoBusy(true);
    try {
      const path = await uploadLogo(picked, user.id);
      const result = await updateProfile(user.id, { logo_url: path });
      if (!result.ok) {
        void deleteJobPhotos([path]);
        Alert.alert("Couldn't save logo", result.message);
        return;
      }
      if (logoPath) void deleteJobPhotos([logoPath]);
      setLogoPath(path);
      setLogoUri(picked.uri);
    } catch (err) {
      Alert.alert("Couldn't upload logo", err instanceof Error ? err.message : String(err));
    } finally {
      setLogoBusy(false);
    }
  }

  async function handleRemoveLogo() {
    if (!user || !logoPath || logoBusy) return;
    setLogoBusy(true);
    const result = await updateProfile(user.id, { logo_url: null });
    setLogoBusy(false);
    if (!result.ok) {
      Alert.alert("Couldn't remove logo", result.message);
      return;
    }
    void deleteJobPhotos([logoPath]);
    setLogoPath(null);
    setLogoUri(null);
  }

  async function handleSave() {
    if (!user || saving) return;

    const trimmedName = businessName.trim();
    const trimmedState = stateCode.trim().toUpperCase();

    if (!trimmedName) {
      Alert.alert('Business name is required');
      return;
    }
    if (trimmedState.length !== 2) {
      Alert.alert('State must be a 2-letter code', 'e.g. TX, CA, FL');
      return;
    }
    const parsedTax = taxRate.trim() === '' ? 0 : Number(taxRate.replace('%', ''));
    if (!Number.isFinite(parsedTax) || parsedTax < 0 || parsedTax > 30) {
      Alert.alert('Tax rate must be a percentage between 0 and 30', 'e.g. 8.25');
      return;
    }

    setSaving(true);
    const result = await updateProfile(user.id, {
      business_name: trimmedName,
      state_code: trimmedState,
      trade,
      default_tax_rate: Math.round(parsedTax * 100) / 100,
      travel_buffer_minutes: travelBuffer,
    });
    setSaving(false);

    if (result.ok) {
      router.back();
    } else {
      Alert.alert("Couldn't save", result.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <BackButton />

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Business profile</Text>
            <Text style={styles.subtitle}>
              Drives quote tone, contract templates, and how customers see you.
            </Text>
          </View>

          {loading ? null : (
            <>
              <LogoPicker
                imageUri={logoUri}
                busy={logoBusy}
                onPick={() => void handlePickLogo()}
                onRemove={() => void handleRemoveLogo()}
              />

              <Input
                label="Business name"
                value={businessName}
                onChangeText={setBusinessName}
                placeholder="Smith Handyman"
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Input
                label="State"
                value={stateCode}
                onChangeText={(v) => setStateCode(v.toUpperCase().slice(0, 2))}
                placeholder="2-letter code"
                autoCapitalize="characters"
                maxLength={2}
                returnKeyType="next"
              />
              <StateFromLocation onState={setStateCode} />

              <Input
                label="Sales tax rate (%)"
                value={taxRate}
                onChangeText={setTaxRate}
                placeholder="0 — added to every quote and invoice"
                keyboardType="decimal-pad"
                returnKeyType="done"
              />

              <View style={styles.tradeBlock}>
                <Text style={styles.fieldLabel}>Travel time between jobs</Text>
                <View style={styles.tradeGrid}>
                  {TRAVEL_BUFFER_OPTIONS.map((m) => (
                    <Chip
                      key={m}
                      label={m === 0 ? 'None' : `${m} min`}
                      selected={travelBuffer === m}
                      onPress={() => setTravelBuffer(m)}
                    />
                  ))}
                </View>
                <Text style={styles.travelHint}>
                  Kept clear before and after each job. You&apos;ll get a warning when a job is
                  scheduled closer than this.
                </Text>
              </View>

              <View style={styles.tradeBlock}>
                <Text style={styles.fieldLabel}>Trade</Text>
                <View style={styles.tradeGrid}>
                  {TRADES.map((t) => (
                    <Chip
                      key={t}
                      label={strings.goals.trades[t]}
                      selected={trade === t}
                      onPress={() => setTrade(t)}
                      style={styles.tradeItem}
                    />
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>

        {loading ? null : (
          <View style={styles.footer}>
            <PrimaryButton
              label={saving ? 'Saving…' : 'Save changes'}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            />
          </View>
        )}
      </KeyboardAvoidingView>
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: colors.surface2,
    },
    flex: {
      flex: 1,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.huge + spacing.huge,
      gap: spacing.lg,
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
      marginBottom: spacing.sm,
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
    travelHint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    tradeBlock: {
      gap: spacing.sm,
    },
    fieldLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      letterSpacing: 0.5,
      color: colors.ink2,
    },
    tradeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.md,
    },
    tradeItem: {
      flexBasis: '47%',
      paddingVertical: spacing.md,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
      backgroundColor: colors.surface2,
    },
  });
