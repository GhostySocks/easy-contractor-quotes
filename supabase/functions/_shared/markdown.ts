/**
 * Minimal markdown to HTML for contract text, shared by the customer signing
 * page and the signed-copy emails. Pure, unit-tested
 * (lib/__tests__/markdown.test.ts).
 *
 * Handles exactly what _shared/contract-template.ts writes: headings,
 * paragraphs, bullet lists, **bold**, and the line-item table. Every text
 * value is HTML-escaped first, because a contractor can edit the contract
 * body and it is shown to someone else.
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape, then turn **bold** into <strong>. */
function inline(text: string): string {
  return escapeHtml(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function isTableRow(line: string): boolean {
  return line.startsWith('|') && line.endsWith('|') && line.length > 1;
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

/** Columns marked `---:` in the divider row are right-aligned (the money columns). */
function alignments(divider: string): boolean[] {
  return cells(divider).map((c) => c.endsWith(':') && !c.startsWith(':'));
}

function renderTable(rows: string[]): string {
  const hasHeader = rows.length > 1 && isDividerRow(rows[1]);
  const right = hasHeader ? alignments(rows[1]) : [];
  const body = hasHeader ? rows.slice(2) : rows;
  const cell = (tag: 'th' | 'td', text: string, i: number) =>
    `<${tag}${right[i] ? ' style="text-align:right"' : ''}>${inline(text)}</${tag}>`;
  const head = hasHeader
    ? `<thead><tr>${cells(rows[0])
        .map((c, i) => cell('th', c, i))
        .join('')}</tr></thead>`
    : '';
  const lines = body
    .map(
      (r) =>
        `<tr>${cells(r)
          .map((c, i) => cell('td', c, i))
          .join('')}</tr>`,
    )
    .join('');
  return `<table>${head}<tbody>${lines}</tbody></table>`;
}

export function markdownToHtml(md: string): string {
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let table: string[] = [];

  const flush = () => {
    if (paragraph.length) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
    if (list.length) {
      out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join('')}</ul>`);
      list = [];
    }
    if (table.length) {
      out.push(renderTable(table));
      table = [];
    }
  };

  for (const raw of md.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    const bullet = line.match(/^[-*]\s+(.*)$/);
    if (heading) {
      flush();
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
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
  return out.join('\n');
}
