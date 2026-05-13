import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

import { listCustomers, type CustomerWithJobs } from './customers';
import { toCSV, type CsvColumn } from './csv';

const COLUMNS: CsvColumn<CustomerWithJobs>[] = [
  { header: 'Name', value: (c) => c.name },
  { header: 'Phone', value: (c) => c.phone },
  { header: 'Email', value: (c) => c.email },
  { header: 'Address 1', value: (c) => c.address_line1 },
  { header: 'Address 2', value: (c) => c.address_line2 },
  { header: 'City', value: (c) => c.city },
  { header: 'State', value: (c) => c.state_code },
  { header: 'Postal code', value: (c) => c.postal_code },
  { header: 'Tags', value: (c) => c.tags.join(', ') },
  { header: 'Jobs', value: (c) => c.job_count },
  { header: 'Lifetime value (USD)', value: (c) => (c.lifetime_value_cents / 100).toFixed(2) },
  { header: 'Last job', value: (c) => formatDateOnly(c.last_job_at) },
  { header: 'Created', value: (c) => formatDateOnly(c.created_at) },
  { header: 'Notes', value: (c) => c.notes },
];

export type CustomerExportResult =
  | { status: 'shared'; rowCount: number }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

/**
 * Fetch every customer the user owns, build a CSV in the OS cache directory,
 * and open the system share sheet so they can hand it off to Files / Mail /
 * Drive / Numbers.
 *
 * The file is written to the cache dir (not document dir) so the OS can
 * reclaim it freely — the share sheet copies the bytes into whichever
 * destination the user picks.
 */
export async function exportCustomersCSV(): Promise<CustomerExportResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { status: 'unsupported' };
    }

    // Limit higher than any plausible solo contractor's customer count;
    // we can paginate properly if a power user ever hits this.
    const customers = await listCustomers({ limit: 10000 });
    const csv = toCSV(customers, COLUMNS);

    const stamp = new Date().toISOString().slice(0, 10);
    const uri = `${FileSystem.cacheDirectory ?? ''}customers-${stamp}.csv`;
    await FileSystem.writeAsStringAsync(uri, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Sharing.shareAsync(uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Export customers',
      UTI: 'public.comma-separated-values-text',
    });
    return { status: 'shared', rowCount: customers.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { status: 'error', message };
  }
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return '';
  // Slice off the time so the column reads cleanly in spreadsheets.
  return iso.slice(0, 10);
}
