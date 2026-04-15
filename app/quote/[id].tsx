import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
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

import { LineItemEditor } from '@/components/quote/LineItemEditor';
import { PriceRangeChips, type PriceBucket } from '@/components/quote/PriceRangeChips';
import { Card } from '@/components/ui/Card';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import type { LineItem } from '@/lib/ai';
import {
  computeSubtotalCents,
  computeTaxCents,
  computeTotalCents,
  formatCents,
} from '@/lib/pricing';
import { fetchQuote, type QuoteRow, updateQuote } from '@/lib/quotes';
import { strings } from '@/lib/strings';
import { colors, radii, spacing, typography } from '@/lib/theme';

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function QuoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [bucket, setBucket] = useState<PriceBucket>('most_likely');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');

  // Load the quote row once on mount.
  useEffect(() => {
    if (!id) return;
    void fetchQuote(id).then((row) => {
      setQuote(row);
      setLoading(false);
      if (row) {
        setScope(row.scope_of_work ?? '');
        setLineItems(row.line_items);
      }
    });
  }, [id]);

  const subtotal = computeSubtotalCents(lineItems);
  const tax = computeTaxCents(subtotal, 0);
  const total = computeTotalCents(subtotal, tax);
  const low = Math.round(total * 0.8);
  const high = Math.round(total * 1.25);

  // Debounced autosave whenever the editable pieces change.
  const savedSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!quote) return;
    const signature = JSON.stringify({ scope, lineItems, subtotal, total });
    if (savedSignature.current === signature) return;

    const handle = setTimeout(async () => {
      setSaving('saving');
      const updated = await updateQuote(quote.id, {
        scope_of_work: scope,
        line_items: lineItems,
        subtotal_cents: subtotal,
        tax_cents: tax,
        total_cents: total,
        total_low_cents: low,
        total_high_cents: high,
      });
      if (updated) {
        setQuote(updated);
        savedSignature.current = signature;
        setSaving('saved');
      } else {
        setSaving('idle');
      }
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(handle);
  }, [quote, scope, lineItems, subtotal, tax, total, low, high]);

  const handleSend = useCallback(() => {
    Alert.alert('Send & sign', 'Wired in M1d. For now, the draft stays in your Jobs list.');
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.gold} />
          <Text style={styles.loadingLabel}>Loading quote…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!quote) {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.loadingLabel}>Quote not found.</Text>
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
          onPress={() => router.replace('/(tabs)/home')}
        >
          <ChevronLeft size={22} color={colors.ink2} strokeWidth={2} />
        </Pressable>
        <Text style={styles.title}>Quote</Text>
        <Text style={styles.saveStatus}>{statusLabel(saving)}</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Card dark style={styles.aiBanner}>
            <Text style={styles.aiEyebrow}>AI quote generated</Text>
            {quote.ai_generation_ms != null ? (
              <Text style={styles.aiSub}>
                {(quote.ai_generation_ms / 1000).toFixed(1)}s · {lineItems.length} line items
              </Text>
            ) : null}
          </Card>

          <View>
            <Text style={styles.sectionLabel}>Scope of work</Text>
            <TextInput
              value={scope}
              onChangeText={setScope}
              multiline
              textAlignVertical="top"
              style={styles.scopeField}
            />
          </View>

          <LineItemEditor items={lineItems} onChange={setLineItems} />

          <Card>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{formatCents(subtotal)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Tax</Text>
              <Text style={styles.totalsValue}>{formatCents(tax)}</Text>
            </View>
            <View style={[styles.totalsRow, styles.totalsGrand]}>
              <Text style={styles.totalsGrandLabel}>Total</Text>
              <Text style={styles.totalsGrandValue}>{formatCents(total)}</Text>
            </View>
          </Card>

          <View>
            <Text style={styles.sectionLabel}>Price range</Text>
            <PriceRangeChips
              low_cents={low}
              most_likely_cents={total}
              high_cents={high}
              selected={bucket}
              onSelect={setBucket}
            />
          </View>

          {quote.state_notes ? (
            <Card>
              <Text style={styles.sectionLabel}>State notes</Text>
              <Text style={styles.stateNote}>{quote.state_notes}</Text>
            </Card>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <GhostButton
            label="Save draft"
            onPress={() => router.replace('/(tabs)/home')}
            style={styles.footerButton}
          />
          <PrimaryButton
            label={strings.locked.ctaSendQuote}
            onPress={handleSend}
            style={styles.footerButton}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function statusLabel(status: 'idle' | 'saving' | 'saved'): string {
  switch (status) {
    case 'saving':
      return 'Saving…';
    case 'saved':
      return 'Saved';
    default:
      return '';
  }
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.surface2,
  },
  flex: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingLabel: {
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
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typography.sizes.h3,
    fontWeight: '800',
    color: colors.ink,
  },
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
  aiBanner: {
    gap: spacing.xs,
  },
  aiEyebrow: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.gold,
  },
  aiSub: {
    fontSize: typography.sizes.bodySmall,
    color: colors.goldTint,
    opacity: 0.85,
  },
  sectionLabel: {
    fontSize: typography.sizes.label,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.ink3,
    marginBottom: spacing.sm,
  },
  scopeField: {
    minHeight: 100,
    borderRadius: radii.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: spacing.md,
    fontSize: typography.sizes.bodySmall,
    color: colors.ink,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  totalsLabel: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink2,
  },
  totalsValue: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink,
    fontWeight: '600',
  },
  totalsGrand: {
    marginTop: spacing.sm,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  totalsGrandLabel: {
    fontSize: typography.sizes.h3,
    color: colors.ink,
    fontWeight: '800',
  },
  totalsGrandValue: {
    fontSize: typography.sizes.h3,
    color: colors.ink,
    fontWeight: '800',
  },
  stateNote: {
    fontSize: typography.sizes.bodySmall,
    color: colors.ink2,
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    borderTopColor: colors.divider,
    borderTopWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surface2,
  },
  footerButton: {
    flex: 1,
  },
});
