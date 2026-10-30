import {
  logoPath,
  MAX_PHOTOS,
  newPhotoId,
  photoPath,
  resizeTarget,
  sanitizePhotoPaths,
} from '../photo-math';
import {
  jobFieldsFromQuote,
  jobTitleFromScope,
} from '../../supabase/functions/_shared/job-from-quote';
import { buildUserMessage } from '../../supabase/functions/_shared/prompts';

describe('resizeTarget', () => {
  it('caps the long edge of a landscape photo', () => {
    expect(resizeTarget(4032, 3024)).toEqual({ width: 1024 });
  });

  it('caps the long edge of a portrait photo', () => {
    expect(resizeTarget(3024, 4032)).toEqual({ height: 1024 });
  });

  it('leaves small photos alone', () => {
    expect(resizeTarget(800, 600)).toBeNull();
    expect(resizeTarget(1024, 1024)).toBeNull();
  });

  it('ignores missing dimensions', () => {
    expect(resizeTarget(0, 0)).toBeNull();
    expect(resizeTarget(NaN, 4000)).toBeNull();
  });
});

describe('photo paths', () => {
  const user = '6f1c2b2e-0000-4000-8000-000000000001';

  it('puts each photo under the user folder', () => {
    expect(photoPath(user, 'abc')).toBe(`${user}/abc.jpg`);
  });

  it('makes distinct ids', () => {
    let n = 0.1;
    const rand = () => (n += 0.1);
    expect(newPhotoId(1, rand)).not.toBe(newPhotoId(1, rand));
  });

  it('keeps only the caller’s own paths, at most the limit', () => {
    const own = Array.from({ length: 6 }, (_, i) => `${user}/p${i}.jpg`);
    const result = sanitizePhotoPaths(
      ['other-user/x.jpg', `${user}/../other/x.jpg`, 42, ...own],
      user,
    );
    expect(result).toEqual(own.slice(0, MAX_PHOTOS));
  });

  it('returns nothing for non-array input', () => {
    expect(sanitizePhotoPaths(undefined, user)).toEqual([]);
    expect(sanitizePhotoPaths('x', user)).toEqual([]);
  });
});

describe('jobFieldsFromQuote', () => {
  const quote = {
    scope_of_work: 'Replace the kitchen faucet. Test for leaks.',
    total_cents: 21400,
  };

  it('schedules the job when the quote has a requested start', () => {
    const start = '2026-11-04T14:00:00.000Z';
    expect(
      jobFieldsFromQuote({ ...quote, requested_start_at: start, photos: ['u/a.jpg'] }),
    ).toEqual({
      title: 'Replace the kitchen faucet',
      description: quote.scope_of_work,
      status: 'scheduled',
      scheduled_at: start,
      total_cents: 21400,
      photos: ['u/a.jpg'],
    });
  });

  it('leaves the job to be scheduled when there is no start date', () => {
    const fields = jobFieldsFromQuote(quote);
    expect(fields.status).toBe('todo');
    expect(fields.scheduled_at).toBeNull();
    expect(fields.photos).toEqual([]);
  });

  it('titles jobs from the first sentence, capped at 60 chars', () => {
    expect(jobTitleFromScope(null)).toBe('Job');
    expect(jobTitleFromScope('x'.repeat(80))).toHaveLength(58);
  });
});

describe('buildUserMessage with photos', () => {
  const base = { trade: 'handyman', state_code: 'TX', scope_text: 'Patch two drywall holes.' };

  it('mentions attached photos', () => {
    expect(buildUserMessage({ ...base, photo_count: 3 })).toContain(
      '3 photos of the job are attached',
    );
    expect(buildUserMessage({ ...base, photo_count: 1 })).toContain(
      'A photo of the job is attached',
    );
  });

  it('says nothing about photos when there are none', () => {
    expect(buildUserMessage(base)).not.toMatch(/photo/i);
    expect(buildUserMessage({ ...base, photo_count: 0 })).not.toMatch(/photo/i);
  });
});

describe('logoPath', () => {
  it('stores logos as PNG under the user folder so the same storage rules apply', () => {
    expect(logoPath('u1', 'abc')).toBe('u1/logo-abc.png');
    expect(sanitizePhotoPaths([logoPath('u1', 'abc')], 'u1')).toEqual(['u1/logo-abc.png']);
  });
});
