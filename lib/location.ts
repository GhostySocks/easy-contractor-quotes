import * as Location from 'expo-location';

import { reportError } from './error-reporting';
import { addressFromGeocode } from './geo-address';
import { type Fix, fixQuality } from './location-fix';
import { stateCodeFromRegion } from './us-states';
import { withTimeout } from './with-timeout';

export type CurrentState =
  | { kind: 'ok'; code: string }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/**
 * The US state the phone is in, as a 2-letter code, for prefilling the
 * business profile instead of assuming a state. Asks for location only when
 * the contractor taps the button.
 */
export async function currentStateCode(): Promise<CurrentState> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };
  try {
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60_000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    const [first] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const code = stateCodeFromRegion(first?.region);
    return code ? { kind: 'ok', code } : { kind: 'unavailable' };
  } catch (err) {
    console.warn('[location] state lookup failed', err);
    return { kind: 'unavailable' };
  }
}

export type CurrentAddress =
  | { kind: 'ok'; line1: string; city: string }
  /**
   * GPS couldn't narrow it to one house; the address may be a neighbor's.
   * `precisionOff`: the phone only allows this app approximate location.
   */
  | {
      kind: 'approximate';
      line1: string;
      city: string;
      accuracyM: number | null;
      precisionOff: boolean;
    }
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/** A full GPS fix can take a while outdoors; past this, give up. */
const GPS_WAIT_MS = 15_000;

/**
 * The street address where the phone is right now, for prefilling New Quote
 * when the contractor is standing at the job. Asks for location only when
 * tapped (foreground, while in use). Uses full GPS accuracy, reusing the last
 * fix only when it is seconds old and precise, and says so when it can't
 * narrow it to one house (lib/location-fix.ts).
 */
export async function currentAddress(): Promise<CurrentAddress> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };
  // Android 12+ lets people share only an approximate location. (iOS does too,
  // but expo-location doesn't report it; its loose fix lands in 'approximate'.)
  const precisionOff = permission.android?.accuracy === 'coarse';

  try {
    const now = Date.now();
    const last = await Location.getLastKnownPositionAsync();
    const position =
      last && fixQuality(fixOf(last), now) === 'precise'
        ? last
        : await withTimeout(
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
            GPS_WAIT_MS,
            'Finding your location',
          );
    const [first] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const address = first ? addressFromGeocode(first) : null;
    if (!address) return { kind: 'unavailable' };
    return fixQuality(fixOf(position), Date.now()) === 'precise'
      ? { kind: 'ok', ...address }
      : { kind: 'approximate', ...address, accuracyM: position.coords.accuracy, precisionOff };
  } catch (err) {
    console.warn('[location] lookup failed', err);
    reportError(err, 'location.address');
    return { kind: 'unavailable' };
  }
}

function fixOf(position: Location.LocationObject): Fix {
  return { accuracy: position.coords.accuracy, timestamp: position.timestamp };
}
