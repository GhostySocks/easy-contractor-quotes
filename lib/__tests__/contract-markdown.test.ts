import { renderWorkAgreement } from '../../supabase/functions/_shared/contract-template';
import { boldSpans, plainText, priceRows, tokenize, type TableBlock } from '../contract-markdown';

const TABLE = [
  '| Item | Qty | Unit price | Total |',
  '| --- | ---: | ---: | ---: |',
  '| Labor: build 19 doors (approx. 2.5h each) | 47.5 | $65.00 | $3,087.50 |',
  '| Haul-away & disposal | 1 | $350.00 | $350.00 |',
  '| **Total** | | | **$9,929.60** |',
].join('\n');

describe('tokenize', () => {
  it('reads the line-item table as a table, not a paragraph of pipes', () => {
    const blocks = tokenize(`## Price and Payment\n\n${TABLE}\n\nPrices include labor.`);
    expect(blocks.map((b) => b.type)).toEqual(['h2', 'table', 'p']);
    const table = blocks[1] as TableBlock;
    expect(table.header).toEqual(['Item', 'Qty', 'Unit price', 'Total']);
    expect(table.rows).toHaveLength(3);
    expect(table.rows[0]).toEqual([
      'Labor: build 19 doors (approx. 2.5h each)',
      '47.5',
      '$65.00',
      '$3,087.50',
    ]);
  });

  it('never leaves the divider row or a pipe in any text block', () => {
    for (const block of tokenize(TABLE)) {
      if (block.type === 'table') continue;
      expect(JSON.stringify(block)).not.toMatch(/\||---/);
    }
    expect(tokenize(TABLE)).toHaveLength(1);
  });

  it('still reads headings, paragraphs and bullets', () => {
    expect(tokenize('# Title\n\nOne\ntwo\n\n- a\n- b\n\n### Small')).toEqual([
      { type: 'h1', text: 'Title' },
      { type: 'p', text: 'One two' },
      { type: 'ul', items: ['a', 'b'] },
      { type: 'h3', text: 'Small' },
    ]);
  });

  it('finds exactly one table in a real work agreement', () => {
    const body = renderWorkAgreement({
      kind: 'work',
      state_code: 'OH',
      contractor: { business_name: 'Motter Handyman', trade: 'handyman' },
      customer: { name: 'Jane Doe' },
      quote: {
        scope_of_work: 'Build and install 19 doors.',
        line_items: [
          { label: 'Labor', qty: 47.5, unit_price_cents: 6500, total_cents: 308750 },
          { label: 'Materials', qty: 19, unit_price_cents: 21000, total_cents: 399000 },
        ],
        total_cents: 707750,
      },
      generated_at: '2026-11-17T12:00:00Z',
    });
    const tables = tokenize(body).filter((b) => b.type === 'table') as TableBlock[];
    expect(tables).toHaveLength(1);
    expect(priceRows(tables[0])).toHaveLength(3);
  });
});

describe('boldSpans', () => {
  it('splits out bold text and drops the asterisks', () => {
    expect(boldSpans('**Job site:** 9 Lake Rd')).toEqual([
      { text: 'Job site:', bold: true },
      { text: ' 9 Lake Rd', bold: false },
    ]);
  });

  it('handles bold in the middle and plain text alone', () => {
    expect(boldSpans('between **A** and **B** here').map((s) => s.text)).toEqual([
      'between ',
      'A',
      ' and ',
      'B',
      ' here',
    ]);
    expect(boldSpans('nothing bold')).toEqual([{ text: 'nothing bold', bold: false }]);
  });

  it('leaves a stray pair of asterisks alone rather than eating text', () => {
    expect(plainText('5 ** 2 is 25')).toBe('5 ** 2 is 25');
  });
});

describe('priceRows', () => {
  const table = tokenize(TABLE)[0] as TableBlock;

  it('puts quantity and unit price on a line under the item', () => {
    expect(priceRows(table)?.[0]).toEqual({
      label: 'Labor: build 19 doors (approx. 2.5h each)',
      detail: '47.5 × $65.00',
      total: '$3,087.50',
      isTotal: false,
    });
  });

  it('marks the Total row and strips its bold markers', () => {
    expect(priceRows(table)?.[2]).toEqual({
      label: 'Total',
      detail: null,
      total: '$9,929.60',
      isTotal: true,
    });
  });

  it('is null for a table of another shape, which is drawn as a plain grid', () => {
    const other = tokenize('| A | B |\n| --- | --- |\n| 1 | 2 |')[0] as TableBlock;
    expect(priceRows(other)).toBeNull();
  });
});
