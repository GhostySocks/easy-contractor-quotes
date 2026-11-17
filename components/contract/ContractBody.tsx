import { useMemo } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import { boldSpans, priceRows, tokenize, type TableBlock } from '@/lib/contract-markdown';
import { spacing, typography, type Colors } from '@/lib/theme';
import { useStyles } from '@/lib/theme-context';

/**
 * The contract as the contractor reads it in the app: headings, paragraphs,
 * bullets, bold, and the price table drawn as rows rather than raw markup.
 */
export function ContractBody({ body }: { body: string }) {
  const styles = useStyles(makeStyles);
  const blocks = useMemo(() => tokenize(body), [body]);
  return (
    <View style={styles.root}>
      {blocks.map((block, i) => {
        if (block.type === 'table') return <Table key={i} table={block} />;
        if (block.type === 'ul') {
          return (
            <View key={i} style={styles.list}>
              {block.items.map((item, j) => (
                <View key={j} style={styles.listItem}>
                  <Text style={styles.listBullet}>•</Text>
                  <Rich text={item} style={styles.listText} />
                </View>
              ))}
            </View>
          );
        }
        const style =
          block.type === 'h1'
            ? styles.h1
            : block.type === 'h2'
              ? styles.h2
              : block.type === 'h3'
                ? styles.h3
                : styles.paragraph;
        return <Rich key={i} text={block.text} style={style} />;
      })}
    </View>
  );
}

/** Text with its **bold** parts drawn bold. */
function Rich({ text, style }: { text: string; style: TextStyle }) {
  const styles = useStyles(makeStyles);
  return (
    <Text style={style}>
      {boldSpans(text).map((span, i) =>
        span.bold ? (
          <Text key={i} style={styles.bold}>
            {span.text}
          </Text>
        ) : (
          span.text
        ),
      )}
    </Text>
  );
}

function Table({ table }: { table: TableBlock }) {
  const styles = useStyles(makeStyles);
  const rows = priceRows(table);

  // The line-item table: item, with quantity × unit price beneath, amount at right.
  if (rows) {
    return (
      <View style={styles.table} accessibilityRole="summary">
        {rows.map((row, i) => (
          <View key={i} style={[styles.priceRow, row.isTotal && styles.totalRow]}>
            <View style={styles.priceLabelColumn}>
              <Text style={row.isTotal ? styles.totalLabel : styles.priceLabel}>{row.label}</Text>
              {row.detail ? <Text style={styles.priceDetail}>{row.detail}</Text> : null}
            </View>
            <Text style={row.isTotal ? styles.totalAmount : styles.priceAmount}>{row.total}</Text>
          </View>
        ))}
      </View>
    );
  }

  // Any other table a contractor typed in: a plain grid.
  return (
    <View style={styles.table}>
      {table.header ? (
        <View style={styles.gridRow}>
          {table.header.map((cell, i) => (
            <Rich key={i} text={cell} style={styles.gridHeader} />
          ))}
        </View>
      ) : null}
      {table.rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((cell, j) => (
            <Rich key={j} text={cell} style={styles.gridCell} />
          ))}
        </View>
      ))}
    </View>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    root: { gap: spacing.md },
    h1: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h2,
      color: colors.ink,
      marginTop: spacing.md,
    },
    h2: {
      fontFamily: typography.fonts.displayHeavy,
      fontSize: typography.sizes.h3,
      color: colors.ink,
      marginTop: spacing.sm,
    },
    h3: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    paragraph: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      lineHeight: 22,
    },
    bold: {
      fontFamily: typography.fonts.bodyStrong,
    },
    list: { gap: spacing.xs },
    listItem: { flexDirection: 'row', gap: spacing.sm },
    listBullet: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink2,
    },
    listText: {
      fontFamily: typography.fonts.body,
      flex: 1,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
      lineHeight: 22,
    },
    table: {
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    priceLabelColumn: {
      flex: 1,
      gap: spacing.xs,
    },
    priceLabel: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      lineHeight: 22,
      color: colors.ink,
    },
    priceDetail: {
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      fontVariant: ['tabular-nums'],
      color: colors.ink3,
    },
    priceAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.bodySmall,
      lineHeight: 22,
      color: colors.ink,
      textAlign: 'right',
    },
    totalRow: {
      borderBottomWidth: 0,
    },
    totalLabel: {
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.body,
      color: colors.ink,
    },
    totalAmount: {
      fontFamily: typography.fonts.numeric,
      fontVariant: ['tabular-nums'],
      fontSize: typography.sizes.body,
      color: colors.ink,
      textAlign: 'right',
    },
    gridRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    gridHeader: {
      flex: 1,
      fontFamily: typography.fonts.bodyStrong,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink3,
    },
    gridCell: {
      flex: 1,
      fontFamily: typography.fonts.body,
      fontSize: typography.sizes.bodySmall,
      color: colors.ink,
    },
  });
