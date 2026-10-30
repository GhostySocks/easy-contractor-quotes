import { Alert } from 'react-native';

import { useAuth } from './auth-store';
import { listJobsByDateRange } from './jobs';
import { fetchProfile } from './profile';
import { findConflicts, type Block } from './schedule-conflicts';
import { supabase } from './supabase';

/** Time the contractor blocked off (PRD CL-03). RLS limits every call to the owner. */

export async function listBlocks(fromIso: string, toIso: string): Promise<Block[]> {
  const { data, error } = await supabase
    .from('availability')
    .select('id, starts_at, ends_at')
    .eq('kind', 'unavailable')
    .lt('starts_at', toIso)
    .gt('ends_at', fromIso)
    .order('starts_at', { ascending: true });
  if (error) {
    console.warn('[availability] list failed', error.message);
    return [];
  }
  return (data ?? []) as Block[];
}

export async function createBlock(startsAt: string, endsAt: string): Promise<Block | null> {
  const userId = useAuth.getState().user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from('availability')
    .insert({ user_id: userId, starts_at: startsAt, ends_at: endsAt, kind: 'unavailable' })
    .select('id, starts_at, ends_at')
    .single();
  if (error) {
    console.warn('[availability] create failed', error.message);
    return null;
  }
  return data as Block;
}

export async function deleteBlock(id: string): Promise<boolean> {
  const { error } = await supabase.from('availability').delete().eq('id', id);
  if (error) console.warn('[availability] delete failed', error.message);
  return !error;
}

/**
 * Before saving a start time, check it against other jobs (with the
 * profile's travel buffer) and blocked time. Resolves true to go ahead:
 * immediately when there's no conflict, or when the contractor chooses
 * "Schedule anyway". A failed lookup never blocks scheduling.
 */
export async function confirmScheduleSlot(
  startIso: string,
  excludeJobId?: string,
): Promise<boolean> {
  try {
    const userId = useAuth.getState().user?.id;
    const start = new Date(startIso);
    const from = new Date(start.getTime() - 24 * 3_600_000).toISOString();
    const to = new Date(start.getTime() + 24 * 3_600_000).toISOString();
    const [jobs, blocks, profile] = await Promise.all([
      listJobsByDateRange(from, to),
      listBlocks(from, to),
      userId ? fetchProfile(userId) : Promise.resolve(null),
    ]);
    const conflicts = findConflicts({
      startIso,
      jobs,
      blocks,
      bufferMinutes: profile?.travel_buffer_minutes ?? 30,
      excludeJobId,
    });
    if (conflicts.length === 0) return true;

    const lines = conflicts.map((c) => {
      const t = new Date(c.at).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      });
      return c.kind === 'job' ? `• ${c.label} at ${t}` : `• ${c.label}`;
    });
    const buffer = profile?.travel_buffer_minutes ?? 30;
    return await new Promise<boolean>((resolve) =>
      Alert.alert(
        'That time is tight',
        `${lines.join('\n')}${buffer > 0 ? `\n\nIncludes ${buffer} min of travel time.` : ''}`,
        [
          { text: 'Pick another time', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Schedule anyway', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      ),
    );
  } catch (err) {
    console.warn('[availability] conflict check failed', err);
    return true;
  }
}
