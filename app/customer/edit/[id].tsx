import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import {
  type CustomerFormValues,
  formValuesFromCustomer,
  patchFromForm,
  validateCustomerForm,
} from '@/lib/customer-form';
import { fetchCustomer, updateCustomer } from '@/lib/customers';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

/**
 * Edit a customer's contact details, address, notes and tags. Reached from
 * the customer profile. Validation only flags fields once they've been
 * touched, so a half-filled record doesn't open covered in red.
 */
export default function EditCustomer() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [values, setValues] = useState<CustomerFormValues | null>(null);
  const [touched, setTouched] = useState<Partial<Record<keyof CustomerFormValues, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!id) return;
    void fetchCustomer(id).then((c) => {
      if (c) setValues(formValuesFromCustomer(c));
      else setMissing(true);
    });
  }, [id]);

  const errors = useMemo(() => (values ? validateCustomerForm(values) : {}), [values]);
  const hasErrors = Object.keys(errors).length > 0;

  function field<K extends keyof CustomerFormValues>(key: K) {
    return {
      value: values?.[key] ?? '',
      onChangeText: (text: string) => setValues((v) => (v ? { ...v, [key]: text } : v)),
      onBlur: () => setTouched((t) => ({ ...t, [key]: true })),
      error: touched[key] ? errors[key] : undefined,
    };
  }

  async function handleSave() {
    if (!id || !values || saving) return;
    if (hasErrors) {
      // Show every problem at once rather than one per tap.
      setTouched(Object.fromEntries(Object.keys(values).map((k) => [k, true])));
      return;
    }
    setSaving(true);
    const result = await updateCustomer(id, patchFromForm(values));
    setSaving(false);
    if (result.ok) {
      router.back();
    } else {
      Alert.alert("Couldn't save", result.message);
    }
  }

  if (missing) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BackButton />
        <View style={styles.center}>
          <Text style={styles.muted}>Customer not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!values) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <BackButton />
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
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
          <Text style={styles.title}>Edit customer</Text>

          <Input label="Name" {...field('name')} autoCapitalize="words" returnKeyType="next" />

          <Text style={styles.section}>CONTACT</Text>
          <Input
            label="Phone"
            {...field('phone')}
            keyboardType="phone-pad"
            autoCorrect={false}
            placeholder="(512) 555-0142"
          />
          <Input
            label="Email"
            {...field('email')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="name@example.com"
          />

          <Text style={styles.section}>ADDRESS</Text>
          <Input label="Street" {...field('address_line1')} autoCapitalize="words" />
          <Input label="Apt, unit, gate code" {...field('address_line2')} autoCapitalize="words" />
          <Input label="City" {...field('city')} autoCapitalize="words" />
          <View style={styles.row}>
            <Input
              label="State"
              {...field('state_code')}
              onChangeText={(t) =>
                setValues((v) => (v ? { ...v, state_code: t.toUpperCase().slice(0, 2) } : v))
              }
              autoCapitalize="characters"
              maxLength={2}
              placeholder="TX"
              containerStyle={styles.stateField}
            />
            <Input
              label="ZIP"
              {...field('postal_code')}
              keyboardType="number-pad"
              maxLength={10}
              containerStyle={styles.zipField}
            />
          </View>

          <Text style={styles.section}>NOTES</Text>
          <Input
            label="Notes"
            {...field('notes')}
            multiline
            placeholder="Dog in the back yard. Prefers texts after 5pm."
            style={styles.notes}
            textAlignVertical="top"
          />
          <Input
            label="Tags"
            {...field('tags')}
            autoCapitalize="words"
            placeholder="Commercial, Referral, Net 30"
          />
          <Text style={styles.hint}>Separate tags with commas.</Text>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={saving ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            loading={saving}
            disabled={saving}
          />
        </View>
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
      paddingBottom: spacing.xxxl,
      gap: spacing.md,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    muted: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.ink3,
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
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h1,
      color: colors.ink,
      letterSpacing: -0.5,
      marginBottom: spacing.sm,
    },
    section: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.8,
      color: colors.ink3,
      marginTop: spacing.lg,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    stateField: {
      flex: 1,
    },
    zipField: {
      flex: 2,
    },
    notes: {
      minHeight: 120,
      paddingTop: spacing.md,
    },
    hint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      marginTop: -spacing.sm,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.md,
      backgroundColor: colors.surface2,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.divider,
    },
  });
