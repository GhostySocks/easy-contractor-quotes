import { router, Stack, useLocalSearchParams } from 'expo-router';
import { CalendarDays, LocateFixed, X } from 'lucide-react-native';
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
import { DictationButton } from '@/components/quote/DictationButton';
import { PhotoStrip, type StripPhoto } from '@/components/quote/PhotoStrip';
import { TravelSection } from '@/components/quote/TravelSection';
import { Chip } from '@/components/ui/Chip';
import { DateSheet, isoDay } from '@/components/ui/DateSheet';
import { Input } from '@/components/ui/Input';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { AiTimeoutError, finishQuoteInBackground, generateQuote } from '@/lib/ai';
import { progressLabel } from '@/lib/ai-progress';
import { notifyQuoteReady } from '@/lib/notifications';
import { useAuth } from '@/lib/auth-store';
import { usePaused } from '@/lib/use-paused';
import {
  fetchCustomer,
  rememberCustomerContact,
  saveCustomerForQuote,
  type CustomerRow,
} from '@/lib/customers';
import { quoteContactErrors, type ContactErrors } from '@/lib/customer-form';
import { fetchJob } from '@/lib/jobs';
import { reportError } from '@/lib/error-reporting';
import type { FilledAddress } from '@/lib/geo-address';
import { currentAddress, geocodeAddress, type Coords } from '@/lib/location';
import { type TradeCode } from '@/lib/onboarding-store';
import { MAX_PHOTOS } from '@/lib/photo-math';
import { deleteJobPhotos, pickPhotos, type PhotoSource, uploadJobPhoto } from '@/lib/photos';
import { strings } from '@/lib/strings';
import { supabase } from '@/lib/supabase';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import {
  addressQuery,
  DEFAULT_TRAVEL_FORM,
  travelFromForm,
  type TravelForm,
} from '@/lib/travel-form';
import { useTravelPrefs } from '@/lib/travel-prefs';
import { useStyles, useTheme } from '@/lib/theme-context';
import { withTimeout } from '@/lib/with-timeout';
import { roadMiles } from '@/supabase/functions/_shared/travel';

// The customer save runs before the AI call. It limits and retries its own
// requests; this is only the backstop for one that never settles at all.
const CUSTOMER_SAVE_TIMEOUT_MS = 45_000;

const ZIP_RE = /^\d{5}(-\d{4})?$/;

const TRADES: TradeCode[] = ['handyman', 'plumber', 'electrician', 'hvac', 'landscaping', 'other'];

