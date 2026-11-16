import { StyleSheet, Text, View } from 'react-native';

import { Chip } from '@/components/ui/Chip';
import { Input } from '@/components/ui/Input';
import { formatCents } from '@/lib/pricing';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';
import { travelPreviewCents, type TravelForm } from '@/lib/travel-form';

type Props = {
  form: TravelForm;
  onChange: (patch: Partial<TravelForm>) => void;
  /** Under the miles field: where the estimate came from, or how to get one. */
  milesNote: string | null;
};

/**
 * "Charge for travel?" on New Quote. Asked on every quote; a Yes adds one
 * editable Travel line to the quote from the contractor's own rate.
 */
export function TravelSection({ form, onChange, milesNote }: Props) {
  const styles = useStyles(makeStyles);
  const preview = travelPreviewCents(form);

  return (
    <View style={styles.block}>
      <Text style={styles.label}>Charge for travel?</Text>
      <View style={styles.chips}>
        <Chip label="No" selected={!form.charge} onPress={() => onChange({ charge: false })} />
        <Chip label="Yes" selected={form.charge} onPress={() => onChange({ charge: true })} />
      </View>

      {form.charge ? (
        <>
          <View style={styles.chips}>
            <Chip
              label="Per mile"
              selected={form.mode === 'per_mile'}
              onPress={() => onChange({ mode: 'per_mile' })}
            />
            <Chip
              label="Flat fee"
              selected={form.mode === 'flat'}
              onPress={() => onChange({ mode: 'flat' })}
            />
          </View>

          <Input
            label={form.mode === 'flat' ? 'Travel fee ($)' : 'Rate per mile ($)'}
            placeholder={form.mode === 'flat' ? '75' : '1.50'}
            value={form.rate}
            onChangeText={(rate) => onChange({ rate })}
            keyboardType="decimal-pad"
          />

          {form.mode === 'per_mile' ? (
            <>
              <Input
                label="Miles to the job, one way"
                placeholder="25"
                value={form.miles}
                onChangeText={(miles) => onChange({ miles })}
                keyboardType="number-pad"
              />
              {milesNote ? <Text style={styles.note}>{milesNote}</Text> : null}
            </>
          ) : null}

          <View style={styles.chips}>
            <Chip
              label="Once for the job"
              selected={form.per === 'job'}
              onPress={() => onChange({ per: 'job' })}
            />
            <Chip
              label="Each day"
              selected={form.per === 'day'}
              onPress={() => onChange({ per: 'day' })}
            />
          </View>

          {form.per === 'day' ? (
            <Input
              label="Days on site"
              placeholder="3"
              value={form.days}
              onChangeText={(days) => onChange({ days })}
              keyboardType="number-pad"
            />
          ) : null}

          {preview !== null ? (
            <Text style={styles.preview}>
              Travel on this quote: <Text style={styles.previewAmount}>{formatCents(preview)}</Text>
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    block: {
      gap: spacing.md,
    },
    label: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      letterSpacing: 0.5,
      color: colors.ink2,
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    note: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
      lineHeight: 20,
      marginTop: -spacing.sm,
    },
    preview: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.body,
      color: colors.ink2,
    },
    previewAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      color: colors.ink,
    },
  });
