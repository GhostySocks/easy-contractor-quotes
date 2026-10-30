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
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { type TradeCode } from '@/lib/onboarding-store';
import { fetchProfile, updateProfile } from '@/lib/profile';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void fetchProfile(user.id).then((profile) => {
      if (profile) {
        setBusinessName(profile.business_name);
        setStateCode(profile.state_code);
        setTrade((profile.trade as TradeCode | null) ?? null);
      }
      setLoading(false);
    });
  }, [user]);

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

    setSaving(true);
    const result = await updateProfile(user.id, {
      business_name: trimmedName,
      state_code: trimmedState,
      trade,
    });
    setSaving(false);

    if (result.ok) {
      router.back();
    } else {
      Alert.alert("Couldn't save", result.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
                placeholder="TX"
                autoCapitalize="characters"
                maxLength={2}
                returnKeyType="done"
              />

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
    tradeBlock: {
      gap: spacing.sm,
    },
    fieldLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
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
