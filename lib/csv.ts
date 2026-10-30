/**
 * Tiny RFC-4180-ish CSV writer. Quotes every value defensively so commas,
 * newlines, and double-quotes inside fields don't break parsing in Excel /
 * Numbers / Google Sheets.
 */

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

export function toCSV<T>(rows: readonly T[], columns: readonly CsvColumn<T>[]): string {
  const headerLine = columns.map((c) => escapeField(c.header)).join(',');
  const bodyLines = rows.map((row) =>
    columns.map((c) => escapeField(formatCell(c.value(row)))).join(','),
  );
  // CRLF per RFC 4180 — Excel prefers it.
  return [headerLine, ...bodyLines].join('\r\n');
}

function formatCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function escapeField(s: string): string {
  // Always quote so we don't have to reason about which characters require it.
  return `"${s.replace(/"/g, '""')}"`;
}
