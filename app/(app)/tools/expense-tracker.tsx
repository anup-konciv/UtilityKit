import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, Alert, Dimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import DateField from '@/components/DateField';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#6366F1';
const { width: SW } = Dimensions.get('window');

const CURRENCY_SYMBOLS = [
  { symbol: '₹', label: 'INR (₹)' },
  { symbol: '$', label: 'USD ($)' },
  { symbol: '€', label: 'EUR (€)' },
  { symbol: '£', label: 'GBP (£)' },
  { symbol: '¥', label: 'JPY (¥)' },
  { symbol: 'A$', label: 'AUD (A$)' },
  { symbol: 'C$', label: 'CAD (C$)' },
  { symbol: '₩', label: 'KRW (₩)' },
  { symbol: '฿', label: 'THB (฿)' },
  { symbol: 'R$', label: 'BRL (R$)' },
];

// ── Types ─────────────────────────────────────────────────────────────────────
type Expense = { id: string; amount: number; categoryId: string; note: string; date: string };
type Colors  = ReturnType<typeof useAppTheme>['colors'];
type TabId   = 'overview' | 'history' | 'transfers' | 'analytics';

/**
 * Transfers are *not* expenses — they're money the user moved out for
 * recoverable / asset-building reasons (lent to someone, parked into an
 * investment, etc.). They live in their own list, have their own tab, and
 * never touch the spending totals or the monthly budget.
 */
type TransferKind = 'lent' | 'investment' | 'other';
type Transfer = {
  id: string;
  amount: number;
  kind: TransferKind;
  recipient: string;
  note: string;
  date: string;
  /** Only meaningful for `kind === 'lent'`. Tracks whether the borrower paid back. */
  returned: boolean;
  returnedDate?: string;
};

const TRANSFER_KINDS: { id: TransferKind; label: string; icon: string; color: string }[] = [
  { id: 'lent',       label: 'Lent',       icon: 'arrow-up-circle-outline',   color: '#F97316' },
  { id: 'investment', label: 'Investment', icon: 'trending-up-outline',       color: '#10B981' },
  { id: 'other',      label: 'Other',      icon: 'swap-horizontal-outline',   color: '#6366F1' },
];

function getTransferKind(id: TransferKind) {
  return TRANSFER_KINDS.find(k => k.id === id) ?? TRANSFER_KINDS[2];
}

type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Marks user-created categories. Built-ins are immutable. */
  custom?: boolean;
};

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES: readonly Category[] = [
  { id: 'food',          label: 'Food',         icon: 'restaurant-outline',          color: '#F97316' },
  { id: 'transport',     label: 'Transport',    icon: 'car-outline',                 color: '#3B82F6' },
  { id: 'shopping',      label: 'Shopping',     icon: 'bag-outline',                 color: '#EC4899' },
  { id: 'fun',           label: 'Fun',          icon: 'game-controller-outline',     color: '#8B5CF6' },
  { id: 'health',        label: 'Health',       icon: 'medkit-outline',              color: '#10B981' },
  { id: 'bills',         label: 'Bills',        icon: 'receipt-outline',             color: '#EF4444' },
  { id: 'education',     label: 'Education',    icon: 'book-outline',                color: '#06B6D4' },
  { id: 'personal',      label: 'Personal',     icon: 'person-outline',              color: '#84CC16' },
  { id: 'travel',        label: 'Travel',       icon: 'airplane-outline',            color: '#F59E0B' },
  { id: 'other',         label: 'Other',        icon: 'ellipsis-horizontal-outline', color: '#64748B' },
];

// Curated picker palette for the "Create category" sheet. Kept short on
// purpose so the picker stays one screen tall on small phones.
const ICON_CHOICES: string[] = [
  'restaurant-outline', 'fast-food-outline', 'cafe-outline', 'pizza-outline',
  'beer-outline', 'wine-outline', 'cart-outline', 'bag-handle-outline',
  'shirt-outline', 'gift-outline', 'home-outline', 'bed-outline',
  'water-outline', 'flash-outline', 'flame-outline', 'paw-outline',
  'fitness-outline', 'barbell-outline', 'football-outline', 'school-outline',
  'book-outline', 'laptop-outline', 'phone-portrait-outline', 'headset-outline',
  'musical-notes-outline', 'film-outline', 'tv-outline', 'camera-outline',
  'car-outline', 'bus-outline', 'bicycle-outline', 'airplane-outline',
  'train-outline', 'boat-outline', 'medkit-outline', 'heart-outline',
  'leaf-outline', 'flower-outline', 'cash-outline', 'card-outline',
  'wallet-outline', 'briefcase-outline', 'business-outline', 'construct-outline',
];

const COLOR_CHOICES: string[] = [
  '#F97316', '#EF4444', '#EC4899', '#A855F7',
  '#8B5CF6', '#6366F1', '#3B82F6', '#06B6D4',
  '#14B8A6', '#10B981', '#84CC16', '#F59E0B',
];

// Module-level resolver. Mirrors the `_curSym` pattern already used for the
// currency symbol — lets `getCat` stay parameter-less so existing call sites
// (CSV export, ExpenseRow, History search) keep working unchanged. The screen
// keeps `_allCats` in sync via `setAllCats` whenever the custom-category list
// is loaded or mutated.
let _allCats: readonly Category[] = CATEGORIES;
function setAllCats(list: readonly Category[]) { _allCats = list; }

function getCat(id: string): Category {
  return _allCats.find(c => c.id === id)
      ?? CATEGORIES.find(c => c.id === 'other')
      ?? CATEGORIES[CATEGORIES.length - 1];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function yesterdayISO() {
  const d = new Date(); d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function prevMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y-1}-12` : `${y}-${String(m-1).padStart(2,'0')}`;
}
function nextMonth(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return m === 12 ? `${y+1}-01` : `${y}-${String(m+1).padStart(2,'0')}`;
}
function monthLabel(ym: string) {
  const [y, m] = ym.split('-').map(Number);
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${y}`;
}
function shortDate(iso: string) {
  const today = todayISO(), yest = yesterdayISO();
  if (iso === today) return 'Today';
  if (iso === yest)  return 'Yesterday';
  const [,m,d] = iso.split('-').map(Number);
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1]} ${d}`;
}
function last6Months(): string[] {
  const res: string[] = [];
  const d = new Date();
  for (let i = 5; i >= 0; i--) {
    const t = new Date(d.getFullYear(), d.getMonth() - i, 1);
    res.push(`${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}`);
  }
  return res;
}
function daysInMonth(ym: string): number {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

let _curSym = '₹';
function setCurSym(s: string) { _curSym = s; }
function fmtINR(n: number) {
  if (!isFinite(n) || n === 0) return `${_curSym}0`;
  if (n >= 10_000_000) return `${_curSym}${(n/10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000)    return `${_curSym}${(n/100_000).toFixed(1)}L`;
  if (n >= 1_000)      return `${_curSym}${(n/1_000).toFixed(1)}K`;
  return `${_curSym}${Math.round(n).toLocaleString()}`;
}
function fmtFull(n: number) {
  return `${_curSym}${Math.round(n).toLocaleString()}`;
}

