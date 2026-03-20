import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import { TOOLS, type ToolMeta } from '@/constants/tools-meta';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';

const CARD_GAP = 12;

// ── Grid Card ──────────────────────────────────────────────────────────────────
function GridCard({ item, colors, isFav, onToggleFav }: { item: ToolMeta; colors: ReturnType<typeof useAppTheme>['colors']; isFav: boolean; onToggleFav: () => void }) {
  const styles = useMemo(() => gridCardStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: item.accent }]}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.82}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.accent + '20' }]}>
        <Ionicons name={item.icon as any} size={24} color={item.accent} />
      </View>
      <View style={styles.topRight}>
        <TouchableOpacity onPress={onToggleFav} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name={isFav ? 'star' : 'star-outline'} size={16} color={isFav ? '#F59E0B' : colors.textMuted} />
        </TouchableOpacity>
        <View style={[styles.badge, { backgroundColor: item.accent + '18' }]}>
          <Text style={[styles.badgeText, { color: item.accent }]}>{item.badge}</Text>
        </View>
      </View>
      <Text style={styles.label}>{item.label}</Text>
      <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
    </TouchableOpacity>
  );
}

const gridCardStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      minHeight: 120,
    },
    iconWrap: {
      width: 46,
      height: 46,
      borderRadius: Radii.md,
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
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: Radii.pill,
    },
    badgeText: { fontSize: 9, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    label: { fontSize: 14, fontFamily: Fonts.semibold, color: colors.text, marginBottom: 3 },
    desc: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textMuted, lineHeight: 16 },
  });

// ── List Card ──────────────────────────────────────────────────────────────────
function ListCard({ item, colors, isFav, onToggleFav }: { item: ToolMeta; colors: ReturnType<typeof useAppTheme>['colors']; isFav: boolean; onToggleFav: () => void }) {
  const styles = useMemo(() => listCardStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.card, { borderLeftColor: item.accent }]}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.82}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.accent + '20' }]}>
        <Ionicons name={item.icon as any} size={22} color={item.accent} />
      </View>
      <View style={styles.info}>
        <Text style={styles.label}>{item.label}</Text>
        <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
      </View>
      <TouchableOpacity onPress={onToggleFav} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ marginRight: 4 }}>
        <Ionicons name={isFav ? 'star' : 'star-outline'} size={16} color={isFav ? '#F59E0B' : colors.textMuted} />
      </TouchableOpacity>
      <View style={[styles.badge, { backgroundColor: item.accent + '18' }]}>
        <Text style={[styles.badgeText, { color: item.accent }]}>{item.badge}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginLeft: 6 }} />
    </TouchableOpacity>
  );
}

const listCardStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
    },
    iconWrap: {
      width: 42,
      height: 42,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
    },
    info: { flex: 1 },
    badge: {
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: Radii.pill,
      marginRight: 2,
    },
    badgeText: { fontSize: 9, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    label: { fontSize: 14, fontFamily: Fonts.semibold, color: colors.text, marginBottom: 2 },
    desc: { fontSize: 11, fontFamily: Fonts.regular, color: colors.textMuted },
  });

// ── Edit Card ──────────────────────────────────────────────────────────────────
function EditCard({
  item,
  colors,
  index,
  total,
  onMove,
}: {
  item: ToolMeta;
  colors: ReturnType<typeof useAppTheme>['colors'];
  index: number;
  total: number;
  onMove: (from: number, to: number) => void;
}) {
  const styles = useMemo(() => editCardStyles(colors), [colors]);
  return (
    <View style={[styles.card, { borderLeftColor: item.accent }]}>
      <Ionicons name="reorder-three-outline" size={22} color={colors.textMuted} style={{ marginRight: 10 }} />
      <View style={[styles.iconWrap, { backgroundColor: item.accent + '20' }]}>
        <Ionicons name={item.icon as any} size={20} color={item.accent} />
      </View>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
      <View style={styles.arrows}>
        <TouchableOpacity
          onPress={() => onMove(index, index - 1)}
          style={[styles.arrowBtn, index === 0 && styles.arrowDisabled]}
          disabled={index === 0}
        >
          <Ionicons name="chevron-up" size={18} color={index === 0 ? colors.border : colors.text} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => onMove(index, index + 1)}
          style={[styles.arrowBtn, index === total - 1 && styles.arrowDisabled]}
          disabled={index === total - 1}
        >
          <Ionicons name="chevron-down" size={18} color={index === total - 1 ? colors.border : colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const editCardStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
    },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.sm,
    },
    label: { flex: 1, fontSize: 14, fontFamily: Fonts.semibold, color: colors.text },
    arrows: { flexDirection: 'row', gap: 4 },
    arrowBtn: {
      width: 32,
      height: 32,
      borderRadius: Radii.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowDisabled: { opacity: 0.35 },
  });

