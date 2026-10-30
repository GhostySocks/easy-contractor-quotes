import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarDays, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CustomerAutocomplete } from '@/components/quote/CustomerAutocomplete';
import { PhotoStrip, type StripPhoto } from '@/components/quote/PhotoStrip';
import { Chip } from '@/components/ui/Chip';
import { DateSheet, isoDay, morningOf } from '@/components/ui/DateSheet';
import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { generateQuote } from '@/lib/ai';
import { useAuth } from '@/lib/auth-store';
import {
  createCustomer,
  fetchCustomer,
  rememberCustomerContact,
  type CustomerRow,
} from '@/lib/customers';
import { fetchJob } from '@/lib/jobs';
import { type TradeCode } from '@/lib/onboarding-store';
import { MAX_PHOTOS } from '@/lib/photo-math';
import { deleteJobPhotos, pickPhotos, type PhotoSource, uploadJobPhoto } from '@/lib/photos';
import { strings } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const TRADES: TradeCode[] = ['handyman', 'plumber', 'electrician', 'hvac', 'landscaping', 'other'];

export default function NewQuote() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const [profileState, setProfileState] = useState<string>('TX');
  const [jobType, setJobType] = useState<string>('handyman');
  const jobTypeTouched = useRef(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [photos, setPhotos] = useState<StripPhoto[]>([]);
  const [generating, setGenerating] = useState(false);

  // Photos uploaded but not attached to a quote are deleted if the user
  // leaves without generating. Ref so the unmount cleanup sees the latest.
  const uploadedPaths = useRef<string[]>([]);
  const submitted = useRef(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from('profiles')
      .select('trade, state_code')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.trade && !jobTypeTouched.current) setJobType(data.trade);
        if (data?.state_code) setProfileState(data.state_code);
      });
  }, [user]);

  useEffect(
    () => () => {
      if (!submitted.current) void deleteJobPhotos(uploadedPaths.current);
    },
    [],
  );

  // "Quote again" / "New quote" from a customer or job: prefill the customer
  // and, from a past job, its description so the contractor edits rather than
  // retypes. Nothing is generated until they tap Generate.
  const params = useLocalSearchParams<{ customerId?: string; fromJobId?: string }>();
  useEffect(() => {
    if (params.customerId) {
      void fetchCustomer(params.customerId).then((c) => {
        if (!c) return;
        setCustomerId(c.id);
        setCustomerName(c.name);
        if (c.address_line1) setAddressLine1(c.address_line1);
        if (c.city) setCity(c.city);
      });
    }
    if (params.fromJobId) {
      void fetchJob(params.fromJobId).then((j) => {
        if (j?.description) setDescription(j.description);
      });
    }
  }, [params.customerId, params.fromJobId]);

  const uploading = photos.some((p) => p.path === null && !p.failed);
  const canGenerate = description.trim().length >= 5 && !generating && !uploading;

  function addPhotos(source: PhotoSource) {
    if (!user) return;
    void pickPhotos(source, MAX_PHOTOS - photos.length, () =>
      Alert.alert(
        source === 'camera' ? 'Camera access is off' : 'Photo access is off',
        'Turn it on in Settings to attach photos to quotes.',
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Open Settings', onPress: () => void Linking.openSettings() },
        ],
      ),
    ).then((picked) => {
      if (picked.length === 0) return;
      setPhotos((prev) => [...prev, ...picked.map((p) => ({ uri: p.uri, path: null }))]);
      for (const p of picked) {
        uploadJobPhoto(p, user.id)
          .then((path) => {
            uploadedPaths.current.push(path);
            setPhotos((prev) => prev.map((x) => (x.uri === p.uri ? { ...x, path } : x)));
          })
          .catch((err: unknown) => {
            console.warn('[new-quote] photo upload failed', err);
            setPhotos((prev) => prev.map((x) => (x.uri === p.uri ? { ...x, failed: true } : x)));
          });
      }
    });
  }

  function promptAddPhoto() {
    Alert.alert('Add a photo', undefined, [
      { text: 'Take photo', onPress: () => addPhotos('camera') },
      { text: 'Choose from library', onPress: () => addPhotos('library') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function removePhoto(index: number) {
    const target = photos[index];
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    if (target?.path) {
      uploadedPaths.current = uploadedPaths.current.filter((p) => p !== target.path);
      void deleteJobPhotos([target.path]);
    }
  }

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

      const photoPaths = photos.flatMap((p) => (p.path ? [p.path] : []));
      const result = await generateQuote({
        trade: jobType,
        state_code: profileState,
        scope_text: description,
        customer_id: resolvedCustomerId,
        address: {
          line1: addressLine1 || undefined,
          city: city || undefined,
          state_code: profileState,
        },
        photos: photoPaths,
        requested_start_at: startAt,
      });
      submitted.current = true;
      router.replace({ pathname: '/quote/[id]', params: { id: result.id } });
    } catch (err) {
      Alert.alert('Could not generate quote', err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  }

  const today = isoDay(new Date());

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
          <View style={styles.block}>
            <Text style={styles.fieldLabel}>
              Job type <Text style={styles.fieldMeta}>· {profileState}</Text>
            </Text>
            <View style={styles.chips}>
              {TRADES.map((t) => (
                <Chip
                  key={t}
                  label={strings.goals.trades[t]}
                  selected={jobType === t}
                  onPress={() => {
                    jobTypeTouched.current = true;
                    setJobType(t);
                  }}
                />
              ))}
            </View>
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

          <PhotoStrip photos={photos} onAdd={promptAddPhoto} onRemove={removePhoto} />

          <View style={styles.block}>
            <Text style={styles.fieldLabel}>
              Start date <Text style={styles.fieldMeta}>(optional)</Text>
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                startAt ? `Start date ${formatDay(startAt)}. Change` : 'Pick a start date'
              }
              onPress={() => setDateOpen(true)}
              style={({ pressed }) => [styles.dateRow, pressed && styles.pressed]}
            >
              <CalendarDays size={20} color={colors.goldDark} strokeWidth={2} />
              <Text style={[styles.dateValue, !startAt && styles.datePlaceholder]}>
                {startAt ? formatDay(startAt) : 'Not set — schedule after signing'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={
              generating ? 'Generating quote…' : uploading ? 'Uploading photos…' : 'Generate quote'
            }
            loading={generating}
            disabled={!canGenerate}
            onPress={handleGenerate}
          />
        </View>
      </KeyboardAvoidingView>

      <DateSheet
        visible={dateOpen}
        title="Start date"
        currentIso={startAt}
        minDate={today}
        onClose={() => setDateOpen(false)}
        onPick={(day) => {
          setStartAt(morningOf(day));
          setDateOpen(false);
        }}
        clearLabel={startAt ? 'Clear start date' : undefined}
        onClear={() => {
          setStartAt(null);
          setDateOpen(false);
        }}
      />
    </SafeAreaView>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
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
    block: {
      gap: spacing.sm,
    },
    fieldLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    fieldMeta: {
      fontFamily: typography.fonts.body,
      color: colors.ink3,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
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
      marginTop: -spacing.sm,
    },
    dateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: 60,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
    },
    dateValue: {
      flex: 1,
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    datePlaceholder: {
      fontFamily: typography.fonts.body,
      color: colors.ink3,
    },
    pressed: {
      opacity: 0.7,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface2,
    },
  });
