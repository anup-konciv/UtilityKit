import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import ToolPickerModal from '@/components/ToolPickerModal';
import { type ToolMeta } from '@/constants/tools-meta';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import {
  getFolderById,
  isVirtualFolder,
  loadFolders,
  resolveFolderTools,
  saveFolders,
  type Folder,
} from '@/lib/folders';
import { withAlpha } from '@/lib/color-utils';

const CARD_GAP = 12;

function ToolCard({
  item,
  colors,
  isFav,
  onToggleFav,
}: {
  item: ToolMeta;
  colors: ReturnType<typeof useAppTheme>['colors'];
  isFav: boolean;
  onToggleFav: () => void;
}) {
  const styles = useMemo(() => toolCardStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.82}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.accent + '15' }]}>
        <Ionicons name={item.icon as any} size={24} color={item.accent} />
      </View>
      <View style={styles.topRight}>
        <TouchableOpacity onPress={onToggleFav} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={isFav ? 'star' : 'star-outline'}
            size={16}
            color={isFav ? '#F59E0B' : colors.textMuted}
          />
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: item.accent + '14' }]}>
          <Text style={[styles.badgeText, { color: item.accent }]}>{item.badge}</Text>
        </View>
      </View>
      <Text style={styles.label}>{item.label}</Text>
      <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
    </TouchableOpacity>
  );
}

const toolCardStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 120,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    topRight: {
      position: 'absolute',
      top: Spacing.sm,
      right: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    badge: {
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: Radii.pill,
    },
    badgeText: { fontSize: 9, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    label: { fontSize: 14, fontFamily: Fonts.semibold, color: colors.text, marginBottom: 3 },
    desc: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textMuted, lineHeight: 16 },
  });

function EmptyState({ folder, colors }: { folder: Folder; colors: ReturnType<typeof useAppTheme>['colors'] }) {
  const styles = useMemo(() => emptyStyles(colors), [colors]);
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, { backgroundColor: folder.accent + '18' }]}>
        <Ionicons name={folder.icon as any} size={40} color={folder.accent} />
      </View>
      <Text style={styles.title}>This folder is empty</Text>
      <Text style={styles.sub}>
        {folder.id === '__favorites'
          ? 'Star any tool to see it here.'
          : 'Tap Manage tools to add some.'}
      </Text>
    </View>
  );
}

const emptyStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    wrap: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.huge,
      paddingHorizontal: Spacing.xl,
      gap: Spacing.sm,
    },
    iconWrap: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.md,
    },
    title: { fontSize: 16, fontFamily: Fonts.semibold, color: colors.text },
    sub: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textMuted, textAlign: 'center' },
  });

export default function FolderDetailScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const { id, pick } = useLocalSearchParams<{ id: string; pick?: string }>();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    loadFolders().then(setFolders);
    loadJSON<string[]>(KEYS.favorites, []).then(setFavorites);
  }, []);

  useEffect(() => {
    if (pick === '1' && folders.length > 0) setPickerVisible(true);
  }, [pick, folders.length]);

  const folder = useMemo(() => getFolderById(folders, id ?? ''), [folders, id]);

  const folderByTool = useMemo(() => {
    const map: Record<string, string> = {};
    folders.forEach(f => {
      if (f.id === id) return;
      f.toolIds.forEach(tid => {
        if (!map[tid]) map[tid] = f.name;
      });
    });
    return map;
  }, [folders, id]);

  const handleSavePicker = useCallback(
    async (ids: string[]) => {
      if (!folder || isVirtualFolder(folder.id)) {
        setPickerVisible(false);
        return;
      }
      const nextFolders = folders.map(f =>
        f.id === folder.id ? { ...f, toolIds: ids } : f,
      );
      setFolders(nextFolders);
      await saveFolders(nextFolders);
      setPickerVisible(false);
    },
    [folder, folders],
  );

  const tools = useMemo(
    () => (folder ? resolveFolderTools(folder, favorites) : []),
    [folder, favorites],
  );

  const toggleFavorite = useCallback((toolId: string) => {
    setFavorites(prev => {
      const next = prev.includes(toolId) ? prev.filter(f => f !== toolId) : [...prev, toolId];
      saveJSON(KEYS.favorites, next);
      return next;
    });
  }, []);

  const numColumns = useMemo(() => {
    if (width >= 1024) return 4;
    if (width >= 768) return 3;
    return 2;
  }, [width]);

  const renderItem = useCallback(
    ({ item }: { item: ToolMeta }) => (
      <ToolCard
        item={item}
        colors={colors}
        isFav={favorites.includes(item.id)}
        onToggleFav={() => toggleFavorite(item.id)}
      />
    ),
    [colors, favorites, toggleFavorite],
  );

  if (!folder) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
        <View style={styles.missingWrap}>
          <Text style={styles.missingText}>Folder not found.</Text>
          <TouchableOpacity onPress={() => router.replace('/')}>
            <Text style={[styles.missingLink, { color: colors.accent }]}>Back to home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const accent = folder.accent;
  const canManage = !isVirtualFolder(folder.id);

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
              style={[
                styles.backBtn,
                {
                  backgroundColor: withAlpha(accent, colors.bg === '#0B1120' ? '18' : '12'),
                  borderColor: withAlpha(accent, colors.bg === '#0B1120' ? '32' : '24'),
                },
              ]}
            >
              <Ionicons name="chevron-back" size={20} color={accent} />
            </TouchableOpacity>
            <View style={[styles.iconWrap, { backgroundColor: accent + '18' }]}>
              <Ionicons name={folder.icon as any} size={20} color={accent} />
            </View>
            <View>
              <Text style={styles.title}>{folder.name}</Text>
              <Text style={styles.subtitle}>
                {tools.length} {tools.length === 1 ? 'tool' : 'tools'}
              </Text>
            </View>
          </View>
          {canManage && (
            <TouchableOpacity
              style={[
                styles.manageBtn,
                { borderColor: withAlpha(accent, '44'), backgroundColor: withAlpha(accent, '14') },
              ]}
              onPress={() => setPickerVisible(true)}
            >
              <Ionicons name="options-outline" size={16} color={accent} />
              <Text style={[styles.manageText, { color: accent }]}>Manage</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        style={styles.listFlex}
        key={`folder-${numColumns}`}
        data={tools}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
        ItemSeparatorComponent={() => <View style={{ height: CARD_GAP }} />}
        contentContainerStyle={styles.grid}
        renderItem={renderItem}
        ListEmptyComponent={<EmptyState folder={folder} colors={colors} />}
        showsVerticalScrollIndicator={false}
      />
      {canManage && (
        <ToolPickerModal
          visible={pickerVisible}
          title={`Manage · ${folder.name}`}
          accent={accent}
          selectedIds={folder.toolIds}
          folderByTool={folderByTool}
          onClose={() => setPickerVisible(false)}
          onSave={handleSavePicker}
        />
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
      width: '100%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
      gap: Spacing.sm,
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1 },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: { fontSize: 18, fontFamily: Fonts.bold, color: colors.text, letterSpacing: -0.3 },
    subtitle: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    manageBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      height: 34,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    manageText: { fontSize: 12, fontFamily: Fonts.semibold },
    listFlex: { flex: 1 },
    grid: {
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.huge,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
    },
    row: { gap: CARD_GAP },
    missingWrap: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    missingText: { fontSize: 15, fontFamily: Fonts.semibold, color: colors.text },
    missingLink: { fontSize: 14, fontFamily: Fonts.semibold },
  });
