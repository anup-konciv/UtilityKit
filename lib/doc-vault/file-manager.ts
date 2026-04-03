import * as FileSystem from 'expo-file-system/legacy';

const DOC_VAULT_DIR = (FileSystem.documentDirectory ?? '') + 'doc-vault/';

/** Ensure the doc-vault directory exists */
export async function ensureVaultDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(DOC_VAULT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(DOC_VAULT_DIR, { intermediates: true });
  }
}

/** Generate a unique filename preserving the original extension */
export function generateFileName(originalName: string): string {
  const ext = originalName.includes('.')
    ? originalName.substring(originalName.lastIndexOf('.'))
    : '';
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return `${id}${ext}`;
}

/** Copy a file from a source URI into the doc-vault directory. Returns the new local URI. */
export async function copyFileToVault(sourceUri: string, originalName: string): Promise<{ localUri: string; fileName: string; size: number }> {
  await ensureVaultDir();
  const fileName = generateFileName(originalName);
  const destUri = DOC_VAULT_DIR + fileName;
  await FileSystem.copyAsync({ from: sourceUri, to: destUri });
  const info = await FileSystem.getInfoAsync(destUri);
  return {
    localUri: destUri,
    fileName,
    size: info.exists ? info.size : 0,
  };
}

/** Delete a file from the vault */
export async function deleteFile(localUri: string): Promise<void> {
  const info = await FileSystem.getInfoAsync(localUri);
  if (info.exists) {
    await FileSystem.deleteAsync(localUri, { idempotent: true });
  }
}

/** Get total storage used by all vault files (in bytes) */
export async function getStorageUsed(): Promise<number> {
  await ensureVaultDir();
  const files = await FileSystem.readDirectoryAsync(DOC_VAULT_DIR);
  let total = 0;
  for (const file of files) {
    const info = await FileSystem.getInfoAsync(DOC_VAULT_DIR + file);
    total += info.exists ? info.size : 0;
  }
  return total;
}

/** Format bytes to human-readable string */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  return `${val.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Get the file extension from a filename or URI */
export function getFileExtension(name: string): string {
  const ext = name.includes('.') ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : '';
  return ext;
}

/** Determine if a mime type is an image */
export function isImageMime(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/** Get a display icon name for a file type */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image-outline';
  if (mimeType === 'application/pdf') return 'document-text-outline';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'document-outline';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid-outline';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'easel-outline';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('archive')) return 'archive-outline';
  return 'document-outline';
}
