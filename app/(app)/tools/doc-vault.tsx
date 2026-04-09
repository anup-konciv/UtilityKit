import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  FlatList,
  ScrollView,
  Platform,
  Image,
  Switch,
  ActivityIndicator,} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';
import * as AuthSession from 'expo-auth-session';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import {
  copyFileToVault,
  deleteFile,
  getStorageUsed,
  formatBytes,
  isImageMime,
  getFileIcon,
} from '@/lib/doc-vault/file-manager';
import {
  type DriveAuth,
  loadAuth,
  signOut as authSignOut,
  getAuthRequestConfig,
  getDiscovery,
  exchangeCodeForTokens,
} from '@/lib/doc-vault/auth';
import { uploadFile as driveUpload } from '@/lib/doc-vault/drive-api';

/* ───── Constants ───── */

const ACCENT = '#2563EB';

/* ───── Types ───── */

type DocFile = {
  id: string;
  name: string;
  fileName: string;
  localUri: string;
  mimeType: string;
  size: number;
  folderId: string;
  tags: string[];
  driveFileId?: string;
  driveSynced: boolean;
  createdAt: string;
  updatedAt: string;
};

type Folder = {
  id: string;
  name: string;
  icon: string;
  color: string;
  pinHash?: string;
  isDefault: boolean;
  createdAt: string;
};

type VaultSettings = {
  autoSync: boolean;
};

type TabKey = 'folders' | 'files';

/* ───── Helpers ───── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  if (!iso) return '\u2014';
  const d = new Date(iso);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ───── Default Folders ───── */

function makeDefaultFolders(): Folder[] {
  const iso = todayISO();
  return [
    { id: 'f_id', name: 'ID & Documents', icon: 'id-card-outline', color: '#3B82F6', isDefault: true, createdAt: iso },
    { id: 'f_ins', name: 'Insurance', icon: 'shield-checkmark-outline', color: '#10B981', isDefault: true, createdAt: iso },
    { id: 'f_veh', name: 'Vehicle', icon: 'car-outline', color: '#F97316', isDefault: true, createdAt: iso },
    { id: 'f_med', name: 'Medical', icon: 'medkit-outline', color: '#EF4444', isDefault: true, createdAt: iso },
    { id: 'f_fin', name: 'Financial', icon: 'card-outline', color: '#F59E0B', isDefault: true, createdAt: iso },
    { id: 'f_edu', name: 'Education', icon: 'school-outline', color: '#8B5CF6', isDefault: true, createdAt: iso },
    { id: 'f_cert', name: 'Certificates', icon: 'ribbon-outline', color: '#EC4899', isDefault: true, createdAt: iso },
    { id: 'f_other', name: 'Other', icon: 'folder-outline', color: '#64748B', isDefault: true, createdAt: iso },
  ];
}

/* ───── Icon & Color Options ───── */

const ICON_OPTIONS: string[] = [
  'folder-outline', 'document-outline', 'image-outline', 'shield-checkmark-outline',
  'car-outline', 'medkit-outline', 'card-outline', 'school-outline',
  'ribbon-outline', 'briefcase-outline', 'home-outline', 'heart-outline',
  'id-card-outline', 'airplane-outline', 'person-outline', 'key-outline',
  'globe-outline', 'receipt-outline', 'pricetag-outline', 'construct-outline',
];

const COLOR_OPTIONS: string[] = [
  '#3B82F6', '#10B981', '#F97316', '#EF4444', '#F59E0B', '#8B5CF6',
  '#EC4899', '#64748B', '#0891B2', '#059669', '#D946EF', '#2563EB',
];

/* ───── Component ───── */

