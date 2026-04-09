/**
 * Local-notifications wrapper around expo-notifications.
 *
 * One-time setup before this module works:
 *   npx expo install expo-notifications
 *
 * The module is designed to be safe to import even when the underlying
 * package isn't installed yet — every entry point either no-ops or
 * resolves a sentinel value, so tools that wire it up don't crash on a
 * fresh install. Once `expo-notifications` is added, behaviour switches
 * on automatically with no further code changes.
 *
 * Why a thin wrapper?
 *   - Hides expo-notifications API churn behind a stable surface.
 *   - Centralises permission prompting (Settings can flip a single flag).
 *   - Namespaces ids per tool so cancelling is easy and collisions are
 *     impossible (`uk:reminder:<id>`, `uk:habit:<habitId>:morning`, …).
 *   - Persists a small index in AsyncStorage so the app can audit /
 *     cancel everything it scheduled (e.g. on logout).
 */
import { Platform } from 'react-native';
import { loadJSON, saveJSON, KEYS } from './storage';

// Lazy require so missing dependency only blows up at call-time, not import-time.
let notifsModule: any | null = null;
function notifs(): any | null {
  if (notifsModule) return notifsModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    notifsModule = require('expo-notifications');
    return notifsModule;
  } catch {
    return null;
  }
}

export type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';

/**
 * Tool namespace — keeps cancellations cheap and collisions impossible.
 *
 * Adding a new tool? Add its namespace here so cancellations stay cheap and
 * the audit list stays semantic. Falling back to `'custom'` works but loses
 * the ability to bulk-cancel by tool.
 */
export type Namespace =
  | 'reminder'
  | 'habit'
  | 'subscription'
  | 'doc-expiry'
  | 'birthday'
  | 'pomodoro'
  | 'bill'
  | 'assignment'
  | 'vehicle'
  | 'maintenance'
  | 'event'
  | 'travel'
  | 'water'
  | 'routine'
  | 'custom';

export type ScheduleInput = {
  /** Stable id within the namespace (e.g. reminder uuid, habit id). */
  id: string;
  namespace: Namespace;
  title: string;
  body?: string;
  /** Wall-clock fire time. Past dates are silently dropped. */
  date: Date;
  repeat?: RepeatMode;
  /** Optional opaque payload — surfaced in the tap handler. */
  data?: Record<string, unknown>;
};

type ScheduledRecord = {
  key: string;          // namespaced id
  systemId: string;     // expo-notifications identifier
  date: string;         // ISO
  repeat: RepeatMode;
  title: string;
};

const indexKey = 'uk_notifications_index';

function nsKey(namespace: string, id: string) {
  return `uk:${namespace}:${id}`;
}

async function readIndex(): Promise<ScheduledRecord[]> {
  return loadJSON<ScheduledRecord[]>(indexKey, []);
}

async function writeIndex(records: ScheduledRecord[]) {
  await saveJSON(indexKey, records);
}

/**
 * One-time global setup. Call from the app root (e.g. `_layout.tsx`).
 * Safe to call multiple times.
 */
export async function configureNotifications(): Promise<void> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return;
  N.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Returns true if notifications are usable (package present + permission
 * granted + user toggle on). Call this before scheduling, but the lower-level
 * `schedule` will also no-op if any condition fails.
 */
export async function notificationsReady(): Promise<boolean> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return false;
  const enabled = await loadJSON<boolean>(KEYS.notificationsEnabled, true);
  if (!enabled) return false;
  const status = (await N.getPermissionsAsync()).status;
  return status === 'granted';
}

/** Prompt for permission. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return false;
  const cur = await N.getPermissionsAsync();
  if (cur.status === 'granted') return true;
  if (!cur.canAskAgain) return false;
  const next = await N.requestPermissionsAsync();
  return next.status === 'granted';
}

/**
 * Ensure notifications are usable before the caller tries to schedule one.
 *
 * - Checks the user toggle (`KEYS.notificationsEnabled`).
 * - If notifications are off, prompts for permission.
 * - Returns one of:
 *     'ready'      → permission granted, scheduling will work
 *     'denied'     → user denied / can't ask again — caller should explain
 *     'unsupported'→ web or package missing — caller should silently skip
 *
 * Designed so callers can show a helpful one-time alert when the user tries
 * to set up a reminder but the OS/app isn't going to deliver it.
 */
