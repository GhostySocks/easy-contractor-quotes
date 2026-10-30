import { router, Stack } from 'expo-router';
import { X } from 'lucide-react-native';
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

import { CustomerAutocomplete } from '@/components/quote/CustomerAutocomplete';
import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { generateQuote } from '@/lib/ai';
import { useAuth } from '@/lib/auth-store';
import { createCustomer, rememberCustomerContact, type CustomerRow } from '@/lib/customers';
import { supabase } from '@/lib/supabase';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

export default function NewQuote() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const [profileTrade, setProfileTrade] = useState<string>('handyman');
  const [profileState, setProfileState] = useState<string>('TX');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from('profiles')
      .select('trade, state_code')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.trade) setProfileTrade(data.trade);
        if (data?.state_code) setProfileState(data.state_code);
      });
  }, [user]);

  const canGenerate = description.trim().length >= 5 && !generating;

  async function handleGenerate() {
    setGenerating(true);
    try {
      // If the user typed a customer name but never picked from the dropdown
      // (or never tapped 'Create new'), auto-create on the fly. createCustomer
      // dedupes server-side by normalized name so this can't produce a fresh
      // duplicate of an existing customer.
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId && customerName.trim()) {
        const created = await createCustomer({ name: customerName });
        if (!created) {
          Alert.alert("Couldn't link customer", 'Try picking a customer from the list.');
          return;
        }
        resolvedCustomerId = created.id;
        setCustomerId(created.id);
      }

      // Save the job address onto the customer so the next quote prefills it.
      if (resolvedCustomerId && (addressLine1.trim() || city.trim())) {
        void rememberCustomerContact(resolvedCustomerId, {
          address_line1: addressLine1,
          city,
        });
      }

      const result = await generateQuote({
        trade: profileTrade,
        state_code: profileState,
        scope_text: description,
        customer_id: resolvedCustomerId,
        address: {
          line1: addressLine1 || undefined,
          city: city || undefined,
          state_code: profileState,
        },
        photos: [],
      });
      router.replace({ pathname: '/quote/[id]', params: { id: result.id } });
    } catch (err) {
      Alert.alert('Could not generate quote', err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          style={styles.close}
          onPress={() => router.back()}
        >
          <X size={22} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>New quote</Text>
        <View style={styles.close} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.tradePill}>
            <Text style={styles.tradeLabel}>Trade</Text>
            <Text style={styles.tradeValue}>
              {capitalize(profileTrade)} · {profileState}
            </Text>
          </View>

          <CustomerAutocomplete
            name={customerName}
            onChangeName={(value) => {
              setCustomerName(value);
              if (!value) setCustomerId(null);
            }}
            onSelect={(c: CustomerRow) => {
              setCustomerId(c.id);
              setCustomerName(c.name);
              if (c.address_line1) setAddressLine1(c.address_line1);
              if (c.city) setCity(c.city);
            }}
          />

          <Input
            label="Address"
            placeholder="123 Main St"
            value={addressLine1}
            onChangeText={setAddressLine1}
            autoCapitalize="words"
          />

          <Input
            label="City"
            placeholder="Austin"
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
          />

          <Input
            label="What's the job?"
            placeholder="Assemble 3 dressers and mount a 65-inch TV…"
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.textarea}
            textAlignVertical="top"
          />

          <Text style={styles.hint}>
            Describe what needs to be done in 2–5 sentences. The more specific you are about
            materials and room size, the better the quote.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={generating ? 'Generating quote…' : 'Generate quote'}
            loading={generating}
            disabled={!canGenerate}
            onPress={handleGenerate}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function capitalize(str: string): string {
  return str.length === 0 ? str : str[0].toUpperCase() + str.slice(1);
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    close: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      gap: spacing.lg,
    },
    tradePill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      backgroundColor: colors.goldTint,
      borderRadius: 999,
      flexDirection: 'row',
      gap: spacing.sm,
      alignItems: 'center',
    },
    tradeLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
    },
    tradeValue: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
    },
    textarea: {
      minHeight: 120,
      paddingTop: spacing.md,
    },
    hint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.label,
      color: colors.ink3,
      lineHeight: 16,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface2,
    },
  });
