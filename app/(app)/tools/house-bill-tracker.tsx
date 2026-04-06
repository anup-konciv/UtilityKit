import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#059669';

type Bill = {
  id: string;
  categoryId: string;
  title: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  paidDate: string;
  recurring: boolean;
  note: string;
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

const CATEGORIES = [
  { id: 'rent', label: 'Rent', icon: 'home-outline', color: '#3B82F6' },
  { id: 'electricity', label: 'Electricity', icon: 'flash-outline', color: '#F59E0B' },
  { id: 'water', label: 'Water', icon: 'water-outline', color: '#0EA5E9' },
  { id: 'gas', label: 'Gas', icon: 'flame-outline', color: '#EF4444' },
  { id: 'internet', label: 'Internet', icon: 'wifi-outline', color: '#8B5CF6' },
  { id: 'phone', label: 'Phone', icon: 'call-outline', color: '#10B981' },
  { id: 'insurance', label: 'Insurance', icon: 'shield-checkmark-outline', color: '#6366F1' },
  { id: 'maintenance', label: 'Maintenance', icon: 'construct-outline', color: '#F97316' },
  { id: 'subscription', label: 'Subscription', icon: 'card-outline', color: '#EC4899' },
  { id: 'tax', label: 'Tax', icon: 'receipt-outline', color: '#64748B' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#94A3B8' },
];

function getCat(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function HouseBillTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bills, setBills] = useState<Bill[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [showPaidOnly, setShowPaidOnly] = useState(false);

  // Form
  const [catId, setCatId] = useState('rent');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [recurring, setRecurring] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    loadJSON<Bill[]>(KEYS.houseBills, []).then(setBills);
  }, []);

  const persist = useCallback((b: Bill[]) => {
    setBills(b);
    saveJSON(KEYS.houseBills, b);
  }, []);

  const openAdd = (bill?: Bill) => {
    if (bill) {
      setEditId(bill.id);
      setCatId(bill.categoryId);
      setTitle(bill.title);
      setAmount(String(bill.amount));
      setDueDate(bill.dueDate);
      setRecurring(bill.recurring);
      setNote(bill.note);
    } else {
      setEditId(null);
      setCatId('rent');
      setTitle('');
      setAmount('');
      setDueDate(todayISO());
      setRecurring(true);
      setNote('');
    }
    setShowAdd(true);
  };

  const saveBill = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    const cat = getCat(catId);
    const billTitle = title.trim() || cat.label;
    if (editId) {
      persist(bills.map(b => b.id === editId ? {
        ...b, categoryId: catId, title: billTitle, amount: amt, dueDate, recurring, note: note.trim(),
      } : b));
    } else {
      persist([{
        id: uid(), categoryId: catId, title: billTitle, amount: amt, dueDate,
        paid: false, paidDate: '', recurring, note: note.trim(),
      }, ...bills]);
    }
    setShowAdd(false);
  };

  const togglePaid = (id: string) => {
    persist(bills.map(b => {
      if (b.id !== id) return b;
      return { ...b, paid: !b.paid, paidDate: !b.paid ? todayISO() : '' };
    }));
  };

  const deleteBill = (id: string) => {
    Alert.alert('Delete Bill', 'Remove this bill?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(bills.filter(b => b.id !== id)) },
    ]);
  };

  const copyRecurringFromPrev = () => {
    const prevM = viewMonth.month === 0 ? 11 : viewMonth.month - 1;
    const prevY = viewMonth.month === 0 ? viewMonth.year - 1 : viewMonth.year;
    const prevKey = `${prevY}-${String(prevM + 1).padStart(2, '0')}`;
    const recurring = bills.filter(b => b.dueDate.startsWith(prevKey) && b.recurring);
    if (recurring.length === 0) {
      Alert.alert('No recurring bills', 'No recurring bills found in previous month.');
      return;
    }
    const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
    const existingTitles = bills.filter(b => b.dueDate.startsWith(monthKey)).map(b => b.title);
    const newBills = recurring
      .filter(b => !existingTitles.includes(b.title))
      .map(b => ({
        ...b,
        id: uid(),
        dueDate: `${monthKey}-${b.dueDate.split('-')[2]}`,
        paid: false,
        paidDate: '',
      }));
    if (newBills.length === 0) {
      Alert.alert('Already copied', 'All recurring bills already exist this month.');
      return;
    }
    persist([...newBills, ...bills]);
  };

  const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
  const monthBills = bills.filter(b => b.dueDate.startsWith(monthKey));
  const displayBills = showPaidOnly ? monthBills.filter(b => b.paid) : monthBills.filter(b => !b.paid);

  const totalDue = monthBills.reduce((s, b) => s + b.amount, 0);
  const totalPaid = monthBills.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
  const totalPending = totalDue - totalPaid;
  const paidCount = monthBills.filter(b => b.paid).length;

  const prevMonth = () => {
    setViewMonth(prev => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 });
  };
  const nextMonth = () => {
    setViewMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };

  return (
    <ScreenShell
      title="House Bills"
      accentColor={ACCENT}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={copyRecurringFromPrev}>
            <Ionicons name="copy-outline" size={22} color={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openAdd()}>
            <Ionicons name="add-circle-outline" size={24} color={ACCENT} />
          </TouchableOpacity>
        </View>
      }
    >
      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{MONTHS[viewMonth.month]} {viewMonth.year}</Text>
        <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={24} color={colors.text} /></TouchableOpacity>
      </View>

      {/* Hero Card */}
      <LinearGradient
        colors={['#064E3B', '#059669', '#34D399']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>MONTHLY BILLS</Text>
        <Text style={styles.heroTitle}>{totalDue > 0 ? totalDue.toLocaleString() : 'No bills'}</Text>
        <Text style={styles.heroSub}>{paidCount}/{monthBills.length} bills paid this month</Text>
        <View style={[styles.heroProgressWrap, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <View style={[styles.heroProgressFill, { width: `${totalDue > 0 ? (totalPaid / totalDue) * 100 : 0}%` }]} />
        </View>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{totalPaid.toLocaleString()}</Text>
            <Text style={styles.heroStatLabel}>PAID</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatVal, { color: totalPending > 0 ? '#FEF3C7' : '#fff' }]}>{totalPending.toLocaleString()}</Text>
            <Text style={styles.heroStatLabel}>PENDING</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{monthBills.length}</Text>
            <Text style={styles.heroStatLabel}>BILLS</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter toggle */}
      <View style={[styles.viewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { k: false, lb: 'Pending', ic: 'time-outline' },
          { k: true, lb: 'Paid', ic: 'checkmark-circle-outline' },
        ].map(v => (
          <TouchableOpacity key={String(v.k)} style={[styles.viewBtn, showPaidOnly === v.k && { backgroundColor: ACCENT }]} onPress={() => setShowPaidOnly(v.k)}>
            <Ionicons name={v.ic as any} size={15} color={showPaidOnly === v.k ? '#fff' : colors.textMuted} />
            <Text style={[styles.viewBtnText, { color: showPaidOnly === v.k ? '#fff' : colors.textMuted }]}>{v.lb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Bills */}
      {displayBills.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="receipt-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {showPaidOnly ? 'No paid bills this month' : 'No pending bills this month'}
          </Text>
        </View>
      ) : displayBills.map(bill => {
        const cat = getCat(bill.categoryId);
        const isOverdue = !bill.paid && bill.dueDate < todayISO();
        return (
          <View key={bill.id} style={[styles.billCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TouchableOpacity style={styles.billMain} onPress={() => togglePaid(bill.id)}>
              <View style={[styles.billIcon, { backgroundColor: cat.color + '20' }]}>
                <Ionicons name={cat.icon as any} size={20} color={cat.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.billTitle, { color: colors.text }]}>{bill.title}</Text>
                <View style={styles.billMetaRow}>
                  <Ionicons name="calendar-outline" size={12} color={isOverdue ? '#EF4444' : colors.textMuted} />
                  <Text style={[styles.billMeta, { color: isOverdue ? '#EF4444' : colors.textMuted }]}>
                    Due {formatDate(bill.dueDate)}{isOverdue ? ' (Overdue)' : ''}
                  </Text>
                </View>
                {bill.note ? <Text style={[styles.billNote, { color: colors.textMuted }]}>{bill.note}</Text> : null}
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.billAmount, { color: bill.paid ? '#10B981' : colors.text }]}>{bill.amount.toLocaleString()}</Text>
                <Ionicons
                  name={bill.paid ? 'checkmark-circle' : 'ellipse-outline'}
                  size={22}
                  color={bill.paid ? '#10B981' : colors.textMuted}
                />
              </View>
            </TouchableOpacity>
            {bill.paid && bill.paidDate ? (
              <Text style={[styles.paidTag, { color: '#10B981' }]}>Paid on {formatDate(bill.paidDate)}</Text>
            ) : null}
            <View style={styles.billActions}>
              {bill.recurring && (
                <View style={[styles.recurBadge, { backgroundColor: ACCENT + '15' }]}>
                  <Ionicons name="repeat-outline" size={12} color={ACCENT} />
                  <Text style={[styles.recurText, { color: ACCENT }]}>Recurring</Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => openAdd(bill)} style={{ padding: 4 }}>
                <Ionicons name="create-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteBill(bill.id)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Category Breakdown */}
      {monthBills.length > 0 && (
        <View style={[styles.breakdownCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Category Breakdown</Text>
          {CATEGORIES.filter(cat => monthBills.some(b => b.categoryId === cat.id)).map(cat => {
            const catBills = monthBills.filter(b => b.categoryId === cat.id);
            const catTotal = catBills.reduce((s, b) => s + b.amount, 0);
            const catPct = totalDue > 0 ? (catTotal / totalDue) * 100 : 0;
            return (
              <View key={cat.id} style={styles.breakdownRow}>
                <View style={[styles.breakdownIcon, { backgroundColor: cat.color + '20' }]}>
                  <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                </View>
                <Text style={[styles.breakdownLabel, { color: colors.text }]}>{cat.label}</Text>
                <View style={[styles.breakdownBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.breakdownFill, { width: `${catPct}%`, backgroundColor: cat.color }]} />
                </View>
                <Text style={[styles.breakdownAmt, { color: colors.text }]}>{catTotal.toLocaleString()}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ justifyContent: 'center', flexGrow: 1 }}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editId ? 'Edit Bill' : 'New Bill'}</Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {CATEGORIES.map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.catOption, catId === cat.id && { backgroundColor: cat.color + '20', borderColor: cat.color }]}
                  onPress={() => { setCatId(cat.id); if (!title.trim()) setTitle(cat.label); }}
                >
                  <Ionicons name={cat.icon as any} size={14} color={catId === cat.id ? cat.color : colors.textMuted} />
                  <Text style={[styles.catOptionText, { color: catId === cat.id ? cat.color : colors.textMuted }]}>{cat.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={title} onChangeText={setTitle} placeholder="Bill name" placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Amount</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={amount} onChangeText={setAmount} placeholder="Bill amount" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Due Date</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
            />

            <TouchableOpacity style={styles.recurToggle} onPress={() => setRecurring(!recurring)}>
              <Ionicons name={recurring ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={recurring ? ACCENT : colors.textMuted} />
              <Text style={[styles.recurToggleText, { color: colors.text }]}>Recurring monthly bill</Text>
            </TouchableOpacity>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={note} onChangeText={setNote} placeholder="Optional note" placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveBill}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{editId ? 'Update' : 'Add Bill'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
    monthLabel: { fontSize: 18, fontFamily: Fonts.bold },
    heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.lg },
    heroLabel: { fontSize: 10, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 4 },
    heroTitle: { fontSize: 28, fontFamily: Fonts.bold, color: '#fff', marginBottom: 2 },
    heroSub: { fontSize: 13, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.md },
    heroProgressWrap: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.lg },
    heroProgressFill: { height: '100%', borderRadius: 3, backgroundColor: '#fff' },
    heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    heroStat: { alignItems: 'center' },
    heroStatVal: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff' },
    heroStatLabel: { fontSize: 9, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginTop: 2 },
    heroDivider: { width: 1, height: 30 },
    viewToggle: { flexDirection: 'row', borderRadius: Radii.lg, borderWidth: 1, padding: 3, gap: 3, marginBottom: Spacing.lg },
    viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: Radii.md },
    viewBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium },
    billCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    billMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    billIcon: { width: 44, height: 44, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
    billTitle: { fontSize: 15, fontFamily: Fonts.bold },
    billMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    billMeta: { fontSize: 11, fontFamily: Fonts.medium },
    billNote: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2, fontStyle: 'italic' },
    billAmount: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: 4 },
    paidTag: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 6, marginLeft: 56 },
    billActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: Spacing.sm },
    recurBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.pill },
    recurText: { fontSize: 10, fontFamily: Fonts.bold },
    breakdownCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    breakdownIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    breakdownLabel: { fontSize: 12, fontFamily: Fonts.semibold, width: 80 },
    breakdownBar: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
    breakdownFill: { height: '100%', borderRadius: 3 },
    breakdownAmt: { fontSize: 12, fontFamily: Fonts.bold, width: 60, textAlign: 'right' },
    catOption: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, borderColor: c.border, marginRight: 8 },
    catOptionText: { fontSize: 12, fontFamily: Fonts.semibold },
    recurToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md, paddingVertical: 4 },
    recurToggleText: { fontSize: 14, fontFamily: Fonts.medium },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
