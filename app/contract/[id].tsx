import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pencil, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { SendRecipientSheet, type Recipient } from '@/components/contract/SendRecipientSheet';
import { SignatureModal } from '@/components/contract/SignatureModal';
import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { fetchCustomer, rememberCustomerContact } from '@/lib/customers';
import {
  fetchContract,
  submitSignature,
  updateContractBody,
  type ContractRow,
} from '@/lib/contracts';
import { sendQuote } from '@/lib/quotes';
import { strings } from '@/lib/strings';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function ContractDetail() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [contract, setContract] = useState<ContractRow | null>(null);
  const [loading, setLoading] = useState(true);
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
  }, [id]);

  const signed = !!contract?.signed_at;

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
    async (signatureSvg: string) => {
      if (!contract) return;
      try {
        const updated = await submitSignature({
          contract_id: contract.id,
          signature_svg: signatureSvg,
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
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.loadingLabel}>Contract not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.back}
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
            <RenderedMarkdown body={body} />
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
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign in person instead"
              onPress={openSignature}
              style={styles.inlineLink}
            >
              <Text style={styles.inlineLinkText}>
                {strings.locked.ctaSignNow} in person instead
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.footerSigned}>
            <ShieldCheck size={18} color={colors.success} strokeWidth={2} />
            <Text style={styles.footerSignedLabel}>Signed and locked</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      <SignatureModal
        visible={signatureOpen}
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
function RenderedMarkdown({ body }: { body: string }) {
  const styles = useStyles(makeStyles);
  const blocks = useMemo(() => tokenize(body), [body]);
  return (
    <View style={styles.mdRoot}>
      {blocks.map((block, i) => {
        if (block.type === 'h1') {
          return (
            <Text key={i} style={styles.mdH1}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'h2') {
          return (
            <Text key={i} style={styles.mdH2}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'h3') {
          return (
            <Text key={i} style={styles.mdH3}>
              {block.text}
            </Text>
          );
        }
        if (block.type === 'ul') {
          return (
            <View key={i} style={styles.mdList}>
              {block.items.map((item, j) => (
                <View key={j} style={styles.mdListItem}>
                  <Text style={styles.mdListBullet}>•</Text>
                  <Text style={styles.mdListText}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={styles.mdParagraph}>
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}

type Block = { type: 'h1' | 'h2' | 'h3' | 'p'; text: string } | { type: 'ul'; items: string[] };

function tokenize(body: string): Block[] {
  const lines = body.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      blocks.push({ type: 'ul', items: list });
      list = [];
    }
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }
    const h1 = line.match(/^#\s+(.*)$/);
    const h2 = line.match(/^##\s+(.*)$/);
    const h3 = line.match(/^###\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (h3) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h3', text: h3[1] });
    } else if (h2) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h2', text: h2[1] });
    } else if (h1) {
      flushParagraph();
      flushList();
      blocks.push({ type: 'h1', text: h1[1] });
    } else if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
    } else {
      flushList();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushList();
  return blocks;
}

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
    mdRoot: { gap: spacing.md },
    mdH1: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
      color: colors.ink,
      marginTop: spacing.md,
    },
    mdH2: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
      marginTop: spacing.sm,
    },
    mdH3: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    mdParagraph: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      lineHeight: 22,
    },
    mdList: { gap: spacing.xs },
    mdListItem: { flexDirection: 'row', gap: spacing.sm },
    mdListBullet: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    mdListText: {
      fontFamily: typography.fonts.body,
      flex: 1,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      lineHeight: 22,
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
    inlineLink: {
      alignSelf: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    inlineLinkText: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      color: colors.ink3,
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
