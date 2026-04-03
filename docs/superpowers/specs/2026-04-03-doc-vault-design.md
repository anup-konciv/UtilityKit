# Doc Vault — Design Spec

**Date:** 2026-04-03
**Tool:** New tool inside UtilityKit — `doc-vault`
**Purpose:** Secure local document & image storage with optional Google Drive backup

---

## Overview

Doc Vault lets users store important documents and images on-device, organized into folders with optional PIN locks. Users who want cloud backup can sign in with Google to sync files to Google Drive. The tool works fully offline — Google login is optional.

---

## Data Model

### DocFile

```ts
type DocFile = {
  id: string;
  name: string;            // user-facing display name
  fileName: string;        // original file name with extension
  localUri: string;        // path in expo-file-system documentDirectory
  mimeType: string;        // e.g. image/jpeg, application/pdf
  size: number;            // bytes
  folderId: string;
  tags: string[];
  driveFileId?: string;    // populated after Drive upload
  driveSynced: boolean;
  createdAt: string;       // ISO date
  updatedAt: string;       // ISO date
};
```

### Folder

```ts
type Folder = {
  id: string;
  name: string;
  icon: string;            // Ionicons icon name
  color: string;           // hex accent color
  pinHash?: string;        // if set, folder requires PIN to open
  isDefault: boolean;      // predefined folders cannot be deleted
  createdAt: string;
};
```

### DriveAuth

```ts
type DriveAuth = {
  accessToken: string;
  refreshToken: string;
  email: string;
  avatarUrl?: string;
  expiresAt: number;       // timestamp ms
};
```

### Default Folders

| Name | Icon | Color |
|---|---|---|
| ID & Documents | id-card-outline | #3B82F6 |
| Insurance | shield-checkmark-outline | #10B981 |
| Vehicle | car-outline | #F97316 |
| Medical | medkit-outline | #EF4444 |
| Financial | card-outline | #F59E0B |
| Education | school-outline | #8B5CF6 |
| Certificates | ribbon-outline | #EC4899 |
| Other | folder-outline | #64748B |

### Storage Keys (AsyncStorage)

- `uk_doc_vault_files` — `DocFile[]`
- `uk_doc_vault_folders` — `Folder[]`
- `uk_doc_vault_auth` — `DriveAuth | null`
- `uk_doc_vault_settings` — `{ autoSync: boolean }`

### File Storage

Actual files saved to `FileSystem.documentDirectory + 'doc-vault/'` with UUID-based filenames to avoid collisions. Example: `doc-vault/k8x2f9a3b.pdf`.

---

## UI Design

### Accent Color

`#2563EB` (blue — trustworthy, secure feel)

### Main Screen (`doc-vault.tsx`)

**Header:** Title "Doc Vault", gear icon (settings), Google avatar/sign-in button (top-right).

**Two tabs** at top:

1. **Folders** (default): Grid of folder cards (2 columns). Each card shows:
   - Folder icon + color
   - Folder name
   - File count
   - Lock icon if PIN-protected
   - Tap → opens folder (with PIN check if locked)
   - Long-press → edit/delete modal

2. **All Files**: Flat list of all files across all folders, sorted by most recent. Search bar filters by name and tags.

**FAB** (bottom-right): Opens bottom sheet with three options:
- Camera — take a photo
- Gallery — pick from photo library
- Browse Files — system file picker

After picking a file, user selects destination folder (or current folder if inside one).

**Empty state:** When no folders have files yet — icon, description, add button.

### Folder Detail Screen (`doc-vault-folder.tsx`) — navigated via expo-router (not a modal)

**PIN gate:** If folder has `pinHash`, show PIN entry overlay before revealing contents. 4-dot UI with numeric keypad. 3 wrong attempts → 30s cooldown. Stays unlocked for current session.

**File list:** Each file card shows:
- Thumbnail (for images) or file-type icon (PDF, DOC, etc.)
- File name (editable)
- File size, date added
- Drive sync status icon (none / pending / synced / failed)
- Tap → preview modal (image viewer for images, file info for others)
- Long-press → action sheet: rename, move folder, delete, share, upload to Drive

**Header actions:** Folder name, back button, FAB for adding files to this folder.

### Settings (gear icon modal/section)

