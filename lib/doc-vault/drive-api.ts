import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { getValidToken } from './auth';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3';
const ROOT_FOLDER_NAME = 'UtilityKit DocVault';

/** Find or create a folder in Drive by name under a parent */
async function findOrCreateFolder(name: string, parentId?: string): Promise<string> {
  const token = await getValidToken();
  if (!token) throw new Error('Not authenticated');

  // Search for existing folder
  let q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  else q += ` and 'root' in parents`;

  const searchRes = await fetch(
    `${DRIVE_API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files?.length > 0) return data.files[0].id;
  }

  // Create folder
  const body: any = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) body.parents = [parentId];

  const createRes = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) throw new Error('Failed to create Drive folder');
  const created = await createRes.json();
  return created.id;
}

/** Get or create the root "UtilityKit DocVault" folder */
export async function getRootFolderId(): Promise<string> {
  return findOrCreateFolder(ROOT_FOLDER_NAME);
}

/** Get or create a subfolder inside the root DocVault folder */
export async function getSubFolderId(folderName: string): Promise<string> {
  const rootId = await getRootFolderId();
  return findOrCreateFolder(folderName, rootId);
}

/** Upload a file to a specific Drive folder. Returns the Drive file ID. */
export async function uploadFile(
  localUri: string,
  fileName: string,
  mimeType: string,
  driveFolderName: string,
): Promise<string> {
  const token = await getValidToken();
  if (!token) throw new Error('Not authenticated');

  const folderId = await getSubFolderId(driveFolderName);

  // Read file as base64
  const base64 = await readAsStringAsync(localUri, {
    encoding: EncodingType.Base64,
  });

  // Create multipart upload
  const metadata = JSON.stringify({
    name: fileName,
    parents: [folderId],
  });

  const boundary = 'doc_vault_upload_boundary';
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadata}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    `${base64}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${DRIVE_UPLOAD}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${err}`);
  }

  const data = await res.json();
  return data.id;
}
