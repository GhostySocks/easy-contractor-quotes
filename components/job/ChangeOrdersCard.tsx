import { router, useFocusEffect } from 'expo-router';
import { FilePlus2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import {
  CHANGE_ORDER_STATUS_LABEL,
  listChangeOrders,
  type ChangeOrderRow,
  type ChangeOrderStatus,
} from '@/lib/change-orders';
import { radii, spacing, typography, type Colors } from '@/lib/theme';
import { useStyles, useTheme } from '@/lib/theme-context';
import { signedMoney } from '@/supabase/functions/_shared/change-order';

type Props = {
  jobId: string;
  /** False once the job is paid or cancelled: existing ones still show, no new ones. */
  canAdd: boolean;
};

/**
 * The job's change orders, and the way to add one. Reloads whenever the job
 * page comes back into view, so a change order saved or signed a moment ago
 * is already here.
 */
export function ChangeOrdersCard({ jobId, canAdd }: Props) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [orders, setOrders] = useState<ChangeOrderRow[]>([]);

  useFocusEffect(
    useCallback(() => {
      let live = true;
      void listChangeOrders(jobId).then((rows) => {
        if (live) setOrders(rows);
      });
      return () => {
        live = false;
      };
    }, [jobId]),
  );

  if (orders.length === 0 && !canAdd) return null;

  return (
    <Card>
      <Text style={styles.sectionLabel}>Change orders</Text>

      {orders.length === 0 ? (
        <Text style={styles.empty}>
          Extra work or a hidden problem? Write it up and get it signed before you start.
        </Text>
      ) : (
        <View style={styles.list}>
          {orders.map((co) => (
            <Pressable
              key={co.id}
              accessibilityRole="button"
              accessibilityLabel={`Change order ${co.number}, ${CHANGE_ORDER_STATUS_LABEL[co.status]}, ${signedMoney(co.total_cents)}`}
              onPress={() => router.push({ pathname: '/change-order/[id]', params: { id: co.id } })}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {co.number}. {co.description}
                </Text>
                <Text style={[styles.status, statusStyle(styles, co.status)]}>
                  {CHANGE_ORDER_STATUS_LABEL[co.status]}
                </Text>
              </View>
              <Text style={[styles.amount, co.status !== 'signed' && styles.amountPending]}>
                {signedMoney(co.total_cents)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {canAdd ? (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/change-order/[id]', params: { id: 'new', jobId } })
          }
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <FilePlus2 size={20} color={colors.goldDark} strokeWidth={2} />
          <Text style={styles.addLabel}>Add change order</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function statusStyle(styles: ReturnType<typeof makeStyles>, status: ChangeOrderStatus) {
  if (status === 'signed') return styles.statusSigned;
  if (status === 'sent') return styles.statusSent;
  if (status === 'declined') return styles.statusDeclined;
  return null;
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    sectionLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.label,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      color: colors.ink3,
      marginBottom: spacing.sm,
    },
    empty: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      lineHeight: 22,
      color: colors.ink2,
    },
    list: {
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: typography.minTouchTarget,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    rowText: {
      flex: 1,
      gap: spacing.xs,
    },
    rowTitle: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
    status: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    statusSigned: { color: colors.success },
    statusSent: { color: colors.warn },
    statusDeclined: { color: colors.danger },
    amount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    // Not signed yet, so not part of the job total yet.
    amountPending: {
      color: colors.ink3,
    },
    add: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      minHeight: typography.minTouchTarget,
      marginTop: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface2,
    },
    addLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.goldDark,
    },
    pressed: {
      opacity: 0.7,
    },
  });
