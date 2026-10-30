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
import { PriceRangeChips } from '@/components/quote/PriceRangeChips';
import { Card } from '@/components/ui/Card';
import { GhostButton } from '@/components/ui/GhostButton';
import { PrimaryButton } from '@/components/ui/PrimaryButton';
import { generateContract, type LineItem } from '@/lib/ai';
import { useAuth } from '@/lib/auth-store';
import {
  computeSubtotalCents,
  computeTaxCents,
  computeTotalCents,
  formatCents,
  type PriceBucket,
  scaleLineItems,
} from '@/lib/pricing';
import { fetchProfile } from '@/lib/profile';
import { fetchQuote, type QuoteRow, updateQuote } from '@/lib/quotes';
import { strings } from '@/lib/strings';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';

const AUTOSAVE_DEBOUNCE_MS = 800;

export default function QuoteDetail() {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [quote, setQuote] = useState<QuoteRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [bucket, setBucket] = useState<PriceBucket>('most_likely');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [generating, setGenerating] = useState(false);
  const user = useAuth((s) => s.user);
  // Sales tax from the business profile (percent). Null until loaded so we
  // never autosave a $0 tax over a real rate during the first render.
  const [taxRate, setTaxRate] = useState<number | null>(null);

  // The "most likely" line items. Picking a price bucket scales *these*;
  // editing a line item by hand replaces them and resets the bucket.
  const baseItems = useRef<LineItem[]>([]);

  // Load the quote row once on mount.
  useEffect(() => {
    if (!id) return;
    void fetchQuote(id).then((row) => {
      setQuote(row);
      setLoading(false);
      if (row) {
        setScope(row.scope_of_work ?? '');
        setLineItems(row.line_items);
        baseItems.current = row.line_items;
      }
    });
  }, [id]);

  useEffect(() => {
    if (!user) return;
    void fetchProfile(user.id).then((profile) => {
      setTaxRate(Number(profile?.default_tax_rate ?? 0));
    });
  }, [user]);

  const handleLineItemsChange = useCallback((items: LineItem[]) => {
    baseItems.current = items;
    setBucket('most_likely');
    setLineItems(items);
  }, []);

  const handleBucketSelect = useCallback((next: PriceBucket) => {
    setBucket(next);
    setLineItems(scaleLineItems(baseItems.current, next));
  }, []);

  const rate = taxRate ?? 0;
  const subtotal = computeSubtotalCents(lineItems);
  const tax = computeTaxCents(subtotal, rate);
  const total = computeTotalCents(subtotal, tax);

  // What each chip would make the total, derived from the base items so the
  // chips stay stable while one of them is selected.
  const bucketTotal = (b: PriceBucket) => {
    const sub = computeSubtotalCents(scaleLineItems(baseItems.current, b));
    return computeTotalCents(sub, computeTaxCents(sub, rate));
  };
  const low = bucketTotal('low');
  const mostLikely = bucketTotal('most_likely');
  const high = bucketTotal('high');

  // Debounced autosave whenever the editable pieces change.
  const savedSignature = useRef<string | null>(null);
  useEffect(() => {
    if (!quote || taxRate === null) return;
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
  }, [quote, taxRate, scope, lineItems, subtotal, tax, total, low, high]);

  const handleSend = useCallback(async () => {
    if (!quote) return;
    if (saving === 'saving') {
      // Let the autosave flush so the contract is generated from the latest scope/line items.
      return;
    }
    setGenerating(true);
    try {
      const contract = await generateContract({ kind: 'work', quote_id: quote.id });
      router.replace({ pathname: '/contract/[id]', params: { id: contract.id } });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      Alert.alert("Couldn't generate contract", message);
    } finally {
      setGenerating(false);
    }
  }, [quote, saving]);

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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
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

          <LineItemEditor items={lineItems} onChange={handleLineItemsChange} />

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
              most_likely_cents={mostLikely}
              high_cents={high}
              selected={bucket}
              onSelect={handleBucketSelect}
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
            label={generating ? 'Generating contract…' : strings.locked.ctaSendQuote}
            onPress={handleSend}
            loading={generating}
            disabled={generating}
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

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
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
    aiBanner: {
      gap: spacing.xs,
    },
    aiEyebrow: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.gold,
    },
    aiSub: {
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
    scopeField: {
      fontFamily: typography.fonts.body,
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
      borderTopColor: colors.divider,
      borderTopWidth: StyleSheet.hairlineWidth,
      paddingTop: spacing.md,
    },
    totalsGrandLabel: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    totalsGrandValue: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.h3,
      color: colors.ink,
    },
    stateNote: {
      fontFamily: typography.fonts.body,
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
