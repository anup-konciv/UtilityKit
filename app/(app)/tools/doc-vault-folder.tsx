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
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import * as Crypto from 'expo-crypto';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import {
  copyFileToVault,
  deleteFile,
  formatBytes,
  isImageMime,
  getFileIcon,
} from '@/lib/doc-vault/file-manager';
import { loadAuth, type DriveAuth } from '@/lib/doc-vault/auth';
import { uploadFile as driveUpload } from '@/lib/doc-vault/drive-api';

/* ───── Constants ───── */

const ACCENT = '#2563EB';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

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

/* ───── Helpers ───── */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  if (!iso) return '\u2014';
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

/* ───── Component ───── */

export default function DocVaultFolderScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();

  /* ── State ── */
  const [allFiles, setAllFiles] = useState<DocFile[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [driveAuth, setDriveAuth] = useState<DriveAuth | null>(null);

  // PIN state
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [pinAttempts, setPinAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modals
  const [previewFile, setPreviewFile] = useState<DocFile | null>(null);
  const [actionFile, setActionFile] = useState<DocFile | null>(null);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showMovePicker, setShowMovePicker] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [uploading, setUploading] = useState(false);

  /* ── Derived ── */
  const folder = useMemo(() => folders.find(f => f.id === id), [folders, id]);
  const needsPin = folder?.pinHash != null && folder.pinHash.length > 0;

  const folderFiles = useMemo(() => {
    return allFiles
      .filter(f => f.folderId === id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [allFiles, id]);

  /* ── Load data ── */
  useEffect(() => {
    loadJSON<DocFile[]>(KEYS.docVaultFiles, []).then(setAllFiles);
    loadJSON<Folder[]>(KEYS.docVaultFolders, []).then(setFolders);
    loadAuth().then(setDriveAuth);
  }, []);

  // Auto-unlock if no PIN
  useEffect(() => {
    if (!needsPin) setUnlocked(true);
  }, [needsPin]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      cooldownRef.current = setInterval(() => {
        setCooldown(prev => {
          if (prev <= 1) {
            if (cooldownRef.current) clearInterval(cooldownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Persist helpers ── */
  const persistFiles = useCallback((next: DocFile[]) => {
    setAllFiles(next);
    saveJSON(KEYS.docVaultFiles, next);
  }, []);

  /* ── PIN verification ── */
  const handlePinEntry = useCallback(async (digit: string) => {
    if (cooldown > 0) return;
    const next = pin + digit;
    setPin(next);

    if (next.length === 4) {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        next,
      );
      if (hash === folder?.pinHash) {
        setUnlocked(true);
        setPin('');
        setPinAttempts(0);
      } else {
        const attempts = pinAttempts + 1;
        setPinAttempts(attempts);
        setPin('');
        if (attempts >= 3) {
          setCooldown(30);
          setPinAttempts(0);
        } else {
          Alert.alert('Wrong PIN', `Incorrect PIN. ${3 - attempts} attempt${3 - attempts === 1 ? '' : 's'} remaining.`);
        }
      }
    }
  }, [pin, pinAttempts, cooldown, folder?.pinHash]);

  const handlePinBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1));
  }, []);

  /* ── File picking ── */
  const addFileFromResult = useCallback(async (
    sourceUri: string,
    originalName: string,
    mimeType: string,
  ) => {
    try {
      const result = await copyFileToVault(sourceUri, originalName);
      const newFile: DocFile = {
        id: uid(),
        name: originalName,
        fileName: result.fileName,
        localUri: result.localUri,
        mimeType: mimeType || 'application/octet-stream',
        size: result.size,
        folderId: id ?? '',
        tags: [],
        driveSynced: false,
        createdAt: todayISO(),
        updatedAt: todayISO(),
      };
      persistFiles([newFile, ...allFiles]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      Alert.alert('Error', `Failed to add file: ${msg}`);
    }
  }, [allFiles, id, persistFiles]);

  const pickCamera = useCallback(async () => {
    setShowAddSheet(false);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Camera access is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const name = asset.fileName ?? `photo_${Date.now()}.jpg`;
      await addFileFromResult(asset.uri, name, asset.mimeType ?? 'image/jpeg');
    }
  }, [addFileFromResult]);

  const pickGallery = useCallback(async () => {
    setShowAddSheet(false);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Required', 'Gallery access is needed to pick images.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0];
      const name = asset.fileName ?? `image_${Date.now()}.jpg`;
      await addFileFromResult(asset.uri, name, asset.mimeType ?? 'image/jpeg');
    }
  }, [addFileFromResult]);

  const pickDocument = useCallback(async () => {
    setShowAddSheet(false);
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      await addFileFromResult(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream');
    }
  }, [addFileFromResult]);

  /* ── Actions ── */
  const handleRename = useCallback(() => {
    if (!actionFile) return;
    const name = renameText.trim();
    if (!name) {
      Alert.alert('Error', 'File name cannot be empty.');
      return;
    }
    const updated = allFiles.map(f =>
      f.id === actionFile.id ? { ...f, name, updatedAt: todayISO() } : f,
    );
    persistFiles(updated);
    setShowRename(false);
    setActionFile(null);
  }, [actionFile, renameText, allFiles, persistFiles]);

  const handleMoveToFolder = useCallback((targetFolderId: string) => {
    if (!actionFile) return;
    const updated = allFiles.map(f =>
      f.id === actionFile.id ? { ...f, folderId: targetFolderId, updatedAt: todayISO() } : f,
    );
    persistFiles(updated);
    setShowMovePicker(false);
    setActionFile(null);
  }, [actionFile, allFiles, persistFiles]);

  const handleUploadToDrive = useCallback(async () => {
    if (!actionFile || !folder) return;
    setUploading(true);
    try {
      const driveFileId = await driveUpload(
        actionFile.localUri,
        actionFile.fileName,
        actionFile.mimeType,
        folder.name,
      );
      const updated = allFiles.map(f =>
        f.id === actionFile.id
          ? { ...f, driveFileId, driveSynced: true, updatedAt: todayISO() }
          : f,
      );
      persistFiles(updated);
      Alert.alert('Success', 'File uploaded to Google Drive.');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      Alert.alert('Upload Failed', msg);
    } finally {
      setUploading(false);
      setActionFile(null);
    }
  }, [actionFile, folder, allFiles, persistFiles]);

  const handleShare = useCallback(async () => {
    if (!actionFile) return;
    try {
      await Sharing.shareAsync(actionFile.localUri);
    } catch {
      Alert.alert('Error', 'Unable to share this file.');
    }
    setActionFile(null);
  }, [actionFile]);

  const handleDelete = useCallback(() => {
    if (!actionFile) return;
    Alert.alert(
      'Delete File',
      `Are you sure you want to delete "${actionFile.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFile(actionFile.localUri);
            } catch {
              // File may already be gone
            }
            const updated = allFiles.filter(f => f.id !== actionFile.id);
            persistFiles(updated);
            setActionFile(null);
          },
        },
      ],
    );
  }, [actionFile, allFiles, persistFiles]);

  /* ── PIN entry UI ── */
  const renderPinGate = () => {
    const dots = [0, 1, 2, 3];
    const keys = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['', '0', 'back'],
    ];

    return (
      <View style={styles.pinOverlay}>
        <View style={styles.pinContainer}>
          <View style={[styles.pinIconCircle, { backgroundColor: withAlpha(ACCENT, '20') }]}>
            <Ionicons name="lock-closed" size={32} color={ACCENT} />
          </View>
          <Text style={[styles.pinTitle, { color: colors.text }]}>Enter PIN</Text>
          <Text style={[styles.pinSubtitle, { color: colors.textMuted }]}>
            This folder is protected
          </Text>

          <View style={styles.pinDotsRow}>
            {dots.map(i => (
              <View
                key={i}
                style={[
                  styles.pinDot,
                  {
                    backgroundColor: i < pin.length ? ACCENT : 'transparent',
                    borderColor: i < pin.length ? ACCENT : colors.border,
                  },
                ]}
              />
            ))}
          </View>

          {cooldown > 0 && (
            <Text style={[styles.cooldownText, { color: colors.error }]}>
              Too many attempts. Try again in {cooldown}s
            </Text>
          )}

          <View style={styles.pinKeypad}>
            {keys.map((row, ri) => (
              <View key={ri} style={styles.pinKeyRow}>
                {row.map(key => {
                  if (key === '') {
                    return <View key="empty" style={styles.pinKeyEmpty} />;
                  }
                  if (key === 'back') {
                    return (
                      <TouchableOpacity
                        key="back"
                        activeOpacity={0.7}
                        style={[styles.pinKey, { backgroundColor: colors.surface }]}
                        onPress={handlePinBackspace}
                      >
                        <Ionicons name="backspace-outline" size={24} color={colors.text} />
                      </TouchableOpacity>
                    );
                  }
                  return (
                    <TouchableOpacity
                      key={key}
                      activeOpacity={0.7}
                      style={[
                        styles.pinKey,
                        {
                          backgroundColor: cooldown > 0
                            ? withAlpha(colors.surface, '60')
                            : colors.surface,
                        },
                      ]}
                      onPress={() => handlePinEntry(key)}
                      disabled={cooldown > 0}
                    >
                      <Text style={[styles.pinKeyText, { color: colors.text }]}>{key}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  /* ── File card ── */
  const renderFileCard = ({ item }: { item: DocFile }) => {
    const isImage = isImageMime(item.mimeType);

    return (
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.fileCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setPreviewFile(item)}
        onLongPress={() => {
          setActionFile(item);
          setRenameText(item.name);
        }}
      >
        {/* Thumbnail / icon */}
        <View style={[styles.fileThumbnail, { backgroundColor: withAlpha(ACCENT, '12') }]}>
          {isImage ? (
            <Image source={{ uri: item.localUri }} style={styles.fileThumbnailImage} />
          ) : (
            <Ionicons
              name={getFileIcon(item.mimeType) as keyof typeof Ionicons.glyphMap}
              size={26}
              color={ACCENT}
            />
          )}
        </View>

        {/* Info */}
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.fileMeta, { color: colors.textMuted }]} numberOfLines={1}>
            {formatBytes(item.size)}  {'\u00B7'}  {formatDate(item.createdAt)}
          </Text>
        </View>

        {/* Sync icon */}
        {driveAuth != null && (
          <View style={styles.syncIcon}>
            {item.driveSynced ? (
              <Ionicons name="cloud-done-outline" size={20} color={colors.success} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={20} color={colors.textMuted} />
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  /* ── Empty state ── */
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={[styles.emptyIconCircle, { backgroundColor: withAlpha(ACCENT, '12') }]}>
        <Ionicons name="folder-open-outline" size={48} color={ACCENT} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No files yet</Text>
      <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
        Add documents to this folder
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        style={[styles.emptyAddBtn, { backgroundColor: ACCENT }]}
        onPress={() => setShowAddSheet(true)}
      >
        <Ionicons name="add" size={20} color="#FFF" />
        <Text style={styles.emptyAddBtnText}>Add File</Text>
      </TouchableOpacity>
    </View>
  );

  /* ── Preview modal ── */
  const renderPreviewModal = () => {
    if (!previewFile) return null;
    const isImage = isImageMime(previewFile.mimeType);
    const imgWidth = SCREEN_WIDTH - Spacing.xl * 2;

    return (
      <Modal visible animationType="fade" transparent onRequestClose={() => setPreviewFile(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.previewModal, { backgroundColor: colors.surface }]}>
            {/* Close button */}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.previewCloseBtn, { backgroundColor: withAlpha(colors.text, '12') }]}
              onPress={() => setPreviewFile(null)}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.previewContent}
            >
              {isImage ? (
                <Image
                  source={{ uri: previewFile.localUri }}
                  style={[styles.previewImage, { width: imgWidth }]}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.previewFileIcon, { backgroundColor: withAlpha(ACCENT, '12') }]}>
                  <Ionicons
                    name={getFileIcon(previewFile.mimeType) as keyof typeof Ionicons.glyphMap}
                    size={56}
                    color={ACCENT}
                  />
                </View>
              )}

              <Text style={[styles.previewFileName, { color: colors.text }]}>
                {previewFile.name}
              </Text>

              <View style={styles.previewDetails}>
                <View style={styles.previewDetailRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Type</Text>
                  <Text style={[styles.previewValue, { color: colors.textSub }]}>
                    {previewFile.mimeType}
                  </Text>
                </View>
                <View style={styles.previewDetailRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Size</Text>
                  <Text style={[styles.previewValue, { color: colors.textSub }]}>
                    {formatBytes(previewFile.size)}
                  </Text>
                </View>
                <View style={styles.previewDetailRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Added</Text>
                  <Text style={[styles.previewValue, { color: colors.textSub }]}>
                    {formatDate(previewFile.createdAt)}
                  </Text>
                </View>
                <View style={styles.previewDetailRow}>
                  <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Path</Text>
                  <Text
                    style={[styles.previewValue, { color: colors.textSub }]}
                    numberOfLines={2}
                  >
                    {previewFile.localUri}
                  </Text>
                </View>
                {previewFile.driveSynced && previewFile.driveFileId && (
                  <View style={styles.previewDetailRow}>
                    <Text style={[styles.previewLabel, { color: colors.textMuted }]}>Drive</Text>
                    <View style={styles.previewSyncBadge}>
                      <Ionicons name="cloud-done-outline" size={14} color={colors.success} />
                      <Text style={[styles.previewValue, { color: colors.success, marginLeft: 4 }]}>
                        Synced
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  /* ── Action modal (long-press) ── */
  const renderActionModal = () => {
    if (!actionFile) return null;

    // Rename sub-view
    if (showRename) {
      return (
        <Modal visible animationType="slide" transparent onRequestClose={() => setShowRename(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Rename File</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                    borderColor: colors.border,
                    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
                  },
                ]}
                value={renameText}
                onChangeText={setRenameText}
                placeholder="File name"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <View style={styles.sheetBtnRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.sheetBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => setShowRename(false)}
                >
                  <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.7}
                  style={[styles.sheetBtn, { backgroundColor: ACCENT }]}
                  onPress={handleRename}
                >
                  <Text style={[styles.sheetBtnText, { color: '#FFF' }]}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      );
    }

    // Move to folder sub-view
    if (showMovePicker) {
      const otherFolders = folders.filter(f => f.id !== id);
      return (
        <Modal visible animationType="slide" transparent onRequestClose={() => setShowMovePicker(false)}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.bottomSheet, { backgroundColor: colors.surface, maxHeight: '70%' }]}>
              <View style={styles.sheetHandle} />
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Move to Folder</Text>
              {otherFolders.length === 0 ? (
                <Text style={[styles.noFoldersText, { color: colors.textMuted }]}>
                  No other folders available.
                </Text>
              ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                  <View style={styles.folderGrid}>
                    {otherFolders.map(f => (
                      <TouchableOpacity
                        key={f.id}
                        activeOpacity={0.7}
                        style={[
                          styles.folderCard,
                          { backgroundColor: withAlpha(f.color, '15'), borderColor: withAlpha(f.color, '30') },
                        ]}
                        onPress={() => handleMoveToFolder(f.id)}
                      >
                        <Ionicons name={f.icon as keyof typeof Ionicons.glyphMap} size={28} color={f.color} />
                        <Text style={[styles.folderCardName, { color: colors.text }]} numberOfLines={1}>
                          {f.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              )}
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.sheetCancelBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setShowMovePicker(false)}
              >
                <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      );
    }

    // Uploading overlay
    if (uploading) {
      return (
        <Modal visible animationType="fade" transparent onRequestClose={() => {}}>
          <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
            <View style={[styles.uploadingBox, { backgroundColor: colors.surface }]}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={[styles.uploadingText, { color: colors.text }]}>
                Uploading to Drive...
              </Text>
            </View>
          </View>
        </Modal>
      );
    }

    // Main action sheet
    const actions: {
      label: string;
      icon: keyof typeof Ionicons.glyphMap;
      color: string;
      onPress: () => void;
    }[] = [
      {
        label: 'Rename',
        icon: 'pencil-outline',
        color: colors.text,
        onPress: () => setShowRename(true),
      },
      {
        label: 'Move to Folder',
        icon: 'folder-outline',
        color: colors.text,
        onPress: () => setShowMovePicker(true),
      },
      {
        label: 'Upload to Drive',
        icon: 'cloud-upload-outline',
        color: ACCENT,
        onPress: handleUploadToDrive,
      },
      {
        label: 'Share',
        icon: 'share-outline',
        color: colors.text,
        onPress: handleShare,
      },
      {
        label: 'Delete',
        icon: 'trash-outline',
        color: colors.error,
        onPress: handleDelete,
      },
    ];

    return (
      <Modal visible animationType="slide" transparent onRequestClose={() => setActionFile(null)}>
        <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
          <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHandle} />
            <Text style={[styles.sheetFileName, { color: colors.text }]} numberOfLines={1}>
              {actionFile.name}
            </Text>
            {actions.map(action => (
              <TouchableOpacity
                key={action.label}
                activeOpacity={0.7}
                style={[styles.actionRow, { borderBottomColor: colors.border }]}
                onPress={action.onPress}
              >
                <Ionicons name={action.icon} size={22} color={action.color} />
                <Text style={[styles.actionLabel, { color: action.color }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.sheetCancelBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => setActionFile(null)}
            >
              <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  /* ── Add file bottom sheet ── */
  const renderAddSheet = () => (
    <Modal visible={showAddSheet} animationType="slide" transparent onRequestClose={() => setShowAddSheet(false)}>
      <View style={[styles.modalOverlay, { backgroundColor: colors.overlay }]}>
        <View style={[styles.bottomSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Add File</Text>

          <TouchableOpacity activeOpacity={0.7} style={[styles.addOption, { borderColor: colors.border }]} onPress={pickCamera}>
            <View style={[styles.addOptionIcon, { backgroundColor: withAlpha('#F97316', '15') }]}>
              <Ionicons name="camera-outline" size={24} color="#F97316" />
            </View>
            <View style={styles.addOptionText}>
              <Text style={[styles.addOptionTitle, { color: colors.text }]}>Camera</Text>
              <Text style={[styles.addOptionSub, { color: colors.textMuted }]}>Take a photo</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} style={[styles.addOption, { borderColor: colors.border }]} onPress={pickGallery}>
            <View style={[styles.addOptionIcon, { backgroundColor: withAlpha('#8B5CF6', '15') }]}>
              <Ionicons name="images-outline" size={24} color="#8B5CF6" />
            </View>
            <View style={styles.addOptionText}>
              <Text style={[styles.addOptionTitle, { color: colors.text }]}>Gallery</Text>
              <Text style={[styles.addOptionSub, { color: colors.textMuted }]}>Pick from photos</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.7} style={[styles.addOption, { borderColor: colors.border }]} onPress={pickDocument}>
            <View style={[styles.addOptionIcon, { backgroundColor: withAlpha(ACCENT, '15') }]}>
              <Ionicons name="document-outline" size={24} color={ACCENT} />
            </View>
            <View style={styles.addOptionText}>
              <Text style={[styles.addOptionTitle, { color: colors.text }]}>Browse</Text>
              <Text style={[styles.addOptionSub, { color: colors.textMuted }]}>Pick a document</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.sheetCancelBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setShowAddSheet(false)}
          >
            <Text style={[styles.sheetBtnText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ── Header info ── */
  const headerRight = (
    <View style={[styles.fileCountBadge, { backgroundColor: withAlpha(ACCENT, '18') }]}>
      <Text style={[styles.fileCountText, { color: ACCENT }]}>{folderFiles.length}</Text>
    </View>
  );

  /* ── Main render ── */
  return (
    <ScreenShell
      title={folder?.name ?? 'Folder'}
      accentColor={ACCENT}
      scrollable={false}
      rightAction={unlocked ? headerRight : undefined}
    >
      {!unlocked && needsPin ? (
        renderPinGate()
      ) : (
        <View style={styles.content}>
          <FlatList
            data={folderFiles}
            keyExtractor={item => item.id}
            renderItem={renderFileCard}
            contentContainerStyle={[
              styles.listContent,
              folderFiles.length === 0 && styles.listContentEmpty,
            ]}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
          />

          {/* FAB */}
          {folderFiles.length > 0 && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={[styles.fab, { backgroundColor: ACCENT }]}
              onPress={() => setShowAddSheet(true)}
            >
              <Ionicons name="add" size={28} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Modals */}
      {renderPreviewModal()}
      {renderActionModal()}
      {renderAddSheet()}
    </ScreenShell>
  );
}

/* ───── Styles ───── */

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    content: {
      flex: 1,
    },
    listContent: {
      paddingBottom: Spacing.huge + 24,
      gap: Spacing.sm,
    },
    listContentEmpty: {
      flex: 1,
    },

    /* ── File card ── */
    fileCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1,
      gap: Spacing.md,
    },
    fileThumbnail: {
      width: 50,
      height: 50,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    fileThumbnailImage: {
      width: 50,
      height: 50,
      borderRadius: Radii.sm,
    },
    fileInfo: {
      flex: 1,
      gap: 2,
    },
    fileName: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    fileMeta: {
      fontSize: 12,
      fontFamily: Fonts.regular,
    },
    syncIcon: {
      paddingLeft: Spacing.xs,
    },

    /* ── Empty state ── */
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    emptyIconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      marginBottom: Spacing.md,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radii.pill,
    },
    emptyAddBtnText: {
      color: '#FFF',
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },

    /* ── PIN gate ── */
    pinOverlay: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinContainer: {
      alignItems: 'center',
      width: '100%',
      maxWidth: 320,
    },
    pinIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.lg,
    },
    pinTitle: {
      fontSize: 22,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.xs,
    },
    pinSubtitle: {
      fontSize: 14,
      fontFamily: Fonts.regular,
      marginBottom: Spacing.xl,
    },
    pinDotsRow: {
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
    cooldownText: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      marginBottom: Spacing.md,
    },
    pinKeypad: {
      gap: Spacing.md,
      width: '100%',
    },
    pinKeyRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.md,
    },
    pinKey: {
      width: 72,
      height: 52,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pinKeyEmpty: {
      width: 72,
      height: 52,
    },
    pinKeyText: {
      fontSize: 22,
      fontFamily: Fonts.semibold,
    },

    /* ── Header badge ── */
    fileCountBadge: {
      minWidth: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    fileCountText: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },

    /* ── Modals ── */
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    previewModal: {
      width: SCREEN_WIDTH - Spacing.xl * 2,
      maxHeight: '85%',
      borderRadius: Radii.lg,
      overflow: 'hidden',
    },
    previewCloseBtn: {
      position: 'absolute',
      top: Spacing.md,
      right: Spacing.md,
      zIndex: 10,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewContent: {
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.lg,
    },
    previewImage: {
      height: 300,
      borderRadius: Radii.md,
      marginTop: Spacing.xl,
    },
    previewFileIcon: {
      width: 96,
      height: 96,
      borderRadius: Radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: Spacing.xl,
    },
    previewFileName: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    previewDetails: {
      width: '100%',
      gap: Spacing.md,
    },
    previewDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    previewLabel: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      width: 60,
    },
    previewValue: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      flex: 1,
      textAlign: 'right',
    },
    previewSyncBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      flex: 1,
    },

    /* ── Bottom sheet ── */
    bottomSheet: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      paddingHorizontal: Spacing.xl,
      paddingBottom: Spacing.xxl,
      paddingTop: Spacing.md,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.textMuted,
      opacity: 0.4,
      alignSelf: 'center',
      marginBottom: Spacing.lg,
    },
    sheetTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.lg,
    },
    sheetFileName: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.xs,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
    },
    actionLabel: {
      fontSize: 15,
      fontFamily: Fonts.medium,
    },
    sheetBtnRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.lg,
    },
    sheetBtn: {
      flex: 1,
      height: 46,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    sheetBtnText: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    sheetCancelBtn: {
      height: 46,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      marginTop: Spacing.lg,
    },
    input: {
      fontSize: 15,
      fontFamily: Fonts.regular,
      borderRadius: Radii.md,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
    },
    noFoldersText: {
      fontSize: 14,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      paddingVertical: Spacing.xl,
    },

    /* ── Folder picker grid ── */
    folderGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
      paddingBottom: Spacing.md,
    },
    folderCard: {
      width: '47%',
      padding: Spacing.lg,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    folderCardName: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },

    /* ── Add file options ── */
    addOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      gap: Spacing.md,
    },
    addOptionIcon: {
      width: 44,
      height: 44,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addOptionText: {
      flex: 1,
    },
    addOptionTitle: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    addOptionSub: {
      fontSize: 12,
      fontFamily: Fonts.regular,
    },

    /* ── Uploading ── */
    uploadingBox: {
      padding: Spacing.xxl,
      borderRadius: Radii.lg,
      alignItems: 'center',
      gap: Spacing.lg,
    },
    uploadingText: {
      fontSize: 15,
      fontFamily: Fonts.medium,
    },

    /* ── FAB ── */
    fab: {
      position: 'absolute',
      bottom: Spacing.xl,
      right: 0,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
    },
  });