// ── Home Screen ────────────────────────────────────────────────────────────────
export default function HomeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [query, setQuery] = useState('');
  const [badge, setBadge] = useState('All');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [order, setOrder] = useState<string[]>(() => TOOLS.map(t => t.id));
  const [editMode, setEditMode] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load saved order and favorites
  useEffect(() => {
    loadJSON<string[]>(KEYS.toolOrder, []).then(saved => {
      if (!saved.length) return;
      const valid = saved.filter(id => TOOLS.some(t => t.id === id));
      const missing = TOOLS.map(t => t.id).filter(id => !valid.includes(id));
      setOrder([...valid, ...missing]);
    });
    loadJSON<string[]>(KEYS.favorites, []).then(setFavorites);
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      const next = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id];
      saveJSON(KEYS.favorites, next);
      return next;
    });
  }, []);

  const orderedTools = useMemo(
    () => order.map(id => TOOLS.find(t => t.id === id)).filter(Boolean) as ToolMeta[],
    [order],
  );

  const displayTools = useMemo(() => {
    let list = orderedTools;
    if (badge === 'Favorites') list = list.filter(t => favorites.includes(t.id));
    else if (badge !== 'All') list = list.filter(t => t.badge === badge);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        t =>
          t.label.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.badge.toLowerCase().includes(q),
      );
    }
    return list;
  }, [orderedTools, badge, query, favorites]);

  const badgeList = useMemo(() => {
    const base = ['All', ...Array.from(new Set(TOOLS.map(t => t.badge)))];
    if (favorites.length > 0) base.splice(1, 0, 'Favorites');
    return base;
  }, [favorites.length]);

  const moveItem = useCallback((from: number, to: number) => {
    setOrder(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      saveJSON(KEYS.toolOrder, next);
      return next;
    });
  }, []);

  const isGrid = viewMode === 'grid' && !editMode;
  const listKey = `${viewMode}-${editMode ? 'edit' : 'view'}`;

  const renderItem = useCallback(
    ({ item, index }: { item: ToolMeta; index: number }) => {
      if (editMode) {
        return (
          <EditCard
            item={item}
            colors={colors}
            index={index}
            total={orderedTools.length}
            onMove={moveItem}
          />
        );
      }
      if (isGrid) return <GridCard item={item} colors={colors} isFav={favorites.includes(item.id)} onToggleFav={() => toggleFavorite(item.id)} />;
      return <ListCard item={item} colors={colors} isFav={favorites.includes(item.id)} onToggleFav={() => toggleFavorite(item.id)} />;
    },
    [editMode, isGrid, colors, orderedTools.length, moveItem, favorites, toggleFavorite],
  );

  const subLabel = editMode
    ? 'USE ↑↓ TO REORDER • TAP ✓ WHEN DONE'
    : `${displayTools.length} ${displayTools.length === 1 ? 'utility' : 'utilities'}${badge !== 'All' ? ` · ${badge}` : ''}${query ? ` · "${query}"` : ''}`;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
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
            style={[
              styles.iconBtn,
              {
                backgroundColor: editMode ? colors.accent + '20' : colors.surface,
                borderColor: editMode ? colors.accent : colors.border,
              },
            ]}
            onPress={() => setEditMode(e => !e)}
          >
            <Ionicons
              name={editMode ? 'checkmark' : 'reorder-four-outline'}
              size={20}
              color={editMode ? colors.accent : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/settings')}
          >
            <Ionicons name="settings-outline" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search + View Toggle */}
      {!editMode && (
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search utilities..."
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
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setViewMode(v => (v === 'grid' ? 'list' : 'grid'))}
          >
            <Ionicons
              name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
              size={20}
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>
      )}

      {/* Category Filter Chips */}
      {!editMode && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipScroll}
        >
          {badgeList.map(b => (
            <TouchableOpacity
              key={b}
              style={[
                styles.chip,
                badge === b && { backgroundColor: colors.accent, borderColor: colors.accent },
              ]}
              onPress={() => setBadge(b)}
            >
              <Text style={[styles.chipText, { color: badge === b ? '#fff' : colors.textMuted }]}>{b}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Sub-label */}
      <View style={styles.subRow}>
        <Text style={styles.subTitle}>{subLabel}</Text>
      </View>

      {/* Tool Grid / List */}
      <FlatList
        key={listKey}
        data={editMode ? orderedTools : displayTools}
        keyExtractor={item => item.id}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? styles.row : undefined}
        ItemSeparatorComponent={() => <View style={{ height: CARD_GAP }} />}
        contentContainerStyle={styles.grid}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </SafeAreaView>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
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
    chipScroll: { maxHeight: 44 },
    chips: { paddingHorizontal: Spacing.lg, gap: 8, alignItems: 'center', paddingVertical: 6 },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    chipText: { fontSize: 12, fontFamily: Fonts.semibold },
    subRow: { paddingHorizontal: Spacing.lg, paddingTop: 6, paddingBottom: Spacing.sm },
    subTitle: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
    },
    grid: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
    row: { gap: CARD_GAP },
  });
