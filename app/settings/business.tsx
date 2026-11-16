import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
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

import { LoadFailed } from '@/components/ui/LoadFailed';
import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { LogoPicker } from '@/components/ui/LogoPicker';
import { StateFromLocation } from '@/components/ui/StateFromLocation';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { useAuth } from '@/lib/auth-store';
import { type TradeCode } from '@/lib/onboarding-store';
import { deleteJobPhotos, promptForPhotos, signedPhotoUrls, uploadLogo } from '@/lib/photos';
import { EMAIL_RE, PHONE_RE } from '@/lib/customer-form';
import { geocodeAddress } from '@/lib/location';
import { loadProfile, updateProfile } from '@/lib/profile';
import { TRAVEL_BUFFER_OPTIONS } from '@/lib/schedule-conflicts';
import { strings } from '@/lib/strings';
import { addressQuery } from '@/lib/travel-form';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const TRADES: TradeCode[] = ['handyman', 'plumber', 'electrician', 'hvac', 'landscaping', 'other'];

export default function BusinessSettings() {
  const styles = useStyles(makeStyles);
  const user = useAuth((s) => s.user);
  const [businessName, setBusinessName] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  // The saved address and its map point, so an unchanged address isn't looked up again.
  const savedBase = useRef<{ query: string | null; lat: number | null; lng: number | null }>({
    query: null,
    lat: null,
    lng: null,
  });
  const [trade, setTrade] = useState<TradeCode | null>(null);
  const [taxRate, setTaxRate] = useState('');
  const [travelBuffer, setTravelBuffer] = useState<number>(30);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    void loadProfile(user.id)
      .then((profile) => {
        if (profile) {
          setBusinessName(profile.business_name);
          setStateCode(profile.state_code);
          setAddressLine1(profile.address_line1 ?? '');
          setCity(profile.city ?? '');
          setPostalCode(profile.postal_code ?? '');
          setBusinessPhone(profile.business_phone ?? '');
          setBusinessEmail(profile.business_email ?? '');
          savedBase.current = {
            query: addressQuery({
              line1: profile.address_line1 ?? '',
              city: profile.city ?? '',
              state_code: profile.state_code,
              postal_code: profile.postal_code ?? '',
            }),
            lat: profile.base_lat,
            lng: profile.base_lng,
          };
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
      })
      .catch(() => {
        setLoadFailed(true);
        setLoading(false);
      });
  }, [user, attempt]);

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

    const phone = businessPhone.trim();
    if (phone && !PHONE_RE.test(phone)) {
      Alert.alert('Check the business phone', 'It looks incomplete. Fix it or clear it.');
      return;
    }
    const email = businessEmail.trim().toLowerCase();
    if (email && !EMAIL_RE.test(email)) {
      Alert.alert('Check the business email', 'It looks incomplete. Fix it or clear it.');
      return;
    }
    const zip = postalCode.trim();
    if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) {
      Alert.alert('ZIP code must be 5 digits', 'e.g. 44805');
      return;
    }

    setSaving(true);
    // Place the business on the map for travel estimates. If the phone can't
    // (no signal), the address still saves and miles can be typed on a quote.
    const query = addressQuery({
      line1: addressLine1,
      city,
      state_code: trimmedState,
      postal_code: zip,
    });
    let base: { lat: number | null; lng: number | null } = { lat: null, lng: null };
    if (query && query === savedBase.current.query && savedBase.current.lat !== null) {
      base = { lat: savedBase.current.lat, lng: savedBase.current.lng };
    } else if (query) {
      const found = await geocodeAddress(query);
      if (found) base = found;
    }

    const result = await updateProfile(user.id, {
      business_name: trimmedName,
      state_code: trimmedState,
      address_line1: addressLine1.trim() || null,
      city: city.trim() || null,
      postal_code: zip || null,
      base_lat: base.lat,
      base_lng: base.lng,
      business_phone: phone || null,
      business_email: email || null,
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

  if (loadFailed) {
    return (
      <LoadFailed
        what="profile"
        onRetry={() => {
          setLoadFailed(false);
          setLoading(true);
          setAttempt((n) => n + 1);
        }}
      />
    );
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
                label="Business phone"
                value={businessPhone}
                onChangeText={setBusinessPhone}
                placeholder="555 123 4567"
                keyboardType="phone-pad"
                autoComplete="tel"
                returnKeyType="next"
              />

              <Input
                label="Business email"
                value={businessEmail}
                onChangeText={setBusinessEmail}
                placeholder="you@yourbusiness.com"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
              <Text style={styles.travelHint}>
                Shown to customers on quotes, signed agreements and invoices. Their replies go to
                this email, or to your login email if you leave it blank.
              </Text>

              <Input
                label="Business address"
                value={addressLine1}
                onChangeText={setAddressLine1}
                placeholder="123 Main St"
                autoCapitalize="words"
                autoComplete="street-address"
                returnKeyType="next"
              />
              <Text style={styles.travelHint}>
                Where you start from. Used to estimate travel miles on a quote.
              </Text>

              <Input
                label="City"
                value={city}
                onChangeText={setCity}
                placeholder="Ashland"
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Input
                label="ZIP code"
                value={postalCode}
                onChangeText={(v) => setPostalCode(v.replace(/[^\d-]/g, '').slice(0, 10))}
                placeholder="44805"
                keyboardType="number-pad"
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
