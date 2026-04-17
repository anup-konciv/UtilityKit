import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import { TOOLS, type ToolMeta } from '@/constants/tools-meta';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import {
  DEFAULT_FOLDERS,
  VIRTUAL_FOLDER_IDS,
  loadFolders,
  resolveFolderTools,
  type Folder,
} from '@/lib/folders';

const CARD_GAP = 12;

type HomeTile =
  | { kind: 'folder'; folder: Folder; count: number; preview: ToolMeta[] }
  | { kind: 'all'; count: number };

// ── Folder Tile ────────────────────────────────────────────────────────────────
function FolderTile({
  folder,
  count,
  preview,
  colors,
  onPress,
}: {
  folder: Folder;
  count: number;
  preview: ToolMeta[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  onPress: () => void;
}) {
  const styles = useMemo(() => folderTileStyles(colors), [colors]);
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.iconWrap, { backgroundColor: folder.accent + '18' }]}>
        <Ionicons name={folder.icon as any} size={28} color={folder.accent} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{folder.name}</Text>
      <Text style={styles.count}>{count} {count === 1 ? 'tool' : 'tools'}</Text>
      {preview.length > 0 && (
        <View style={styles.preview}>
          {preview.slice(0, 4).map(t => (
            <View
              key={t.id}
              style={[styles.previewDot, { backgroundColor: t.accent + '22', borderColor: t.accent + '44' }]}
            >
              <Ionicons name={t.icon as any} size={12} color={t.accent} />
            </View>
          ))}
          {count > 4 && <Text style={styles.previewMore}>+{count - 4}</Text>}
        </View>
      )}
    </TouchableOpacity>
  );
}

const folderTileStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      minHeight: 140,
      elevation: 2,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 4,
      justifyContent: 'space-between',
    },
    iconWrap: {
      width: 52,
      height: 52,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    name: { fontSize: 15, fontFamily: Fonts.semibold, color: colors.text, marginBottom: 2 },
    count: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: Spacing.sm,
    },
    preview: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    previewDot: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewMore: {
      fontSize: 10,
      fontFamily: Fonts.semibold,
      color: colors.textMuted,
      marginLeft: 2,
    },
  });

// ── Search Result Card ─────────────────────────────────────────────────────────
function ResultCard({
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
  const styles = useMemo(() => resultStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.82}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.accent + '15' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.accent} />
      </View>
      <View style={styles.info}>
        <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
        <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
      </View>
      <TouchableOpacity onPress={onToggleFav} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons
          name={isFav ? 'star' : 'star-outline'}
          size={16}
          color={isFav ? '#F59E0B' : colors.textMuted}
        />
      </TouchableOpacity>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 8 }} />
    </TouchableOpacity>
  );
}

const resultStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    info: { flex: 1 },
    label: { fontSize: 14, fontFamily: Fonts.semibold, color: colors.text, marginBottom: 2 },
    desc: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textMuted },
  });

// ── Home Screen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [folders, setFolders] = useState<Folder[]>(DEFAULT_FOLDERS);
  const [favorites, setFavorites] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadFolders().then(setFolders);
      loadJSON<string[]>(KEYS.favorites, []).then(setFavorites);
    }, []),
  );

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      saveJSON(KEYS.favorites, next);
      return next;
    });
  }, []);

  const tiles = useMemo<HomeTile[]>(() => {
    const out: HomeTile[] = [];
    if (favorites.length > 0) {
      const favFolder: Folder = {
        id: VIRTUAL_FOLDER_IDS.favorites,
        name: 'Favorites',
        icon: 'star',
        accent: '#F59E0B',
        toolIds: favorites,
      };
      out.push({
        kind: 'folder',
        folder: favFolder,
        count: favorites.length,
        preview: resolveFolderTools(favFolder, favorites),
      });
    }
    folders.forEach(f => {
      out.push({
        kind: 'folder',
        folder: f,
        count: f.toolIds.length,
        preview: resolveFolderTools(f, favorites),
      });
    });
    out.push({ kind: 'all', count: TOOLS.length });
    return out;
  }, [folders, favorites]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as ToolMeta[];
    return TOOLS.filter(
      t =>
        t.label.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.badge.toLowerCase().includes(q),
    );
  }, [query]);

  const numColumns = useMemo(() => {
    if (width >= 1024) return 4;
    if (width >= 768) return 3;
    return 2;
  }, [width]);

  const isSearching = query.trim().length > 0;

  const renderTile = useCallback(
    ({ item }: { item: HomeTile }) => {
      if (item.kind === 'all') {
        const allFolder: Folder = {
          id: VIRTUAL_FOLDER_IDS.all,
          name: 'All Tools',
          icon: 'apps-outline',
          accent: colors.accent,
          toolIds: [],
        };
        return (
          <FolderTile
            folder={allFolder}
            count={item.count}
            preview={TOOLS.slice(0, 4)}
            colors={colors}
            onPress={() => router.push('/all-tools' as any)}
          />
        );
      }
      return (
        <FolderTile
          folder={item.folder}
          count={item.count}
          preview={item.preview}
          colors={colors}
          onPress={() => router.push(`/folders/${item.folder.id}` as any)}
        />
      );
    },
    [colors],
  );

  const renderResult = useCallback(
    ({ item }: { item: ToolMeta }) => (
      <ResultCard
        item={item}
        colors={colors}
        isFav={favorites.includes(item.id)}
        onToggleFav={() => toggleFavorite(item.id)}
      />
    ),
    [colors, favorites, toggleFavorite],
  );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      <View style={styles.headerWrapper}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
              <Ionicons name="flash" size={18} color="#fff" />
            </View>
            <Text style={styles.logoText}>
              Utility<Text style={{ color: colors.accent }}>Kit</Text>
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/manage-folders' as any)}
            >
              <Ionicons name="albums-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/all-tools' as any)}
            >
              <Ionicons name="apps-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push('/settings')}
            >
              <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search tools..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.subRow}>
        <Text style={styles.subTitle}>
          {isSearching
            ? `${searchResults.length} ${searchResults.length === 1 ? 'match' : 'matches'} for "${query.trim()}"`
            : `${tiles.length} ${tiles.length === 1 ? 'folder' : 'folders'} · ${TOOLS.length} tools`}
        </Text>
      </View>

      {isSearching ? (
        <FlatList
          style={styles.listFlex}
          data={searchResults}
          keyExtractor={item => item.id}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
          contentContainerStyle={styles.listContent}
          renderItem={renderResult}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <FlatList
          style={styles.listFlex}
          key={`folders-${numColumns}`}
          data={tiles}
          keyExtractor={(item, idx) =>
            item.kind === 'all' ? '__all' : `${item.folder.id}-${idx}`
          }
          numColumns={numColumns}
          columnWrapperStyle={numColumns > 1 ? styles.row : undefined}
          ItemSeparatorComponent={() => <View style={{ height: CARD_GAP }} />}
          contentContainerStyle={styles.grid}
          renderItem={renderTile}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
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
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    logoIcon: {
      width: 34,
      height: 34,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoText: { fontSize: 20, fontFamily: Fonts.bold, color: colors.text, letterSpacing: -0.5 },
    iconBtn: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    searchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: 6,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
    },
    searchBox: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      height: 38,
    },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, padding: 0 },
    listFlex: { flex: 1 },
    subRow: {
      paddingHorizontal: Spacing.lg,
      paddingTop: 6,
      paddingBottom: Spacing.sm,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
    },
    subTitle: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    grid: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.huge,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
    },
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.huge,
      width: '100%',
      maxWidth: 1200,
      alignSelf: 'center',
    },
    row: { gap: CARD_GAP },
  });