export default function DocVaultScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  /* ── State ── */
  const [files, setFiles] = useState<DocFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [settings, setSettings] = useState<VaultSettings>({ autoSync: false });
  const [auth, setAuth] = useState<DriveAuth | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('folders');
  const [searchQuery, setSearchQuery] = useState('');

  // PIN state
  const [pinUnlocked, setPinUnlocked] = useState<Set<string>>(new Set());
  const [pinEntryFolderId, setPinEntryFolderId] = useState<string | null>(null);
  const [pinDigits, setPinDigits] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [pinCooldown, setPinCooldown] = useState(0);
  const pinCooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modals
  const [showSettings, setShowSettings] = useState(false);
  const [showFAB, setShowFAB] = useState(false);
  const [showFolderEdit, setShowFolderEdit] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState<DocFile | null>(null);
  const [showFileInfo, setShowFileInfo] = useState<DocFile | null>(null);

  // Folder edit form
  const [editFolderId, setEditFolderId] = useState<string | null>(null);
  const [formFolderName, setFormFolderName] = useState('');
  const [formFolderIcon, setFormFolderIcon] = useState('folder-outline');
  const [formFolderColor, setFormFolderColor] = useState('#3B82F6');
  const [formPinEnabled, setFormPinEnabled] = useState(false);
  const [formPin, setFormPin] = useState('');
  const [formPinConfirm, setFormPinConfirm] = useState('');
  const [formCurrentPin, setFormCurrentPin] = useState('');

  // File pick pending
  const [pendingFile, setPendingFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);

  // Settings state
  const [storageUsed, setStorageUsed] = useState(0);
  const [loadingStorage, setLoadingStorage] = useState(false);

  /* ── Auth session ── */
  const discovery = useMemo(() => getDiscovery(), []);
  const authConfig = useMemo(() => getAuthRequestConfig(), []);
  const [request, response, promptAsync] = AuthSession.useAuthRequest(authConfig, discovery);

  /* ── Load data ── */
  useEffect(() => {
    (async () => {
      const [loadedFiles, loadedFolders, loadedSettings, loadedAuth] = await Promise.all([
        loadJSON<DocFile[]>(KEYS.docVaultFiles, []),
        loadJSON<Folder[]>(KEYS.docVaultFolders, []),
        loadJSON<VaultSettings>(KEYS.docVaultSettings, { autoSync: false }),
        loadAuth(),
      ]);
      setFiles(loadedFiles);
      if (loadedFolders.length === 0) {
        const defaults = makeDefaultFolders();
        setFolders(defaults);
        saveJSON(KEYS.docVaultFolders, defaults);
      } else {
        setFolders(loadedFolders);
      }
      setSettings(loadedSettings);
      setAuth(loadedAuth);
    })();
  }, []);

  /* ── Handle auth response ── */
  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      exchangeCodeForTokens(response.params.code, request?.codeVerifier)
        .then((a) => setAuth(a))
        .catch(() => Alert.alert('Sign-In Failed', 'Could not complete Google sign-in.'));
    }
  }, [response, request]);

  /* ── Persist helpers ── */
  const persistFiles = useCallback((updated: DocFile[]) => {
    setFiles(updated);
    saveJSON(KEYS.docVaultFiles, updated);
  }, []);

  const persistFolders = useCallback((updated: Folder[]) => {
    setFolders(updated);
    saveJSON(KEYS.docVaultFolders, updated);
  }, []);

  const persistSettings = useCallback((updated: VaultSettings) => {
    setSettings(updated);
    saveJSON(KEYS.docVaultSettings, updated);
  }, []);

  /* ── Computed ── */
  const folderMap = useMemo(() => {
    const map: Record<string, Folder> = {};
    for (const f of folders) map[f.id] = f;
    return map;
  }, [folders]);

  const fileCountByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of files) {
      counts[f.folderId] = (counts[f.folderId] || 0) + 1;
    }
    return counts;
  }, [files]);

  const filteredFiles = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const sorted = [...files].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    if (!q) return sorted;
    return sorted.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  /* ───── PIN Logic ───── */

  const openPinEntry = useCallback((folderId: string) => {
    setPinEntryFolderId(folderId);
    setPinDigits('');
    setPinAttempts(0);
    setPinCooldown(0);
  }, []);

  const closePinEntry = useCallback(() => {
    setPinEntryFolderId(null);
    setPinDigits('');
    setPinAttempts(0);
    setPinCooldown(0);
    if (pinCooldownRef.current) {
      clearInterval(pinCooldownRef.current);
      pinCooldownRef.current = null;
    }
  }, []);

  const handlePinDigit = useCallback(
    (digit: string) => {
      if (pinCooldown > 0) return;
      if (!pinEntryFolderId) return;
      const next = pinDigits + digit;
      if (next.length > 4) return;
      setPinDigits(next);

      if (next.length === 4) {
        // Verify PIN
        const folder = folderMap[pinEntryFolderId];
        if (!folder?.pinHash) return;

        Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, next).then((hash) => {
          if (hash === folder.pinHash) {
            // Correct
            setPinUnlocked((prev) => new Set(prev).add(pinEntryFolderId));
            closePinEntry();
            router.push({ pathname: '/tools/doc-vault-folder' as any, params: { id: pinEntryFolderId } });
          } else {
            // Wrong
            const newAttempts = pinAttempts + 1;
            setPinAttempts(newAttempts);
            setPinDigits('');
            if (newAttempts >= 3) {
              setPinCooldown(30);
              pinCooldownRef.current = setInterval(() => {
                setPinCooldown((prev) => {
                  if (prev <= 1) {
                    if (pinCooldownRef.current) clearInterval(pinCooldownRef.current);
                    pinCooldownRef.current = null;
                    setPinAttempts(0);
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
            }
          }
        });
      }
    },
    [pinDigits, pinEntryFolderId, pinAttempts, pinCooldown, folderMap, closePinEntry]
  );

  const handlePinBackspace = useCallback(() => {
    if (pinCooldown > 0) return;
    setPinDigits((prev) => prev.slice(0, -1));
  }, [pinCooldown]);

  /* ───── Folder Navigation ───── */

  const handleFolderTap = useCallback(
    (folder: Folder) => {
      if (folder.pinHash && !pinUnlocked.has(folder.id)) {
        openPinEntry(folder.id);
      } else {
        router.push({ pathname: '/tools/doc-vault-folder' as any, params: { id: folder.id } });
      }
    },
    [pinUnlocked, openPinEntry]
  );

  /* ───── Folder Edit ───── */

  const openCreateFolder = useCallback(() => {
    setEditFolderId(null);
    setFormFolderName('');
    setFormFolderIcon('folder-outline');
    setFormFolderColor('#3B82F6');
    setFormPinEnabled(false);
    setFormPin('');
    setFormPinConfirm('');
    setFormCurrentPin('');
    setShowFolderEdit(true);
  }, []);

  const openEditFolder = useCallback(
    (folder: Folder) => {
      setEditFolderId(folder.id);
      setFormFolderName(folder.name);
      setFormFolderIcon(folder.icon);
      setFormFolderColor(folder.color);
      setFormPinEnabled(!!folder.pinHash);
      setFormPin('');
      setFormPinConfirm('');
      setFormCurrentPin('');
      setShowFolderEdit(true);
    },
    []
  );

  const saveFolder = useCallback(async () => {
    if (!formFolderName.trim()) {
      Alert.alert('Error', 'Folder name is required.');
      return;
    }

    let pinHash: string | undefined;

    if (editFolderId) {
      const existing = folderMap[editFolderId];

      // Removing PIN
      if (existing?.pinHash && !formPinEnabled) {
        if (!formCurrentPin) {
          Alert.alert('Error', 'Enter current PIN to disable lock.');
          return;
        }
        const hash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          formCurrentPin
        );
        if (hash !== existing.pinHash) {
          Alert.alert('Error', 'Current PIN is incorrect.');
          return;
        }
        pinHash = undefined;
      }
      // Keeping existing PIN
      else if (existing?.pinHash && formPinEnabled && !formPin) {
        pinHash = existing.pinHash;
      }
      // Setting new PIN
      else if (formPinEnabled && formPin) {
        if (formPin.length !== 4 || formPin !== formPinConfirm) {
          Alert.alert('Error', 'PIN must be 4 digits and both fields must match.');
          return;
        }
        pinHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          formPin
        );
      }
      // No PIN
      else {
        pinHash = undefined;
      }

      const updated = folders.map((f) =>
        f.id === editFolderId
          ? { ...f, name: formFolderName.trim(), icon: formFolderIcon, color: formFolderColor, pinHash }
          : f
      );
      persistFolders(updated);
    } else {
      // Create new folder
      if (formPinEnabled) {
        if (formPin.length !== 4 || formPin !== formPinConfirm) {
          Alert.alert('Error', 'PIN must be 4 digits and both fields must match.');
          return;
        }
        pinHash = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          formPin
        );
      }

      const newFolder: Folder = {
        id: uid(),
        name: formFolderName.trim(),
        icon: formFolderIcon,
        color: formFolderColor,
        pinHash,
        isDefault: false,
        createdAt: todayISO(),
      };
      persistFolders([...folders, newFolder]);
    }

    setShowFolderEdit(false);
  }, [editFolderId, formFolderName, formFolderIcon, formFolderColor, formPinEnabled, formPin, formPinConfirm, formCurrentPin, folderMap, folders, persistFolders]);

  const deleteFolder = useCallback(
    (folderId: string) => {
      const folder = folderMap[folderId];
      if (!folder || folder.isDefault) return;

      Alert.alert('Delete Folder', `Delete "${folder.name}" and all its files?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const folderFiles = files.filter((f) => f.folderId === folderId);
            for (const file of folderFiles) {
              await deleteFile(file.localUri);
            }
            persistFiles(files.filter((f) => f.folderId !== folderId));
            persistFolders(folders.filter((f) => f.id !== folderId));
            setShowFolderEdit(false);
          },
        },
      ]);
    },
    [folderMap, files, folders, persistFiles, persistFolders]
  );

  /* ───── FAB / File Picking ───── */

  const pickFromCamera = useCallback(async () => {
    setShowFAB(false);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Camera access is required to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPendingFile({
      uri: asset.uri,
      name: asset.fileName || `photo_${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    });
    setShowFolderPicker(true);
  }, []);

  const pickFromGallery = useCallback(async () => {
    setShowFAB(false);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Denied', 'Gallery access is required to pick images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPendingFile({
      uri: asset.uri,
      name: asset.fileName || `image_${Date.now()}.jpg`,
      mimeType: asset.mimeType || 'image/jpeg',
    });
    setShowFolderPicker(true);
  }, []);

  const pickFromFiles = useCallback(async () => {
    setShowFAB(false);
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPendingFile({
      uri: asset.uri,
      name: asset.name || `file_${Date.now()}`,
      mimeType: asset.mimeType || 'application/octet-stream',
    });
    setShowFolderPicker(true);
  }, []);

  const handleFolderSelect = useCallback(
    async (folderId: string) => {
      if (!pendingFile) return;
      setShowFolderPicker(false);
      try {
        const { localUri, fileName, size } = await copyFileToVault(
          pendingFile.uri,
          pendingFile.name
        );
        const newFile: DocFile = {
          id: uid(),
          name: pendingFile.name,
          fileName,
          localUri,
          mimeType: pendingFile.mimeType,
          size,
          folderId,
          tags: [],
          driveSynced: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        persistFiles([...files, newFile]);
        setPendingFile(null);
      } catch {
        Alert.alert('Error', 'Failed to save file to vault.');
        setPendingFile(null);
      }
    },
    [pendingFile, files, persistFiles]
  );

  /* ───── Settings ───── */

  const openSettings = useCallback(async () => {
    setShowSettings(true);
    setLoadingStorage(true);
    try {
      const used = await getStorageUsed();
      setStorageUsed(used);
    } catch {
      setStorageUsed(0);
    }
    setLoadingStorage(false);
  }, []);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setAuth(null);
  }, []);

  const handleSignIn = useCallback(() => {
    promptAsync();
  }, [promptAsync]);

  /* ───── Render Helpers ───── */

  // Folder card
  const renderFolderCard = useCallback(
    ({ item, index }: { item: Folder | 'add'; index: number }) => {
      if (item === 'add') {
        return (
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.folderCard, { borderStyle: 'dashed', borderColor: colors.borderStrong }]}
            onPress={openCreateFolder}
          >
            <View style={[styles.folderIconCircle, { backgroundColor: withAlpha(ACCENT, '18') }]}>
              <Ionicons name="add" size={28} color={ACCENT} />
            </View>
            <Text style={[styles.folderCardName, { color: colors.textSub }]}>New Folder</Text>
          </TouchableOpacity>
        );
      }

      const count = fileCountByFolder[item.id] || 0;

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.folderCard, { borderColor: colors.border }]}
          onPress={() => handleFolderTap(item)}
          onLongPress={() => openEditFolder(item)}
        >
          <View style={[styles.folderIconCircle, { backgroundColor: withAlpha(item.color, '1A') }]}>
            <Ionicons name={item.icon as any} size={26} color={item.color} />
          </View>
          <Text style={[styles.folderCardName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.folderCardMeta}>
            <Text style={[styles.folderCardCount, { color: colors.textMuted }]}>
              {count} {count === 1 ? 'file' : 'files'}
            </Text>
            {item.pinHash ? (
              <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
            ) : null}
          </View>
        </TouchableOpacity>
      );
    },
    [styles, colors, fileCountByFolder, handleFolderTap, openCreateFolder, openEditFolder]
  );

  // File card
  const renderFileCard = useCallback(
    ({ item }: { item: DocFile }) => {
      const folder = folderMap[item.folderId];
      const isImage = isImageMime(item.mimeType);

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.fileCard, { borderColor: colors.border }]}
          onPress={() => {
            if (isImage) {
              setShowImagePreview(item);
            } else {
              setShowFileInfo(item);
            }
          }}
        >
          <View style={[styles.fileThumbnail, { backgroundColor: withAlpha(folder?.color || '#64748B', '14') }]}>
            {isImage ? (
              <Image source={{ uri: item.localUri }} style={styles.fileThumbnailImage} />
            ) : (
              <Ionicons name={getFileIcon(item.mimeType) as any} size={28} color={folder?.color || '#64748B'} />
            )}
          </View>
          <View style={styles.fileCardBody}>
            <Text style={[styles.fileCardName, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.fileCardRow}>
              <Text style={[styles.fileCardSize, { color: colors.textMuted }]}>
                {formatBytes(item.size)}
              </Text>
              {folder && (
                <View style={[styles.folderBadge, { backgroundColor: withAlpha(folder.color, '18') }]}>
                  <Text style={[styles.folderBadgeText, { color: folder.color }]} numberOfLines={1}>
                    {folder.name}
                  </Text>
                </View>
              )}
            </View>
            <Text style={[styles.fileCardDate, { color: colors.textMuted }]}>
              {formatDate(item.updatedAt)}
            </Text>
          </View>
          {item.driveSynced && (
            <Ionicons name="cloud-done-outline" size={16} color={colors.success} style={{ marginLeft: Spacing.sm }} />
          )}
        </TouchableOpacity>
      );
    },
    [styles, colors, folderMap]
  );

  const foldersGridData = useMemo(() => [...folders, 'add' as const], [folders]);

  /* ───── Render ───── */

  return (
    <ScreenShell
      title="Doc Vault"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {auth && (
            <View style={styles.avatarDot}>
              <Text style={styles.avatarText}>{auth.email[0].toUpperCase()}</Text>
            </View>
          )}
          <TouchableOpacity onPress={openSettings} activeOpacity={0.7}>
            <Ionicons name="settings-outline" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      }
    >
      {/* ── Tab Bar ── */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.tab, activeTab === 'folders' && styles.tabActive]}
          onPress={() => setActiveTab('folders')}
        >
          <Ionicons
            name="folder-outline"
            size={18}
            color={activeTab === 'folders' ? ACCENT : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'folders' ? ACCENT : colors.textMuted },
              activeTab === 'folders' && styles.tabTextActive,
            ]}
          >
            Folders
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.tab, activeTab === 'files' && styles.tabActive]}
          onPress={() => setActiveTab('files')}
        >
          <Ionicons
            name="documents-outline"
            size={18}
            color={activeTab === 'files' ? ACCENT : colors.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              { color: activeTab === 'files' ? ACCENT : colors.textMuted },
              activeTab === 'files' && styles.tabTextActive,
            ]}
          >
            All Files
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Folders Tab ── */}
      {activeTab === 'folders' && (
        <FlatList
          data={foldersGridData}
          keyExtractor={(item) => (typeof item === 'string' ? 'add' : item.id)}
          numColumns={2}
          columnWrapperStyle={styles.folderRow}
          contentContainerStyle={styles.folderListContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) =>
            renderFolderCard({ item, index })
          }
          ListEmptyComponent={null}
        />
      )}

      {/* ── All Files Tab ── */}
      {activeTab === 'files' && (
        <View style={{ flex: 1 }}>
          {/* Search */}
          <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={18} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search files..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} activeOpacity={0.7}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {filteredFiles.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconCircle, { backgroundColor: withAlpha(ACCENT, '14') }]}>
                <Ionicons name="document-outline" size={48} color={ACCENT} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No Files Yet</Text>
              <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
                Tap the + button below to add your first document.
              </Text>
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.emptyAddBtn, { backgroundColor: ACCENT }]}
                onPress={() => setShowFAB(true)}
              >
                <Ionicons name="add" size={20} color="#FFF" />
                <Text style={styles.emptyAddBtnText}>Add File</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={filteredFiles}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.fileListContent}
              showsVerticalScrollIndicator={false}
              renderItem={renderFileCard}
            />
          )}
        </View>
      )}

      {/* ── FAB ── */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.fab, { backgroundColor: ACCENT }]}
        onPress={() => setShowFAB(true)}
      >
        <Ionicons name="add" size={28} color="#FFF" />
      </TouchableOpacity>

      {/* ══════════════════════ MODALS ══════════════════════ */}

      {/* ── FAB Bottom Sheet ── */}
      <KeyboardAwareModal visible={showFAB} transparent animationType="fade" onRequestClose={() => setShowFAB(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setShowFAB(false)}
        >
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add File</Text>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.sheetOption, { borderColor: colors.border }]}
              onPress={pickFromCamera}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: withAlpha('#3B82F6', '18') }]}>
                <Ionicons name="camera-outline" size={24} color="#3B82F6" />
              </View>
              <View>
                <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Camera</Text>
                <Text style={[styles.sheetOptionSub, { color: colors.textMuted }]}>Take a photo</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.sheetOption, { borderColor: colors.border }]}
              onPress={pickFromGallery}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: withAlpha('#10B981', '18') }]}>
                <Ionicons name="images-outline" size={24} color="#10B981" />
              </View>
              <View>
                <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Gallery</Text>
                <Text style={[styles.sheetOptionSub, { color: colors.textMuted }]}>Pick from gallery</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.sheetOption, { borderColor: colors.border }]}
              onPress={pickFromFiles}
            >
              <View style={[styles.sheetOptionIcon, { backgroundColor: withAlpha('#F59E0B', '18') }]}>
                <Ionicons name="folder-open-outline" size={24} color="#F59E0B" />
              </View>
              <View>
                <Text style={[styles.sheetOptionTitle, { color: colors.text }]}>Browse Files</Text>
                <Text style={[styles.sheetOptionSub, { color: colors.textMuted }]}>Pick any file</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </KeyboardAwareModal>

      {/* ── Folder Picker Modal ── */}
      <KeyboardAwareModal visible={showFolderPicker} transparent animationType="fade" onRequestClose={() => { setShowFolderPicker(false); setPendingFile(null); }}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => { setShowFolderPicker(false); setPendingFile(null); }}
        >
          <View style={[styles.pickerSheet, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={[styles.sheetHandle, { backgroundColor: colors.borderStrong }]} />
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Choose Folder</Text>
            <FlatList
              data={folders}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.folderRow}
              contentContainerStyle={{ paddingBottom: Spacing.lg }}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.folderPickerCard, { borderColor: colors.border }]}
                  onPress={() => handleFolderSelect(item.id)}
                >
                  <View style={[styles.folderIconCircle, { backgroundColor: withAlpha(item.color, '1A'), width: 40, height: 40 }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={[styles.folderPickerName, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </KeyboardAwareModal>

      {/* ── Settings Modal ── */}
      <KeyboardAwareModal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setShowSettings(false)}
        >
          <View style={[styles.settingsModal, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Google Account */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textMuted }]}>Google Account</Text>
              {auth ? (
                <View style={[styles.settingsCard, { borderColor: colors.border }]}>
                  <View style={styles.settingsAccountRow}>
                    <View style={[styles.avatarDot, { width: 36, height: 36 }]}>
                      <Text style={[styles.avatarText, { fontSize: 14 }]}>{auth.email[0].toUpperCase()}</Text>
                    </View>
                    <Text style={[styles.settingsAccountEmail, { color: colors.text }]} numberOfLines={1}>
                      {auth.email}
                    </Text>
                  </View>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    style={[styles.signOutBtn, { borderColor: colors.error }]}
                    onPress={handleSignOut}
                  >
                    <Ionicons name="log-out-outline" size={18} color={colors.error} />
                    <Text style={[styles.signOutBtnText, { color: colors.error }]}>Sign Out</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.googleBtn]}
                  onPress={handleSignIn}
                >
                  <Ionicons name="logo-google" size={20} color="#FFF" />
                  <Text style={styles.googleBtnText}>Continue with Google</Text>
                </TouchableOpacity>
              )}

              {/* Auto Sync */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textMuted, marginTop: Spacing.xl }]}>
                Backup
              </Text>
              <View style={[styles.settingsCard, { borderColor: colors.border }]}>
                <View style={styles.settingsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsToggleLabel, { color: colors.text }]}>Auto-sync to Drive</Text>
                    <Text style={[styles.settingsToggleSub, { color: colors.textMuted }]}>
                      Automatically back up new files
                    </Text>
                  </View>
                  <Switch
                    value={settings.autoSync}
                    onValueChange={(val) => persistSettings({ ...settings, autoSync: val })}
                    trackColor={{ false: colors.border, true: withAlpha(ACCENT, '60') }}
                    thumbColor={settings.autoSync ? ACCENT : colors.textMuted}
                  />
                </View>
              </View>

              {/* Storage */}
              <Text style={[styles.settingsSectionTitle, { color: colors.textMuted, marginTop: Spacing.xl }]}>
                Storage
              </Text>
              <View style={[styles.settingsCard, { borderColor: colors.border }]}>
                <View style={styles.settingsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsToggleLabel, { color: colors.text }]}>Vault Storage Used</Text>
                    {loadingStorage ? (
                      <ActivityIndicator size="small" color={ACCENT} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                    ) : (
                      <Text style={[styles.settingsToggleSub, { color: colors.textMuted }]}>
                        {formatBytes(storageUsed)} across {files.length} file{files.length !== 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>
                  <Ionicons name="server-outline" size={22} color={colors.textMuted} />
                </View>
              </View>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </KeyboardAwareModal>

      {/* ── Folder Edit Modal ── */}
      <KeyboardAwareModal visible={showFolderEdit} transparent animationType="fade" onRequestClose={() => setShowFolderEdit(false)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setShowFolderEdit(false)}
        >
          <View style={[styles.folderEditModal, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, { color: colors.text }]}>
                  {editFolderId ? 'Edit Folder' : 'New Folder'}
                </Text>
                <TouchableOpacity onPress={() => setShowFolderEdit(false)} activeOpacity={0.7}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Name */}
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Folder Name</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                placeholder="Enter folder name"
                placeholderTextColor={colors.textMuted}
                value={formFolderName}
                onChangeText={setFormFolderName}
              />

              {/* Icon Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>Icon</Text>
              <View style={styles.iconGrid}>
                {ICON_OPTIONS.map((iconName) => (
                  <TouchableOpacity
                    key={iconName}
                    activeOpacity={0.7}
                    style={[
                      styles.iconOption,
                      { borderColor: formFolderIcon === iconName ? formFolderColor : colors.border },
                      formFolderIcon === iconName && { backgroundColor: withAlpha(formFolderColor, '18') },
                    ]}
                    onPress={() => setFormFolderIcon(iconName)}
                  >
                    <Ionicons
                      name={iconName as any}
                      size={22}
                      color={formFolderIcon === iconName ? formFolderColor : colors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>

              {/* Color Picker */}
              <Text style={[styles.fieldLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>Color</Text>
              <View style={styles.colorRow}>
                {COLOR_OPTIONS.map((c) => (
                  <TouchableOpacity
                    key={c}
                    activeOpacity={0.7}
                    style={[
                      styles.colorCircle,
                      { backgroundColor: c },
                      formFolderColor === c && styles.colorCircleSelected,
                    ]}
                    onPress={() => setFormFolderColor(c)}
                  >
                    {formFolderColor === c && <Ionicons name="checkmark" size={16} color="#FFF" />}
                  </TouchableOpacity>
                ))}
              </View>

              {/* PIN Toggle */}
              <Text style={[styles.fieldLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>Security</Text>
              <View style={[styles.settingsCard, { borderColor: colors.border }]}>
                <View style={styles.settingsToggleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingsToggleLabel, { color: colors.text }]}>PIN Lock</Text>
                    <Text style={[styles.settingsToggleSub, { color: colors.textMuted }]}>
                      Require a 4-digit PIN to open
                    </Text>
                  </View>
                  <Switch
                    value={formPinEnabled}
                    onValueChange={(val) => {
                      setFormPinEnabled(val);
                      if (!val) {
                        setFormPin('');
                        setFormPinConfirm('');
                      }
                    }}
                    trackColor={{ false: colors.border, true: withAlpha(ACCENT, '60') }}
                    thumbColor={formPinEnabled ? ACCENT : colors.textMuted}
                  />
                </View>
              </View>

              {/* PIN Input (when enabling) */}
              {formPinEnabled && (
                <View style={{ marginTop: Spacing.md }}>
                  {/* If editing a folder that already has a PIN and user is disabling, require current PIN */}
                  {editFolderId && folderMap[editFolderId]?.pinHash && !formPinEnabled ? null : null}

                  {/* Current PIN (for disabling on existing folder) */}
                  {editFolderId && folderMap[editFolderId]?.pinHash && !formPinEnabled && (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Current PIN</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        placeholder="Enter current PIN"
                        placeholderTextColor={colors.textMuted}
                        value={formCurrentPin}
                        onChangeText={setFormCurrentPin}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                    </>
                  )}

                  {/* New PIN fields (only show if setting a new PIN or no existing PIN) */}
                  {(!editFolderId || !folderMap[editFolderId]?.pinHash || formPin.length > 0 || formPinConfirm.length > 0 || !folderMap[editFolderId]?.pinHash) && (
                    <>
                      <Text style={[styles.fieldLabel, { color: colors.textSub }]}>
                        {editFolderId && folderMap[editFolderId]?.pinHash ? 'New PIN (leave blank to keep current)' : 'Set PIN'}
                      </Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        placeholder="4-digit PIN"
                        placeholderTextColor={colors.textMuted}
                        value={formPin}
                        onChangeText={setFormPin}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                      <Text style={[styles.fieldLabel, { color: colors.textSub, marginTop: Spacing.sm }]}>Confirm PIN</Text>
                      <TextInput
                        style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                        placeholder="Confirm PIN"
                        placeholderTextColor={colors.textMuted}
                        value={formPinConfirm}
                        onChangeText={setFormPinConfirm}
                        keyboardType="number-pad"
                        maxLength={4}
                        secureTextEntry
                      />
                    </>
                  )}
                </View>
              )}

              {/* Disable PIN — require current PIN */}
              {!formPinEnabled && editFolderId && folderMap[editFolderId]?.pinHash && (
                <View style={{ marginTop: Spacing.md }}>
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Current PIN (required to remove lock)</Text>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    placeholder="Enter current PIN"
                    placeholderTextColor={colors.textMuted}
                    value={formCurrentPin}
                    onChangeText={setFormCurrentPin}
                    keyboardType="number-pad"
                    maxLength={4}
                    secureTextEntry
                  />
                </View>
              )}

              {/* Save Button */}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.saveBtn, { backgroundColor: ACCENT }]}
                onPress={saveFolder}
              >
                <Ionicons name="checkmark" size={20} color="#FFF" />
                <Text style={styles.saveBtnText}>{editFolderId ? 'Save Changes' : 'Create Folder'}</Text>
              </TouchableOpacity>

              {/* Delete Button (non-default only) */}
              {editFolderId && !folderMap[editFolderId]?.isDefault && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.deleteBtn, { borderColor: colors.error }]}
                  onPress={() => deleteFolder(editFolderId)}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.error} />
                  <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete Folder</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </KeyboardAwareModal>

      {/* ── PIN Entry Overlay ── */}
      <KeyboardAwareModal visible={!!pinEntryFolderId} transparent animationType="fade" onRequestClose={closePinEntry}>
        <View style={[styles.pinOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.pinModal, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.pinCloseBtn} onPress={closePinEntry} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>

            <Ionicons name="lock-closed" size={36} color={ACCENT} style={{ marginBottom: Spacing.md }} />
            <Text style={[styles.pinTitle, { color: colors.text }]}>Enter PIN</Text>
            <Text style={[styles.pinSubtitle, { color: colors.textMuted }]}>
              {pinEntryFolderId ? (folderMap[pinEntryFolderId]?.name || 'Folder') : 'Folder'}
            </Text>

            {/* PIN Dots */}
            <View style={styles.pinDots}>
              {[0, 1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.pinDot,
                    {
                      backgroundColor: i < pinDigits.length ? ACCENT : 'transparent',
                      borderColor: i < pinDigits.length ? ACCENT : colors.borderStrong,
                    },
                  ]}
                />
              ))}
            </View>

            {/* Cooldown message */}
            {pinCooldown > 0 && (
              <Text style={[styles.pinCooldownText, { color: colors.error }]}>
                Too many attempts. Try again in {pinCooldown}s
              </Text>
            )}

            {/* Numeric Keypad */}
            <View style={styles.keypad}>
              {[
                ['1', '2', '3'],
                ['4', '5', '6'],
                ['7', '8', '9'],
                ['', '0', 'back'],
              ].map((row, ri) => (
                <View key={ri} style={styles.keypadRow}>
                  {row.map((key, ki) => {
                    if (key === '') {
                      return <View key={ki} style={styles.keypadKey} />;
                    }
                    if (key === 'back') {
                      return (
                        <TouchableOpacity
                          key={ki}
                          activeOpacity={0.7}
                          style={styles.keypadKey}
                          onPress={handlePinBackspace}
                        >
                          <Ionicons name="backspace-outline" size={24} color={colors.text} />
                        </TouchableOpacity>
                      );
                    }
                    return (
                      <TouchableOpacity
                        key={ki}
                        activeOpacity={0.7}
                        style={[styles.keypadKey, { backgroundColor: colors.glass }]}
                        onPress={() => handlePinDigit(key)}
                      >
                        <Text style={[styles.keypadKeyText, { color: colors.text }]}>{key}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </View>
      </KeyboardAwareModal>

      {/* ── Image Preview Modal ── */}
      <KeyboardAwareModal visible={!!showImagePreview} transparent animationType="fade" onRequestClose={() => setShowImagePreview(null)}>
        <View style={[styles.previewOverlay, { backgroundColor: colors.overlay }]}>
          <View style={styles.previewHeader}>
            <TouchableOpacity onPress={() => setShowImagePreview(null)} activeOpacity={0.7}>
              <Ionicons name="close" size={28} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.previewTitle} numberOfLines={1}>
              {showImagePreview?.name || ''}
            </Text>
            <View style={{ width: 28 }} />
          </View>
          {showImagePreview && (
            <Image
              source={{ uri: showImagePreview.localUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
          {showImagePreview && (
            <View style={styles.previewFooter}>
              <Text style={styles.previewFooterText}>
                {formatBytes(showImagePreview.size)} {'\u2022'} {formatDate(showImagePreview.updatedAt)}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAwareModal>

      {/* ── File Info Modal ── */}
      <KeyboardAwareModal visible={!!showFileInfo} transparent animationType="fade" onRequestClose={() => setShowFileInfo(null)}>
        <TouchableOpacity
          activeOpacity={1}
          style={styles.modalOverlay}
          onPress={() => setShowFileInfo(null)}
        >
          <View style={[styles.fileInfoModal, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <View style={styles.settingsHeader}>
              <Text style={[styles.settingsTitle, { color: colors.text }]}>File Details</Text>
              <TouchableOpacity onPress={() => setShowFileInfo(null)} activeOpacity={0.7}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            {showFileInfo && (
              <View>
                <View style={[styles.fileInfoIconWrap, { backgroundColor: withAlpha(folderMap[showFileInfo.folderId]?.color || '#64748B', '14') }]}>
                  <Ionicons
                    name={getFileIcon(showFileInfo.mimeType) as any}
                    size={48}
                    color={folderMap[showFileInfo.folderId]?.color || '#64748B'}
                  />
                </View>

                <View style={styles.fileInfoRow}>
                  <Text style={[styles.fileInfoLabel, { color: colors.textMuted }]}>Name</Text>
                  <Text style={[styles.fileInfoValue, { color: colors.text }]} numberOfLines={2}>{showFileInfo.name}</Text>
                </View>
                <View style={styles.fileInfoRow}>
                  <Text style={[styles.fileInfoLabel, { color: colors.textMuted }]}>Size</Text>
                  <Text style={[styles.fileInfoValue, { color: colors.text }]}>{formatBytes(showFileInfo.size)}</Text>
                </View>
                <View style={styles.fileInfoRow}>
                  <Text style={[styles.fileInfoLabel, { color: colors.textMuted }]}>Type</Text>
                  <Text style={[styles.fileInfoValue, { color: colors.text }]}>{showFileInfo.mimeType}</Text>
                </View>
                <View style={styles.fileInfoRow}>
                  <Text style={[styles.fileInfoLabel, { color: colors.textMuted }]}>Folder</Text>
                  <Text style={[styles.fileInfoValue, { color: colors.text }]}>
                    {folderMap[showFileInfo.folderId]?.name || 'Unknown'}
                  </Text>
                </View>
                <View style={styles.fileInfoRow}>
                  <Text style={[styles.fileInfoLabel, { color: colors.textMuted }]}>Added</Text>
                  <Text style={[styles.fileInfoValue, { color: colors.text }]}>{formatDate(showFileInfo.createdAt)}</Text>
                </View>
                <View style={styles.fileInfoRow}>
                  <Text style={[styles.fileInfoLabel, { color: colors.textMuted }]}>Drive Sync</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons
                      name={showFileInfo.driveSynced ? 'cloud-done-outline' : 'cloud-offline-outline'}
                      size={16}
                      color={showFileInfo.driveSynced ? colors.success : colors.textMuted}
                    />
                    <Text style={[styles.fileInfoValue, { color: showFileInfo.driveSynced ? colors.success : colors.textMuted }]}>
                      {showFileInfo.driveSynced ? 'Synced' : 'Not synced'}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

/* ───── Styles ───── */

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    /* Tab Bar */
    tabBar: {
      flexDirection: 'row',
      borderRadius: Radii.md,
      backgroundColor: colors.glass,
      padding: 3,
      marginBottom: Spacing.lg,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.sm + 2,
      borderRadius: Radii.sm,
    },
    tabActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    tabText: {
      fontFamily: Fonts.medium,
      fontSize: 14,
    },
    tabTextActive: {
      fontFamily: Fonts.semibold,
    },

    /* Folder Grid */
    folderRow: {
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    folderListContent: {
      paddingBottom: 100,
      gap: Spacing.md,
    },
    folderCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    folderIconCircle: {
      width: 52,
      height: 52,
      borderRadius: Radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
    },
    folderCardName: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      textAlign: 'center',
    },
    folderCardMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    folderCardCount: {
      fontFamily: Fonts.regular,
      fontSize: 12,
    },

    /* File List */
    fileListContent: {
      paddingBottom: 100,
      gap: Spacing.sm,
    },
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      borderWidth: 1,
      padding: Spacing.md,
      gap: Spacing.md,
    },
    fileThumbnail: {
      width: 52,
      height: 52,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fileThumbnailImage: {
      width: 52,
      height: 52,
      borderRadius: Radii.sm,
    },
    fileCardBody: {
      flex: 1,
      gap: 2,
    },
    fileCardName: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },
    fileCardRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    fileCardSize: {
      fontFamily: Fonts.regular,
      fontSize: 12,
    },
    fileCardDate: {
      fontFamily: Fonts.regular,
      fontSize: 11,
    },
    folderBadge: {
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: Radii.sm,
    },
    folderBadgeText: {
      fontFamily: Fonts.medium,
      fontSize: 10,
    },

    /* Search */
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radii.md,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    searchInput: {
      flex: 1,
      fontFamily: Fonts.regular,
      fontSize: 14,
      paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    },

    /* Empty State */
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xxl,
    },
    emptyIconCircle: {
      width: 96,
      height: 96,
      borderRadius: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    emptyTitle: {
      fontFamily: Fonts.bold,
      fontSize: 20,
      marginBottom: Spacing.sm,
    },
    emptyDesc: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: Spacing.xl,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.xl,
      paddingVertical: Spacing.md,
      borderRadius: Radii.pill,
    },
    emptyAddBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: '#FFF',
    },

    /* FAB */
    fab: {
      position: 'absolute',
      bottom: Spacing.xl,
      right: 0,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 6,
    },

    /* Modal Overlay */
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },

    /* Bottom Sheet */
    bottomSheet: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing.xxl + Spacing.lg,
      gap: Spacing.md,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginBottom: Spacing.sm,
    },
    sheetTitle: {
      fontFamily: Fonts.bold,
      fontSize: 18,
      marginBottom: Spacing.sm,
    },
    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      padding: Spacing.md,
    },
    sheetOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetOptionTitle: {
      fontFamily: Fonts.semibold,
      fontSize: 15,
    },
    sheetOptionSub: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      marginTop: 1,
    },

    /* Folder Picker */
    pickerSheet: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing.xxl,
      maxHeight: '70%',
    },
    folderPickerCard: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      borderWidth: 1,
      padding: Spacing.md,
    },
    folderPickerName: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      flex: 1,
    },

    /* Settings Modal */
    settingsModal: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing.xxl + Spacing.lg,
      maxHeight: '80%',
    },
    settingsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    settingsTitle: {
      fontFamily: Fonts.bold,
      fontSize: 20,
    },
    settingsSectionTitle: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: Spacing.sm,
    },
    settingsCard: {
      borderRadius: Radii.md,
      borderWidth: 1,
      padding: Spacing.md,
    },
    settingsAccountRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    settingsAccountEmail: {
      fontFamily: Fonts.medium,
      fontSize: 14,
      flex: 1,
    },
    settingsToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    settingsToggleLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },
    settingsToggleSub: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      marginTop: 2,
    },
    signOutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: Radii.sm,
      paddingVertical: Spacing.sm,
    },
    signOutBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
    },
    googleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: '#4285F4',
      borderRadius: Radii.md,
      paddingVertical: Spacing.md,
    },
    googleBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
      color: '#FFF',
    },

    /* Avatar Dot */
    avatarDot: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: ACCENT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: Fonts.bold,
      fontSize: 12,
      color: '#FFF',
    },

    /* Folder Edit Modal */
    folderEditModal: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing.xxl + Spacing.lg,
      maxHeight: '85%',
    },
    fieldLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 13,
      marginBottom: Spacing.xs,
    },
    textInput: {
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
      fontFamily: Fonts.regular,
      fontSize: 14,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    iconOption: {
      width: 44,
      height: 44,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    colorCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorCircleSelected: {
      borderWidth: 3,
      borderColor: '#FFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: Radii.md,
      paddingVertical: Spacing.md + 2,
      marginTop: Spacing.xl,
    },
    saveBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 15,
      color: '#FFF',
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderRadius: Radii.md,
      borderWidth: 1,
      paddingVertical: Spacing.md,
      marginTop: Spacing.md,
    },
    deleteBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 14,
    },

    /* PIN Modal */
    pinOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinModal: {
      width: '85%',
      maxWidth: 340,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      alignItems: 'center',
    },
    pinCloseBtn: {
      position: 'absolute',
      top: Spacing.md,
      right: Spacing.md,
    },
    pinTitle: {
      fontFamily: Fonts.bold,
      fontSize: 20,
      marginBottom: 4,
    },
    pinSubtitle: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      marginBottom: Spacing.xl,
    },
    pinDots: {
      flexDirection: 'row',
      gap: Spacing.lg,
      marginBottom: Spacing.xl,
    },
    pinDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 2,
    },
    pinCooldownText: {
      fontFamily: Fonts.medium,
      fontSize: 13,
      marginBottom: Spacing.md,
    },
    keypad: {
      gap: Spacing.md,
    },
    keypadRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    keypadKey: {
      width: 64,
      height: 52,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    keypadKeyText: {
      fontFamily: Fonts.semibold,
      fontSize: 22,
    },

    /* Image Preview */
    previewOverlay: {
      flex: 1,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.xxl + Spacing.lg,
      paddingBottom: Spacing.md,
    },
    previewTitle: {
      fontFamily: Fonts.semibold,
      fontSize: 16,
      color: '#FFF',
      flex: 1,
      textAlign: 'center',
      marginHorizontal: Spacing.md,
    },
    previewImage: {
      flex: 1,
      width: '100%',
    },
    previewFooter: {
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    previewFooterText: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: 'rgba(255,255,255,0.7)',
    },

    /* File Info Modal */
    fileInfoModal: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      paddingBottom: Spacing.xxl + Spacing.lg,
    },
    fileInfoIconWrap: {
      width: 80,
      height: 80,
      borderRadius: Radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: Spacing.xl,
    },
    fileInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm + 2,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    fileInfoLabel: {
      fontFamily: Fonts.medium,
      fontSize: 13,
    },
    fileInfoValue: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      maxWidth: '60%',
      textAlign: 'right',
    },
  });
