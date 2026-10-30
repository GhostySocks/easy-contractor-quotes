import { appendDictation, dictationErrorMessage } from '../dictation';

describe('appendDictation', () => {
  it('starts an empty description with a capital', () => {
    expect(appendDictation('', 'replace the kitchen faucet')).toBe('Replace the kitchen faucet');
  });

  it('adds a new sentence after a full stop', () => {
    expect(appendDictation('Replace the faucet.', 'also fix the drain')).toBe(
      'Replace the faucet. Also fix the drain',
    );
  });

  it('continues a sentence that is mid-way', () => {
    expect(appendDictation('Replace the faucet and', 'the drain trap')).toBe(
      'Replace the faucet and the drain trap',
    );
  });

  it('never replaces or loses what was typed', () => {
    const typed = 'Two doors, 36 inch, prehung';
    expect(appendDictation(typed, 'install both').startsWith(typed)).toBe(true);
  });

  it('tidies whitespace and ignores silence', () => {
    expect(appendDictation('Fix sink.  \n', '  check   the   valve ')).toBe(
      'Fix sink. Check the valve',
    );
    expect(appendDictation('Fix sink.', '   ')).toBe('Fix sink.');
  });
});

describe('dictationErrorMessage', () => {
  it('stays quiet for a normal stop or silence', () => {
    expect(dictationErrorMessage('aborted')).toBeNull();
    expect(dictationErrorMessage('no-speech')).toBeNull();
  });

  it('explains permission and availability problems', () => {
    expect(dictationErrorMessage('not-allowed')).toMatch(/Microphone access is off/);
    expect(dictationErrorMessage('service-not-allowed')).toMatch(/isn't available/);
    expect(dictationErrorMessage('something-new')).toMatch(/Try again/);
  });
});
