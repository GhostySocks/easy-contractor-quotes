import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Pencil, ShieldCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/ui/Card';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { fetchContract, updateContractBody, type ContractRow } from '@/lib/contracts';
import { strings } from '@/lib/strings';
import { colors, radii, spacing, typography } from '@/lib/theme';

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function ContractDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [contract, setContract] = useState<ContractRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    if (!id) return;
    void fetchContract(id).then((row) => {
      setContract(row);
      setLoading(false);
      if (row) setBody(row.body_markdown);
    });
  }, [id]);

  const signed = !!contract?.signed_at;

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

  const handleSign = useCallback(() => {
    Alert.alert('Sign now', 'Signature canvas wires in M1c-4. The row will become immutable.');
  }, []);

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
                ? `Signed ${formatSignedAt(contract.signed_at)} — this document is locked.`
                : 'Review, edit, and tap Sign now when ready.'}
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
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Toggle edit mode"
              onPress={() => setEditing((e) => !e)}
              style={styles.editIconButton}
            >
              <Pencil size={20} color={colors.ink2} strokeWidth={2} />
            </Pressable>
            <PrimaryButton
              label={strings.locked.ctaSignNow}
              onPress={handleSign}
              style={styles.footerButton}
            />
          </View>
        ) : (
          <View style={styles.footerSigned}>
            <ShieldCheck size={18} color={colors.success} strokeWidth={2} />
            <Text style={styles.footerSignedLabel}>Signed and locked</Text>
          </View>
        )}
      </KeyboardAvoidingView>
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

/**
 * Minimal markdown renderer: headings (# / ## / ###), bullet lists (- ),
 * and paragraphs. Good enough for the AI-generated contract body. A full
 * markdown dep would add weight we don't need yet.
 */
function RenderedMarkdown({ body }: { body: string }) {
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface2 },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  loadingLabel: { fontSize: typography.sizes.bodySmall, color: colors.ink2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: typography.sizes.h3, fontWeight: '800', color: colors.ink },
  saveStatus: {
    minWidth: 56,
    textAlign: 'right',
    fontSize: typography.sizes.label,
    color: colors.ink3,
    fontWeight: '600',
    paddingRight: spacing.md,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  banner: { gap: spacing.xs },
  bannerEyebrow: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.gold,
  },
  bannerSub: { fontSize: typography.sizes.bodySmall, color: colors.goldTint, opacity: 0.85 },
  sectionLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ink3,
    marginBottom: spacing.sm,
  },
  bodyField: {
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
    fontSize: typography.sizes.h2,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.md,
  },
  mdH2: {
    fontSize: typography.sizes.h3,
    fontWeight: '800',
    color: colors.ink,
    marginTop: spacing.sm,
  },
  mdH3: { fontSize: typography.sizes.bodySmall, fontWeight: '700', color: colors.ink2 },
  mdParagraph: { fontSize: typography.sizes.bodySmall, color: colors.ink, lineHeight: 22 },
  mdList: { gap: spacing.xs },
  mdListItem: { flexDirection: 'row', gap: spacing.sm },
  mdListBullet: { fontSize: typography.sizes.bodySmall, color: colors.ink2 },
  mdListText: { flex: 1, fontSize: typography.sizes.bodySmall, color: colors.ink, lineHeight: 22 },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface2,
    alignItems: 'center',
  },
  footerButton: { flex: 1 },
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
    fontSize: typography.sizes.bodySmall,
    color: colors.success,
    fontWeight: '700',
  },
});
