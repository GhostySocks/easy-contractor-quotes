/**
 * Joining dictated speech onto what's already typed. Pure, unit-tested.
 *
 * Dictation always adds to the job description, never replaces it. While the
 * contractor is talking, the live (interim) words are shown appended to the
 * text that was there when they tapped the mic; each final result is folded
 * into that base so the next phrase continues after it.
 */

/** Capitalize the first letter of a phrase. */
function capitalize(s: string): string {
  return s.length === 0 ? s : s[0].toUpperCase() + s.slice(1);
}

/**
 * `base` + `spoken`, with sensible spacing and capitalization:
 * - nothing typed yet: the spoken text, capitalized
 * - typed text ends a sentence (. ! ?): a space, then capitalized
 * - otherwise: a space, continuing the sentence as spoken
 */
export function appendDictation(base: string, spoken: string): string {
  const said = spoken.trim().replace(/\s+/g, ' ');
  if (!said) return base;
  const typed = base.replace(/\s+$/, '');
  if (!typed) return capitalize(said);
  const endsSentence = /[.!?]$/.test(typed);
  return `${typed} ${endsSentence ? capitalize(said) : said}`;
}

/** Plain-English message for a recognition error, or null to stay quiet. */
export function dictationErrorMessage(code: string): string | null {
  switch (code) {
    case 'aborted':
    case 'no-speech':
    case 'speech-timeout':
      return null; // stopped, or nothing was said: not worth an alert
    case 'not-allowed':
      return 'Microphone access is off. Turn it on in Settings to talk instead of type.';
    case 'network':
      return "Couldn't reach speech recognition. Check your signal and try again, or type it.";
    case 'audio-capture':
      return "Couldn't use the microphone. Another app may be using it.";
    case 'service-not-allowed':
    case 'language-not-supported':
      return "Speech recognition isn't available on this phone. Type it instead, or use your keyboard's mic.";
    default:
      return 'Speech recognition stopped. Try again, or type it.';
  }
}
