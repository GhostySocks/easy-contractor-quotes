/**
 * Reads the contract text into blocks the app can draw. Pure, unit-tested
 * (lib/__tests__/contract-markdown.test.ts).
 *
 * The contract is stored as markdown (supabase/functions/_shared/
 * contract-template.ts). This handles exactly what that template writes:
 * headings, paragraphs, bullet lists, **bold**, and the line-item table. The
 * customer signing page has its own HTML twin (_shared/markdown.ts).
 */

export type Span = { text: string; bold: boolean };

export type TableBlock = {
  type: 'table';
  /** Column titles, or null for a table written without a header row. */
  header: string[] | null;
  rows: string[][];
};

export type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'p'; text: string }
  | { type: 'ul'; items: string[] }
  | TableBlock;

/** Split text on **bold** markers, so the asterisks never reach the screen. */
export function boldSpans(text: string): Span[] {
  const spans: Span[] = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = pattern.exec(text); m; m = pattern.exec(text)) {
    if (m.index > last) spans.push({ text: text.slice(last, m.index), bold: false });
    spans.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false });
  return spans;
}

/** The text with bold markers removed, for places that draw their own emphasis. */
export function plainText(text: string): string {
  return boldSpans(text)
    .map((s) => s.text)
    .join('');
}

function isTableRow(line: string): boolean {
  return line.length > 1 && line.startsWith('|') && line.endsWith('|');
}

function isDividerRow(line: string): boolean {
  return /^\|(\s*:?-{3,}:?\s*\|)+$/.test(line);
}

function cells(line: string): string[] {
  return line
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
}

function tableFrom(lines: string[]): TableBlock {
  const hasHeader = lines.length > 1 && isDividerRow(lines[1]);
  return {
    type: 'table',
    header: hasHeader ? cells(lines[0]) : null,
    rows: (hasHeader ? lines.slice(2) : lines).filter((l) => !isDividerRow(l)).map(cells),
  };
}

export function tokenize(body: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      blocks.push({ type: 'p', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (list.length) {
      blocks.push({ type: 'ul', items: list });
      list = [];
    }
    if (table.length) {
      blocks.push(tableFrom(table));
      table = [];
    }
  };

  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      flush();
      const type = (['h1', 'h2', 'h3'] as const)[heading[1].length - 1];
      blocks.push({ type, text: heading[2] });
    } else if (isTableRow(line)) {
      if (!table.length) flush();
      table.push(line);
    } else if (bullet) {
      if (!list.length) flush();
      list.push(bullet[1]);
    } else {
      if (!paragraph.length) flush();
      paragraph.push(line);
    }
  }
  flush();
  return blocks;
}

export type PriceRow = {
  label: string;
  /** "47.5 × $65.00", or null when the row has no quantity and unit price. */
  detail: string | null;
  total: string;
  /** The closing Total row. */
  isTotal: boolean;
};

/**
 * The line-item table as rows that fit a phone: the item on one line, its
 * quantity and unit price beneath, the amount on the right. Four columns
 * (Item, Qty, Unit price, Total) is the only table the template writes; any
 * other shape returns null and is drawn as a plain grid.
 */
export function priceRows(table: TableBlock): PriceRow[] | null {
  if (table.header?.length !== 4 || table.rows.some((r) => r.length !== 4)) return null;
  return table.rows.map((r) => {
    const [label, qty, unit, total] = r.map(plainText);
    return {
      label,
      detail: qty && unit ? `${qty} × ${unit}` : null,
      total,
      isTotal: r[0].startsWith('**'),
    };
  });
}