- **Google Account:** Sign in / sign out, shows connected email + avatar
- **Auto-sync:** Toggle — when on, new files auto-upload to Drive after local save
- **Storage used:** Total size of local doc-vault files
- **Clear sync data:** Re-upload all files on next sync (doesn't delete local files)

---

## Permissions

Permissions are requested on-demand, only when the user selects the specific action:

| Action | Library | Permission Required |
|---|---|---|
| Camera | `expo-image-picker` | Camera |
| Gallery | `expo-image-picker` | Media library |
| Browse Files | `expo-document-picker` | None (system picker) |

**If permission denied:** Show alert explaining why it's needed, with button to open device settings.

---

## Google Sign-In & Drive Sync

### Authentication

- **Library:** `expo-auth-session` with Google OAuth 2.0
- **Scopes:** `email`, `profile`, `https://www.googleapis.com/auth/drive.file`
- The `drive.file` scope only grants access to files created by the app — not the user's entire Drive
- Tokens stored in AsyncStorage under `uk_doc_vault_auth`
- Auto-refresh access token when expired using refresh token

### Google Cloud Setup (one-time)

1. Create project in Google Cloud Console
2. Enable Google Drive API
3. Create OAuth 2.0 credentials:
   - Android: package `com.utilitykit.app` + SHA-1 of signing key
   - iOS: bundle ID `com.utilitykit.app`
4. Configure OAuth consent screen (app name, scopes)
5. Copy client IDs into `lib/doc-vault/auth.ts`

### Drive Folder Structure

```
My Drive/
  UtilityKit DocVault/
    ID & Documents/
    Insurance/
    Vehicle/
    ... (mirrors local folders)
```

App creates `UtilityKit DocVault` folder on first sync. Subfolders mirror local folder names.

### Sync Modes

- **Manual:** Tap cloud-upload icon on a file, or "Sync All" in settings
- **Auto-sync:** When enabled + logged in, new files upload automatically after local save

### Sync Status (per file)

| Icon | Meaning |
|---|---|
| (none) | Local only, not logged in |
| cloud-upload-outline | Pending upload |
| cloud-done-outline | Synced to Drive |
| cloud-offline-outline | Sync failed (tap to retry) |

### Offline Behavior

Everything works without login. Files are always local-first. Drive is purely a backup destination. No streaming from Drive — files are not downloaded from Drive back to device (one-way upload).

---

## PIN Lock

- **Setting PIN:** In folder edit modal, toggle "Lock with PIN" → enter 4-digit PIN → confirm → hashed via `expo-crypto` SHA-256 and stored in `folder.pinHash`
- **Unlocking:** Tap locked folder → PIN overlay with 4 dots + numeric keypad
- **Wrong attempts:** 3 wrong → 30-second cooldown
- **Session:** Once unlocked, stays open until user leaves the tool or app backgrounds
- **Scope:** PIN protects opening the folder. Folder name, icon, and file count remain visible on the card.
- **Removing PIN:** Edit folder → toggle off lock → confirms with current PIN

---

## Dependencies to Add

| Package | Purpose |
|---|---|
| `expo-image-picker` | Camera + gallery photo picking |
| `expo-document-picker` | System file browser for any file type |
| `expo-file-system` | Read/write/delete files in local storage |
| `expo-auth-session` | Google OAuth 2.0 sign-in flow |

`expo-crypto` is already installed (used for PIN hashing).

All packages are Expo managed-workflow compatible. No ejecting required.

---

## File Structure

```
app/tools/doc-vault.tsx              — main screen (folders grid + all files tab)
app/tools/doc-vault-folder.tsx       — folder contents screen
lib/doc-vault/auth.ts                — Google OAuth sign-in/out/token refresh
lib/doc-vault/drive-api.ts           — Drive folder creation, file upload, status check
lib/doc-vault/file-manager.ts        — local file copy/delete/rename/size utilities
```

### Updates to Existing Files

- `lib/storage.ts` — add storage keys: `docVaultFiles`, `docVaultFolders`, `docVaultAuth`, `docVaultSettings`
- `constants/tools-meta.ts` — add Doc Vault tool entry
- `app.json` — add `expo-image-picker`, `expo-document-picker` plugins if required

---

## tools-meta Entry

```ts
{
  id: 'doc-vault',
  label: 'Doc Vault',
  description: 'Secure document & image storage',
  icon: 'lock-closed-outline',
  route: '/tools/doc-vault',
  accent: '#2563EB',
  badge: 'Utility',
}
```

---

## Out of Scope

- Downloading files FROM Drive back to device (one-way upload only)
- File encryption at rest (PIN lock is access control, not encryption)
- Sharing files between users
- In-app PDF/document viewer (opens via system viewer)
- File versioning
