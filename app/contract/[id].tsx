import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pencil, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadFailed } from '@/components/ui/LoadFailed';
import { ContractBody } from '@/components/contract/ContractBody';
import { SendRecipientSheet, type Recipient } from '@/components/contract/SendRecipientSheet';
import { SignatureModal } from '@/components/contract/SignatureModal';
import { Card } from '@/components/ui/Card';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { generateContract } from '@/lib/ai';
import { fetchCustomer, rememberCustomerContact } from '@/lib/customers';
import {
  fetchContract,
  submitSignature,
  updateContractBody,
  type ContractRow,
} from '@/lib/contracts';
import { sendQuote } from '@/lib/quotes';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function ContractDetail() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [contract, setContract] = useState<ContractRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [signatureOpen, setSignatureOpen] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [recipient, setRecipient] = useState<Recipient>({ name: '', email: '', phone: '' });

  useEffect(() => {
    if (!id) return;
    void fetchContract(id).then(async (row) => {
      setContract(row);
      setLoading(false);
      if (row) {
        setBody(row.body_markdown);
        if (row.customer_id) {
          const customer = await fetchCustomer(row.customer_id);
          if (customer) {
            setRecipient({
              name: customer.name ?? '',
              email: customer.email ?? '',
              phone: customer.phone ?? '',
            });
          }
        }
      }
    });
  }, [id, attempt]);

  const signed = !!contract?.signed_at;
  const [amending, setAmending] = useState(false);

  const handleAmend = useCallback(() => {
    if (!contract) return;
    Alert.alert(
      'Amend this contract?',
      'The signed version stays locked. A new version is created from it for you to edit and send for signature.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Create amendment',
          onPress: async () => {
            setAmending(true);
            try {
              const next = await generateContract({
                kind: contract.kind,
                quote_id: contract.quote_id ?? '',
                amend_contract_id: contract.id,
              });
              router.replace({ pathname: '/contract/[id]', params: { id: next.id } });
            } catch (err) {
              Alert.alert(
                "Couldn't create the amendment",
                err instanceof Error ? err.message : String(err),
              );
            } finally {
              setAmending(false);
            }
          },
        },
      ],
    );
  }, [contract]);

  // Poll for customer-side signing while the screen is in view and the
  // contract is unsigned. 15s cadence is cheap (one row read) and covers
  // the "contractor is watching as the customer signs" scenario. Refetch
  // immediately on focus so returning to the screen shows fresh state.
  useFocusEffect(
    useCallback(() => {
      if (!id || signed) return;
      let cancelled = false;
      const refresh = async () => {
        const row = await fetchContract(id);
        if (!cancelled && row) setContract(row);
      };
      void refresh();
      const handle = setInterval(refresh, 15_000);
      return () => {
        cancelled = true;
        clearInterval(handle);
      };
    }, [id, signed]),
  );

  const savedSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!contract || signed) return;
    if (body === contract.body_markdown) {
      savedSignature.current = body;
      return;
    }
    if (savedSignature.current === body) return;

    const handle = setTimeout(async () => {
      setSaving('saving');
      const updated = await updateContractBody(contract.id, body);
      if (updated) {
        setContract(updated);
        savedSignature.current = body;
        setSaving('saved');
      } else {
        setSaving('idle');
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [contract, body, signed]);

  const openSignature = useCallback(() => {
    setEditing(false);
    setSignatureOpen(true);
  }, []);

  const openSend = useCallback(() => {
    setEditing(false);
    setSendOpen(true);
  }, []);

  const handleSend = useCallback(
    async (r: Recipient, channels: { email: boolean; sms: boolean }) => {
      if (!contract?.quote_id) {
        Alert.alert("Can't send", 'This contract is not linked to a quote.');
        return;
      }
      try {
        const channelList: ('email' | 'sms')[] = [];
        if (channels.email) channelList.push('email');
        if (channels.sms) channelList.push('sms');

        const result = await sendQuote({
          quote_id: contract.quote_id,
          channels: channelList,
          recipient: {
            name: r.name || null,
            email: r.email || null,
            phone: r.phone || null,
          },
        });

        setSendOpen(false);
        setRecipient(r);

        // Remember the email / phone used so next time it's prefilled.
        if (contract.customer_id) {
          void rememberCustomerContact(contract.customer_id, {
            name: r.name,
            email: channels.email ? r.email : undefined,
            phone: channels.sms ? r.phone : undefined,
          });
        }

        if (result.sms_url) {
          await Linking.openURL(result.sms_url);
        }

        const emailLine = channels.email
          ? result.email_sent
            ? 'Email sent.'
            : `Email failed: ${result.email_error ?? 'unknown error'}`
          : null;
        const smsLine = channels.sms ? 'Messages app opened for you to send.' : null;
        const body = [emailLine, smsLine].filter(Boolean).join('\n');
        Alert.alert('Sent', body || 'Customer will get the signing link shortly.');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        Alert.alert("Couldn't send", message);
      }
    },
    [contract],
  );

  const handleSubmitSignature = useCallback(
    async (signatureSvg: string, signer: { name: string; consent: boolean }) => {
      if (!contract) return;
      try {
        const updated = await submitSignature({
          contract_id: contract.id,
          signature_svg: signatureSvg,
          signer_name: signer.name,
          consent: signer.consent,
        });
        setContract(updated);
        setBody(updated.body_markdown);
        setSignatureOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        Alert.alert("Couldn't sign", message);
      }
    },
    [contract],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingLabel}>Loading contract…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!contract) {
    return (
      <LoadFailed
        what="contract"
        onRetry={() => {
          setLoading(true);
          setAttempt((n) => n + 1);
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
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
        <Text style={styles.title}>{titleFor(contract.kind)}</Text>
        <Text style={styles.saveStatus}>{statusLabel(saving, signed)}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card dark style={styles.banner}>
            <Text style={styles.bannerEyebrow}>
              {signed ? 'SIGNED' : `${contract.state_code} ${contract.kind.toUpperCase()}`}
            </Text>
            <Text style={styles.bannerSub}>
              {signed
                ? signedBannerText(recipient.name, contract.signed_at)
                : 'Review, edit, then send the signing link to your customer.'}
            </Text>
          </Card>

          {editing && !signed ? (
            <View>
              <Text style={styles.sectionLabel}>Contract body (markdown)</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                multiline
                textAlignVertical="top"
                style={styles.bodyField}
              />
            </View>
          ) : (
            <ContractBody body={body} />
          )}
        </ScrollView>

        {!signed ? (
          <View style={styles.footerColumn}>
            <View style={styles.footerRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle edit mode"
                onPress={() => setEditing((e) => !e)}
                style={styles.editIconButton}
              >
                <Pencil size={20} color={colors.ink2} strokeWidth={2} />
              </Pressable>
              <PrimaryButton
                label="Send to customer"
                onPress={openSend}
                style={styles.footerButton}
                accessibilityLabel="Send to customer"
              />
            </View>
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>or</Text>
              <View style={styles.orLine} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Customer signs now in person, on this phone"
              onPress={openSignature}
              style={styles.inlineLink}
            >
              <Text style={styles.inlineLinkText}>Customer signs now in person</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footerColumn}>
            <View style={styles.signedInline}>
              <ShieldCheck size={18} color={colors.success} strokeWidth={2} />
              <Text style={styles.footerSignedLabel}>
                Signed and locked{contract.version > 1 ? ` · version ${contract.version}` : ''}
              </Text>
            </View>
            <GhostButton
              label={amending ? 'Creating amendment…' : 'Amend contract'}
              onPress={handleAmend}
              disabled={amending}
              accessibilityLabel="Create an amended version of this signed contract"
            />
          </View>
        )}
      </KeyboardAvoidingView>

      <SignatureModal
        visible={signatureOpen}
        customerName={recipient.name}
        onCancel={() => setSignatureOpen(false)}
        onSubmit={handleSubmitSignature}
      />

      <SendRecipientSheet
        visible={sendOpen}
        initialRecipient={recipient}
        onCancel={() => setSendOpen(false)}
        onSend={handleSend}
      />
    </SafeAreaView>
  );
}

function titleFor(kind: ContractRow['kind']): string {
  return kind === 'release' ? 'Release of liability' : 'Work agreement';
}

function statusLabel(status: 'idle' | 'saving' | 'saved', signed: boolean): string {
  if (signed) return 'Signed';
  if (status === 'saving') return 'Saving…';
  if (status === 'saved') return 'Saved';
  return '';
}

function formatSignedAt(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function signedBannerText(customerName: string | undefined, signedAt: string | null): string {
  const date = formatSignedAt(signedAt);
  const who = customerName && customerName.trim().length > 0 ? customerName : 'Your customer';
  return `Signed by ${who} on ${date}. Locked.`;
}

/**
 * Minimal markdown renderer: headings (# / ## / ###), bullet lists (- ),
 * and paragraphs. Good enough for the AI-generated contract body. A full
 * markdown dep would add weight we don't need yet.
 */
const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.surface2 },
    flex: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
    loadingLabel: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    title: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    saveStatus: {
      fontFamily: typography.fonts.bodyStrong,
      minWidth: 56,
      textAlign: 'right',
      fontSize: typography.sizes.label,
      color: colors.ink3,
      paddingRight: spacing.md,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xxxl,
      gap: spacing.lg,
    },
    banner: { gap: spacing.xs },
    bannerEyebrow: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      color: colors.gold,
    },
    bannerSub: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.onInverseMuted,
      opacity: 0.85,
    },
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
      marginBottom: spacing.sm,
    },
    bodyField: {
      fontFamily: typography.fonts.body,
      minHeight: 360,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
      padding: spacing.md,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      lineHeight: 22,
    },
    signedInline: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    footerColumn: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.md,
      gap: spacing.sm,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface2,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    footerButton: { flex: 1 },
    orRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.xs,
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
    inlineLink: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      minHeight: typography.minTouchTarget,
      justifyContent: 'center',
    },
    inlineLinkText: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.goldDark,
      textDecorationLine: 'underline',
    },
    editIconButton: {
      width: typography.minTouchTarget,
      height: typography.minTouchTarget,
      borderRadius: radii.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.divider,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerSigned: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.lg,
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      backgroundColor: colors.surface2,
    },
    footerSignedLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.success,
    },
  });
