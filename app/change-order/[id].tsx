import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, ShieldCheck, Sparkles, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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

import { ContractBody } from '@/components/contract/ContractBody';
import { SendRecipientSheet, type Recipient } from '@/components/contract/SendRecipientSheet';
import { SignatureModal } from '@/components/contract/SignatureModal';
import { DictationButton } from '@/components/quote/DictationButton';
import { LineItemEditor } from '@/components/quote/LineItemEditor';
import { Card } from '@/components/ui/Card';
import { GhostButton } from '@/components/ui/GhostButton';
import { Input } from '@/components/ui/Input';
import { LoadFailed } from '@/components/ui/LoadFailed';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { LineItem } from '@/lib/ai';
import { useAuth } from '@/lib/auth-store';
import { checkDraft, isDirty, parseExtraDays, travelSuggestion } from '@/lib/change-order-form';
import {
  deleteChangeOrder,
  draftChangeOrderLines,
  fetchChangeOrder,
  saveChangeOrder,
  sendChangeOrder,
  signChangeOrderInPerson,
  type ChangeOrderRow,
} from '@/lib/change-orders';
import { fetchCustomer, rememberCustomerContact } from '@/lib/customers';
import { reportError } from '@/lib/error-reporting';
import { fetchJob, type JobRow } from '@/lib/jobs';
import { formatCents } from '@/lib/pricing';
import { fetchProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';
import { usePaused } from '@/lib/use-paused';
import { changeOrderTotals, signedMoney } from '@/supabase/functions/_shared/change-order';
import type { TravelInput } from '@/supabase/functions/_shared/travel';

const EMPTY_LINE: LineItem = { label: '', qty: 1, unit_price_cents: 0, total_cents: 0 };

/**
 * A change order for a job: write it, save it, then send it for signature or
 * have the customer sign here. Opened with id "new" and a jobId, or with an
 * existing change order's id. Once signed it is read-only.
 */
export default function ChangeOrderScreen() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ id: string; jobId?: string }>();
  const isNew = params.id === 'new';
  const user = useAuth((s) => s.user);
  const paused = usePaused();

  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [job, setJob] = useState<JobRow | null>(null);
  const [saved, setSaved] = useState<ChangeOrderRow | null>(null);
  const [taxRate, setTaxRate] = useState(0);
  const [quoteTravel, setQuoteTravel] = useState<TravelInput | null>(null);
  const [recipient, setRecipient] = useState<Recipient>({ name: '', email: '', phone: '' });

  const [description, setDescription] = useState('');
  const [lines, setLines] = useState<LineItem[]>([EMPTY_LINE]);
  const [extraDays, setExtraDays] = useState('');
  const [dictating, setDictating] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [signatureOpen, setSignatureOpen] = useState(false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const existing = isNew ? null : await fetchChangeOrder(params.id);
      const jobId = existing?.job_id ?? params.jobId;
      const jobRow = jobId ? await fetchJob(jobId) : null;
      if (!live) return;
      setJob(jobRow);
      setSaved(existing);
      if (existing) {
        setDescription(existing.description);
        setLines(existing.line_items.length ? existing.line_items : [EMPTY_LINE]);
        setExtraDays(existing.extra_days > 0 ? String(existing.extra_days) : '');
      }
      setLoading(false);
      if (!jobRow) return;

      if (jobRow.customer_id) {
        void fetchCustomer(jobRow.customer_id).then((c) => {
          if (live && c) setRecipient({ name: c.name, email: c.email ?? '', phone: c.phone ?? '' });
        });
      }
      // The travel the quote charged, to offer the same for added days.
      void supabase
        .from('quotes')
        .select('travel')
        .eq('job_id', jobRow.id)
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (live) setQuoteTravel((data?.travel as TravelInput | null) ?? null);
        });
    })();
    return () => {
      live = false;
    };
  }, [isNew, params.id, params.jobId, attempt]);

  useEffect(() => {
    if (!user) return;
    void fetchProfile(user.id).then((p) => setTaxRate(Number(p?.default_tax_rate ?? 0)));
  }, [user]);

  const signed = !!saved?.signed_at;
  const jobTotal = job?.total_cents ?? 0;
  // The total this change starts from. Once signed, that is what it was then.
  const previousTotal = signed ? (saved?.previous_total_cents ?? 0) : jobTotal;
  const days = parseExtraDays(extraDays);
  const totals = useMemo(
    () =>
      changeOrderTotals(
        lines.map((l) => ({ ...l, total_cents: Math.round(l.qty * l.unit_price_cents) })),
        taxRate,
        previousTotal,
      ),
    [lines, taxRate, previousTotal],
  );
  const draft = { description, lines, extraDays };
  // Another change order signed since this one was written moves the job
  // total, so this one's "new total" is stale until it is saved again.
  const stale = !!saved && !signed && saved.previous_total_cents !== jobTotal;
  const dirty = isDirty(draft, saved) || stale;
  const travelLine = signed ? null : travelSuggestion(quoteTravel, days, lines);
  const busy = saving || drafting;

  const handleDraft = useCallback(async () => {
    if (!job) return;
    if (description.trim().length < 5) {
      Alert.alert('Describe the change first', 'A sentence or two is enough to draft the lines.');
      return;
    }
    const run = async () => {
      setDrafting(true);
      try {
        setLines(await draftChangeOrderLines(job.id, description));
      } catch (err) {
        reportError(err, 'change-order.draft');
        Alert.alert("Couldn't draft the lines", err instanceof Error ? err.message : String(err));
      } finally {
        setDrafting(false);
      }
    };
    const hasLines = lines.some((l) => l.label.trim() || l.unit_price_cents !== 0);
    if (!hasLines) return void run();
    Alert.alert('Replace the lines?', 'The lines you have now will be replaced with a new draft.', [
      { text: 'Keep mine', style: 'cancel' },
      { text: 'Replace', onPress: () => void run() },
    ]);
  }, [job, description, lines]);

  const handleSave = useCallback(async (): Promise<ChangeOrderRow | null> => {
    if (!job) return null;
    const check = checkDraft({ description, lines, extraDays });
    if (!check.ok) {
      Alert.alert('Not ready to save', check.message);
      return null;
    }
    setSaving(true);
    try {
      const row = await saveChangeOrder({
        id: saved?.id,
        job_id: job.id,
        description: description.trim(),
        line_items: check.lines,
        extra_days: check.extraDays,
      });
      setSaved(row);
      setLines(row.line_items);
      // The job total may have moved; show what the server used.
      const fresh = await fetchJob(job.id);
      if (fresh) setJob(fresh);
      return row;
    } catch (err) {
      reportError(err, 'change-order.save');
      Alert.alert("Couldn't save", err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setSaving(false);
    }
  }, [job, saved, description, lines, extraDays]);

  const handleSend = useCallback(
    async (r: Recipient, channels: { email: boolean; sms: boolean }) => {
      if (!saved) return;
      try {
        const list: ('email' | 'sms')[] = [];
        if (channels.email) list.push('email');
        if (channels.sms) list.push('sms');
        const result = await sendChangeOrder({
          id: saved.id,
          channels: list,
          recipient: { name: r.name || null, email: r.email || null, phone: r.phone || null },
        });
        setSendOpen(false);
        setRecipient(r);
        setSaved({ ...saved, status: 'sent', sent_at: result.sent_at });
        if (saved.customer_id) {
          void rememberCustomerContact(saved.customer_id, {
            name: r.name,
            email: channels.email ? r.email : undefined,
            phone: channels.sms ? r.phone : undefined,
          });
        }
        if (result.sms_url) await Linking.openURL(result.sms_url);
        const emailLine = channels.email
          ? result.email_sent
            ? 'Email sent.'
            : `Email failed: ${result.email_error ?? 'unknown error'}`
          : null;
        const smsLine = channels.sms ? 'Messages app opened for you to send.' : null;
        Alert.alert(
          'Sent',
          [emailLine, smsLine, "Don't start this work until it's signed."]
            .filter(Boolean)
            .join('\n'),
        );
      } catch (err) {
        Alert.alert("Couldn't send", err instanceof Error ? err.message : String(err));
      }
    },
    [saved],
  );

  const handleSign = useCallback(
    async (signatureSvg: string, signer: { name: string; consent: boolean }) => {
      if (!saved) return;
      try {
        const row = await signChangeOrderInPerson({
          id: saved.id,
          signature_svg: signatureSvg,
          signer_name: signer.name,
          consent: signer.consent,
        });
        setSaved(row);
        setSignatureOpen(false);
        if (job) {
          const fresh = await fetchJob(job.id);
          if (fresh) setJob(fresh);
        }
      } catch (err) {
        Alert.alert("Couldn't sign", err instanceof Error ? err.message : String(err));
      }
    },
    [saved, job],
  );

  const handleDelete = useCallback(() => {
    if (!saved) return;
    Alert.alert('Delete this change order?', "It hasn't been signed, so nothing else changes.", [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (await deleteChangeOrder(saved.id)) router.back();
          else Alert.alert("Couldn't delete", 'Please try again.');
        },
      },
    ]);
  }, [saved]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
        </View>
      </SafeAreaView>
    );
  }

  if (!job || (!isNew && !saved)) {
    return (
      <LoadFailed
        what="change order"
        onRetry={() => {
          setLoading(true);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  const title = saved ? `Change order ${saved.number}` : 'New change order';

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
          hitSlop={10}
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        {saved && !signed ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete this change order"
            style={styles.back}
            hitSlop={10}
            onPress={handleDelete}
          >
            <Trash2 size={20} color={colors.ink3} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.jobLine} numberOfLines={2}>
            For: {job.title}
          </Text>

          {signed && saved ? (
            <>
              <Card dark>
                <Text style={styles.bannerEyebrow}>SIGNED</Text>
                <Text style={styles.bannerText}>
                  {saved.signer_name ? `${saved.signer_name} signed` : 'Signed'} on{' '}
                  {formatDay(saved.signed_at as string)}. The job total is now{' '}
                  {formatCents(saved.new_total_cents)}.
                </Text>
              </Card>
              <ContractBody body={saved.body_markdown} />
            </>
          ) : (
            <>
              {saved?.status === 'declined' ? (
                <Card>
                  <Text style={styles.notice}>
                    Your customer declined this. Don&apos;t start the work. Change it and save to
                    send it again, or delete it.
                  </Text>
                </Card>
              ) : null}
              {saved?.status === 'sent' && !dirty ? (
                <Card>
                  <Text style={styles.notice}>
                    Sent and waiting for a signature. Don&apos;t start this work until it&apos;s
                    signed. Editing it cancels the link your customer has.
                  </Text>
                </Card>
              ) : null}
              {stale ? (
                <Card>
                  <Text style={styles.notice}>
                    The job total has changed since this was written. Save it again to update the
                    new total before sending.
                  </Text>
                </Card>
              ) : null}

              <Input
                label="What's changing?"
                placeholder="Add a second gate on the east side…"
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
                disabled={busy}
              />

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Draft the lines for me from the description"
                onPress={() => void handleDraft()}
                disabled={busy || paused}
                style={({ pressed }) => [
                  styles.draftButton,
                  (pressed || busy || paused) && styles.pressed,
                ]}
              >
                {drafting ? (
                  <ActivityIndicator color={colors.goldDark} />
                ) : (
                  <Sparkles size={20} color={colors.goldDark} strokeWidth={2} />
                )}
                <Text style={styles.draftLabel}>
                  {drafting ? 'Drafting the lines…' : 'Draft the lines for me'}
                </Text>
              </Pressable>

              <LineItemEditor
                items={lines}
                onChange={setLines}
                allowCredits
                labelPlaceholder="Added labor, materials, or what is credited…"
              />
              <Text style={styles.hint}>
                Price only the change. Mark a line Credit to take money off, for example when the
                customer supplies something.
              </Text>

              <Input
                label="Extra days on the job (optional)"
                placeholder="0"
                value={extraDays}
                onChangeText={(v) => setExtraDays(v.replace(/[^\d]/g, '').slice(0, 3))}
                keyboardType="number-pad"
              />
              {travelLine ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    setLines((prev) => [
                      ...prev.filter((l) => l.label.trim() || l.unit_price_cents),
                      travelLine,
                    ])
                  }
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                >
                  <Text style={styles.suggestionText}>
                    Add travel for {days} extra {days === 1 ? 'day' : 'days'} (
                    {signedMoney(travelLine.total_cents)})
                  </Text>
                </Pressable>
              ) : null}

              <Card>
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>Total before</Text>
                  <Text style={styles.totalsValue}>{formatCents(totals.previous_total_cents)}</Text>
                </View>
                {totals.tax_cents !== 0 ? (
                  <View style={styles.totalsRow}>
                    <Text style={styles.totalsLabel}>Tax on this change</Text>
                    <Text style={styles.totalsValue}>{formatCents(totals.tax_cents)}</Text>
                  </View>
                ) : null}
                <View style={styles.totalsRow}>
                  <Text style={styles.totalsLabel}>This change</Text>
                  <Text style={styles.totalsValue}>{signedMoney(totals.total_cents)}</Text>
                </View>
                <View style={[styles.totalsRow, styles.totalsGrand]}>
                  <Text style={styles.totalsGrandLabel}>New total</Text>
                  <Text style={styles.totalsGrandValue}>{formatCents(totals.new_total_cents)}</Text>
                </View>
              </Card>

              {saved && !dirty ? (
                <View>
                  <Text style={styles.sectionLabel}>What your customer will sign</Text>
                  <ContractBody body={saved.body_markdown} />
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {signed ? (
          <View style={styles.footer}>
            <View style={styles.signedInline}>
              <ShieldCheck size={18} color={colors.success} strokeWidth={2} />
              <Text style={styles.signedLabel}>Signed and locked</Text>
            </View>
          </View>
        ) : dirty ? (
          <View style={styles.footer}>
            <PrimaryButton
              label={saving ? 'Saving…' : saved ? 'Save changes' : 'Save and review'}
              onPress={() => void handleSave()}
              loading={saving}
              disabled={busy || dictating || paused}
            />
          </View>
        ) : (
          <View style={styles.footer}>
            <PrimaryButton
              label={saved?.status === 'sent' ? 'Send again' : 'Send to customer'}
              onPress={() => setSendOpen(true)}
              disabled={paused}
            />
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            <GhostButton
              label="Customer signs now in person"
              onPress={() => setSignatureOpen(true)}
              disabled={paused}
            />
          </View>
        )}
      </KeyboardAvoidingView>

      <SendRecipientSheet
        visible={sendOpen}
        initialRecipient={recipient}
        onCancel={() => setSendOpen(false)}
        onSend={handleSend}
      />
      <SignatureModal
        visible={signatureOpen}
        customerName={recipient.name}
        onCancel={() => setSignatureOpen(false)}
        onSubmit={handleSign}
      />
    </SafeAreaView>
  );
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface2 },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    back: {
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
      paddingBottom: spacing.huge,
      gap: spacing.lg,
    },
    jobLine: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    bannerEyebrow: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 1,
      color: colors.gold,
      marginBottom: spacing.xs,
    },
    bannerText: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      lineHeight: 22,
      color: colors.goldTint,
    },
    notice: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      lineHeight: 22,
      color: colors.ink,
    },
    textarea: {
      minHeight: 96,
      paddingTop: spacing.md,
    },
    draftButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: typography.minTouchTarget,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: colors.goldTint,
    },
    draftLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.goldDark,
    },
    hint: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      lineHeight: 20,
      color: colors.ink3,
      marginTop: -spacing.sm,
    },
    suggestion: {
      minHeight: typography.minTouchTarget,
      justifyContent: 'center',
      marginTop: -spacing.sm,
    },
    suggestionText: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.goldDark,
      textDecorationLine: 'underline',
    },
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
      marginBottom: spacing.sm,
    },
    totalsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.xs,
    },
    totalsLabel: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    totalsValue: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    totalsGrand: {
      marginTop: spacing.sm,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    totalsGrandLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    totalsGrandValue: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.h2,
      color: colors.ink,
    },
    footer: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.lg,
      gap: spacing.sm,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface2,
    },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    orLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.divider,
    },
    orText: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    signedInline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: typography.minTouchTarget,
    },
    signedLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.success,
    },
    pressed: {
      opacity: 0.7,
    },
  });
