import {
  blockDays,
  findConflicts,
  isWholeDay,
  wholeDay,
  type ScheduledJob,
} from '../schedule-conflicts';

// Local times so the tests mean the same thing in any timezone.
const at = (h: number, m = 0, day = 4) => new Date(2026, 10, day, h, m).toISOString();

describe('findConflicts', () => {
  const jobs: ScheduledJob[] = [
    { id: 'a', title: 'Faucet', customer_name: 'Jane', scheduled_at: at(9), status: 'scheduled' },
    { id: 'b', title: 'Drywall', scheduled_at: at(15), status: 'scheduled' },
    { id: 'done', title: 'Old', scheduled_at: at(12), status: 'completed' },
  ];

  it('flags a job that overlaps outright', () => {
    const c = findConflicts({ startIso: at(10), jobs, blocks: [], bufferMinutes: 0 });
    expect(c.map((x) => x.kind === 'job' && x.jobId)).toEqual(['a']);
    expect(c[0].label).toBe('Faucet · Jane');
  });

  it('counts travel time on both sides', () => {
    // a runs 9-11. Starting at 11:15 is fine with no buffer, too close with 30.
    expect(findConflicts({ startIso: at(11, 15), jobs, blocks: [], bufferMinutes: 0 })).toEqual([]);
    expect(
      findConflicts({ startIso: at(11, 15), jobs, blocks: [], bufferMinutes: 30 }).map((x) => x.at),
    ).toEqual([at(9)]);
    // Ending at 1:00 PM with 60 min travel is fine before b at 3 PM, 1:30 is not.
    expect(
      findConflicts({ startIso: at(11, 0), jobs: [jobs[1]], blocks: [], bufferMinutes: 60 }),
    ).toEqual([]);
    expect(
      findConflicts({ startIso: at(12, 30), jobs: [jobs[1]], blocks: [], bufferMinutes: 60 }),
    ).toHaveLength(1);
  });

  it('ignores the job being moved and jobs that are done', () => {
    expect(
      findConflicts({ startIso: at(9, 30), jobs, blocks: [], bufferMinutes: 0, excludeJobId: 'a' }),
    ).toEqual([]);
    expect(
      findConflicts({ startIso: at(12), jobs: [jobs[2]], blocks: [], bufferMinutes: 0 }),
    ).toEqual([]);
  });

  it('flags blocked-off time', () => {
    const blocks = [{ id: 'x', ...wholeDay('2026-11-04') }];
    const c = findConflicts({ startIso: at(13), jobs: [], blocks, bufferMinutes: 0 });
    expect(c).toEqual([
      { kind: 'block', blockId: 'x', label: 'Time you blocked off', at: blocks[0].starts_at },
    ]);
    expect(findConflicts({ startIso: at(13, 0, 5), jobs: [], blocks, bufferMinutes: 0 })).toEqual(
      [],
    );
  });
});

describe('blocks', () => {
  it('marks every day a block touches', () => {
    expect(blockDays(wholeDay('2026-11-04'))).toEqual(['2026-11-04']);
    expect(blockDays({ starts_at: at(14, 0, 4), ends_at: at(10, 0, 6) })).toEqual([
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
    ]);
  });

  it('recognizes whole-day blocks', () => {
    expect(isWholeDay(wholeDay('2026-11-04'))).toBe(true);
    expect(isWholeDay({ starts_at: at(9), ends_at: at(12) })).toBe(false);
  });
});