export type PermissionState = 'ready' | 'denied' | 'unsupported';
export async function ensureNotificationPermission(): Promise<PermissionState> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return 'unsupported';
  const enabled = await loadJSON<boolean>(KEYS.notificationsEnabled, true);
  if (!enabled) {
    // Auto-enable when the user explicitly opts in to a reminder. The
    // global toggle is intended as a kill-switch, not a per-feature gate.
    await saveJSON(KEYS.notificationsEnabled, true);
  }
  const cur = await N.getPermissionsAsync();
  if (cur.status === 'granted') return 'ready';
  if (!cur.canAskAgain) return 'denied';
  const next = await N.requestPermissionsAsync();
  return next.status === 'granted' ? 'ready' : 'denied';
}

function buildTrigger(N: any, date: Date, repeat: RepeatMode) {
  if (repeat === 'daily') {
    return { hour: date.getHours(), minute: date.getMinutes(), repeats: true };
  }
  if (repeat === 'weekly') {
    return {
      weekday: date.getDay() + 1, // expo: 1=Sun..7=Sat
      hour: date.getHours(),
      minute: date.getMinutes(),
      repeats: true,
    };
  }
  if (repeat === 'monthly') {
    // expo-notifications doesn't support a true "monthly" trigger, so we
    // schedule the next occurrence as a one-shot. Callers that want true
    // monthly recurrence should re-schedule from inside the notification
    // handler — for now this gives the user one reminder, the next month
    // gets re-scheduled when the app is opened.
    return { date };
  }
  return { date };
}

/**
 * Schedule a notification. Returns true if it was actually scheduled,
 * false if the platform couldn't handle it (no package, no permission,
 * disabled, past-date for non-repeating). Replaces any prior schedule for
 * the same `(namespace, id)` so callers can update freely.
 */
export async function schedule(input: ScheduleInput): Promise<boolean> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return false;
  if (!(await notificationsReady())) return false;
  const repeat = input.repeat ?? 'none';
  if (repeat === 'none' && input.date.getTime() <= Date.now()) return false;

  await cancel(input.namespace, input.id); // dedupe

  const systemId = await N.scheduleNotificationAsync({
    content: {
      title: input.title,
      body: input.body ?? '',
      data: { ...(input.data ?? {}), key: nsKey(input.namespace, input.id) },
    },
    trigger: buildTrigger(N, input.date, repeat),
  });

  const idx = await readIndex();
  idx.push({
    key: nsKey(input.namespace, input.id),
    systemId,
    date: input.date.toISOString(),
    repeat,
    title: input.title,
  });
  await writeIndex(idx);
  return true;
}

/** Cancel one scheduled notification by its `(namespace, id)`. */
export async function cancel(namespace: string, id: string): Promise<void> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return;
  const target = nsKey(namespace, id);
  const idx = await readIndex();
  const remaining: ScheduledRecord[] = [];
  for (const rec of idx) {
    if (rec.key === target) {
      try { await N.cancelScheduledNotificationAsync(rec.systemId); } catch {}
    } else {
      remaining.push(rec);
    }
  }
  await writeIndex(remaining);
}

/** Cancel everything in a namespace (e.g. when the user clears all reminders). */
export async function cancelNamespace(namespace: string): Promise<void> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return;
  const prefix = `uk:${namespace}:`;
  const idx = await readIndex();
  const remaining: ScheduledRecord[] = [];
  for (const rec of idx) {
    if (rec.key.startsWith(prefix)) {
      try { await N.cancelScheduledNotificationAsync(rec.systemId); } catch {}
    } else {
      remaining.push(rec);
    }
  }
  await writeIndex(remaining);
}

/** Fire a one-shot notification right now (used by Pomodoro session-end, etc.). */
export async function fireNow(title: string, body?: string): Promise<void> {
  const N = notifs();
  if (!N || Platform.OS === 'web') return;
  if (!(await notificationsReady())) return;
  try {
    await N.scheduleNotificationAsync({
      content: { title, body: body ?? '' },
      trigger: null,
    });
  } catch {}
}

/** Read the in-AsyncStorage audit list. Useful for a Settings → "Notifications" screen. */
export async function listScheduled(): Promise<ScheduledRecord[]> {
  return readIndex();
}
