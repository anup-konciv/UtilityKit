/**
 * Centralised backup / restore for every persisted UtilityKit slice.
 *
 * Walks the entire `KEYS` map (now that all outliers are centralised — see
 * `00-foundation-changelog.md`), serialises everything to one versioned JSON
 * blob, and round-trips it back into AsyncStorage. There are three transports:
 *
 *   - Clipboard (always available, used as the legacy fallback).
 *   - Native share via `expo-sharing` so the user can drop the backup into
 *     iCloud, Google Drive, email, AirDrop, etc.
 *   - File-picker import via `expo-document-picker` for the matching restore.
 *
 * The Settings screen should call these helpers rather than hand-rolling
 * AsyncStorage walks. That way the backup format only lives in one place.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Clipboard from 'expo-clipboard';
import { KEYS } from './storage';

/** Bumped only when the on-disk shape changes in a non-additive way. */
export const BACKUP_VERSION = 1;

export type BackupBlob = {
  version: number;
  exportedAt: string; // ISO timestamp
  appName: 'UtilityKit';
  /** Map of `KEYS.*` value → already-parsed JSON. */
  data: Record<string, unknown>;
};

export type BackupSummary = {
  /** Number of populated keys (i.e. how much state the user has). */
  populatedKeys: number;
  /** Total size in bytes of the serialised blob. */
  byteSize: number;
};

// ── Build / parse ────────────────────────────────────────────────────────────

/** Read every `KEYS.*` slice and assemble a backup blob. */
export async function buildBackup(): Promise<BackupBlob> {
  const out: Record<string, unknown> = {};
  for (const key of Object.values(KEYS)) {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) continue;
    try {
      out[key] = JSON.parse(raw);
    } catch {
      // Stray non-JSON value — keep as a string so we don't lose it.
      out[key] = raw;
    }
  }
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'UtilityKit',
    data: out,
  };
}

/** Quick metadata view used by the Settings UI. */
export async function summarise(): Promise<BackupSummary> {
  const blob = await buildBackup();
  const json = JSON.stringify(blob);
  return {
    populatedKeys: Object.keys(blob.data).length,
    byteSize: new TextEncoder().encode(json).length,
  };
}

/**
 * Apply a backup blob back into AsyncStorage. Returns the number of keys
 * restored. Tolerates legacy clipboard exports (the old Settings dump used
 * a flat object instead of a versioned blob).
 */
export async function restoreBackup(input: unknown): Promise<number> {
  if (!input || typeof input !== 'object') {
    throw new Error('Backup is not an object.');
  }
  // Accept either { version, data } shape or the legacy flat shape.
  const data: Record<string, unknown> =
    'data' in (input as Record<string, unknown>) &&
    typeof (input as { data?: unknown }).data === 'object'
      ? ((input as { data: Record<string, unknown> }).data ?? {})
      : (input as Record<string, unknown>);

  const validKeys = new Set<string>(Object.values(KEYS));
  let restored = 0;
  for (const [key, value] of Object.entries(data)) {
    // Be conservative — don't overwrite anything we don't recognise.
    if (!validKeys.has(key)) continue;
    await AsyncStorage.setItem(key, JSON.stringify(value));
    restored++;
  }
  return restored;
}

// ── Transports: clipboard ────────────────────────────────────────────────────

export async function exportToClipboard(): Promise<BackupSummary> {
  const blob = await buildBackup();
  const json = JSON.stringify(blob, null, 2);
  await Clipboard.setStringAsync(json);
  return {
    populatedKeys: Object.keys(blob.data).length,
    byteSize: new TextEncoder().encode(json).length,
  };
}

export async function importFromClipboard(): Promise<number> {
  const json = await Clipboard.getStringAsync();
  if (!json || !json.trim()) throw new Error('Clipboard is empty.');
  const parsed = JSON.parse(json);
  return restoreBackup(parsed);
}

// ── Transports: native file ──────────────────────────────────────────────────

function backupFilename() {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `utilitykit-backup-${ts}.json`;
}

/**
 * Write the backup to the app sandbox and open the native share sheet so
 * the user can save it to Files / Drive / iCloud / email / etc.
 *
 * Returns the path that was written. Throws if sharing isn't available.
 */
export async function exportToFile(): Promise<{ path: string; summary: BackupSummary }> {
  const blob = await buildBackup();
  const json = JSON.stringify(blob, null, 2);
  const filename = backupFilename();
  // expo-file-system v19 surfaces a default cache directory; fall back to
  // documentDirectory if cache isn't writeable for some reason.
  const dir =
    (FileSystem as { cacheDirectory?: string | null }).cacheDirectory ??
    (FileSystem as { documentDirectory?: string | null }).documentDirectory ??
    '';
  if (!dir) throw new Error('No writable directory available.');
  const path = `${dir}${filename}`;
  // expo-file-system v19 still exposes the legacy `writeAsStringAsync`.
  await (FileSystem as unknown as {
    writeAsStringAsync: (uri: string, contents: string) => Promise<void>;
  }).writeAsStringAsync(path, json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/json',
      dialogTitle: 'Save UtilityKit backup',
      UTI: 'public.json',
    });
  }

  return {
    path,
    summary: {
      populatedKeys: Object.keys(blob.data).length,
      byteSize: new TextEncoder().encode(json).length,
    },
  };
}

/**
 * Open the native document picker, read the chosen file and restore it.
 * Returns the number of keys restored, or `null` if the user cancelled.
 */
export async function importFromFile(): Promise<number | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset) return null;
  const json = await (FileSystem as unknown as {
    readAsStringAsync: (uri: string) => Promise<string>;
  }).readAsStringAsync(asset.uri);
  const parsed = JSON.parse(json);
  return restoreBackup(parsed);
}

// ── Reset ────────────────────────────────────────────────────────────────────

export async function resetAll(): Promise<void> {
  const allKeys = Object.values(KEYS);
  await AsyncStorage.multiRemove(allKeys);
}
