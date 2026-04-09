import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';
import { haptics } from '@/lib/haptics';

/* ── types ── */

type Category =
  | 'fruits'
  | 'vegetables'
  | 'dairy'
  | 'meat'
  | 'bakery'
  | 'beverages'
  | 'snacks'
  | 'household'
  | 'personal'
  | 'other';

type Unit = 'pcs' | 'kg' | 'g' | 'L' | 'mL' | 'dozen' | 'pack' | 'bottle' | 'box' | 'bag';

type GroceryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: Unit;
  category: Category;
  checked: boolean;
  favorite: boolean;
  createdAt: string;
};

type FilterCategory = 'all' | Category;
type ViewMode = 'list' | 'category';

/* ── constants ── */

const ACCENT = '#059669';
const ACCENT_DEEP = '#065F46';

const CATEGORY_META: Record<
  Category,
  { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  fruits: { label: 'Fruits', icon: 'nutrition-outline', color: '#F97316' },
  vegetables: { label: 'Vegetables', icon: 'leaf-outline', color: '#22C55E' },
  dairy: { label: 'Dairy', icon: 'water-outline', color: '#3B82F6' },
  meat: { label: 'Meat', icon: 'flame-outline', color: '#EF4444' },
  bakery: { label: 'Bakery', icon: 'cafe-outline', color: '#D97706' },
  beverages: { label: 'Beverages', icon: 'beer-outline', color: '#8B5CF6' },
  snacks: { label: 'Snacks', icon: 'fast-food-outline', color: '#EC4899' },
  household: { label: 'Household', icon: 'home-outline', color: '#0891B2' },
  personal: { label: 'Personal Care', icon: 'body-outline', color: '#6366F1' },
  other: { label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#64748B' },
};

const CATEGORIES = Object.keys(CATEGORY_META) as Category[];

const UNITS: { value: Unit; label: string }[] = [
  { value: 'pcs', label: 'pcs' },
  { value: 'kg', label: 'kg' },
  { value: 'g', label: 'g' },
  { value: 'L', label: 'L' },
  { value: 'mL', label: 'mL' },
  { value: 'dozen', label: 'dozen' },
  { value: 'pack', label: 'pack' },
  { value: 'bottle', label: 'bottle' },
  { value: 'box', label: 'box' },
  { value: 'bag', label: 'bag' },
];

const CATEGORY_ORDER: Record<Category, number> = {
  fruits: 0,
  vegetables: 1,
  dairy: 2,
  meat: 3,
  bakery: 4,
  beverages: 5,
  snacks: 6,
  household: 7,
  personal: 8,
  other: 9,
};

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/* ── component ── */

export default function GroceryListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState<GroceryItem[]>([]);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<FilterCategory>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // form state
  const [formName, setFormName] = useState('');
  const [formQuantity, setFormQuantity] = useState('1');
  const [formUnit, setFormUnit] = useState<Unit>('pcs');
  const [formCategory, setFormCategory] = useState<Category>('fruits');

  useEffect(() => {
    loadJSON<GroceryItem[]>(KEYS.groceryItems, []).then((saved) => {
      setItems(Array.isArray(saved) ? saved : []);
    });
  }, []);

  const persist = useCallback((next: GroceryItem[]) => {
    setItems(next);
    saveJSON(KEYS.groceryItems, next);
  }, []);

  /* ── actions ── */

  function addItem() {
    const name = formName.trim();
    if (!name) {
      Alert.alert('Missing name', 'Please enter an item name.');
      return;
    }
    const qty = parseFloat(formQuantity) || 1;
    persist([
      {
        id: generateId(),
        name,
        quantity: qty,
        unit: formUnit,
        category: formCategory,
        checked: false,
        favorite: false,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
    setFormName('');
    setFormQuantity('1');
    setFormUnit('pcs');
    setShowAddModal(false);
  }

  function toggleChecked(id: string) {
    const target = items.find((i) => i.id === id);
    if (target?.checked) {
      haptics.tap();
    } else {
      haptics.success();
    }
    persist(items.map((i) => (i.id === id ? { ...i, checked: !i.checked } : i)));
  }

  function toggleFavorite(id: string) {
    haptics.selection();
    persist(items.map((i) => (i.id === id ? { ...i, favorite: !i.favorite } : i)));
  }

  function removeItem(id: string) {
    haptics.warning();
    persist(items.filter((i) => i.id !== id));
  }

  function clearChecked() {
    haptics.warning();
    const count = items.filter((i) => i.checked).length;
    if (count === 0) return;
    Alert.alert(
      'Clear checked items',
      `Remove ${count} checked item${count === 1 ? '' : 's'} from the list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => persist(items.filter((i) => !i.checked)) },
      ],
    );
  }

  function uncheckAll() {
    persist(items.map((i) => ({ ...i, checked: false })));
  }

  /* ── derived data ── */

  const counts = useMemo(() => {
    const total = items.length;
    const checked = items.filter((i) => i.checked).length;
    const pending = total - checked;
    const favorites = items.filter((i) => i.favorite).length;
    const categoryCounts: Partial<Record<Category, number>> = {};
    items.forEach((i) => {
      if (!i.checked) {
        categoryCounts[i.category] = (categoryCounts[i.category] || 0) + 1;
      }
    });
    return { total, checked, pending, favorites, categoryCounts };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items
      .filter((i) => {
        if (showFavoritesOnly && !i.favorite) return false;
        if (filterCategory !== 'all' && i.category !== filterCategory) return false;
        if (query && !i.name.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort((a, b) => {
        // unchecked first
        if (a.checked !== b.checked) return a.checked ? 1 : -1;
        // then by category order
        if (CATEGORY_ORDER[a.category] !== CATEGORY_ORDER[b.category]) {
          return CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
        }
        // favorites first within category
        if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
        return 0;
      });
  }, [items, search, filterCategory, showFavoritesOnly]);

  type ListItem =
    | { type: 'header'; label: string; icon: keyof typeof Ionicons.glyphMap; color: string; count: number }
    | { type: 'item'; data: GroceryItem }
    | { type: 'empty' };

  const listData = useMemo((): ListItem[] => {
    if (filteredItems.length === 0) {
      return [{ type: 'empty' }];
    }

    if (viewMode === 'category') {
      const grouped = new Map<Category, GroceryItem[]>();
      filteredItems.forEach((i) => {
        const bucket = grouped.get(i.category) ?? [];
        bucket.push(i);
        grouped.set(i.category, bucket);
      });

      const result: ListItem[] = [];
      CATEGORIES.forEach((cat) => {
        const bucket = grouped.get(cat);
        if (!bucket || bucket.length === 0) return;
        const meta = CATEGORY_META[cat];
        result.push({
          type: 'header',
          label: meta.label,
          icon: meta.icon,
          color: meta.color,
          count: bucket.filter((i) => !i.checked).length,
        });
        bucket.forEach((i) => result.push({ type: 'item', data: i }));
      });
      return result;
    }

    return filteredItems.map((i) => ({ type: 'item' as const, data: i }));
  }, [filteredItems, viewMode]);

  const progress = counts.total > 0 ? counts.checked / counts.total : 0;

  /* ── hero card ── */

  const heroTitle =
    counts.total === 0
      ? 'Your grocery list is empty'
      : counts.pending === 0
        ? 'All items checked off!'
        : `${counts.pending} item${counts.pending === 1 ? '' : 's'} to get`;

  const heroSubtitle =
    counts.total === 0
      ? 'Start adding items for your next shopping trip.'
      : counts.pending === 0
        ? 'Ready to clear the list or add more items.'
        : `${counts.checked} of ${counts.total} items done`;

  /* ── render items ── */

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIconWrap, { backgroundColor: withAlpha(item.color, '18') }]}>
            <Ionicons name={item.icon} size={14} color={item.color} />
          </View>
          <Text style={[styles.sectionHeaderText, { color: colors.text }]}>{item.label}</Text>
          <View style={[styles.sectionBadge, { backgroundColor: withAlpha(item.color, '18') }]}>
            <Text style={[styles.sectionBadgeText, { color: item.color }]}>{item.count}</Text>
          </View>
        </View>
      );
    }

    if (item.type === 'empty') {
      return (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: withAlpha(ACCENT, '14') }]}>
            <Ionicons name="cart-outline" size={28} color={ACCENT} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {items.length === 0 ? 'Nothing here yet' : 'No matching items'}
          </Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>
            {items.length === 0
              ? 'Tap the + button to add your first grocery item.'
              : 'Try adjusting your search or filter.'}
          </Text>
        </View>
      );
    }

    const grocery = item.data;
    const catMeta = CATEGORY_META[grocery.category];
    const isChecked = grocery.checked;

    return (
      <View
        style={[
          styles.itemCard,
          {
            backgroundColor: isChecked
              ? withAlpha(colors.border, '08')
              : withAlpha(catMeta.color, '06'),
            borderColor: isChecked
              ? colors.border
              : withAlpha(catMeta.color, '22'),
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => toggleChecked(grocery.id)}
          style={[
            styles.checkbox,
            isChecked
              ? { backgroundColor: ACCENT, borderColor: ACCENT }
              : { backgroundColor: colors.surface, borderColor: withAlpha(catMeta.color, '40') },
          ]}
          activeOpacity={0.7}
        >
          {isChecked ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </TouchableOpacity>

        <View style={styles.itemBody}>
          <View style={styles.itemNameRow}>
            <Text
              style={[
                styles.itemName,
                { color: isChecked ? colors.textMuted : colors.text },
                isChecked && styles.itemNameDone,
              ]}
              numberOfLines={1}
            >
              {grocery.name}
            </Text>
            {grocery.favorite ? (
              <Ionicons name="heart" size={14} color="#F43F5E" />
            ) : null}
          </View>

          <View style={styles.itemMetaRow}>
            <View style={[styles.qtyBadge, { backgroundColor: withAlpha(catMeta.color, '14'), borderColor: withAlpha(catMeta.color, '22') }]}>
              <Text style={[styles.qtyText, { color: catMeta.color }]}>
                {grocery.quantity} {grocery.unit}
              </Text>
            </View>
            <View style={[styles.catBadge, { backgroundColor: withAlpha(catMeta.color, '10') }]}>
              <Ionicons name={catMeta.icon} size={12} color={catMeta.color} />
              <Text style={[styles.catBadgeText, { color: catMeta.color }]}>{catMeta.label}</Text>
            </View>
          </View>
        </View>

        <View style={styles.itemActions}>
          <TouchableOpacity
            onPress={() => toggleFavorite(grocery.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={grocery.favorite ? 'heart' : 'heart-outline'}
              size={18}
              color={grocery.favorite ? '#F43F5E' : colors.textMuted}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => removeItem(grocery.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  /* ── header ── */

  const header = (
    <View style={styles.headerStack}>
      {/* Hero */}
      <LinearGradient
        colors={['#064E3B', '#059669', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Shopping List</Text>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>

        <View style={styles.heroStatsRow}>
          {[
            { label: 'Pending', value: counts.pending },
            { label: 'Done', value: counts.checked },
            { label: 'Favorites', value: counts.favorites },
          ].map((stat) => (
            <View key={stat.label} style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{stat.value}</Text>
              <Text style={styles.heroStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {counts.total > 0 ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
            </View>
            <Text style={styles.progressText}>{Math.round(progress * 100)}% complete</Text>
          </View>
        ) : null}
      </LinearGradient>

      {/* Controls */}
      <View style={[styles.controlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Search */}
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search items..."
            placeholderTextColor={colors.textMuted}
            selectionColor={ACCENT}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Category filter pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pillScroll} contentContainerStyle={styles.pillRow}>
          <TouchableOpacity
            onPress={() => setFilterCategory('all')}
            style={[
              styles.filterPill,
              filterCategory === 'all'
                ? { backgroundColor: ACCENT, borderColor: ACCENT }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.filterPillText,
                { color: filterCategory === 'all' ? '#FFFFFF' : colors.textMuted },
              ]}
            >
              All {counts.total}
            </Text>
          </TouchableOpacity>
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_META[cat];
            const active = filterCategory === cat;
            const catCount = counts.categoryCounts[cat] || 0;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setFilterCategory(active ? 'all' : cat)}
                style={[
                  styles.filterPill,
                  active
                    ? { backgroundColor: withAlpha(meta.color, '18'), borderColor: meta.color }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name={meta.icon} size={13} color={active ? meta.color : colors.textMuted} />
                <Text style={[styles.filterPillText, { color: active ? meta.color : colors.textMuted }]}>
                  {meta.label}{catCount > 0 ? ` ${catCount}` : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* View mode + favorites + actions row */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === 'list' ? 'category' : 'list')}
            style={[styles.actionChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
          >
            <Ionicons
              name={viewMode === 'category' ? 'list-outline' : 'grid-outline'}
              size={15}
              color={colors.textMuted}
            />
            <Text style={[styles.actionChipText, { color: colors.textMuted }]}>
              {viewMode === 'category' ? 'List' : 'By Category'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            style={[
              styles.actionChip,
              showFavoritesOnly
                ? { backgroundColor: 'rgba(244, 63, 94, 0.12)', borderColor: '#F43F5E' }
                : { backgroundColor: colors.inputBg, borderColor: colors.border },
            ]}
          >
            <Ionicons
              name={showFavoritesOnly ? 'heart' : 'heart-outline'}
              size={15}
              color={showFavoritesOnly ? '#F43F5E' : colors.textMuted}
            />
            <Text
              style={[
                styles.actionChipText,
                { color: showFavoritesOnly ? '#F43F5E' : colors.textMuted },
              ]}
            >
              Favorites
            </Text>
          </TouchableOpacity>

          {counts.checked > 0 ? (
            <>
              <TouchableOpacity
                onPress={uncheckAll}
                style={[styles.actionChip, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              >
                <Ionicons name="refresh-outline" size={15} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={clearChecked}
                style={[styles.actionChip, { backgroundColor: 'rgba(239, 68, 68, 0.10)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
              >
                <Ionicons name="trash-outline" size={15} color="#EF4444" />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );

  /* ── add modal ── */

  const addModal = (
    <KeyboardAwareModal visible={showAddModal} transparent animationType="slide" onRequestClose={() => setShowAddModal(false)}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayDismiss} activeOpacity={1} onPress={() => setShowAddModal(false)} />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={styles.sheetHandle} />

          <Text style={[styles.sheetTitle, { color: colors.text }]}>Add Item</Text>

          {/* Item name */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Item Name</Text>
          <TextInput
            style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={formName}
            onChangeText={setFormName}
            placeholder="e.g. Milk, Apples, Rice..."
            placeholderTextColor={colors.textMuted}
            selectionColor={ACCENT}
            autoFocus
          />

          {/* Quantity & Unit row */}
          <View style={styles.qtyUnitRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Quantity</Text>
              <TextInput
                style={[styles.formInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={formQuantity}
                onChangeText={setFormQuantity}
                placeholder="1"
                placeholderTextColor={colors.textMuted}
                keyboardType="decimal-pad"
                selectionColor={ACCENT}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Unit</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.unitRow}>
                  {UNITS.map((u) => {
                    const active = formUnit === u.value;
                    return (
                      <TouchableOpacity
                        key={u.value}
                        onPress={() => setFormUnit(u.value)}
                        style={[
                          styles.unitChip,
                          active
                            ? { backgroundColor: ACCENT, borderColor: ACCENT }
                            : { backgroundColor: colors.inputBg, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.unitChipText, { color: active ? '#FFFFFF' : colors.textMuted }]}>
                          {u.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Category */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat];
              const active = formCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setFormCategory(cat)}
                  style={[
                    styles.categoryChip,
                    active
                      ? { backgroundColor: withAlpha(meta.color, '18'), borderColor: meta.color }
                      : { backgroundColor: colors.inputBg, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name={meta.icon} size={16} color={active ? meta.color : colors.textMuted} />
                  <Text
                    style={[styles.categoryChipText, { color: active ? meta.color : colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Add button */}
          <TouchableOpacity
            onPress={addItem}
            style={[styles.addButton, { opacity: formName.trim().length === 0 ? 0.5 : 1 }]}
            disabled={formName.trim().length === 0}
          >
            <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
            <Text style={styles.addButtonText}>Add to list</Text>
          </TouchableOpacity>
        </View>
      </View>
      </KeyboardAwareModal>
  );

  /* ── FAB ── */

  const fab = (
    <TouchableOpacity
      onPress={() => setShowAddModal(true)}
      style={styles.fab}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={[ACCENT, '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.fabGradient}
      >
        <Ionicons name="add" size={28} color="#FFFFFF" />
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <ScreenShell title="Grocery List" accentColor={ACCENT} scrollable={false}>
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.type === 'item' ? item.data.id : `${item.type}-${index}`
        }
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
      {fab}
      {addModal}
    </ScreenShell>
  );
}

/* ── styles ── */

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: 100,
    },
    headerStack: {
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },

    /* hero */
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#A7F3D0',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#D1FAE5',
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    heroStatCard: {
      flex: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
      gap: 2,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    heroStatValue: {
      fontSize: 24,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroStatLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: '#D1FAE5',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    progressWrap: {
      gap: 6,
    },
    progressTrack: {
      height: 7,
      borderRadius: Radii.pill,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    progressFill: {
      height: '100%',
      borderRadius: Radii.pill,
      backgroundColor: '#A7F3D0',
    },
    progressText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      color: '#ECFDF5',
    },

    /* controls */
    controlCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      minHeight: 46,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.regular,
      paddingVertical: 10,
    },
    pillScroll: {
      marginHorizontal: -Spacing.lg,
    },
    pillRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
    },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
    },
    filterPillText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    actionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 7,
    },
    actionChipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    /* section headers */
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
      paddingHorizontal: 2,
    },
    sectionIconWrap: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionHeaderText: {
      flex: 1,
      fontSize: 13,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    sectionBadge: {
      borderRadius: Radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    sectionBadgeText: {
      fontSize: 12,
      fontFamily: Fonts.bold,
    },

    /* items */
    itemCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    itemBody: {
      flex: 1,
      gap: 6,
    },
    itemNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    itemName: {
      flex: 1,
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    itemNameDone: {
      textDecorationLine: 'line-through',
      opacity: 0.6,
    },
    itemMetaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    qtyBadge: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    qtyText: {
      fontSize: 11,
      fontFamily: Fonts.bold,
    },
    catBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: Radii.pill,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    catBadgeText: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
    },
    itemActions: {
      gap: 12,
      alignItems: 'center',
    },

    /* empty */
    emptyCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    emptyIconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },

    /* FAB */
    fab: {
      position: 'absolute',
      right: Spacing.lg,
      bottom: Spacing.xl,
    },
    fabGradient: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      elevation: 6,
      shadowColor: ACCENT,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
    },

    /* modal */
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    overlayDismiss: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      paddingBottom: 40,
      gap: Spacing.md,
      maxHeight: '85%',
    },
    sheetHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.sm,
    },
    sheetTitle: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginTop: 4,
    },
    formInput: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: Fonts.regular,
    },
    qtyUnitRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    unitRow: {
      flexDirection: 'row',
      gap: 6,
      paddingVertical: 2,
    },
    unitChip: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    unitChipText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    categoryChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
    },
    categoryChipText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: Radii.lg,
      paddingVertical: 14,
      backgroundColor: ACCENT,
      marginTop: Spacing.sm,
    },
    addButtonText: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
      color: '#FFFFFF',
    },
  });