export default function NewQuote() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const user = useAuth((s) => s.user);
  const paused = usePaused();
  useEffect(() => {
    if (!paused) return;
    Alert.alert(
      'Your subscription is paused',
      'Reactivate to create new quotes. Your jobs and customers are still here to view.',
      [
        { text: 'Not now', style: 'cancel', onPress: () => router.back() },
        { text: 'Reactivate', onPress: () => router.replace('/paywall') },
      ],
    );
  }, [paused]);
  const [profileChecked, setProfileChecked] = useState(false);
  const [jobType, setJobType] = useState<string>('handyman');
  const jobTypeTouched = useRef(false);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactErrors, setContactErrors] = useState<ContactErrors>({});
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  // The address on this form is the job site: where the work happens. Its
  // state prices the quote and decides the contract terms. It starts as the
  // contractor's own state and they change it for a job across the line.
  const [siteState, setSiteState] = useState('');
  const siteStateTouched = useRef(false);
  const [postalCode, setPostalCode] = useState('');
  // Where the phone was when "use my location" filled the address; saves a
  // lookup for the travel estimate. Cleared when the address is retyped.
  const [siteCoords, setSiteCoords] = useState<Coords | null>(null);
  const [baseCoords, setBaseCoords] = useState<Coords | null>(null);
  // The customer may live somewhere other than the job (a rental, a parent's
  // house). Off by default: the job site is saved as their address.
  const [customerElsewhere, setCustomerElsewhere] = useState(false);
  const [custLine1, setCustLine1] = useState('');
  const [custCity, setCustCity] = useState('');
  const [custState, setCustState] = useState('');
  const [custZip, setCustZip] = useState('');
  const [travel, setTravel] = useState<TravelForm>(DEFAULT_TRAVEL_FORM);
  const [milesNote, setMilesNote] = useState<string | null>(null);
  const milesTouched = useRef(false);
  const travelPrefs = useTravelPrefs();
  const [description, setDescription] = useState('');
  const [startAt, setStartAt] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [photos, setPhotos] = useState<StripPhoto[]>([]);
  const [generating, setGenerating] = useState(false);
  const [locating, setLocating] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Step the progress label while the AI works.
  useEffect(() => {
    if (!generating) {
      setElapsed(0);
      return;
    }
    const started = Date.now();
    const handle = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(handle);
  }, [generating]);

  // Photos uploaded but not attached to a quote are deleted if the user
  // leaves without generating. Ref so the unmount cleanup sees the latest.
  const uploadedPaths = useRef<string[]>([]);
  const submitted = useRef(false);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from('profiles')
      .select('trade, state_code, base_lat, base_lng')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.trade && !jobTypeTouched.current) setJobType(data.trade);
        if (data?.state_code) {
          if (!siteStateTouched.current) setSiteState(data.state_code);
        }
        if (typeof data?.base_lat === 'number' && typeof data?.base_lng === 'number') {
          setBaseCoords({ lat: data.base_lat, lng: data.base_lng });
        }
        setProfileChecked(true);
      });
  }, [user]);

  // Estimate the miles for a per-mile travel charge: straight-line distance
  // from the business address to the job site, plus a margin for roads. Runs
  // a moment after the address stops changing, and never over miles the
  // contractor typed themselves.
  useEffect(() => {
    if (!travel.charge || travel.mode !== 'per_mile' || milesTouched.current) return;
    if (!profileChecked) return;
    if (!baseCoords) {
      setMilesNote(
        'Add your business address in Settings to have the miles estimated. For now, type them in.',
      );
      return;
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      void (async () => {
        const query = addressQuery({
          line1: addressLine1,
          city,
          state_code: siteState,
          postal_code: postalCode,
        });
        const site = siteCoords ?? (query ? await geocodeAddress(query) : null);
        if (cancelled || milesTouched.current) return;
        if (!site) {
          setMilesNote(
            query
              ? "Couldn't estimate the miles for that address. Type them in."
              : 'Fill in the job address above, or type the miles.',
          );
          return;
        }
        const miles = roadMiles(baseCoords, site);
        setTravel((t) => ({ ...t, miles: String(miles) }));
        setMilesNote(`About ${miles} miles from your business address. Change it if that's off.`);
      })();
    }, 900);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    travel.charge,
    travel.mode,
    profileChecked,
    baseCoords,
    siteCoords,
    addressLine1,
    city,
    siteState,
    postalCode,
  ]);

  function changeTravel(patch: Partial<TravelForm>) {
    if (patch.miles !== undefined) {
      milesTouched.current = true;
      setMilesNote(null);
    }
    setTravel((prev) => {
      const next = { ...prev, ...patch };
      // Turning it on starts from how they charged last time.
      if (patch.charge && !prev.charge) {
        next.mode = travelPrefs.mode;
        next.per = travelPrefs.per;
        next.rate = travelPrefs.mode === 'flat' ? travelPrefs.flatRate : travelPrefs.mileRate;
      } else if (patch.mode && patch.mode !== prev.mode) {
        next.rate = patch.mode === 'flat' ? travelPrefs.flatRate : travelPrefs.mileRate;
      }
      return next;
    });
  }

  /** Fill the job site from a customer record or a GPS lookup. */
  function fillSite(a: {
    line1?: string | null;
    city?: string | null;
    state_code?: string | null;
    postal_code?: string | null;
  }) {
    if (a.line1) setAddressLine1(a.line1);
    if (a.city) setCity(a.city);
    if (a.state_code) {
      siteStateTouched.current = true;
      setSiteState(a.state_code);
    }
    if (a.postal_code) setPostalCode(a.postal_code);
  }

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
        setPhone(c.phone ?? '');
        setEmail(c.email ?? '');
        fillSite({ ...c, line1: c.address_line1 });
      });
    }
    if (params.fromJobId) {
      void fetchJob(params.fromJobId).then((j) => {
        if (j?.description) setDescription(j.description);
      });
    }
  }, [params.customerId, params.fromJobId]);

  const uploading = photos.some((p) => p.path === null && !p.failed);
  const canGenerate = description.trim().length >= 5 && !generating && !uploading && !dictating;

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

  async function fillFromLocation() {
    setLocating(true);
    try {
      const result = await currentAddress();
      const applyFound = (found: FilledAddress & { coords: Coords }) => {
        fillSite(found);
        setSiteCoords(found.coords);
      };
      if (result.kind === 'ok') {
        applyFound(result);
      } else if (result.kind === 'approximate') {
        const guess = [result.line1, result.city].filter(Boolean).join(', ');
        const within = result.accuracyM
          ? ` (GPS is only accurate to about ${Math.round(result.accuracyM)} m here)`
          : '';
        const fix = result.precisionOff
          ? '\n\nThis phone only shares an approximate location with the app. Turn on Precise location for Easy Contractor Quotes in Settings.'
          : '';
        Alert.alert(
          "Couldn't pin down the exact address",
          `This might be a neighbor's address${within}:\n\n${guess}${fix}`,
          [
            { text: 'Type it in', style: 'cancel' },
            ...(result.precisionOff
              ? [{ text: 'Open Settings', onPress: () => void Linking.openSettings() }]
              : []),
            {
              text: 'Use it',
              onPress: () => applyFound(result),
            },
          ],
        );
      } else if (result.kind === 'denied') {
        Alert.alert(
          'Location access is off',
          'Turn it on in Settings to fill in the job address.',
          [
            { text: 'Not now', style: 'cancel' },
            { text: 'Open Settings', onPress: () => void Linking.openSettings() },
          ],
        );
      } else {
        Alert.alert("Couldn't find an address here", 'Check your signal, or type it in instead.');
      }
    } finally {
      setLocating(false);
    }
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
    const jobState = siteState.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(jobState)) {
      Alert.alert(
        'Which state is the job in?',
        'Quotes are priced and worded for the state the work is done in. Fill in State with its 2-letter code, like OH.',
      );
      return;
    }
    const zip = postalCode.trim();
    if (zip && !ZIP_RE.test(zip)) {
      Alert.alert('Check the ZIP code', 'It should be 5 digits. Fix it or clear it.');
      return;
    }
    const travelResult = travelFromForm(travel);
    if (!travelResult.ok) {
      Alert.alert('Finish the travel charge', `${travelResult.message} Or set travel to No.`);
      return;
    }
    const errors = quoteContactErrors({ phone, email });
    setContactErrors(errors);
    if (errors.phone || errors.email) {
      Alert.alert(
        'Check the contact details',
        'The phone or email looks incomplete. Fix it or clear it, then generate.',
      );
      return;
    }
    setGenerating(true);
    const startedAt = new Date().toISOString();
    try {
      // If the user typed a customer name but never picked from the dropdown
      // (or never tapped 'Create new'), auto-create on the fly. The save
      // dedupes by normalized name so this can't produce a fresh duplicate of
      // an existing customer, and throws a message to show when it fails.
      let resolvedCustomerId = customerId;
      if (!resolvedCustomerId && customerName.trim()) {
        const created = await withTimeout(
          saveCustomerForQuote({ name: customerName, phone, email }),
          CUSTOMER_SAVE_TIMEOUT_MS,
          'Saving the customer',
        );
        resolvedCustomerId = created.id;
        setCustomerId(created.id);
      }

      // Save the address and contact details onto the customer so the next
      // quote and the Send screen prefill them.
      // The customer's own address is the job site unless they live elsewhere.
      if (resolvedCustomerId) {
        void rememberCustomerContact(resolvedCustomerId, {
          ...(customerElsewhere
            ? {
                address_line1: custLine1,
                city: custCity,
                state_code: custState,
                postal_code: custZip,
              }
            : {
                address_line1: addressLine1,
                city,
                // Only with an address: the default state alone isn't theirs.
                state_code: addressLine1.trim() || city.trim() ? jobState : undefined,
                postal_code: zip,
              }),
          phone,
          email,
        });
      }

      const photoPaths = photos.flatMap((p) => (p.path ? [p.path] : []));
      const result = await generateQuote({
        trade: jobType,
        state_code: jobState,
        scope_text: description,
        customer_id: resolvedCustomerId,
        address: {
          line1: addressLine1 || undefined,
          city: city || undefined,
          state_code: jobState,
          postal_code: zip || undefined,
        },
        photos: photoPaths,
        requested_start_at: startAt,
        travel: travelResult.travel,
      });
      if (travelResult.travel) {
        travelPrefs.remember({ mode: travel.mode, per: travel.per, rate: travel.rate });
      }
      submitted.current = true;
      router.replace({ pathname: '/quote/[id]', params: { id: result.id } });
    } catch (err) {
      if (err instanceof AiTimeoutError) {
        // The quote keeps generating server-side; watch for it and notify.
        submitted.current = true;
        finishQuoteInBackground(startedAt, (quoteId) => void notifyQuoteReady(quoteId));
        Alert.alert(strings.locked.errorAiTimeout, undefined, [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }
      reportError(err, 'quote.generate');
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
          hitSlop={10}
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
              Job type {siteState ? <Text style={styles.fieldMeta}>· {siteState}</Text> : null}
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
              setPhone(c.phone ?? '');
              setEmail(c.email ?? '');
              setContactErrors({});
              fillSite({ ...c, line1: c.address_line1 });
              setSiteCoords(null);
            }}
          />

          {/* Optional here, but it's what Send Quote needs later, so it's
              asked while the contractor is with the customer. */}
          <Input
            label="Phone (optional)"
            placeholder="555 123 4567"
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (contactErrors.phone) setContactErrors((e) => ({ ...e, phone: undefined }));
            }}
            keyboardType="phone-pad"
            autoComplete="tel"
            error={contactErrors.phone}
          />
          <Input
            label="Email (optional)"
            placeholder="name@example.com"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (contactErrors.email) setContactErrors((e) => ({ ...e, email: undefined }));
            }}
            keyboardType="email-address"
            autoComplete="email"
            error={contactErrors.email}
          />

          <Input
            label="Job site address"
            placeholder="123 Main St"
            value={addressLine1}
            onChangeText={(v) => {
              setAddressLine1(v);
              setSiteCoords(null);
            }}
            autoCapitalize="words"
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fill in the address from my current location"
            onPress={() => void fillFromLocation()}
            disabled={locating}
            hitSlop={8}
            style={({ pressed }) => [styles.locate, pressed && styles.pressed]}
          >
            <LocateFixed size={18} color={colors.goldDark} strokeWidth={2} />
            <Text style={styles.locateLabel}>
              {locating ? 'Finding your location…' : "I'm at the job: use my location"}
            </Text>
          </Pressable>

          <Input
            label="City"
            placeholder="Austin"
            value={city}
            onChangeText={(v) => {
              setCity(v);
              setSiteCoords(null);
            }}
            autoCapitalize="words"
          />
          <View style={styles.row}>
            <Input
              label="State"
              placeholder="OH"
              value={siteState}
              onChangeText={(v) => {
                siteStateTouched.current = true;
                setSiteState(v.toUpperCase().slice(0, 2));
                setSiteCoords(null);
              }}
              autoCapitalize="characters"
              maxLength={2}
              containerStyle={styles.stateField}
            />
            <Input
              label="ZIP code"
              placeholder="44805"
              value={postalCode}
              onChangeText={(v) => {
                setPostalCode(v.replace(/[^\d-]/g, '').slice(0, 10));
                setSiteCoords(null);
              }}
              keyboardType="number-pad"
              containerStyle={styles.flex}
            />
          </View>

          <View style={styles.chips}>
            <Chip
              label="Customer lives at a different address"
              selected={customerElsewhere}
              onPress={() => setCustomerElsewhere((v) => !v)}
            />
          </View>
          {customerElsewhere ? (
            <>
              <Input
                label="Customer's address"
                placeholder="456 Elm St"
                value={custLine1}
                onChangeText={setCustLine1}
                autoCapitalize="words"
              />
              <Input
                label="Customer's city"
                placeholder="Columbus"
                value={custCity}
                onChangeText={setCustCity}
                autoCapitalize="words"
              />
              <View style={styles.row}>
                <Input
                  label="State"
                  placeholder="OH"
                  value={custState}
                  onChangeText={(v) => setCustState(v.toUpperCase().slice(0, 2))}
                  autoCapitalize="characters"
                  maxLength={2}
                  containerStyle={styles.stateField}
                />
                <Input
                  label="ZIP code"
                  placeholder="43215"
                  value={custZip}
                  onChangeText={(v) => setCustZip(v.replace(/[^\d-]/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  containerStyle={styles.flex}
                />
              </View>
            </>
          ) : null}

          <Input
            label="What's the job?"
            placeholder="Assemble 3 dressers and mount a 65-inch TV…"
            value={description}
            onChangeText={setDescription}
            multiline
            style={styles.textarea}
            textAlignVertical="top"
            editable={!dictating}
          />
          <DictationButton
            value={description}
            onChange={setDescription}
            onListeningChange={setDictating}
            disabled={generating}
          />

          <Text style={styles.hint}>
            Describe what needs to be done in as few sentences as possible. The more specific you
            are about the materials and job description, the better the quote.
          </Text>

          <PhotoStrip photos={photos} onAdd={promptAddPhoto} onRemove={removePhoto} />

          <View style={styles.block}>
            <Text style={styles.fieldLabel}>
              Start date and time <Text style={styles.fieldMeta}>(optional)</Text>
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

          <TravelSection form={travel} onChange={changeTravel} milesNote={milesNote} />
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={
              generating
                ? progressLabel(elapsed)
                : uploading
                  ? 'Uploading photos…'
                  : 'Generate quote'
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
        onPick={(iso) => {
          setStartAt(iso);
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
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
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
    row: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    stateField: {
      width: 96,
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
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      lineHeight: 20,
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
    locate: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      minHeight: 44,
      marginTop: -spacing.sm,
    },
    locateLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
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
