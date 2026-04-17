import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import {
  DEFAULT_FOLDERS,
  loadFolders,
  saveFolders,
  type Folder,
} from '@/lib/folders';

const PALETTE = [
  '#10B981', '#14B8A6', '#059669', '#0D9488',
  '#EF4444', '#DC2626', '#F43F5E', '#E11D48',
  '#F97316', '#F59E0B', '#EA580C', '#D97706',
  '#6366F1', '#3B82F6', '#0EA5E9', '#2563EB',
  '#A855F7', '#8B5CF6', '#D946EF', '#EC4899',
  '#64748B', '#0891B2', '#7C3AED', '#9333EA',
];

const ICONS = [
  'folder-outline', 'folder-open-outline', 'briefcase-outline', 'heart-outline',
  'home-outline', 'wallet-outline', 'construct-outline', 'school-outline',
  'game-controller-outline', 'document-text-outline', 'code-slash-outline', 'gift-outline',
  'airplane-outline', 'barbell-outline', 'book-outline', 'bulb-outline',
  'calendar-outline', 'cafe-outline', 'car-outline', 'flash-outline',
  'paw-outline', 'leaf-outline', 'musical-notes-outline', 'globe-outline',
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

type EditDraft = {
  id: string | null;
  name: string;
  icon: string;
  accent: string;
};

export default function ManageFoldersScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [folders, setFolders] = useState<Folder[]>([]);
  const [editing, setEditing] = useState<EditDraft | null>(null);

  useEffect(() => {
    loadFolders().then(setFolders);
  }, []);

  const persist = useCallback(async (next: Folder[]) => {
    setFolders(next);
    await saveFolders(next);
  }, []);

  const moveItem = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= folders.length) return;
      const next = [...folders];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      persist(next);
    },
    [folders, persist],
  );

  const deleteFolder = useCallback(
    (f: Folder) => {
      const doDelete = () => persist(folders.filter(x => x.id !== f.id));
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && window.confirm(`Delete "${f.name}"? Tools inside remain available in All Tools.`)) {
          doDelete();
        }
        return;
      }
      Alert.alert(
        `Delete "${f.name}"?`,
        'Tools inside will remain available in All Tools. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: doDelete },
        ],
      );
    },
    [folders, persist],
  );

  const resetToDefaults = useCallback(() => {
    const doReset = () => persist(DEFAULT_FOLDERS);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Reset folders to defaults? Your custom folders will be lost.')) {
        doReset();
      }
      return;
    }
    Alert.alert(
      'Reset folders?',
      'Your custom folders and changes will be replaced with the defaults. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: doReset },
      ],
    );
  }, [persist]);

  const saveEdit = useCallback(async () => {
    if (!editing) return;
    const name = editing.name.trim();
    if (!name) return;
    if (editing.id) {
      const next = folders.map(f =>
        f.id === editing.id ? { ...f, name, icon: editing.icon, accent: editing.accent } : f,
      );
      await persist(next);
      setEditing(null);
    } else {
      const newFolder: Folder = {
        id: `custom-${uid()}`,
        name,
        icon: editing.icon,
        accent: editing.accent,
        toolIds: [],
      };
      await persist([...folders, newFolder]);
      setEditing(null);
      router.push(`/folders/${newFolder.id}?pick=1` as any);
    }
  }, [editing, folders, persist]);

  const renderItem = useCallback(
    ({ item, index }: { item: Folder; index: number }) => (
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: item.accent + '18' }]}>
          <Ionicons name={item.icon as any} size={22} color={item.accent} />
        </View>
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.count}>
            {item.toolIds.length} {item.toolIds.length === 1 ? 'tool' : 'tools'}
          </Text>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => moveItem(index, index - 1)}
            style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
            disabled={index === 0}
          >
            <Ionicons name="chevron-up" size={16} color={index === 0 ? colors.border : colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => moveItem(index, index + 1)}
            style={[styles.arrowBtn, index === folders.length - 1 && styles.arrowDisabled]}
            disabled={index === folders.length - 1}
          >
            <Ionicons
              name="chevron-down"
              size={16}
              color={index === folders.length - 1 ? colors.border : colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              setEditing({ id: item.id, name: item.name, icon: item.icon, accent: item.accent })
            }
            style={[styles.arrowBtn, { borderColor: colors.accent + '33' }]}
          >
            <Ionicons name="create-outline" size={16} color={colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => deleteFolder(item)}
            style={[styles.arrowBtn, { borderColor: colors.error + '33' }]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [folders.length, moveItem, deleteFolder, styles, colors],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={() => {
                if (router.canGoBack()) router.back();
                else router.replace('/');
              }}
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="chevron-back" size={20} color={colors.text} />
            </TouchableOpacity>
            <View>
              <Text style={styles.title}>Manage Folders</Text>
              <Text style={styles.subtitle}>
                {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() =>
              setEditing({ id: null, name: '', icon: 'folder-outline', accent: PALETTE[4] })
            }
            style={[styles.newBtn, { backgroundColor: colors.accent }]}
          >
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.newText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={folders}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.resetBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={resetToDefaults}
          >
            <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.resetText, { color: colors.textMuted }]}>Reset to default folders</Text>
          </TouchableOpacity>
        }
      />

      {editing && (
        <KeyboardAwareModal
          visible={editing !== null}
          animationType="slide"
          onRequestClose={() => setEditing(null)}
          transparent
        >
          <View style={styles.backdrop}>
            <View style={[styles.sheet, { backgroundColor: colors.bg }]}>
              <View style={styles.sheetHandle} />
              <Text style={styles.sheetTitle}>
                {editing.id ? 'Edit folder' : 'New folder'}
              </Text>

              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surface }]}
                placeholder="e.g. Work, Family, Travel"
                placeholderTextColor={colors.textMuted}
                value={editing.name}
                onChangeText={name => setEditing(prev => (prev ? { ...prev, name } : prev))}
                autoFocus
              />

              <Text style={styles.fieldLabel}>Color</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.swatchRow}
              >
                {PALETTE.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => setEditing(prev => (prev ? { ...prev, accent: c } : prev))}
                    style={[
                      styles.swatch,
                      { backgroundColor: c },
                      editing.accent === c && styles.swatchActive,
                    ]}
                  >
                    {editing.accent === c && <Ionicons name="checkmark" size={16} color="#fff" />}
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {ICONS.map(ic => {
                  const active = editing.icon === ic;
                  return (
                    <TouchableOpacity
                      key={ic}
                      onPress={() => setEditing(prev => (prev ? { ...prev, icon: ic } : prev))}
                      style={[
                        styles.iconBox,
                        {
                          borderColor: active ? editing.accent : colors.border,
                          backgroundColor: active ? editing.accent + '18' : colors.surface,
                        },
                      ]}
                    >
                      <Ionicons
                        name={ic as any}
                        size={18}
                        color={active ? editing.accent : colors.textMuted}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity
                  onPress={() => setEditing(null)}
                  style={[styles.cancelBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                >
                  <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveEdit}
                  disabled={!editing.name.trim()}
                  style={[
                    styles.saveBtn,
                    { backgroundColor: editing.accent, opacity: editing.name.trim() ? 1 : 0.5 },
                  ]}
                >
                  <Text style={styles.saveText}>{editing.id ? 'Save' : 'Create'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAwareModal>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1 },
    headerWrapper: {
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      maxWidth: 1200,
      width: '100%',
      alignSelf: 'center',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    title: { fontSize: 18, fontFamily: Fonts.bold, color: colors.text, letterSpacing: -0.3 },
    subtitle: { fontSize: 11, fontFamily: Fonts.semibold, color: colors.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
    newBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.md,
      height: 36,
      borderRadius: Radii.md,
    },
    newText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
    list: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.huge, maxWidth: 1200, width: '100%', alignSelf: 'center' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    name: { fontSize: 14, fontFamily: Fonts.semibold, color: colors.text, marginBottom: 2 },
    count: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textMuted },
    actions: { flexDirection: 'row', gap: 6 },
    arrowBtn: {
      width: 32,
      height: 32,
      borderRadius: Radii.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowDisabled: { opacity: 0.35 },
    resetBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginTop: Spacing.xl,
    },
    resetText: { fontSize: 13, fontFamily: Fonts.semibold },
    backdrop: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    sheet: {
      padding: Spacing.lg,
      paddingBottom: Spacing.xl,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    sheetHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.md,
    },
    sheetTitle: { fontSize: 17, fontFamily: Fonts.bold, color: colors.text, marginBottom: Spacing.lg },
    fieldLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: Spacing.sm,
      marginTop: Spacing.md,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      height: 42,
      fontSize: 14,
      fontFamily: Fonts.regular,
    },
    swatchRow: { gap: 10, paddingVertical: 2 },
    swatch: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    swatchActive: { borderColor: '#fff' },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sheetActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.xl,
    },
    cancelBtn: {
      flex: 1,
      height: 44,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelText: { fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: {
      flex: 1,
      height: 44,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
  });
