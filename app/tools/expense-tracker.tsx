import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, Alert, Dimensions, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
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
type TabId   = 'overview' | 'history' | 'analytics';

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
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
] as const;

function getCat(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
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
function AddExpenseSheet({ initial, onSave, onDelete, onClose, colors }: {
  initial: Expense | null;
  onSave: (e: Expense) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  colors: Colors;
}) {
  const isEdit = initial !== null;
  const [amount,    setAmount]    = useState(initial ? String(initial.amount) : '');
  const [catId,     setCatId]     = useState(initial?.categoryId ?? 'food');
  const [note,      setNote]      = useState(initial?.note ?? '');
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
            <Text style={[s.rupee, { color: ACCENT }]}>₹</Text>
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
            {CATEGORIES.map(c => {
              const active = catId === c.id;
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.catPill, { borderColor: active ? c.color : colors.border, backgroundColor: active ? c.color + '22' : colors.inputBg }]}
                  onPress={() => setCatId(c.id)}
                >
                  <Ionicons name={c.icon as any} size={13} color={active ? c.color : colors.textMuted} />
                  <Text style={[s.catPillTxt, { color: active ? c.color : colors.textMuted }]}>{c.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

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
            <TextInput
              style={[s.noteInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, marginTop: 6 }]}
              value={customDate}
              onChangeText={setCustomDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
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
      </View>
    </Modal>
  );
}

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
  catGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 7, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  catPill:     { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5 },
  catPillTxt:  { fontFamily: Fonts.medium, fontSize: 12 },
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
function OverviewTab({ expenses, budget, onSetBudget, onAdd, onEdit, colors }: {
  expenses: Expense[]; budget: number;
  onSetBudget: () => void; onAdd: () => void;
  onEdit: (e: Expense) => void; colors: Colors;
}) {
  const month = currentMonthKey();
  const monthExpenses = expenses.filter(e => e.date.startsWith(month));
  const total = monthExpenses.reduce((s, e) => s + e.amount, 0);
  const count = monthExpenses.length;
  const daysInMonth = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0).getDate();
  const dayOfMonth  = new Date().getDate();
  const dailyAvg    = dayOfMonth > 0 ? total / dayOfMonth : 0;
  const progress    = budget > 0 ? Math.min(total / budget, 1) : 0;
  const overBudget  = budget > 0 && total > budget;

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
        </View>

        {budget > 0 && (
          <>
            <View style={[ov.barTrack, { backgroundColor: colors.border }]}>
              <View style={[ov.barFill, { width: `${progress * 100}%`, backgroundColor: overBudget ? '#EF4444' : '#10B981' }]} />
            </View>
            <Text style={[ov.budgetSub, { color: overBudget ? '#EF4444' : '#10B981' }]}>
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
          { label: 'Days Left',    val: String(daysInMonth - dayOfMonth), icon: 'calendar-outline' },
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
  empty:           { alignItems: 'center', paddingTop: 48, gap: Spacing.md },
  emptyTxt:        { fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

// ── History Tab ───────────────────────────────────────────────────────────────
function HistoryTab({ expenses, month, onMonthChange, onEdit, colors }: {
  expenses: Expense[]; month: string;
  onMonthChange: (m: string) => void;
  onEdit: (e: Expense) => void; colors: Colors;
}) {
  const filtered = [...expenses.filter(e => e.date.startsWith(month))].sort((a, b) => b.date.localeCompare(a.date));

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
      <MonthNav month={month} onChange={onMonthChange} colors={colors} />

      {filtered.length > 0 && (
        <View style={[ht.totalRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[ht.totalLabel, { color: colors.textMuted }]}>Total spent</Text>
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
          <Ionicons name="receipt-outline" size={52} color={colors.textMuted} />
          <Text style={[ov.emptyTxt, { color: colors.textMuted }]}>No expenses in {monthLabel(month)}.</Text>
        </View>
      )}
    </ScrollView>
  );
}
const ht = StyleSheet.create({
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md },
  totalLabel: { fontFamily: Fonts.medium, fontSize: 13 },
  totalVal:   { fontFamily: Fonts.bold, fontSize: 18 },
  dateRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  dateLabel:  { fontFamily: Fonts.semibold, fontSize: 13 },
  dateSub:    { fontFamily: Fonts.medium, fontSize: 12 },
});

// ── Analytics Tab ─────────────────────────────────────────────────────────────
function AnalyticsTab({ expenses, month, onMonthChange, colors }: {
  expenses: Expense[]; month: string;
  onMonthChange: (m: string) => void; colors: Colors;
}) {
  const monthExp  = expenses.filter(e => e.date.startsWith(month));
  const monthTotal = monthExp.reduce((s, e) => s + e.amount, 0);

  // Category breakdown
  const catTotals: Record<string, number> = {};
  for (const e of monthExp) catTotals[e.categoryId] = (catTotals[e.categoryId] ?? 0) + e.amount;
  const catRows = CATEGORIES
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

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.huge }}>
      <MonthNav month={month} onChange={onMonthChange} colors={colors} />

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

      {/* Category breakdown */}
      <View style={[an.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[an.cardTitle, { color: colors.text }]}>By Category</Text>
        {catRows.length === 0 && (
          <Text style={[an.emptyTxt, { color: colors.textMuted }]}>No data for {monthLabel(month)}.</Text>
        )}
        {catRows.map(({ cat, total }) => {
          const pct = monthTotal > 0 ? (total / monthTotal) * 100 : 0;
          return (
            <View key={cat.id} style={an.catRow}>
              <View style={an.catMeta}>
                <View style={[an.catDot, { backgroundColor: cat.color }]} />
                <Text style={[an.catName, { color: colors.text }]}>{cat.label}</Text>
                <Text style={[an.catPct, { color: colors.textMuted }]}>{pct.toFixed(1)}%</Text>
                <Text style={[an.catAmt, { color: colors.text }]}>{fmtFull(total)}</Text>
              </View>
              <View style={[an.catBarTrack, { backgroundColor: colors.border }]}>
                <View style={[an.catBarFill, { width: `${pct}%`, backgroundColor: cat.color }]} />
              </View>
            </View>
          );
        })}
      </View>

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
  card:        { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
  cardTitle:   { fontFamily: Fonts.bold, fontSize: 15, marginBottom: Spacing.lg },
  chartWrap:   { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  barCol:      { flex: 1, alignItems: 'center', gap: 4 },
  barAmt:      { fontFamily: Fonts.regular, fontSize: 9, textAlign: 'center', height: 14 },
  barTrack:    { width: '100%', justifyContent: 'flex-end' },
  barFill:     { width: '100%', borderRadius: 3, minHeight: 0 },
  barLabel:    { fontSize: 12 },
  catRow:      { marginBottom: Spacing.md },
  catMeta:     { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  catDot:      { width: 10, height: 10, borderRadius: 5 },
  catName:     { flex: 1, fontFamily: Fonts.medium, fontSize: 13 },
  catPct:      { fontFamily: Fonts.regular, fontSize: 12 },
  catAmt:      { fontFamily: Fonts.bold, fontSize: 13 },
  catBarTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  catBarFill:  { height: '100%', borderRadius: 4 },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1 },
  insightTxt:  { flex: 1, fontFamily: Fonts.medium, fontSize: 13, lineHeight: 20 },
  emptyTxt:    { fontFamily: Fonts.regular, fontSize: 13, textAlign: 'center', paddingVertical: Spacing.lg },
});

// ── Budget Modal ──────────────────────────────────────────────────────────────
function BudgetModal({ budget, onSave, onClose, colors }: {
  budget: number; onSave: (n: number) => void; onClose: () => void; colors: Colors;
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
            <Text style={[bm.rupee, { color: ACCENT }]}>₹</Text>
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

// ── Main Screen ───────────────────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'overview',  label: 'Overview',  icon: 'home-outline'          },
  { id: 'history',   label: 'History',   icon: 'list-outline'           },
  { id: 'analytics', label: 'Analytics', icon: 'bar-chart-outline'      },
];

export default function ExpenseTrackerScreen() {
  const { colors } = useAppTheme();
  const [tab,          setTab]          = useState<TabId>('overview');
  const [expenses,     setExpenses]     = useState<Expense[]>([]);
  const [budget,       setBudget]       = useState(0);
  const [month,        setMonth]        = useState(currentMonthKey());
  const [addSheet,     setAddSheet]     = useState<{ visible: boolean; editing: Expense | null }>({ visible: false, editing: null });
  const [budgetModal,  setBudgetModal]  = useState(false);
  const [currencySymbol, setCurrencySymbol] = useState('₹');
  const [showCurrency, setShowCurrency] = useState(false);

  useEffect(() => {
    loadJSON<Expense[]>(KEYS.expenses, []).then(setExpenses);
    loadJSON<number>(KEYS.expenseBudget, 0).then(setBudget);
    loadJSON<string>(KEYS.expenseCurrency, '₹').then(s => { setCurrencySymbol(s); setCurSym(s); });
  }, []);

  const persistExpenses = (next: Expense[]) => { setExpenses(next); saveJSON(KEYS.expenses, next); };
  const handleSave = (e: Expense) => {
    const exists = expenses.some(x => x.id === e.id);
    persistExpenses(exists ? expenses.map(x => x.id === e.id ? e : x) : [e, ...expenses]);
    setAddSheet({ visible: false, editing: null });
  };
  const handleDelete = (id: string) => { persistExpenses(expenses.filter(e => e.id !== id)); };
  const handleBudget = (n: number) => { setBudget(n); saveJSON(KEYS.expenseBudget, n); };

  return (
    <ScreenShell title="Expense Tracker" accentColor={ACCENT} scrollable={false}>
      {/* Tab bar + Actions */}
      <View style={[ms.tabRow, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={ms.tabScroll}
          contentContainerStyle={ms.tabBar}
        >
          {TABS.map(t => {
            const active = tab === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[ms.tab, active && { borderBottomColor: ACCENT }]}
                onPress={() => setTab(t.id)}
              >
                <Ionicons name={t.icon as any} size={15} color={active ? ACCENT : colors.textMuted} />
                <Text style={[ms.tabLabel, { color: active ? ACCENT : colors.textMuted }]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={{ flexDirection: 'row', gap: 4, paddingRight: 4 }}>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={() => setShowCurrency(true)}
          >
            <Text style={{ fontSize: 16, fontFamily: Fonts.bold, color: ACCENT }}>{currencySymbol}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={async () => {
              if (expenses.length === 0) { Alert.alert('No Data', 'No expenses to export.'); return; }
              const csv = expensesToCSV(expenses);
              await Clipboard.setStringAsync(csv);
              Alert.alert('CSV Copied', `${expenses.length} expenses copied to clipboard as CSV. Paste into a spreadsheet or text file.`);
            }}
          >
            <Ionicons name="download-outline" size={18} color={ACCENT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {tab === 'overview' && (
          <OverviewTab
            expenses={expenses}
            budget={budget}
            onSetBudget={() => setBudgetModal(true)}
            onAdd={() => setAddSheet({ visible: true, editing: null })}
            onEdit={e => setAddSheet({ visible: true, editing: e })}
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
        {tab === 'analytics' && (
          <AnalyticsTab
            expenses={expenses}
            month={month}
            onMonthChange={setMonth}
            colors={colors}
          />
        )}
      </View>

      {addSheet.visible && (
        <AddExpenseSheet
          initial={addSheet.editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setAddSheet({ visible: false, editing: null })}
          colors={colors}
        />
      )}

      {budgetModal && (
        <BudgetModal
          budget={budget}
          onSave={handleBudget}
          onClose={() => setBudgetModal(false)}
          colors={colors}
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
  tabRow:    { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
  tabScroll: { flex: 1, flexGrow: 0 },
  tabBar:    { gap: 4 },
  tab:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 12, paddingHorizontal: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabLabel:  { fontFamily: Fonts.semibold, fontSize: 13 },
});
