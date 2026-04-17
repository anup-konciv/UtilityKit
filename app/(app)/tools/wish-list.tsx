import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EC4899';
const STORAGE_KEY = 'uk_wish_list';

type WishItem = { id: string; name: string; price: number; priority: number; category: string; notes: string; purchased: boolean; createdAt: string };

const PRIORITIES = [
  { label: 'Low', color: '#10B981' },
  { label: 'Medium', color: '#F59E0B' },
  { label: 'High', color: '#F97316' },
  { label: 'Must Have', color: '#EF4444' },
];

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home', 'Travel', 'Food', 'Health', 'Other'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }

export default function WishListScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState<WishItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'active' | 'purchased'>('all');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [priority, setPriority] = useState(1);
  const [category, setCategory] = useState('Other');
  const [notes, setNotes] = useState('');

  useEffect(() => { loadJSON<WishItem[]>(STORAGE_KEY, []).then(setItems); }, []);
  const persist = useCallback((d: WishItem[]) => { setItems(d); saveJSON(STORAGE_KEY, d); }, []);

  const resetForm = () => { setName(''); setPrice(''); setPriority(1); setCategory('Other'); setNotes(''); setEditId(null); setShowForm(false); };

  const saveItem = () => {
    if (!name.trim()) return;
    const item: WishItem = {
      id: editId ?? uid(),
      name: name.trim(),
      price: parseFloat(price) || 0,
      priority,
      category,
      notes: notes.trim(),
      purchased: editId ? items.find(i => i.id === editId)?.purchased ?? false : false,
      createdAt: editId ? items.find(i => i.id === editId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    };
    persist(editId ? items.map(i => i.id === editId ? item : i) : [item, ...items]);
    resetForm();
  };

  const editItem = (item: WishItem) => {
    setEditId(item.id); setName(item.name); setPrice(item.price > 0 ? String(item.price) : '');
    setPriority(item.priority); setCategory(item.category); setNotes(item.notes); setShowForm(true);
  };

  const togglePurchased = (id: string) => persist(items.map(i => i.id === id ? { ...i, purchased: !i.purchased } : i));
  const deleteItem = (id: string) => persist(items.filter(i => i.id !== id));

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'active') list = list.filter(i => !i.purchased);
    if (filter === 'purchased') list = list.filter(i => i.purchased);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i => i.name.toLowerCase().includes(q));
    }
    return list;
  }, [items, filter, search]);

  const activeTotal = items.filter(i => !i.purchased).reduce((s, i) => s + i.price, 0);
  const purchasedTotal = items.filter(i => i.purchased).reduce((s, i) => s + i.price, 0);

  return (
    <ScreenShell title="Wish List" accentColor={ACCENT}>
      {/* Summary */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: ACCENT }]}>{fmt(activeTotal)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Wishlist Total</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{fmt(purchasedTotal)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Purchased</Text>
          </View>
          <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: colors.text }]}>{items.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Items</Text>
          </View>
        </View>
      </View>

      {/* Search + Filter */}
      <TextInput
        style={[styles.searchInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
        value={search}
        onChangeText={setSearch}
        placeholder="Search items..."
        placeholderTextColor={colors.textMuted}
      />
      <View style={styles.filterRow}>
        {(['all', 'active', 'purchased'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, { backgroundColor: filter === f ? ACCENT + '22' : colors.glass, borderColor: filter === f ? ACCENT : colors.border }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? ACCENT : colors.textMuted }]}>
              {f === 'all' ? 'All' : f === 'active' ? 'Active' : 'Purchased'}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: ACCENT }]} onPress={() => { resetForm(); setShowForm(true); }}>
          <Ionicons name="add" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Add/Edit Form */}
      {showForm && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{editId ? 'Edit Item' : 'Add Item'}</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={name} onChangeText={setName} placeholder="Item name" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={price} onChangeText={setPrice} placeholder="Price (optional)" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Priority</Text>
          <View style={styles.chipRow}>
            {PRIORITIES.map((p, i) => (
              <TouchableOpacity key={i} style={[styles.chip, { backgroundColor: priority === i ? p.color + '22' : colors.glass, borderColor: priority === i ? p.color : colors.border }]} onPress={() => setPriority(i)}>
                <Text style={[styles.chipText, { color: priority === i ? p.color : colors.textMuted }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map(c => (
              <TouchableOpacity key={c} style={[styles.chip, { backgroundColor: category === c ? ACCENT + '22' : colors.glass, borderColor: category === c ? ACCENT : colors.border }]} onPress={() => setCategory(c)}>
                <Text style={[styles.chipText, { color: category === c ? ACCENT : colors.textMuted }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={colors.textMuted} />

          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={saveItem}>
              <Text style={styles.saveText}>{editId ? 'Update' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Items */}
      {filtered.map(item => (
        <View key={item.id} style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: item.purchased ? 0.6 : 1 }]}>
          <TouchableOpacity onPress={() => togglePurchased(item.id)} style={[styles.checkBox, { borderColor: item.purchased ? '#10B981' : colors.border, backgroundColor: item.purchased ? '#10B981' + '20' : 'transparent' }]}>
            {item.purchased && <Ionicons name="checkmark" size={16} color="#10B981" />}
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.itemName, { color: colors.text, textDecorationLine: item.purchased ? 'line-through' : 'none' }]}>{item.name}</Text>
            <View style={styles.itemMeta}>
              <View style={[styles.priorBadge, { backgroundColor: PRIORITIES[item.priority].color + '20' }]}>
                <Text style={[styles.priorText, { color: PRIORITIES[item.priority].color }]}>{PRIORITIES[item.priority].label}</Text>
              </View>
              <Text style={[styles.catText, { color: colors.textMuted }]}>{item.category}</Text>
            </View>
            {item.notes ? <Text style={[styles.itemNotes, { color: colors.textMuted }]} numberOfLines={1}>{item.notes}</Text> : null}
          </View>
          {item.price > 0 && <Text style={[styles.itemPrice, { color: ACCENT }]}>{fmt(item.price)}</Text>}
          <View style={styles.itemActions}>
            <TouchableOpacity onPress={() => editItem(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="create-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deleteItem(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      ))}

      {filtered.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={48} color={ACCENT + '40'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No items yet. Tap + to add your wishes!</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    fieldLabel: { fontSize: 10, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 20, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    summaryDivider: { width: 1, height: 30 },
    searchInput: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.md },
    filterRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, alignItems: 'center' },
    filterChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    filterText: { fontSize: 12, fontFamily: Fonts.medium },
    addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginLeft: 'auto' },
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    chipText: { fontSize: 11, fontFamily: Fonts.medium },
    formBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, borderWidth: 1, alignItems: 'center' },
    cancelText: { fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, alignItems: 'center' },
    saveText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    itemCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
    checkBox: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    itemName: { fontSize: 14, fontFamily: Fonts.semibold },
    itemMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2, alignItems: 'center' },
    priorBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radii.sm },
    priorText: { fontSize: 9, fontFamily: Fonts.bold },
    catText: { fontSize: 10, fontFamily: Fonts.regular },
    itemNotes: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
    itemPrice: { fontSize: 15, fontFamily: Fonts.bold },
    itemActions: { gap: Spacing.sm },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
