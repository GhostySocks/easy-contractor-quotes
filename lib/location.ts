import * as Location from 'expo-location';

import { addressFromGeocode } from './geo-address';
import { stateCodeFromRegion } from './us-states';

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
  | { kind: 'denied' }
  | { kind: 'unavailable' };

/**
 * The street address where the phone is right now, for prefilling New Quote
 * when the contractor is standing at the job. Asks for location only when
 * tapped (foreground, while in use). A recent last-known fix is used first so
 * it answers fast on a job site with weak GPS.
 */
export async function currentAddress(): Promise<CurrentAddress> {
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) return { kind: 'denied' };

  try {
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: 2 * 60_000, requiredAccuracy: 100 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    const [first] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    const address = first ? addressFromGeocode(first) : null;
    return address ? { kind: 'ok', ...address } : { kind: 'unavailable' };
  } catch (err) {
    console.warn('[location] lookup failed', err);
    return { kind: 'unavailable' };
  }
}
