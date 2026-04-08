/**
 * Thin wrapper around expo-location.
 *
 * Same lazy-require pattern as `lib/notifications.ts`: the underlying
 * package may or may not be installed yet. Until you run
 *
 *   npx expo install expo-location
 *
 * every entry point gracefully resolves `null`. After install the wired
 * tools (Weather, Compass declination, Travel Tracker, etc.) start
 * returning real coordinates without any further code changes.
 *
 * Returns a `CoarseFix` rather than the full `Location.LocationObject` so
 * callers don't depend on the package's type surface.
 */
import { Platform } from 'react-native';

let locationModule: any | null = null;
function loc(): any | null {
  if (locationModule) return locationModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    locationModule = require('expo-location');
    return locationModule;
  } catch {
    return null;
  }
}

export type CoarseFix = {
  latitude: number;
  longitude: number;
  /** Best-effort estimated horizontal accuracy in metres, if available. */
  accuracyM: number | null;
};

export type GeocodeName = {
  name: string;
  country?: string;
  region?: string;
};

/**
 * Request foreground location permission. Returns true if granted.
 * Safe to call when the package isn't installed (returns false).
 */
export async function requestLocationPermission(): Promise<boolean> {
  const L = loc();
  if (!L || Platform.OS === 'web') return false;
  try {
    const cur = await L.getForegroundPermissionsAsync();
    if (cur.status === 'granted') return true;
    if (!cur.canAskAgain) return false;
    const next = await L.requestForegroundPermissionsAsync();
    return next.status === 'granted';
  } catch {
    return false;
  }
}

/**
 * One-shot current position read. Returns null if anything goes wrong
 * (no package, no permission, no GPS, timeout). Tools should fall back
 * gracefully to manual entry rather than blocking on this.
 */
export async function getCurrentPosition(): Promise<CoarseFix | null> {
  const L = loc();
  if (!L) return null;
  if (!(await requestLocationPermission())) return null;
  try {
    const result = await L.getCurrentPositionAsync({
      accuracy: L.Accuracy?.Balanced ?? 3,
    });
    return {
      latitude: result.coords.latitude,
      longitude: result.coords.longitude,
      accuracyM: result.coords.accuracy ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Reverse-geocode a coordinate. Used by Weather to give the saved
 * location a friendly name. Returns null on failure.
 */
export async function reverseGeocode(
  fix: CoarseFix,
): Promise<GeocodeName | null> {
  const L = loc();
  if (!L) return null;
  if (!(await requestLocationPermission())) return null;
  try {
    const list = await L.reverseGeocodeAsync({
      latitude: fix.latitude,
      longitude: fix.longitude,
    });
    if (!Array.isArray(list) || list.length === 0) return null;
    const top = list[0];
    return {
      name: top.city ?? top.name ?? top.subregion ?? top.region ?? 'Current location',
      country: top.country ?? undefined,
      region: top.region ?? top.subregion ?? undefined,
    };
  } catch {
    return null;
  }
}
