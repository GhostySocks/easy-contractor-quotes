import { toggleAction } from '../permission-toggle';

describe('toggleAction', () => {
  it('asks when turning on something the phone can still prompt for', () => {
    expect(toggleAction(true, { granted: false, canAskAgain: true })).toBe('ask');
  });

  it('sends to Settings once the phone will no longer prompt', () => {
    expect(toggleAction(true, { granted: false, canAskAgain: false })).toBe('settings');
  });

  it('sends to Settings to turn off, since an app cannot revoke a permission', () => {
    expect(toggleAction(false, { granted: true, canAskAgain: true })).toBe('settings');
  });
});
