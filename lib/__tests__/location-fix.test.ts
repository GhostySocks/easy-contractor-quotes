import { fixQuality } from '../location-fix';

const NOW = 1_800_000_000_000;

describe('fixQuality', () => {
  it('trusts a fresh, tight GPS fix', () => {
    expect(fixQuality({ accuracy: 8, timestamp: NOW - 2_000 }, NOW)).toBe('precise');
  });

  it('calls a fix over 35 m approximate: that is a neighbor, not the job', () => {
    expect(fixQuality({ accuracy: 60, timestamp: NOW }, NOW)).toBe('approximate');
    expect(fixQuality({ accuracy: 100, timestamp: NOW }, NOW)).toBe('approximate');
  });

  it('does not trust a fix with no accuracy reported', () => {
    expect(fixQuality({ accuracy: null, timestamp: NOW }, NOW)).toBe('approximate');
  });

  it('does not reuse an old fix: the contractor may have driven here since', () => {
    expect(fixQuality({ accuracy: 5, timestamp: NOW - 60_000 }, NOW)).toBe('stale');
  });

  it('has nothing to judge without a fix', () => {
    expect(fixQuality(null, NOW)).toBe('stale');
  });
});
