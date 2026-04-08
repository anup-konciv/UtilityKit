/**
 * Semantic haptics wrapper around expo-haptics.
 *
 * Use these helpers instead of the React Native `Vibration` API or
 * direct `Haptics.*` calls. Every helper:
 *   - is async-fire-and-forget (never throws into the caller)
 *   - is a no-op on web / unsupported platforms
 *   - respects the user's `KEYS.hapticsEnabled` preference (default ON)
 *
 * Semantic vocabulary:
 *   tap()        — light selection / button press
 *   selection()  — value-change in a picker / slider
 *   success()    — task completed, goal hit, payment recorded
 *   warning()    — destructive confirm, low fuel, almost-overdue
 *   error()      — invalid input, failed network call, hard delete
 *   impact(s)    — escape hatch for explicit Light/Medium/Heavy
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { loadJSON, KEYS } from './storage';

let cachedEnabled: boolean | null = null;

async function isEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (cachedEnabled === null) {
    cachedEnabled = await loadJSON<boolean>(KEYS.hapticsEnabled, true);
  }
  return cachedEnabled;
}

/** Force-refresh the cached enabled flag (call after Settings changes it). */
export function invalidateHapticsCache() {
  cachedEnabled = null;
}

const safe = async (fn: () => Promise<unknown>) => {
  try {
    if (!(await isEnabled())) return;
    await fn();
  } catch {
    // swallow — haptics must never break a UI flow
  }
};

export const haptics = {
  /** Light tap for buttons, checkboxes, toggles. Cheapest, most frequent. */
  tap: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),

  /** Picker / slider value change. Use sparingly — high frequency. */
  selection: () => safe(() => Haptics.selectionAsync()),

  /** Successful completion: saved, goal hit, paid. */
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),

  /** Warning: about to delete, threshold crossed. */
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),

  /** Error: invalid input, failed action. */
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),

  /** Medium impact: confirm, dice roll, drop. */
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),

  /** Heavy impact: long-press confirm, lock/unlock. */
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
};