function expensesToCSV(expenses: Expense[]): string {
  const header = 'Date,Amount,Category,Note';
  const rows = [...expenses]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(e => {
      const cat = getCat(e.categoryId);
      const note = e.note.replace(/"/g, '""');
      return `${e.date},${e.amount},${cat.label},"${note}"`;
    });
  return [header, ...rows].join('\n');
}

// ── Add / Edit Sheet ──────────────────────────────────────────────────────────
function AddExpenseSheet({
  initial, onSave, onDelete, onClose, colors, currencySymbol,
  allCategories, onAddCategory, onDeleteCategory,
}: {
  initial: Expense | null;
  onSave: (e: Expense) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  colors: Colors;
  currencySymbol: string;
  allCategories: readonly Category[];
  onAddCategory: (cat: Category) => void;
  onDeleteCategory: (id: string) => void;
}) {
  const isEdit = initial !== null;
  const [amount,    setAmount]    = useState(initial ? String(initial.amount) : '');
  const [catId,     setCatId]     = useState(initial?.categoryId ?? 'food');
  const [note,      setNote]      = useState(initial?.note ?? '');
  const [editorOpen, setEditorOpen] = useState(false);

  // If a custom category currently selected gets deleted from another path,
  // fall back to 'food' so the form never points at a missing id.
  useEffect(() => {
    if (!allCategories.some(c => c.id === catId)) setCatId('food');
  }, [allCategories, catId]);
  const [dateMode,  setDateMode]  = useState<'today'|'yesterday'|'custom'>(() => {
    if (!initial) return 'today';
    if (initial.date === todayISO())     return 'today';
    if (initial.date === yesterdayISO()) return 'yesterday';
    return 'custom';
  });
  const [customDate, setCustomDate] = useState(initial?.date ?? todayISO());

  const resolvedDate = dateMode === 'today' ? todayISO()
    : dateMode === 'yesterday' ? yesterdayISO()
    : customDate;

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Please enter a valid amount.'); return; }
    if (dateMode === 'custom' && !/^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DD'); return;
    }
    onSave({ id: initial?.id ?? uid(), amount: amt, categoryId: catId, note: note.trim(), date: resolvedDate });
  };

  const s = useMemo(() => sheetSt(colors), [colors]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.dismiss} activeOpacity={1} onPress={onClose} />
        <ScrollView style={[s.sheet, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <Text style={[s.title, { color: colors.text }]}>{isEdit ? 'Edit Expense' : 'Add Expense'}</Text>

          {/* Amount */}
          <View style={[s.amountWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            {/* FIX #1: Use selected currencySymbol instead of hardcoded ₹ */}
            <Text style={[s.rupee, { color: ACCENT }]}>{currencySymbol}</Text>
            <TextInput
              style={[s.amountInput, { color: colors.text }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus={!isEdit}
            />
          </View>

          {/* Category */}
          <Text style={[s.label, { color: colors.textMuted }]}>Category</Text>
          <View style={s.catGrid}>
            {allCategories.map(c => {
              const active = catId === c.id;
              // Long-press a custom pill to remove it. Built-ins ignore the
              // gesture so users can't nuke the canonical set.
              const handleLongPress = () => {
                if (!c.custom) return;
                Alert.alert(
                  'Delete category',
                  `Remove "${c.label}"? Built-in categories can't be deleted.`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Delete', style: 'destructive', onPress: () => onDeleteCategory(c.id) },
                  ],
                );
              };
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catPill, { borderColor: active ? c.color : colors.border, backgroundColor: active ? c.color + '22' : colors.inputBg }]}
                  onPress={() => setCatId(c.id)}
                  onLongPress={handleLongPress}
                  delayLongPress={350}
                >
                  <Ionicons name={c.icon as any} size={13} color={active ? c.color : colors.textMuted} />
                  <Text style={[s.catPillTxt, { color: active ? c.color : colors.textMuted }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
            {/* "+ New" pill — opens the category editor modal. */}
            <TouchableOpacity
              style={[s.catPill, s.catPillNew, { borderColor: ACCENT, backgroundColor: ACCENT + '12' }]}
              onPress={() => setEditorOpen(true)}
            >
              <Ionicons name="add-outline" size={14} color={ACCENT} />
              <Text style={[s.catPillTxt, { color: ACCENT }]}>New</Text>
            </TouchableOpacity>
          </View>
          {/* Subtle hint so users discover the long-press delete affordance. */}
          {allCategories.some(c => c.custom) && (
            <Text style={[s.catHint, { color: colors.textMuted }]}>
              Long-press a custom category to remove it.
            </Text>
          )}

          {/* Note */}
          <Text style={[s.label, { color: colors.textMuted }]}>Note</Text>
          <TextInput
            style={[s.noteInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={note}
            onChangeText={setNote}
            placeholder="What was this for?"
            placeholderTextColor={colors.textMuted}
          />

          {/* Date */}
          <Text style={[s.label, { color: colors.textMuted }]}>Date</Text>
          <View style={s.dateRow}>
            {(['today', 'yesterday', 'custom'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[s.datePill, { borderColor: dateMode === mode ? ACCENT : colors.border, backgroundColor: dateMode === mode ? ACCENT + '18' : colors.inputBg }]}
                onPress={() => setDateMode(mode)}
              >
                <Text style={[s.datePillTxt, { color: dateMode === mode ? ACCENT : colors.textMuted }]}>
                  {mode === 'today' ? 'Today' : mode === 'yesterday' ? 'Yesterday' : 'Other'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {dateMode === 'custom' && (
            <View style={{ paddingHorizontal: Spacing.lg, marginTop: 6 }}>
              <DateField
                value={customDate}
                onChange={setCustomDate}
                accent={ACCENT}
                placeholder="Pick a date"
              />
            </View>
          )}

          {/* Actions */}
          <View style={[s.btnRow, { paddingBottom: 36 }]}>
            {isEdit && onDelete && (
              <TouchableOpacity
                style={[s.delBtn, { borderColor: '#EF4444' }]}
                onPress={() => Alert.alert('Delete', 'Remove this expense?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { onDelete(initial!.id); onClose(); } },
                ])}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: ACCENT }]} onPress={handleSave}>
              <Text style={s.saveTxt}>{isEdit ? 'Save Changes' : 'Add Expense'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {editorOpen && (
          <CategoryEditor
            colors={colors}
            existingLabels={allCategories.map(c => c.label.toLowerCase())}
            onSave={(cat) => {
              onAddCategory(cat);
              setCatId(cat.id);
              setEditorOpen(false);
            }}
            onClose={() => setEditorOpen(false)}
          />
        )}
      </View>
    </Modal>
  );
}

// ── Category Editor ───────────────────────────────────────────────────────────
function CategoryEditor({ colors, existingLabels, onSave, onClose }: {
  colors: Colors;
  existingLabels: string[];
  onSave: (cat: Category) => void;
  onClose: () => void;
}) {
  const [name,  setName]  = useState('');
  const [icon,  setIcon]  = useState<string>(ICON_CHOICES[0]);
  const [color, setColor] = useState<string>(COLOR_CHOICES[0]);
  const e = useMemo(() => editorSt(colors), [colors]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Please give your category a name.');
      return;
    }
    if (trimmed.length > 24) {
      Alert.alert('Name too long', 'Keep it under 24 characters.');
      return;
    }
    if (existingLabels.includes(trimmed.toLowerCase())) {
      Alert.alert('Already exists', 'A category with that name already exists.');
      return;
    }
    onSave({
      id: `cust_${uid()}`,
      label: trimmed,
      icon,
      color,
      custom: true,
    });
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={e.overlay}>
        <View style={[e.box, { backgroundColor: colors.card }]}>
          {/* Live preview pill — gives the user instant feedback on their choices. */}
          <View style={e.previewWrap}>
            <View style={[e.previewPill, { borderColor: color, backgroundColor: color + '22' }]}>
              <Ionicons name={icon as any} size={16} color={color} />
              <Text style={[e.previewTxt, { color }]} numberOfLines={1}>
                {name.trim() || 'New Category'}
              </Text>
            </View>
          </View>

          {/* Name */}
          <Text style={[e.label, { color: colors.textMuted }]}>Name</Text>
          <TextInput
            style={[e.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Pets, Coffee, Subscriptions"
            placeholderTextColor={colors.textMuted}
            maxLength={24}
            autoFocus
            returnKeyType="done"
          />

          {/* Icon picker */}
          <Text style={[e.label, { color: colors.textMuted }]}>Icon</Text>
          <ScrollView
            style={e.iconScroll}
            contentContainerStyle={e.iconGrid}
            showsVerticalScrollIndicator={false}
          >
            {ICON_CHOICES.map(name => {
              const active = icon === name;
              return (
                <TouchableOpacity
                  key={name}
                  style={[
                    e.iconCell,
                    {
                      borderColor: active ? color : colors.border,
                      backgroundColor: active ? color + '22' : colors.inputBg,
                    },
                  ]}
                  onPress={() => setIcon(name)}
                >
                  <Ionicons name={name as any} size={20} color={active ? color : colors.text} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Color picker */}
          <Text style={[e.label, { color: colors.textMuted }]}>Color</Text>
          <View style={e.colorRow}>
            {COLOR_CHOICES.map(c => {
              const active = color === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[
                    e.colorSwatch,
                    {
                      backgroundColor: c,
                      borderColor: active ? colors.text : 'transparent',
                    },
                  ]}
                  onPress={() => setColor(c)}
                >
                  {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={e.btnRow}>
            <TouchableOpacity style={[e.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[e.cancelTxt, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[e.saveBtn, { backgroundColor: ACCENT }]} onPress={handleSave}>
              <Text style={e.saveTxt}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const editorSt = (c: Colors) => StyleSheet.create({
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  box:         { width: '100%', maxWidth: 420, borderRadius: Radii.xl, padding: Spacing.lg },
  previewWrap: { alignItems: 'center', marginBottom: Spacing.md },
  previewPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.pill, borderWidth: 1.5, maxWidth: '90%' },
  previewTxt:  { fontFamily: Fonts.semibold, fontSize: 14 },
  label:       { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6, marginTop: Spacing.sm },
  input:       { borderRadius: Radii.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 44, fontFamily: Fonts.regular, fontSize: 14, marginBottom: 4 },
  iconScroll:  { maxHeight: 168 },
  iconGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 },
  iconCell:    { width: 44, height: 44, borderRadius: Radii.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  colorRow:    { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: Spacing.md },
  colorSwatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  btnRow:      { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelBtn:   { flex: 1, height: 44, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  cancelTxt:   { fontFamily: Fonts.semibold, fontSize: 14 },
  saveBtn:     { flex: 1, height: 44, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
  saveTxt:     { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
});

const sheetSt = (c: Colors) => StyleSheet.create({
  overlay:     { flex: 1, justifyContent: 'flex-end' },
  dismiss:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:       { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  handle:      { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },
  title:       { fontFamily: Fonts.bold, fontSize: 18, marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  label:       { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7, color: c.textMuted, paddingHorizontal: Spacing.lg },
  amountWrap:  { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.lg, borderWidth: 1.5, paddingHorizontal: Spacing.lg, height: 68, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  rupee:       { fontFamily: Fonts.bold, fontSize: 30, marginRight: 4 },
  amountInput: { flex: 1, fontFamily: Fonts.bold, fontSize: 36 },
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: Spacing.lg, marginBottom: 6 },
  catPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5 },
  catPillNew:  { borderStyle: 'dashed' },
  catPillTxt:  { fontFamily: Fonts.medium, fontSize: 12 },
  catHint:     { fontFamily: Fonts.regular, fontSize: 11, fontStyle: 'italic', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  noteInput:   { borderRadius: Radii.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 14, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  dateRow:     { flexDirection: 'row', gap: 8, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  datePill:    { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: Radii.pill, borderWidth: 1.5 },
  datePillTxt: { fontFamily: Fonts.medium, fontSize: 13 },
  btnRow:      { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, marginTop: Spacing.lg },
  delBtn:      { width: 48, height: 48, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  saveBtn:     { flex: 1, height: 48, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
  saveTxt:     { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
});

// ── Expense Row ───────────────────────────────────────────────────────────────
function ExpenseRow({ item, onPress, colors }: { item: Expense; onPress: () => void; colors: Colors }) {
  const cat = getCat(item.categoryId);
  return (
    <TouchableOpacity style={[er.row, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onPress} activeOpacity={0.8}>
      <View style={[er.iconWrap, { backgroundColor: cat.color + '20' }]}>
        <Ionicons name={cat.icon as any} size={20} color={cat.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[er.noteTxt, { color: colors.text }]} numberOfLines={1}>
          {item.note || cat.label}
        </Text>
        <Text style={[er.catTxt, { color: colors.textMuted }]}>{cat.label}</Text>
      </View>
      <Text style={[er.amount, { color: colors.text }]}>{fmtFull(item.amount)}</Text>
    </TouchableOpacity>
  );
}
const er = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.sm },
  iconWrap: { width: 42, height: 42, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  noteTxt:  { fontFamily: Fonts.semibold, fontSize: 14, marginBottom: 2 },
  catTxt:   { fontFamily: Fonts.regular, fontSize: 12 },
  amount:   { fontFamily: Fonts.bold, fontSize: 15 },
});

// ── Month Navigator ───────────────────────────────────────────────────────────
function MonthNav({ month, onChange, colors }: { month: string; onChange: (m: string) => void; colors: Colors }) {
  const isCurrent = month === currentMonthKey();
  return (
    <View style={[mn.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity onPress={() => onChange(prevMonth(month))} style={mn.btn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </TouchableOpacity>
      <Text style={[mn.label, { color: colors.text }]}>{monthLabel(month)}</Text>
      <TouchableOpacity onPress={() => onChange(nextMonth(month))} style={mn.btn} disabled={isCurrent} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name="chevron-forward" size={20} color={isCurrent ? colors.border : colors.text} />
      </TouchableOpacity>
    </View>
  );
}
const mn = StyleSheet.create({
  row:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: Radii.lg, borderWidth: 1, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  btn:   { padding: Spacing.xs },
  label: { fontFamily: Fonts.semibold, fontSize: 16 },
});

// ── Overview Tab ──────────────────────────────────────────────────────────────
function OverviewTab({ expenses, budget, onSetBudget, onAdd, onEdit, onRepeat, colors }: {
  expenses: Expense[]; budget: number;
  onSetBudget: () => void; onAdd: () => void;
  onEdit: (e: Expense) => void;
  onRepeat: (e: Expense) => void;
  colors: Colors;
}) {
  const month = currentMonthKey();
  const monthExpenses = expenses.filter(e => e.date.startsWith(month));
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const count = monthExpenses.length;
  const daysInM      = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
  const dayOfMonth   = new Date().getDate();
  const dailyAvg     = dayOfMonth > 0 ? total / dayOfMonth : 0;
  const progress     = budget > 0 ? Math.min(total / budget, 1) : 0;
  const overBudget   = budget > 0 && total > budget;
  // FIX #3: 80% warning threshold
  const nearBudget   = budget > 0 && !overBudget && total >= budget * 0.8;

  // FIX #4: Quick Repeat — last 3 unique expenses (deduplicated by amount+category+note)
  const recentUnique = useMemo(() => {
    const seen = new Set<string>();
    const result: Expense[] = [];
    const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
    for (const e of sorted) {
      const key = `${e.amount}|${e.categoryId}|${e.note}`;
      if (!seen.has(key)) { seen.add(key); result.push(e); }
      if (result.length === 3) break;
    }
    return result;
  }, [expenses]);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={ov.scroll}>
      {/* Budget card */}
      <View style={[ov.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={ov.cardRow}>
          <View>
            <Text style={[ov.cardLabel, { color: colors.textMuted }]}>
              {monthLabel(month)} Spending
            </Text>
            <Text style={[ov.cardTotal, { color: colors.text }]}>{fmtFull(total)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            {budget > 0 ? (
              <TouchableOpacity onPress={onSetBudget} style={[ov.budgetBadge, { backgroundColor: (overBudget ? '#EF444420' : ACCENT + '18'), borderColor: overBudget ? '#EF4444' : ACCENT }]}>
                <Text style={[ov.budgetBadgeTxt, { color: overBudget ? '#EF4444' : ACCENT }]}>
                  Budget {fmtINR(budget)}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={onSetBudget} style={[ov.budgetBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="add" size={13} color={colors.textMuted} />
                <Text style={[ov.budgetBadgeTxt, { color: colors.textMuted }]}>Set Budget</Text>
              </TouchableOpacity>
            )}
            {/* FIX #3: Approaching budget warning badge */}
            {nearBudget && (
              <View style={[ov.warningBadge, { backgroundColor: '#F59E0B20', borderColor: '#F59E0B' }]}>
                <Ionicons name="warning-outline" size={11} color="#F59E0B" />
                <Text style={[ov.warningTxt, { color: '#F59E0B' }]}>Approaching limit</Text>
              </View>
            )}
          </View>
        </View>

        {budget > 0 && (
          <>
            <View style={[ov.barTrack, { backgroundColor: colors.border }]}>
              <View style={[ov.barFill, { width: `${progress * 100}%`, backgroundColor: overBudget ? '#EF4444' : nearBudget ? '#F59E0B' : '#10B981' }]} />
            </View>
            <Text style={[ov.budgetSub, { color: overBudget ? '#EF4444' : nearBudget ? '#F59E0B' : '#10B981' }]}>
              {overBudget
                ? `Over budget by ${fmtFull(total - budget)}`
                : `${fmtFull(budget - total)} remaining`}
            </Text>
          </>
        )}
      </View>

      {/* Stats row */}
      <View style={ov.statsRow}>
        {[
          { label: 'Transactions', val: String(count), icon: 'list-outline' },
          { label: 'Daily Avg',    val: fmtINR(dailyAvg), icon: 'stats-chart-outline' },
          { label: 'Days Left',    val: String(daysInM - dayOfMonth), icon: 'calendar-outline' },
        ].map(s => (
          <View key={s.label} style={[ov.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={s.icon as any} size={16} color={ACCENT} />
            <Text style={[ov.statVal, { color: colors.text }]}>{s.val}</Text>
            <Text style={[ov.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick add */}
      <TouchableOpacity style={[ov.addBtn, { backgroundColor: ACCENT }]} onPress={onAdd}>
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={ov.addBtnTxt}>Add Expense</Text>
      </TouchableOpacity>

      {/* FIX #4: Quick Repeat section */}
      {recentUnique.length > 0 && (
        <>
          <Text style={[ov.sectionTitle, { color: colors.textMuted }]}>Quick Repeat</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ov.repeatRow}>
            {recentUnique.map(e => {
              const cat = getCat(e.categoryId);
              return (
                <TouchableOpacity
                  key={e.id}
                  style={[ov.repeatChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => onRepeat(e)}
                  activeOpacity={0.7}
                >
                  <View style={[ov.repeatIcon, { backgroundColor: cat.color + '22' }]}>
                    <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[ov.repeatLabel, { color: colors.text }]} numberOfLines={1}>
                      {e.note || cat.label}
                    </Text>
                    <Text style={[ov.repeatAmt, { color: ACCENT }]}>{fmtFull(e.amount)}</Text>
                  </View>
                  <Ionicons name="refresh-outline" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      )}

      {/* Recent */}
      {monthExpenses.length > 0 && (
        <>
          <Text style={[ov.sectionTitle, { color: colors.textMuted }]}>Recent Expenses</Text>
          {[...monthExpenses]
            .sort((a, b) => b.date.localeCompare(a.date))
            .slice(0, 6)
            .map(e => <ExpenseRow key={e.id} item={e} onPress={() => onEdit(e)} colors={colors} />)}
        </>
      )}

      {monthExpenses.length === 0 && (
        <View style={ov.empty}>
          <Ionicons name="wallet-outline" size={52} color={colors.textMuted} />
          <Text style={[ov.emptyTxt, { color: colors.textMuted }]}>No expenses this month.{'\n'}Tap "Add Expense" to start.</Text>
        </View>
      )}
    </ScrollView>
  );
}

const ov = StyleSheet.create({
  scroll:          { paddingBottom: Spacing.huge },
  card:            { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  cardRow:         { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: Spacing.md },
  cardLabel:       { fontFamily: Fonts.regular, fontSize: 12, marginBottom: 4 },
  cardTotal:       { fontFamily: Fonts.bold, fontSize: 30 },
  budgetBadge:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1.5 },
  budgetBadgeTxt:  { fontFamily: Fonts.semibold, fontSize: 12 },
  warningBadge:    { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill, borderWidth: 1.5 },
  warningTxt:      { fontFamily: Fonts.semibold, fontSize: 11 },
  barTrack:        { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 6 },
  barFill:         { height: '100%', borderRadius: 4 },
  budgetSub:       { fontFamily: Fonts.medium, fontSize: 12 },
  statsRow:        { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statTile:        { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, gap: 4 },
  statVal:         { fontFamily: Fonts.bold, fontSize: 16 },
  statLabel:       { fontFamily: Fonts.regular, fontSize: 10, textAlign: 'center' },
  addBtn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: Radii.lg, marginBottom: Spacing.lg },
  addBtnTxt:       { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
  sectionTitle:    { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  repeatRow:       { gap: Spacing.sm, paddingBottom: Spacing.sm },
  repeatChip:      { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.sm, borderRadius: Radii.lg, borderWidth: 1, width: 160, marginBottom: Spacing.sm },
  repeatIcon:      { width: 28, height: 28, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
  repeatLabel:     { fontFamily: Fonts.medium, fontSize: 12 },
  repeatAmt:       { fontFamily: Fonts.bold, fontSize: 13 },
  empty:           { alignItems: 'center', paddingTop: 48, gap: Spacing.md },
  emptyTxt:        { fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab({ expenses, month, onMonthChange, onEdit, colors }: {
  expenses: Expense[]; month: string;
  onMonthChange: (m: string) => void;
  onEdit: (e: Expense) => void; colors: Colors;
}) {
  // FIX #6: Search state
  const [search, setSearch] = useState('');

  const monthExpenses = [...expenses.filter(e => e.date.startsWith(month))].sort((a, b) => b.date.localeCompare(a.date));

  // Apply search filter
  const filtered = search.trim()
    ? monthExpenses.filter(e => {
        const q = search.trim().toLowerCase();
        const cat = getCat(e.categoryId);
        return (
          e.note.toLowerCase().includes(q) ||
          cat.label.toLowerCase().includes(q) ||
          String(e.amount).includes(q)
        );
      })
    : monthExpenses;

  // Group by date
  const groups: { date: string; items: Expense[] }[] = [];
  for (const e of filtered) {
    const last = groups[groups.length - 1];
    if (last && last.date === e.date) last.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }

  const monthTotal = filtered.reduce((s, e) => s + e.amount, 0);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.huge }}>
      <MonthNav month={month} onChange={(m) => { setSearch(''); onMonthChange(m); }} colors={colors} />

      {/* FIX #6: Search bar */}
      <View style={[ht.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[ht.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by note, category or amount…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {filtered.length > 0 && (
        <View style={[ht.totalRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[ht.totalLabel, { color: colors.textMuted }]}>
            {search.trim() ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}` : 'Total spent'}
          </Text>
          <Text style={[ht.totalVal, { color: ACCENT }]}>{fmtFull(monthTotal)}</Text>
        </View>
      )}

      {groups.map(g => (
        <View key={g.date} style={{ marginBottom: Spacing.sm }}>
          <View style={ht.dateRow}>
            <Text style={[ht.dateLabel, { color: colors.textMuted }]}>{shortDate(g.date)}</Text>
            <Text style={[ht.dateSub, { color: colors.textMuted }]}>{fmtFull(g.items.reduce((s, e) => s + e.amount, 0))}</Text>
          </View>
          {g.items.map(e => <ExpenseRow key={e.id} item={e} onPress={() => onEdit(e)} colors={colors} />)}
        </View>
      ))}

      {filtered.length === 0 && (
        <View style={ov.empty}>
          <Ionicons name={search.trim() ? 'search-outline' : 'receipt-outline'} size={52} color={colors.textMuted} />
          <Text style={[ov.emptyTxt, { color: colors.textMuted }]}>
            {search.trim() ? `No results for "${search}"` : `No expenses in ${monthLabel(month)}.`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
const ht = StyleSheet.create({
  totalRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md },
  totalLabel:  { fontFamily: Fonts.medium, fontSize: 13 },
  totalVal:    { fontFamily: Fonts.bold, fontSize: 18 },
  dateRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dateLabel:   { fontFamily: Fonts.semibold, fontSize: 13 },
  dateSub:     { fontFamily: Fonts.medium, fontSize: 12 },
  searchWrap:  { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radii.lg, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 44, marginBottom: Spacing.md },
  searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 14 },
});

// ── Donut Chart ───────────────────────────────────────────────────────────────
// FIX #2: Horizontal stacked bar as donut-style category visualization
function DonutChart({ catRows, total, colors }: {
  catRows: { cat: Category; total: number }[];
  total: number;
  colors: Colors;
}) {
  if (catRows.length === 0 || total === 0) return null;
  const SIZE = 140;
  const STROKE = 22;

  // Build arc segments using a stacked horizontal bar (simpler, reliable cross-platform)
  return (
    <View style={dc.wrap}>
      {/* Stacked bar visualization */}
      <View style={dc.stackedBar}>
        {catRows.map(({ cat, total: t }) => {
          const pct = total > 0 ? (t / total) * 100 : 0;
          return (
            <View
              key={cat.id}
              style={[dc.segment, { flex: pct, backgroundColor: cat.color }]}
            />
          );
        })}
      </View>

      {/* Legend */}
      <View style={dc.legend}>
        {catRows.slice(0, 6).map(({ cat, total: t }) => {
          const pct = total > 0 ? (t / total) * 100 : 0;
          return (
            <View key={cat.id} style={dc.legendItem}>
              <View style={[dc.legendDot, { backgroundColor: cat.color }]} />
              <Text style={[dc.legendLabel, { color: colors.text }]} numberOfLines={1}>
                {cat.label}
              </Text>
              <Text style={[dc.legendPct, { color: colors.textMuted }]}>
                {pct.toFixed(0)}%
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
const dc = StyleSheet.create({
  wrap:        { marginBottom: Spacing.lg },
  stackedBar:  { flexDirection: 'row', height: 20, borderRadius: 10, overflow: 'hidden', marginBottom: Spacing.md },
  segment:     { minWidth: 2 },
  legend:      { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 5, minWidth: '45%', flex: 1 },
  legendDot:   { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: 12 },
  legendPct:   { fontFamily: Fonts.regular, fontSize: 11 },
});

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ expenses, month, onMonthChange, colors, allCategories }: {
  expenses: Expense[]; month: string;
  onMonthChange: (m: string) => void; colors: Colors;
  allCategories: readonly Category[];
}) {
  const monthExp   = expenses.filter(e => e.date.startsWith(month));
  const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);

  // Category breakdown — iterate over merged list so user-created categories
  // also surface in the analytics breakdown and donut chart.
  const catTotals: Record<string, number> = {};
  for (const e of monthExp) catTotals[e.categoryId] = (catTotals[e.categoryId] ?? 0) + e.amount;
  const catRows = allCategories
    .map(c => ({ cat: c, total: catTotals[c.id] ?? 0 }))
    .filter(r => r.total > 0)
    .sort((a, b) => b.total - a.total);

  // Monthly chart
  const months6 = last6Months();
  const monthlyTotals: Record<string, number> = {};
  for (const e of expenses) {
    const mk = e.date.slice(0, 7);
    monthlyTotals[mk] = (monthlyTotals[mk] ?? 0) + e.amount;
  }
  const maxMonthly = Math.max(...months6.map(m => monthlyTotals[m] ?? 0), 1);
  const BAR_MAX_H = 80;
  const SHORT_MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];

  // FIX #7: Month-over-month comparison
  const prevMon    = prevMonth(month);
  const prevTotal  = expenses
    .filter(e => e.date.startsWith(prevMon))
    .reduce((s, e) => s + e.amount, 0);
  const momDiff    = monthTotal - prevTotal;
  const momPct     = prevTotal > 0 ? (momDiff / prevTotal) * 100 : null;
  const momUp      = momDiff > 0;

  // FIX #5: Daily spending for selected month
  const numDays  = daysInMonth(month);
  const dailyMap: Record<number, number> = {};
  for (const e of monthExp) {
    const day = parseInt(e.date.split('-')[2], 10);
    dailyMap[day] = (dailyMap[day] ?? 0) + e.amount;
  }
  const maxDaily = Math.max(...Object.values(dailyMap), 1);
  const DAILY_BAR_MAX = 50;

  // Per-category 6-month trend. Defaults to the top-spending category for the
  // selected month; tapping a row in the breakdown swaps the trend chart's
  // subject without leaving the screen.
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const effectiveCatId = selectedCatId ?? catRows[0]?.cat.id ?? null;
  // If the previously selected category drops out of view (e.g. user changed
  // months and that category has no spend in any of the visible 6 months),
  // fall back to the top spender silently.
  useEffect(() => {
    if (selectedCatId && !allCategories.some(c => c.id === selectedCatId)) {
      setSelectedCatId(null);
    }
  }, [allCategories, selectedCatId]);

  const trendCat = effectiveCatId ? allCategories.find(c => c.id === effectiveCatId) ?? null : null;
  const trendSeries = effectiveCatId
    ? months6.map(m => ({
        month: m,
        total: expenses
          .filter(e => e.date.startsWith(m) && e.categoryId === effectiveCatId)
          .reduce((s, e) => s + e.amount, 0),
      }))
    : [];
  const trendMax = Math.max(...trendSeries.map(s => s.total), 1);
  const trendHasData = trendSeries.some(s => s.total > 0);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.huge }}>
      <MonthNav month={month} onChange={onMonthChange} colors={colors} />

      {/* FIX #7: Month-over-month card */}
      <View style={[an.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[an.cardTitle, { color: colors.text }]}>vs Last Month ({monthLabel(prevMon)})</Text>
        {prevTotal === 0 && monthTotal === 0 ? (
          <Text style={[an.emptyTxt, { color: colors.textMuted }]}>No data for comparison.</Text>
        ) : (
          <View style={an.momRow}>
            <View style={an.momCol}>
              <Text style={[an.momCaption, { color: colors.textMuted }]}>{monthLabel(prevMon)}</Text>
              <Text style={[an.momVal, { color: colors.text }]}>{fmtFull(prevTotal)}</Text>
            </View>
            <View style={an.momArrow}>
              <Ionicons
                name={momUp ? 'arrow-up' : 'arrow-down'}
                size={20}
                color={momUp ? '#EF4444' : '#10B981'}
              />
              {momPct !== null ? (
                <Text style={[an.momPct, { color: momUp ? '#EF4444' : '#10B981' }]}>
                  {momUp ? '+' : ''}{momPct.toFixed(1)}%
                </Text>
              ) : (
                <Text style={[an.momPct, { color: momUp ? '#EF4444' : '#10B981' }]}>New</Text>
              )}
            </View>
            <View style={[an.momCol, { alignItems: 'flex-end' }]}>
              <Text style={[an.momCaption, { color: colors.textMuted }]}>{monthLabel(month)}</Text>
              <Text style={[an.momVal, { color: colors.text }]}>{fmtFull(monthTotal)}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Monthly chart */}
      <View style={[an.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[an.cardTitle, { color: colors.text }]}>Monthly Spending</Text>
        <View style={[an.chartWrap, { height: BAR_MAX_H + 48 }]}>
          {months6.map(m => {
            const val = monthlyTotals[m] ?? 0;
            const barH = Math.max((val / maxMonthly) * BAR_MAX_H, val > 0 ? 4 : 0);
            const active = m === month;
            const [,mo] = m.split('-').map(Number);
            return (
              <TouchableOpacity key={m} style={an.barCol} onPress={() => onMonthChange(m)} activeOpacity={0.7}>
                <Text style={[an.barAmt, { color: active ? ACCENT : colors.textMuted }]} numberOfLines={1}>
                  {val > 0 ? fmtINR(val) : ''}
                </Text>
                <View style={[an.barTrack, { height: BAR_MAX_H }]}>
                  <View style={[an.barFill, { height: barH, backgroundColor: active ? ACCENT : ACCENT + '55' }]} />
                </View>
                <Text style={[an.barLabel, { color: active ? ACCENT : colors.textMuted, fontFamily: active ? Fonts.bold : Fonts.regular }]}>
                  {SHORT_MONTHS[mo - 1]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* FIX #5: Daily spending chart */}
      <View style={[an.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[an.cardTitle, { color: colors.text }]}>Daily Spending — {monthLabel(month)}</Text>
        {monthExp.length === 0 ? (
          <Text style={[an.emptyTxt, { color: colors.textMuted }]}>No data for {monthLabel(month)}.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[an.dailyChartWrap, { height: DAILY_BAR_MAX + 32 }]}>
              {Array.from({ length: numDays }, (_, i) => i + 1).map(day => {
                const val = dailyMap[day] ?? 0;
                const barH = val > 0 ? Math.max((val / maxDaily) * DAILY_BAR_MAX, 3) : 0;
                const today = new Date().getDate();
                const isToday = month === currentMonthKey() && day === today;
                return (
                  <View key={day} style={an.dailyBarCol}>
                    <View style={[an.dailyBarTrack, { height: DAILY_BAR_MAX }]}>
                      <View style={[an.dailyBarFill, {
                        height: barH,
                        backgroundColor: isToday ? ACCENT : val > 0 ? ACCENT + '88' : 'transparent',
                      }]} />
                    </View>
                    <Text style={[an.dailyLabel, { color: isToday ? ACCENT : colors.textMuted, fontFamily: isToday ? Fonts.bold : Fonts.regular }]}>
                      {day}
                    </Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>

      {/* FIX #2: Donut/stacked chart + category breakdown */}
      <View style={[an.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[an.cardTitle, { color: colors.text }]}>By Category</Text>
        {catRows.length === 0 ? (
          <Text style={[an.emptyTxt, { color: colors.textMuted }]}>No data for {monthLabel(month)}.</Text>
        ) : (
          <>
            <DonutChart catRows={catRows} total={monthTotal} colors={colors} />
            {catRows.map(({ cat, total }) => {
              const pct = monthTotal > 0 ? (total / monthTotal) * 100 : 0;
              const isSelected = effectiveCatId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  style={[
                    an.catRow,
                    isSelected && { backgroundColor: cat.color + '12', borderRadius: Radii.md, padding: 6, marginHorizontal: -6 },
                  ]}
                  onPress={() => setSelectedCatId(cat.id)}
                  activeOpacity={0.7}
                >
                  <View style={an.catMeta}>
                    <View style={[an.catDot, { backgroundColor: cat.color }]} />
                    <Text style={[an.catName, { color: colors.text }]}>{cat.label}</Text>
                    <Text style={[an.catPct, { color: colors.textMuted }]}>{pct.toFixed(1)}%</Text>
                    <Text style={[an.catAmt, { color: colors.text }]}>{fmtFull(total)}</Text>
                  </View>
                  <View style={[an.catBarTrack, { backgroundColor: colors.border }]}>
                    <View style={[an.catBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
                  </View>
                </TouchableOpacity>
              );
            })}
            <Text style={[an.catHint, { color: colors.textMuted }]}>
              Tap a category to see its 6-month trend below.
            </Text>
          </>
        )}
      </View>

      {/* Per-category trend chart */}
      {trendCat && (
        <View style={[an.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={an.trendHeader}>
            <Ionicons name={trendCat.icon as any} size={18} color={trendCat.color} />
            <Text style={[an.cardTitle, { color: colors.text, marginBottom: 0, flex: 1 }]}>
              {trendCat.label} — 6-Month Trend
            </Text>
          </View>
          {!trendHasData ? (
            <Text style={[an.emptyTxt, { color: colors.textMuted }]}>
              No spending in {trendCat.label} over the last 6 months.
            </Text>
          ) : (
            <View style={[an.chartWrap, { height: BAR_MAX_H + 48, marginTop: Spacing.md }]}>
              {trendSeries.map(s => {
                const barH = Math.max((s.total / trendMax) * BAR_MAX_H, s.total > 0 ? 4 : 0);
                const active = s.month === month;
                const [, mo] = s.month.split('-').map(Number);
                return (
                  <TouchableOpacity
                    key={s.month}
                    style={an.barCol}
                    onPress={() => onMonthChange(s.month)}
                    activeOpacity={0.7}
                  >
                    <Text style={[an.barAmt, { color: active ? trendCat.color : colors.textMuted }]} numberOfLines={1}>
                      {s.total > 0 ? fmtINR(s.total) : ''}
                    </Text>
                    <View style={[an.barTrack, { height: BAR_MAX_H }]}>
                      <View style={[an.barFill, { height: barH, backgroundColor: active ? trendCat.color : trendCat.color + '55' }]} />
                    </View>
                    <Text style={[an.barLabel, { color: active ? trendCat.color : colors.textMuted, fontFamily: active ? Fonts.bold : Fonts.regular }]}>
                      {SHORT_MONTHS[mo - 1]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Top category insight */}
      {catRows.length > 0 && (
        <View style={[an.insightCard, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '40' }]}>
          <Ionicons name="trending-up" size={18} color={ACCENT} />
          <Text style={[an.insightTxt, { color: ACCENT }]}>
            Top spend: <Text style={{ fontFamily: Fonts.bold }}>{catRows[0].cat.label}</Text> — {fmtFull(catRows[0].total)} ({((catRows[0].total / monthTotal) * 100).toFixed(0)}% of total)
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const an = StyleSheet.create({
  card:           { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  cardTitle:      { fontFamily: Fonts.bold, fontSize: 15, marginBottom: Spacing.lg },
  chartWrap:      { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barCol:         { flex: 1, alignItems: 'center', gap: 4 },
  barAmt:         { fontFamily: Fonts.regular, fontSize: 9, textAlign: 'center', height: 14 },
  barTrack:       { width: '100%', justifyContent: 'flex-end' },
  barFill:        { width: '100%', borderRadius: 3, minHeight: 0 },
  barLabel:       { fontSize: 12 },
  // Month-over-month
  momRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  momCol:         { flex: 1 },
  momArrow:       { alignItems: 'center', paddingHorizontal: Spacing.sm },
  momCaption:     { fontFamily: Fonts.regular, fontSize: 11, marginBottom: 2 },
  momVal:         { fontFamily: Fonts.bold, fontSize: 16 },
  momPct:         { fontFamily: Fonts.bold, fontSize: 13 },
  // Daily chart
  dailyChartWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  dailyBarCol:    { alignItems: 'center', width: 12 },
  dailyBarTrack:  { width: '100%', justifyContent: 'flex-end' },
  dailyBarFill:   { width: '100%', borderRadius: 2 },
  dailyLabel:     { fontSize: 8, marginTop: 2 },
  // Category
  catRow:         { marginBottom: Spacing.md },
  catMeta:        { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  catDot:         { width: 10, height: 10, borderRadius: 5 },
  catName:        { flex: 1, fontFamily: Fonts.medium, fontSize: 13 },
  catPct:         { fontFamily: Fonts.regular, fontSize: 12 },
  catAmt:         { fontFamily: Fonts.bold, fontSize: 13 },
  catBarTrack:    { height: 8, borderRadius: 4, overflow: 'hidden' },
  catBarFill:     { height: '100%', borderRadius: 4 },
  catHint:        { fontFamily: Fonts.regular, fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 4 },
  // Per-category trend chart
  trendHeader:    { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  insightCard:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1 },
  insightTxt:     { flex: 1, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20 },
  emptyTxt:       { fontFamily: Fonts.regular, fontSize: 13, textAlign: 'center', paddingVertical: Spacing.lg },
});

// ── Budget Modal ──────────────────────────────────────────────────────────────
function BudgetModal({ budget, onSave, onClose, colors, currencySymbol }: {
  budget: number; onSave: (n: number) => void; onClose: () => void; colors: Colors; currencySymbol: string;
}) {
  const [val, setVal] = useState(budget > 0 ? String(budget) : '');
  const save = () => {
    const n = parseFloat(val);
    if (isNaN(n) || n < 0) { Alert.alert('Invalid', 'Enter a valid budget amount.'); return; }
    onSave(n); onClose();
  };
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={bm.overlay}>
        <View style={[bm.box, { backgroundColor: colors.card }]}>
          <Text style={[bm.title, { color: colors.text }]}>Monthly Budget</Text>
          <Text style={[bm.sub, { color: colors.textMuted }]}>Set your total spending limit for the month</Text>
          <View style={[bm.inputWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[bm.rupee, { color: ACCENT }]}>{currencySymbol}</Text>
            <TextInput
              style={[bm.input, { color: colors.text }]}
              value={val}
              onChangeText={setVal}
              placeholder="e.g. 15000"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
          <View style={bm.btnRow}>
            <TouchableOpacity style={[bm.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
              <Text style={[bm.cancelTxt, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[bm.saveBtn, { backgroundColor: ACCENT }]} onPress={save}>
              <Text style={bm.saveTxt}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
const bm = StyleSheet.create({
  overlay:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  box:       { width: '100%', borderRadius: Radii.xl, padding: Spacing.xl },
  title:     { fontFamily: Fonts.bold, fontSize: 18, marginBottom: 4 },
  sub:       { fontFamily: Fonts.regular, fontSize: 13, marginBottom: Spacing.lg, lineHeight: 20 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.lg, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 56, marginBottom: Spacing.lg },
  rupee:     { fontFamily: Fonts.bold, fontSize: 22, marginRight: 4 },
  input:     { flex: 1, fontFamily: Fonts.bold, fontSize: 24 },
  btnRow:    { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, height: 44, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  cancelTxt: { fontFamily: Fonts.semibold, fontSize: 14 },
  saveBtn:   { flex: 1, height: 44, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
  saveTxt:   { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
});

// ── Settings Sheet ────────────────────────────────────────────────────────────
function SettingsSheet({
  colors, currencySymbol, expenseCount,
  onPickCurrency, onExport, onClose,
}: {
  colors: Colors;
  currencySymbol: string;
  expenseCount: number;
  onPickCurrency: () => void;
  onExport: () => void;
  onClose: () => void;
}) {
  const ss = useMemo(() => settingsSt(colors), [colors]);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={ss.overlay}>
        <TouchableOpacity style={ss.dismiss} activeOpacity={1} onPress={onClose} />
        <View style={[ss.sheet, { backgroundColor: colors.surface }]}>
          <View style={[ss.handle, { backgroundColor: colors.border }]} />
          <Text style={[ss.title, { color: colors.text }]}>Settings</Text>

          <TouchableOpacity
            style={[ss.row, { borderColor: colors.border }]}
            onPress={() => { onClose(); onPickCurrency(); }}
            activeOpacity={0.7}
          >
            <View style={[ss.iconWrap, { backgroundColor: ACCENT + '18' }]}>
              <Text style={{ fontSize: 18, fontFamily: Fonts.bold, color: ACCENT }}>{currencySymbol}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ss.rowTitle, { color: colors.text }]}>Currency</Text>
              <Text style={[ss.rowSub, { color: colors.textMuted }]}>
                Change the symbol used across the tracker
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[ss.row, { borderColor: colors.border }]}
            onPress={() => { onClose(); onExport(); }}
            activeOpacity={0.7}
            disabled={expenseCount === 0}
          >
            <View style={[ss.iconWrap, { backgroundColor: ACCENT + '18' }]}>
              <Ionicons name="download-outline" size={18} color={ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[ss.rowTitle, { color: expenseCount === 0 ? colors.textMuted : colors.text }]}>
                Export expenses
              </Text>
              <Text style={[ss.rowSub, { color: colors.textMuted }]}>
                {expenseCount === 0
                  ? 'No expenses to export yet'
                  : `Copy ${expenseCount} expense${expenseCount === 1 ? '' : 's'} as CSV`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[ss.closeBtn, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[ss.closeTxt, { color: colors.textMuted }]}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const settingsSt = (c: Colors) => StyleSheet.create({
  overlay:  { flex: 1, justifyContent: 'flex-end' },
  dismiss:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:    { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.lg, paddingBottom: 36 },
  handle:   { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },
  title:    { fontFamily: Fonts.bold, fontSize: 18, marginBottom: Spacing.lg },
  row:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.sm },
  iconWrap: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: Fonts.semibold, fontSize: 14, marginBottom: 2 },
  rowSub:   { fontFamily: Fonts.regular, fontSize: 12 },
  closeBtn: { height: 44, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginTop: Spacing.sm },
  closeTxt: { fontFamily: Fonts.semibold, fontSize: 14 },
});

// ── Add / Edit Transfer Sheet ─────────────────────────────────────────────────
function AddTransferSheet({ initial, onSave, onDelete, onClose, colors, currencySymbol }: {
  initial: Transfer | null;
  onSave: (t: Transfer) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  colors: Colors;
  currencySymbol: string;
}) {
  const isEdit = initial !== null;
  const [amount,    setAmount]    = useState(initial ? String(initial.amount) : '');
  const [kind,      setKind]      = useState<TransferKind>(initial?.kind ?? 'lent');
  const [recipient, setRecipient] = useState(initial?.recipient ?? '');
  const [note,      setNote]      = useState(initial?.note ?? '');
  const [returned,  setReturned]  = useState(initial?.returned ?? false);
  const [dateMode,  setDateMode]  = useState<'today'|'yesterday'|'custom'>(() => {
    if (!initial) return 'today';
    if (initial.date === todayISO())     return 'today';
    if (initial.date === yesterdayISO()) return 'yesterday';
    return 'custom';
  });
  const [customDate, setCustomDate] = useState(initial?.date ?? todayISO());

  const resolvedDate = dateMode === 'today' ? todayISO()
    : dateMode === 'yesterday' ? yesterdayISO()
    : customDate;

  const handleSave = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { Alert.alert('Invalid amount', 'Please enter a valid amount.'); return; }
    if (!recipient.trim()) {
      Alert.alert(
        'Recipient required',
        kind === 'investment' ? 'Add an investment name (e.g. "Mutual Fund X").' : 'Who did the money go to?',
      );
      return;
    }
    if (dateMode === 'custom' && !/^\d{4}-\d{2}-\d{2}$/.test(customDate)) {
      Alert.alert('Invalid date', 'Use format YYYY-MM-DD'); return;
    }
    onSave({
      id: initial?.id ?? uid(),
      amount: amt,
      kind,
      recipient: recipient.trim(),
      note: note.trim(),
      date: resolvedDate,
      // Investments and "other" are not pay-back-able, force `returned: false`
      // so the toggle state can't poison summary numbers.
      returned: kind === 'lent' ? returned : false,
      returnedDate: kind === 'lent' && returned
        ? (initial?.returnedDate ?? todayISO())
        : undefined,
    });
  };

  const s = useMemo(() => sheetSt(colors), [colors]);

  const recipientPlaceholder =
    kind === 'lent'       ? 'Friend or family member'
    : kind === 'investment' ? 'Investment name'
    :                       'Where did it go?';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.dismiss} activeOpacity={1} onPress={onClose} />
        <ScrollView style={[s.sheet, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <Text style={[s.title, { color: colors.text }]}>{isEdit ? 'Edit Transfer' : 'Add Transfer'}</Text>

          {/* Amount */}
          <View style={[s.amountWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <Text style={[s.rupee, { color: ACCENT }]}>{currencySymbol}</Text>
            <TextInput
              style={[s.amountInput, { color: colors.text }]}
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.textMuted}
              keyboardType="decimal-pad"
              autoFocus={!isEdit}
            />
          </View>

          {/* Kind */}
          <Text style={[s.label, { color: colors.textMuted }]}>Type</Text>
          <View style={s.catGrid}>
            {TRANSFER_KINDS.map(k => {
              const active = kind === k.id;
              return (
                <TouchableOpacity
                  key={k.id}
                  style={[s.catPill, { borderColor: active ? k.color : colors.border, backgroundColor: active ? k.color + '22' : colors.inputBg }]}
                  onPress={() => setKind(k.id)}
                >
                  <Ionicons name={k.icon as any} size={13} color={active ? k.color : colors.textMuted} />
                  <Text style={[s.catPillTxt, { color: active ? k.color : colors.textMuted }]}>{k.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Recipient */}
          <Text style={[s.label, { color: colors.textMuted }]}>
            {kind === 'investment' ? 'Investment Name' : 'Recipient'}
          </Text>
          <TextInput
            style={[s.noteInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={recipient}
            onChangeText={setRecipient}
            placeholder={recipientPlaceholder}
            placeholderTextColor={colors.textMuted}
          />

          {/* Note */}
          <Text style={[s.label, { color: colors.textMuted }]}>Note</Text>
          <TextInput
            style={[s.noteInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={colors.textMuted}
          />

          {/* Date */}
          <Text style={[s.label, { color: colors.textMuted }]}>Date</Text>
          <View style={s.dateRow}>
            {(['today', 'yesterday', 'custom'] as const).map(mode => (
              <TouchableOpacity
                key={mode}
                style={[s.datePill, { borderColor: dateMode === mode ? ACCENT : colors.border, backgroundColor: dateMode === mode ? ACCENT + '18' : colors.inputBg }]}
                onPress={() => setDateMode(mode)}
              >
                <Text style={[s.datePillTxt, { color: dateMode === mode ? ACCENT : colors.textMuted }]}>
                  {mode === 'today' ? 'Today' : mode === 'yesterday' ? 'Yesterday' : 'Other'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {dateMode === 'custom' && (
            <View style={{ paddingHorizontal: Spacing.lg, marginTop: 6 }}>
              <DateField
                value={customDate}
                onChange={setCustomDate}
                accent={ACCENT}
                placeholder="Pick a date"
              />
            </View>
          )}

          {/* Returned toggle — only meaningful for "lent" */}
          {kind === 'lent' && (
            <TouchableOpacity
              style={[ts.returnedRow, { backgroundColor: returned ? '#10B98118' : colors.inputBg, borderColor: returned ? '#10B981' : colors.border }]}
              onPress={() => setReturned(v => !v)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={returned ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={returned ? '#10B981' : colors.textMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={[ts.returnedTitle, { color: returned ? '#10B981' : colors.text }]}>
                  {returned ? 'Marked as returned' : 'Mark as returned'}
                </Text>
                <Text style={[ts.returnedSub, { color: colors.textMuted }]}>
                  {returned
                    ? 'This loan is settled.'
                    : 'Toggle once the borrower pays you back.'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Actions */}
          <View style={[s.btnRow, { paddingBottom: 36 }]}>
            {isEdit && onDelete && (
              <TouchableOpacity
                style={[s.delBtn, { borderColor: '#EF4444' }]}
                onPress={() => Alert.alert('Delete', 'Remove this transfer?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { onDelete(initial!.id); onClose(); } },
                ])}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: ACCENT }]} onPress={handleSave}>
              <Text style={s.saveTxt}>{isEdit ? 'Save Changes' : 'Add Transfer'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

// ── Transfers Tab ─────────────────────────────────────────────────────────────
function TransfersTab({ transfers, onAdd, onEdit, onToggleReturned, colors }: {
  transfers: Transfer[];
  onAdd: () => void;
  onEdit: (t: Transfer) => void;
  onToggleReturned: (id: string) => void;
  colors: Colors;
}) {
  // Aggregate buckets — these power the summary tiles up top.
  const lentPending      = transfers.filter(t => t.kind === 'lent' && !t.returned);
  const lentReturned     = transfers.filter(t => t.kind === 'lent' && t.returned);
  const investments      = transfers.filter(t => t.kind === 'investment');
  const otherTransfers   = transfers.filter(t => t.kind === 'other');

  const sumOf = (xs: Transfer[]) => xs.reduce((s, t) => s + t.amount, 0);

  const totalLentPending  = sumOf(lentPending);
  const totalLentReturned = sumOf(lentReturned);
  const totalInvested     = sumOf(investments);

  // Group everything by kind for the list, sorted newest first inside each.
  const groups = [
    { id: 'lent',       label: 'Lent',         items: [...lentPending, ...lentReturned] },
    { id: 'investment', label: 'Investments',  items: [...investments] },
    { id: 'other',      label: 'Other',        items: [...otherTransfers] },
  ]
    .map(g => ({ ...g, items: g.items.sort((a, b) => b.date.localeCompare(a.date)) }))
    .filter(g => g.items.length > 0);

  // 6-month stacked-bar series. Each bar shows lent + invested + other for a
  // single month so the user can scan their outflow pattern at a glance.
  const months6 = last6Months();
  const SHORT_MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D'];
  const series = months6.map(m => {
    const monthT = transfers.filter(t => t.date.startsWith(m));
    return {
      month: m,
      lent:     monthT.filter(t => t.kind === 'lent').reduce((s, t) => s + t.amount, 0),
      invested: monthT.filter(t => t.kind === 'investment').reduce((s, t) => s + t.amount, 0),
      other:    monthT.filter(t => t.kind === 'other').reduce((s, t) => s + t.amount, 0),
    };
  });
  const maxMonthly = Math.max(...series.map(s => s.lent + s.invested + s.other), 1);
  const BAR_MAX_H  = 80;
  const hasAnySeriesData = series.some(s => s.lent + s.invested + s.other > 0);

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={tt.scroll}>
      {/* Summary tiles */}
      <View style={tt.statsRow}>
        <View style={[tt.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="time-outline" size={16} color="#F97316" />
          <Text style={[tt.statVal, { color: colors.text }]}>{fmtINR(totalLentPending)}</Text>
          <Text style={[tt.statLabel, { color: colors.textMuted }]}>Lent — Pending</Text>
        </View>
        <View style={[tt.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="trending-up-outline" size={16} color="#10B981" />
          <Text style={[tt.statVal, { color: colors.text }]}>{fmtINR(totalInvested)}</Text>
          <Text style={[tt.statLabel, { color: colors.textMuted }]}>Invested</Text>
        </View>
        <View style={[tt.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle-outline" size={16} color="#6366F1" />
          <Text style={[tt.statVal, { color: colors.text }]}>{fmtINR(totalLentReturned)}</Text>
          <Text style={[tt.statLabel, { color: colors.textMuted }]}>Returned</Text>
        </View>
      </View>

      {/* 6-month outflow chart */}
      {hasAnySeriesData && (
        <View style={[tt.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[tt.chartTitle, { color: colors.text }]}>Last 6 Months</Text>
          <View style={[tt.chartWrap, { height: BAR_MAX_H + 38 }]}>
            {series.map(s => {
              const monthTotal = s.lent + s.invested + s.other;
              const lentH     = (s.lent     / maxMonthly) * BAR_MAX_H;
              const investedH = (s.invested / maxMonthly) * BAR_MAX_H;
              const otherH    = (s.other    / maxMonthly) * BAR_MAX_H;
              const [, mo]    = s.month.split('-').map(Number);
              return (
                <View key={s.month} style={tt.chartCol}>
                  <Text style={[tt.chartAmt, { color: colors.textMuted }]} numberOfLines={1}>
                    {monthTotal > 0 ? fmtINR(monthTotal) : ''}
                  </Text>
                  <View style={[tt.chartTrack, { height: BAR_MAX_H }]}>
                    {/* Stack order matches the legend below: other on top, then invested, then lent at the base. */}
                    {s.other > 0 && (
                      <View style={[tt.chartSeg, { height: Math.max(otherH, 2), backgroundColor: '#6366F1' }]} />
                    )}
                    {s.invested > 0 && (
                      <View style={[tt.chartSeg, { height: Math.max(investedH, 2), backgroundColor: '#10B981' }]} />
                    )}
                    {s.lent > 0 && (
                      <View style={[tt.chartSeg, { height: Math.max(lentH, 2), backgroundColor: '#F97316', borderBottomLeftRadius: 3, borderBottomRightRadius: 3 }]} />
                    )}
                  </View>
                  <Text style={[tt.chartLabel, { color: colors.textMuted }]}>{SHORT_MONTHS[mo - 1]}</Text>
                </View>
              );
            })}
          </View>
          {/* Legend */}
          <View style={tt.chartLegend}>
            <View style={tt.legendItem}>
              <View style={[tt.legendDot, { backgroundColor: '#F97316' }]} />
              <Text style={[tt.legendTxt, { color: colors.textMuted }]}>Lent</Text>
            </View>
            <View style={tt.legendItem}>
              <View style={[tt.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={[tt.legendTxt, { color: colors.textMuted }]}>Invested</Text>
            </View>
            <View style={tt.legendItem}>
              <View style={[tt.legendDot, { backgroundColor: '#6366F1' }]} />
              <Text style={[tt.legendTxt, { color: colors.textMuted }]}>Other</Text>
            </View>
          </View>
        </View>
      )}

      {/* Add transfer */}
      <TouchableOpacity style={[tt.addBtn, { backgroundColor: ACCENT }]} onPress={onAdd}>
        <Ionicons name="swap-horizontal-outline" size={20} color="#fff" />
        <Text style={tt.addBtnTxt}>Add Transfer</Text>
      </TouchableOpacity>

      {/* Grouped list */}
      {groups.map(g => (
        <View key={g.id} style={{ marginBottom: Spacing.md }}>
          <Text style={[tt.sectionTitle, { color: colors.textMuted }]}>{g.label}</Text>
          {g.items.map(t => {
            const k = getTransferKind(t.kind);
            const isLentPending = t.kind === 'lent' && !t.returned;
            return (
              <TouchableOpacity
                key={t.id}
                style={[tt.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => onEdit(t)}
                activeOpacity={0.8}
              >
                <View style={[tt.iconWrap, { backgroundColor: k.color + '20' }]}>
                  <Ionicons name={k.icon as any} size={20} color={k.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[tt.rowName, { color: colors.text }]} numberOfLines={1}>
                    {t.recipient}
                  </Text>
                  <View style={tt.rowSubRow}>
                    <Text style={[tt.rowSub, { color: colors.textMuted }]}>
                      {shortDate(t.date)}
                    </Text>
                    {t.kind === 'lent' && (
                      <View style={[
                        tt.statusBadge,
                        {
                          backgroundColor: t.returned ? '#10B98120' : '#F9731620',
                          borderColor: t.returned ? '#10B981' : '#F97316',
                        },
                      ]}>
                        <Text style={[tt.statusTxt, { color: t.returned ? '#10B981' : '#F97316' }]}>
                          {t.returned ? 'Returned' : 'Pending'}
                        </Text>
                      </View>
                    )}
                    {t.note ? (
                      <Text style={[tt.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                        · {t.note}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={[tt.amount, { color: colors.text }]}>{fmtFull(t.amount)}</Text>
                  {/* Quick toggle for pending lends — single tap to mark settled. */}
                  {isLentPending && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation(); onToggleReturned(t.id); }}
                      style={tt.markBtn}
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {transfers.length === 0 && (
        <View style={tt.empty}>
          <Ionicons name="swap-horizontal-outline" size={52} color={colors.textMuted} />
          <Text style={[tt.emptyTxt, { color: colors.textMuted }]}>
            No transfers yet.{'\n'}Track money you've lent, invested, or moved.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const tt = StyleSheet.create({
  scroll:        { paddingBottom: Spacing.huge },
  statsRow:      { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statTile:      { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, gap: 4 },
  statVal:       { fontFamily: Fonts.bold, fontSize: 14 },
  statLabel:     { fontFamily: Fonts.regular, fontSize: 10, textAlign: 'center' },
  // 6-month outflow chart
  chartCard:     { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  chartTitle:    { fontFamily: Fonts.bold, fontSize: 14, marginBottom: Spacing.md },
  chartWrap:     { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  chartCol:      { flex: 1, alignItems: 'center', gap: 4 },
  chartAmt:      { fontFamily: Fonts.regular, fontSize: 9, textAlign: 'center', height: 12 },
  chartTrack:    { width: '100%', justifyContent: 'flex-end', borderRadius: 3, overflow: 'hidden' },
  chartSeg:      { width: '100%' },
  chartLabel:    { fontFamily: Fonts.regular, fontSize: 11 },
  chartLegend:   { flexDirection: 'row', justifyContent: 'center', gap: Spacing.md, marginTop: Spacing.md },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:     { width: 9, height: 9, borderRadius: 4.5 },
  legendTxt:     { fontFamily: Fonts.medium, fontSize: 11 },
  addBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: Radii.lg, marginBottom: Spacing.lg },
  addBtnTxt:     { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
  sectionTitle:  { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
  row:           { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.sm },
  iconWrap:      { width: 42, height: 42, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  rowName:       { fontFamily: Fonts.semibold, fontSize: 14, marginBottom: 2 },
  rowSubRow:     { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  rowSub:        { fontFamily: Fonts.regular, fontSize: 12 },
  statusBadge:   { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.pill, borderWidth: 1 },
  statusTxt:     { fontFamily: Fonts.semibold, fontSize: 10 },
  amount:        { fontFamily: Fonts.bold, fontSize: 15 },
  markBtn:       { padding: 2 },
  empty:         { alignItems: 'center', paddingTop: 48, gap: Spacing.md },
  emptyTxt:      { fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

const ts = StyleSheet.create({
  returnedRow:   { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1.5, marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  returnedTitle: { fontFamily: Fonts.semibold, fontSize: 14, marginBottom: 2 },
  returnedSub:   { fontFamily: Fonts.regular, fontSize: 12 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',  icon: 'home-outline'                },
  { id: 'history',   label: 'History',   icon: 'list-outline'                },
  { id: 'transfers', label: 'Transfers', icon: 'swap-horizontal-outline'     },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline'           },
];

export default function ExpenseTrackerScreen() {
  const { colors } = useAppTheme();
  const [tab,             setTab]             = useState<TabId>('overview');
  const [expenses,        setExpenses]        = useState<Expense[]>([]);
  const [budget,          setBudget]          = useState(0);
  const [month,           setMonth]           = useState(currentMonthKey());
  const [addSheet,        setAddSheet]        = useState<{ visible: boolean; editing: Expense | null }>({ visible: false, editing: null });
  const [budgetModal,     setBudgetModal]     = useState(false);
  const [currencySymbol,  setCurrencySymbol]  = useState('₹');
  const [showCurrency,    setShowCurrency]    = useState(false);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [transfers,       setTransfers]       = useState<Transfer[]>([]);
  const [transferSheet,   setTransferSheet]   = useState<{ visible: boolean; editing: Transfer | null }>({ visible: false, editing: null });
  const [settingsOpen,    setSettingsOpen]    = useState(false);

  // Built-ins always come first; user-created categories follow. The
  // ordering matters for the picker grid and for analytics legends.
  const allCategories = useMemo<readonly Category[]>(
    () => [...CATEGORIES, ...customCategories],
    [customCategories],
  );

  // Keep the module-level resolver in lockstep with state so the lookup
  // helpers (`getCat`, CSV export, ExpenseRow, etc.) see custom categories.
  useEffect(() => { setAllCats(allCategories); }, [allCategories]);

  useEffect(() => {
    loadJSON<Expense[]>(KEYS.expenses, []).then(setExpenses);
    loadJSON<number>(KEYS.expenseBudget, 0).then(setBudget);
    loadJSON<string>(KEYS.expenseCurrency, '₹').then(s => { setCurrencySymbol(s); setCurSym(s); });
    loadJSON<Category[]>(KEYS.expenseCustomCategories, []).then(setCustomCategories);
    loadJSON<Transfer[]>(KEYS.expenseTransfers, []).then(setTransfers);
  }, []);

  const persistTransfers = (next: Transfer[]) => { setTransfers(next); saveJSON(KEYS.expenseTransfers, next); };
  const handleSaveTransfer = (t: Transfer) => {
    const exists = transfers.some(x => x.id === t.id);
    persistTransfers(exists ? transfers.map(x => x.id === t.id ? t : x) : [t, ...transfers]);
    setTransferSheet({ visible: false, editing: null });
  };
  const handleDeleteTransfer = (id: string) => { persistTransfers(transfers.filter(t => t.id !== id)); };
  // Quick "mark as returned" action used by the row check button — flips the
  // status without opening the editor sheet so settling a loan is one tap.
  const handleToggleReturned = (id: string) => {
    persistTransfers(transfers.map(t => t.id === id
      ? { ...t, returned: !t.returned, returnedDate: !t.returned ? todayISO() : undefined }
      : t,
    ));
  };

  const handleExport = async () => {
    if (expenses.length === 0) { Alert.alert('No Data', 'No expenses to export.'); return; }
    const csv = expensesToCSV(expenses);
    await Clipboard.setStringAsync(csv);
    Alert.alert('CSV Copied', `${expenses.length} expenses copied to clipboard as CSV. Paste into a spreadsheet or text file.`);
  };

  const persistExpenses = (next: Expense[]) => { setExpenses(next); saveJSON(KEYS.expenses, next); };
  const handleSave = (e: Expense) => {
    const exists = expenses.some(x => x.id === e.id);
    persistExpenses(exists ? expenses.map(x => x.id === e.id ? e : x) : [e, ...expenses]);
    setAddSheet({ visible: false, editing: null });
  };
  const handleDelete = (id: string) => { persistExpenses(expenses.filter(e => e.id !== id)); };
  const handleBudget = (n: number) => { setBudget(n); saveJSON(KEYS.expenseBudget, n); };

  const persistCustom = (next: Category[]) => {
    setCustomCategories(next);
    saveJSON(KEYS.expenseCustomCategories, next);
  };
  const handleAddCategory = (cat: Category) => {
    persistCustom([...customCategories, cat]);
  };
  const handleDeleteCategory = (id: string) => {
    // Block deletion when expenses still reference this category — silently
    // dropping them would lose data; re-tagging them is surprising. An alert
    // makes the constraint visible and recoverable.
    const inUse = expenses.filter(e => e.categoryId === id).length;
    if (inUse > 0) {
      Alert.alert(
        'Category in use',
        `${inUse} expense${inUse === 1 ? '' : 's'} use this category. Re-tag or delete those expenses first.`,
      );
      return;
    }
    persistCustom(customCategories.filter(c => c.id !== id));
  };

  // FIX #4: Quick repeat handler — opens add sheet pre-filled for today
  const handleRepeat = (e: Expense) => {
    setAddSheet({
      visible: true,
      editing: { ...e, id: uid(), date: todayISO() },
    });
  };

  return (
    <ScreenShell
      title="Expense Tracker"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={
        <TouchableOpacity
          style={ms.settingsBtn}
          onPress={() => setSettingsOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={20} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 'overview' && (
          <OverviewTab
            expenses={expenses}
            budget={budget}
            onSetBudget={() => setBudgetModal(true)}
            onAdd={() => setAddSheet({ visible: true, editing: null })}
            onEdit={e => setAddSheet({ visible: true, editing: e })}
            onRepeat={handleRepeat}
            colors={colors}
          />
        )}
        {tab === 'history' && (
          <HistoryTab
            expenses={expenses}
            month={month}
            onMonthChange={setMonth}
            onEdit={e => setAddSheet({ visible: true, editing: e })}
            colors={colors}
          />
        )}
        {tab === 'transfers' && (
          <TransfersTab
            transfers={transfers}
            onAdd={() => setTransferSheet({ visible: true, editing: null })}
            onEdit={t => setTransferSheet({ visible: true, editing: t })}
            onToggleReturned={handleToggleReturned}
            colors={colors}
          />
        )}
        {tab === 'analytics' && (
          <AnalyticsTab
            expenses={expenses}
            month={month}
            onMonthChange={setMonth}
            colors={colors}
            allCategories={allCategories}
          />
        )}
      </View>

      {/* Bottom tab bar */}
      <View style={[ms.bottomBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {TABS.map(t => {
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={ms.bottomTab}
              onPress={() => setTab(t.id)}
              activeOpacity={0.7}
            >
              {/* Top accent indicator on the active tab — gives a subtle but
                  unmistakable signal that doesn't rely on color alone. */}
              <View style={[ms.bottomIndicator, { backgroundColor: active ? ACCENT : 'transparent' }]} />
              <View style={ms.bottomTabInner}>
                <Ionicons
                  name={t.icon as any}
                  size={22}
                  color={active ? ACCENT : colors.textMuted}
                />
                <Text style={[
                  ms.bottomTabLabel,
                  {
                    color: active ? ACCENT : colors.textMuted,
                    fontFamily: active ? Fonts.bold : Fonts.medium,
                  },
                ]}>
                  {t.label}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {addSheet.visible && (
        <AddExpenseSheet
          initial={addSheet.editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setAddSheet({ visible: false, editing: null })}
          colors={colors}
          currencySymbol={currencySymbol}
          allCategories={allCategories}
          onAddCategory={handleAddCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      )}

      {budgetModal && (
        <BudgetModal
          budget={budget}
          onSave={handleBudget}
          onClose={() => setBudgetModal(false)}
          colors={colors}
          currencySymbol={currencySymbol}
        />
      )}

      {transferSheet.visible && (
        <AddTransferSheet
          initial={transferSheet.editing}
          onSave={handleSaveTransfer}
          onDelete={handleDeleteTransfer}
          onClose={() => setTransferSheet({ visible: false, editing: null })}
          colors={colors}
          currencySymbol={currencySymbol}
        />
      )}

      {settingsOpen && (
        <SettingsSheet
          colors={colors}
          currencySymbol={currencySymbol}
          expenseCount={expenses.length}
          onPickCurrency={() => setShowCurrency(true)}
          onExport={handleExport}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Currency Selector Modal */}
      <Modal visible={showCurrency} transparent animationType="fade" onRequestClose={() => setShowCurrency(false)}>
        <View style={bm.overlay}>
          <View style={[bm.box, { backgroundColor: colors.card }]}>
            <Text style={[bm.title, { color: colors.text }]}>Currency Symbol</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.lg }}>
              {CURRENCY_SYMBOLS.map(c => (
                <TouchableOpacity
                  key={c.symbol}
                  style={[{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.md,
                    borderWidth: 1.5, borderColor: currencySymbol === c.symbol ? ACCENT : colors.border,
                    backgroundColor: currencySymbol === c.symbol ? ACCENT + '18' : colors.inputBg,
                  }]}
                  onPress={() => {
                    setCurrencySymbol(c.symbol);
                    setCurSym(c.symbol);
                    saveJSON(KEYS.expenseCurrency, c.symbol);
                    setShowCurrency(false);
                  }}
                >
                  <Text style={{ fontSize: 13, fontFamily: Fonts.semibold, color: currencySymbol === c.symbol ? ACCENT : colors.text }}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[bm.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowCurrency(false)}>
              <Text style={[bm.cancelTxt, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const ms = StyleSheet.create({
  settingsBtn:    { width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  // Bottom navigation. Bleeds out horizontally to the content-container edges
  // so the divider runs full-width on phones. SafeAreaView already pads the
  // bottom edge for the home indicator, so no extra bottom margin needed.
  // The active-tab indicator is a small accent bar at the top of the cell —
  // a non-color cue that complements the colored icon + label.
  bottomBar:        { flexDirection: 'row', borderTopWidth: 1, marginHorizontal: -Spacing.lg, marginTop: 4 },
  bottomTab:        { flex: 1, alignItems: 'stretch' },
  bottomIndicator:  { height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, marginHorizontal: 18 },
  bottomTabInner:   { alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 8, gap: 3 },
  bottomTabLabel:   { fontSize: 11, letterSpacing: 0.2 },
});
