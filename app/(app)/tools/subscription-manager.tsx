import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert,
  FlatList, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { schedule, cancel } from '@/lib/notifications';
import { haptics } from '@/lib/haptics';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EC4899';

/* ───── Types ───── */
type BillingCycle = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
type SubStatus = 'active' | 'cancelled';

type Subscription = {
  id: string;
  name: string;
  amount: number;
  cycle: BillingCycle;
  nextBillingDate: string;
  category: string;
  autoRenew: boolean;
  notes: string;
  status: SubStatus;
  createdAt: string;
};

/* ───── Constants ───── */
const CATEGORIES: { id: string; label: string; icon: string; color: string }[] = [
  { id: 'streaming', label: 'Streaming', icon: 'play-circle-outline', color: '#EF4444' },
  { id: 'music', label: 'Music', icon: 'musical-notes-outline', color: '#8B5CF6' },
  { id: 'cloud', label: 'Cloud', icon: 'cloud-outline', color: '#3B82F6' },
  { id: 'fitness', label: 'Fitness', icon: 'barbell-outline', color: '#10B981' },
  { id: 'news', label: 'News', icon: 'newspaper-outline', color: '#F59E0B' },
  { id: 'software', label: 'Software', icon: 'code-slash-outline', color: '#6366F1' },
  { id: 'gaming', label: 'Gaming', icon: 'game-controller-outline', color: '#EC4899' },
  { id: 'food', label: 'Food', icon: 'fast-food-outline', color: '#F97316' },
  { id: 'shopping', label: 'Shopping', icon: 'cart-outline', color: '#0891B2' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#64748B' },
];

const PRESETS: { name: string; category: string; cycle: BillingCycle; amount: number }[] = [
  { name: 'Netflix', category: 'streaming', cycle: 'monthly', amount: 199 },
  { name: 'Spotify', category: 'music', cycle: 'monthly', amount: 119 },
  { name: 'YouTube Premium', category: 'streaming', cycle: 'monthly', amount: 149 },
  { name: 'Amazon Prime', category: 'streaming', cycle: 'yearly', amount: 1499 },
  { name: 'Disney+ Hotstar', category: 'streaming', cycle: 'yearly', amount: 899 },
  { name: 'iCloud', category: 'cloud', cycle: 'monthly', amount: 75 },
  { name: 'Google One', category: 'cloud', cycle: 'monthly', amount: 130 },
  { name: 'ChatGPT Plus', category: 'software', cycle: 'monthly', amount: 1800 },
  { name: 'Gym Membership', category: 'fitness', cycle: 'monthly', amount: 1500 },
  { name: 'Newspaper', category: 'news', cycle: 'monthly', amount: 300 },
];

const CYCLES: { key: BillingCycle; label: string; short: string; months: number }[] = [
  { key: 'monthly', label: 'Monthly', short: 'Mo', months: 1 },
  { key: 'quarterly', label: 'Quarterly', short: 'Qt', months: 3 },
  { key: 'half-yearly', label: 'Half-Yearly', short: 'HY', months: 6 },
  { key: 'yearly', label: 'Yearly', short: 'Yr', months: 12 },
];

/* ───── Helpers ───── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function getDaysUntil(iso: string): number {
  const target = new Date(iso + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function getMonthlyAmount(amount: number, cycle: BillingCycle): number {
  const info = CYCLES.find(c => c.key === cycle)!;
  return Math.round(amount / info.months);
}

function getYearlyAmount(amount: number, cycle: BillingCycle): number {
  const info = CYCLES.find(c => c.key === cycle)!;
  return Math.round((amount / info.months) * 12);
}

function getCycleLabel(cycle: BillingCycle): string {
  return CYCLES.find(c => c.key === cycle)?.label ?? cycle;
}

function getCat(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[CATEGORIES.length - 1];
}

type StatusInfo = { label: string; color: string; bgColor: string; icon: string };

function getStatus(sub: Subscription): StatusInfo {
  if (sub.status === 'cancelled') return { label: 'Cancelled', color: '#64748B', bgColor: '#F1F5F9', icon: 'close-circle' };
  const days = getDaysUntil(sub.nextBillingDate);
  if (days < 0) return { label: 'Overdue', color: '#DC2626', bgColor: '#FEE2E2', icon: 'alert-circle' };
  if (days <= 7) return { label: 'Due Soon', color: '#D97706', bgColor: '#FEF3C7', icon: 'warning' };
  return { label: 'Active', color: '#059669', bgColor: '#D1FAE5', icon: 'checkmark-circle' };
}

function nextBillingAfterPayment(currentDate: string, cycle: BillingCycle): string {
  const d = new Date(currentDate + 'T00:00:00');
  const info = CYCLES.find(c => c.key === cycle)!;
  d.setMonth(d.getMonth() + info.months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/* ───── Component ───── */
export default function SubscriptionManagerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'due' | 'cancelled'>('all');
  const [showPresets, setShowPresets] = useState(true);

  // Add form
  const [formName, setFormName] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formCycle, setFormCycle] = useState<BillingCycle>('monthly');
  const [formCategory, setFormCategory] = useState('streaming');
  const [formNextDate, setFormNextDate] = useState(todayISO());
  const [formAutoRenew, setFormAutoRenew] = useState(true);
  const [formNotes, setFormNotes] = useState('');

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCycle, setEditCycle] = useState<BillingCycle>('monthly');
  const [editCategory, setEditCategory] = useState('streaming');
  const [editAutoRenew, setEditAutoRenew] = useState(true);
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    loadJSON<Subscription[]>(KEYS.subscriptions, []).then(setSubs);
  }, []);

  const persist = useCallback((list: Subscription[]) => {
    setSubs(list);
    saveJSON(KEYS.subscriptions, list);
  }, []);

  // Schedule a "renews tomorrow" notification 24h before the next billing
  // date for active subscriptions. Cancels everything for non-active subs.
  const scheduleSubscription = useCallback(async (sub: Subscription) => {
    if (sub.status !== 'active') {
      await cancel('subscription', sub.id);
      return;
    }
    const target = new Date(sub.nextBillingDate + 'T09:00:00');
    target.setDate(target.getDate() - 1);
    if (Number.isNaN(target.getTime())) return;
    await schedule({
      id: sub.id,
      namespace: 'subscription',
      title: `${sub.name} renews tomorrow`,
      body: `₹${sub.amount.toLocaleString()} on ${sub.nextBillingDate}`,
      date: target,
      repeat: 'none',
      data: { subscriptionId: sub.id },
    });
  }, []);

  const detailSub = subs.find(s => s.id === showDetail);

  /* ───── Filtered & sorted ───── */
  const filtered = useMemo(() => {
    let list = [...subs];
    if (filterStatus === 'active') list = list.filter(s => s.status === 'active' && getDaysUntil(s.nextBillingDate) >= 0);
    else if (filterStatus === 'due') list = list.filter(s => s.status === 'active' && getDaysUntil(s.nextBillingDate) <= 7);
    else if (filterStatus === 'cancelled') list = list.filter(s => s.status === 'cancelled');
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return getDaysUntil(a.nextBillingDate) - getDaysUntil(b.nextBillingDate);
    });
    return list;
  }, [subs, filterStatus]);

  /* ───── Stats ───── */
  const stats = useMemo(() => {
    const active = subs.filter(s => s.status === 'active');
    const monthlyTotal = active.reduce((sum, s) => sum + getMonthlyAmount(s.amount, s.cycle), 0);
    const yearlyTotal = active.reduce((sum, s) => sum + getYearlyAmount(s.amount, s.cycle), 0);
    const dueSoon = active.filter(s => getDaysUntil(s.nextBillingDate) <= 7 && getDaysUntil(s.nextBillingDate) >= 0).length;
    const overdue = active.filter(s => getDaysUntil(s.nextBillingDate) < 0).length;
    return { activeCount: active.length, monthlyTotal, yearlyTotal, dueSoon, overdue, cancelled: subs.length - active.length };
  }, [subs]);

  /* ───── Add subscription ───── */
  const addSubscription = () => {
    if (!formName.trim() || !formAmount.trim()) return;
    const newSub: Subscription = {
      id: uid(),
      name: formName.trim(),
      amount: parseFloat(formAmount) || 0,
      cycle: formCycle,
      nextBillingDate: formNextDate,
      category: formCategory,
      autoRenew: formAutoRenew,
      notes: formNotes.trim(),
      status: 'active',
      createdAt: todayISO(),
    };
    persist([...subs, newSub]);
    haptics.success();
    void scheduleSubscription(newSub);
    resetForm();
    setShowAdd(false);
  };

  const selectPreset = (p: typeof PRESETS[0]) => {
    setFormName(p.name);
    setFormAmount(String(p.amount));
    setFormCycle(p.cycle);
    setFormCategory(p.category);
    setShowPresets(false);
  };

  const resetForm = () => {
    setFormName(''); setFormAmount(''); setFormCycle('monthly');
    setFormCategory('streaming'); setFormNextDate(todayISO());
    setFormAutoRenew(true); setFormNotes(''); setShowPresets(true);
  };

  /* ───── Edit ───── */
  const saveEdit = () => {
    if (!detailSub || !editName.trim()) return;
    const updated = subs.map(s =>
      s.id === detailSub.id
        ? { ...s, name: editName.trim(), amount: parseFloat(editAmount) || s.amount, cycle: editCycle, category: editCategory, autoRenew: editAutoRenew, notes: editNotes.trim() }
        : s
    );
    persist(updated);
    haptics.success();
    const editedSub = updated.find(s => s.id === detailSub.id);
    if (editedSub) void scheduleSubscription(editedSub);
    setEditMode(false);
  };

  /* ───── Cancel / Reactivate ───── */
  const toggleStatus = (id: string) => {
    const sub = subs.find(s => s.id === id);
    if (!sub) return;
    const newStatus: SubStatus = sub.status === 'active' ? 'cancelled' : 'active';
    const action = newStatus === 'cancelled' ? 'Cancel' : 'Reactivate';
    Alert.alert(action, `${action} ${sub.name}?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        onPress: () => {
          const updated = subs.map(s => s.id === id ? { ...s, status: newStatus } : s);
          persist(updated);
          const next = updated.find(s => s.id === id);
          if (next) void scheduleSubscription(next);
          haptics.tap();
        },
      },
    ]);
  };

  /* ───── Delete ───── */
  const deleteSub = (id: string) => {
    Alert.alert('Delete', 'Remove this subscription?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          haptics.warning();
          persist(subs.filter(s => s.id !== id));
          void cancel('subscription', id);
          setShowDetail(null);
        },
      },
    ]);
  };

  /* ───── Render: Summary ───── */
  const renderSummary = () => (
    <View style={styles.summaryRow}>
      {[
        { val: stats.activeCount, label: 'Active', color: '#059669', bg: '#D1FAE5', ic: 'checkmark-circle' },
        { val: `\u20B9${stats.monthlyTotal.toLocaleString('en-IN')}`, label: '/month', color: ACCENT, bg: '#FCE7F3', ic: 'card-outline' },
        { val: `\u20B9${stats.yearlyTotal.toLocaleString('en-IN')}`, label: '/year', color: '#6366F1', bg: '#EEF2FF', ic: 'trending-up-outline' },
      ].map((s, i) => (
        <View key={i} style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.summaryIconWrap, { backgroundColor: s.bg }]}>
            <Ionicons name={s.ic as any} size={18} color={s.color} />
          </View>
          <Text style={[styles.summaryVal, { color: s.color }]} numberOfLines={1} adjustsFontSizeToFit>{s.val}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{s.label}</Text>
        </View>
      ))}
    </View>
  );

  /* ───── Render: Filter pills ───── */
  const renderFilters = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterRow}>
      {([
        { key: 'all' as const, label: `All (${subs.length})` },
        { key: 'active' as const, label: `Active (${stats.activeCount})` },
        { key: 'due' as const, label: `Due Soon (${stats.dueSoon + stats.overdue})` },
        { key: 'cancelled' as const, label: `Cancelled (${stats.cancelled})` },
      ]).map(f => {
        const active = filterStatus === f.key;
        return (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterPill, { backgroundColor: active ? ACCENT : colors.card, borderColor: active ? ACCENT : colors.border }]}
            onPress={() => setFilterStatus(f.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterPillText, { color: active ? '#fff' : colors.textSub }]}>{f.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );

  /* ───── Render: Subscription card ───── */
  const renderCard = ({ item }: { item: Subscription }) => {
    const status = getStatus(item);
    const cat = getCat(item.category);
    const daysLeft = getDaysUntil(item.nextBillingDate);
    const cycleInfo = CYCLES.find(c => c.key === item.cycle)!;
    const monthlyAmt = getMonthlyAmount(item.amount, item.cycle);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {
          setShowDetail(item.id);
          setEditMode(false);
          setEditName(item.name);
          setEditAmount(String(item.amount));
          setEditCycle(item.cycle);
          setEditCategory(item.category);
          setEditAutoRenew(item.autoRenew);
          setEditNotes(item.notes);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={[styles.cardIconWrap, { backgroundColor: cat.color + '18' }]}>
            <Ionicons name={cat.icon as any} size={22} color={cat.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]}>{cat.label} · {getCycleLabel(item.cycle)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.cardAmount, { color: colors.text }]}>{'\u20B9'}{item.amount.toLocaleString('en-IN')}</Text>
            {item.cycle !== 'monthly' && (
              <Text style={[styles.cardMonthly, { color: colors.textMuted }]}>{'\u20B9'}{monthlyAmt}/mo</Text>
            )}
          </View>
        </View>

        <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
          <View style={styles.cardMeta}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.cardMetaText, { color: colors.textSub }]}>
              {item.status === 'cancelled' ? 'Cancelled' : `Next: ${formatDate(item.nextBillingDate)}`}
            </Text>
          </View>
          {item.status === 'active' && (
            <View style={styles.cardMeta}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.cardMetaText, { color: daysLeft < 0 ? '#DC2626' : daysLeft <= 7 ? '#D97706' : colors.textSub }]}>
                {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
              </Text>
            </View>
          )}
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {item.status === 'active' && (() => {
          const totalDays = cycleInfo.months * 30;
          const elapsed = totalDays - Math.max(0, daysLeft);
          const pct = Math.min(1, Math.max(0, elapsed / totalDays));
          const barColor = pct > 0.9 ? '#DC2626' : pct > 0.7 ? '#D97706' : '#059669';
          return (
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
            </View>
          );
        })()}
      </TouchableOpacity>
    );
  };

  /* ───── Render: Empty ───── */
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Ionicons name="card-outline" size={48} color={ACCENT} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Subscriptions Yet</Text>
      <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
        Track your recurring subscriptions{'\n'}and never miss a payment
      </Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: ACCENT }]} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Add First Subscription</Text>
      </TouchableOpacity>
    </View>
  );

  /* ───── Render: Add modal ───── */
  const renderAddModal = () => (
    <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Subscription</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); resetForm(); }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Presets */}
            {showPresets && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Quick Add</Text>
                <View style={styles.presetGrid}>
                  {PRESETS.filter(p => !subs.some(s => s.name === p.name && s.status === 'active')).map(p => {
                    const cat = getCat(p.category);
                    return (
                      <TouchableOpacity
                        key={p.name}
                        style={[styles.presetChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => selectPreset(p)}
                      >
                        <Ionicons name={cat.icon as any} size={14} color={cat.color} />
                        <Text style={[styles.presetText, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dividerText, { color: colors.textMuted }]}>or add custom</Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
              </>
            )}

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={formName} onChangeText={setFormName}
              placeholder="e.g. Netflix, Spotify" placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Amount ({'\u20B9'})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={formAmount} onChangeText={setFormAmount}
              placeholder="199" placeholderTextColor={colors.textMuted} keyboardType="number-pad"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Billing Cycle</Text>
            <View style={[styles.cycleToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {CYCLES.map(c => (
                <TouchableOpacity
                  key={c.key}
                  style={[styles.cycleBtn, formCycle === c.key && { backgroundColor: ACCENT }]}
                  onPress={() => setFormCycle(c.key)}
                >
                  <Text style={[styles.cycleBtnText, { color: formCycle === c.key ? '#fff' : colors.textMuted }]}>{c.short}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.sm }}>
              <View style={styles.catRow}>
                {CATEGORIES.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, {
                      backgroundColor: formCategory === c.id ? c.color : colors.card,
                      borderColor: formCategory === c.id ? c.color : colors.border,
                    }]}
                    onPress={() => setFormCategory(c.id)}
                  >
                    <Ionicons name={c.icon as any} size={14} color={formCategory === c.id ? '#fff' : c.color} />
                    <Text style={[styles.catChipText, { color: formCategory === c.id ? '#fff' : colors.textSub }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Next Billing Date (YYYY-MM-DD)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={formNextDate} onChangeText={setFormNextDate}
              placeholder={todayISO()} placeholderTextColor={colors.textMuted}
            />

            <View style={styles.toggleRow}>
              <Text style={[styles.toggleLabel, { color: colors.textSub }]}>Auto-Renew</Text>
              <TouchableOpacity
                style={[styles.toggleTrack, { backgroundColor: formAutoRenew ? ACCENT : colors.border }]}
                onPress={() => setFormAutoRenew(!formAutoRenew)}
                activeOpacity={0.7}
              >
                <View style={[styles.toggleThumb, { transform: [{ translateX: formAutoRenew ? 20 : 2 }] }]} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={formNotes} onChangeText={setFormNotes}
              placeholder="Optional notes..." placeholderTextColor={colors.textMuted}
              multiline numberOfLines={3}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: ACCENT, opacity: formName.trim() && formAmount.trim() ? 1 : 0.5 }]}
            onPress={addSubscription} disabled={!formName.trim() || !formAmount.trim()}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Add Subscription</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ───── Render: Detail modal ───── */
  const renderDetailModal = () => {
    if (!detailSub) return null;
    const status = getStatus(detailSub);
    const cat = getCat(detailSub.category);
    const daysLeft = getDaysUntil(detailSub.nextBillingDate);
    const monthlyAmt = getMonthlyAmount(detailSub.amount, detailSub.cycle);
    const yearlyAmt = getYearlyAmount(detailSub.amount, detailSub.cycle);

    return (
      <Modal visible={!!showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.detailHeaderLeft}>
                <View style={[styles.detailIconWrap, { backgroundColor: cat.color + '18' }]}>
                  <Ionicons name={cat.icon as any} size={24} color={cat.color} />
                </View>
                {editMode ? (
                  <TextInput
                    style={[styles.detailTitleInput, { color: colors.text, borderColor: ACCENT }]}
                    value={editName} onChangeText={setEditName} autoFocus
                  />
                ) : (
                  <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>{detailSub.name}</Text>
                )}
              </View>
              <View style={styles.detailActions}>
                {editMode ? (
                  <TouchableOpacity onPress={saveEdit} style={[styles.smallBtn, { backgroundColor: '#059669' }]}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode(true)} style={[styles.smallBtn, { backgroundColor: colors.card }]}>
                    <Ionicons name="create-outline" size={18} color={ACCENT} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowDetail(null)}>
                  <Ionicons name="close" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Status banner */}
              <View style={[styles.detailStatus, { backgroundColor: status.bgColor, borderColor: status.color + '30' }]}>
                <Ionicons name={status.icon as any} size={28} color={status.color} />
                <View style={styles.detailStatusInfo}>
                  <Text style={[styles.detailStatusLabel, { color: status.color }]}>{status.label}</Text>
                  <Text style={[styles.detailStatusSub, { color: status.color }]}>
                    {detailSub.status === 'cancelled' ? 'This subscription is cancelled'
                      : daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue`
                      : daysLeft === 0 ? 'Payment due today'
                      : `${daysLeft} days until next payment`}
                  </Text>
                </View>
              </View>

              {/* Info grid */}
              {editMode ? (
                <View style={[styles.editSection, { borderColor: colors.border }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Amount ({'\u20B9'})</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={editAmount} onChangeText={setEditAmount} keyboardType="number-pad"
                  />
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Billing Cycle</Text>
                  <View style={[styles.cycleToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    {CYCLES.map(c => (
                      <TouchableOpacity
                        key={c.key}
                        style={[styles.cycleBtn, editCycle === c.key && { backgroundColor: ACCENT }]}
                        onPress={() => setEditCycle(c.key)}
                      >
                        <Text style={[styles.cycleBtnText, { color: editCycle === c.key ? '#fff' : colors.textMuted }]}>{c.short}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Category</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.catRow}>
                      {CATEGORIES.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.catChip, {
                            backgroundColor: editCategory === c.id ? c.color : colors.card,
                            borderColor: editCategory === c.id ? c.color : colors.border,
                          }]}
                          onPress={() => setEditCategory(c.id)}
                        >
                          <Ionicons name={c.icon as any} size={14} color={editCategory === c.id ? '#fff' : c.color} />
                          <Text style={[styles.catChipText, { color: editCategory === c.id ? '#fff' : colors.textSub }]}>{c.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <View style={[styles.toggleRow, { marginTop: Spacing.md }]}>
                    <Text style={[styles.toggleLabel, { color: colors.textSub }]}>Auto-Renew</Text>
                    <TouchableOpacity
                      style={[styles.toggleTrack, { backgroundColor: editAutoRenew ? ACCENT : colors.border }]}
                      onPress={() => setEditAutoRenew(!editAutoRenew)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.toggleThumb, { transform: [{ translateX: editAutoRenew ? 20 : 2 }] }]} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Notes</Text>
                  <TextInput
                    style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={editNotes} onChangeText={setEditNotes}
                    placeholder="Optional notes..." placeholderTextColor={colors.textMuted}
                    multiline numberOfLines={3}
                  />
                </View>
              ) : (
                <>
                  <View style={styles.infoGrid}>
                    {[
                      { label: 'Amount', value: `\u20B9${detailSub.amount.toLocaleString('en-IN')}`, icon: 'cash-outline' },
                      { label: 'Cycle', value: getCycleLabel(detailSub.cycle), icon: 'repeat-outline' },
                      { label: 'Monthly', value: `\u20B9${monthlyAmt.toLocaleString('en-IN')}`, icon: 'calendar-outline' },
                      { label: 'Yearly', value: `\u20B9${yearlyAmt.toLocaleString('en-IN')}`, icon: 'trending-up-outline' },
                      { label: 'Next Due', value: formatDate(detailSub.nextBillingDate), icon: 'time-outline' },
                      { label: 'Category', value: cat.label, icon: cat.icon },
                      { label: 'Auto-Renew', value: detailSub.autoRenew ? 'Yes' : 'No', icon: 'sync-outline' },
                      { label: 'Added', value: formatDate(detailSub.createdAt), icon: 'add-circle-outline' },
                    ].map((info, i) => (
                      <View key={i} style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name={info.icon as any} size={14} color={ACCENT} />
                        <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>{info.label}</Text>
                        <Text style={[styles.infoCellValue, { color: colors.text }]}>{info.value}</Text>
                      </View>
                    ))}
                  </View>

                  {!!detailSub.notes && (
                    <View style={[styles.notesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.notesLabel, { color: colors.textMuted }]}>Notes</Text>
                      <Text style={[styles.notesText, { color: colors.textSub }]}>{detailSub.notes}</Text>
                    </View>
                  )}

                  {/* Cancel / Reactivate */}
                  <TouchableOpacity
                    style={[styles.secondaryBtn, { backgroundColor: detailSub.status === 'active' ? '#FEF3C7' : '#D1FAE5' }]}
                    onPress={() => toggleStatus(detailSub.id)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={detailSub.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'}
                      size={20}
                      color={detailSub.status === 'active' ? '#D97706' : '#059669'}
                    />
                    <Text style={[styles.secondaryBtnText, { color: detailSub.status === 'active' ? '#D97706' : '#059669' }]}>
                      {detailSub.status === 'active' ? 'Cancel Subscription' : 'Reactivate Subscription'}
                    </Text>
                  </TouchableOpacity>

                  {/* Delete */}
                  <TouchableOpacity
                    style={[styles.deleteBtn, { borderColor: '#FEE2E2' }]}
                    onPress={() => deleteSub(detailSub.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#DC2626" />
                    <Text style={styles.deleteBtnText}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  /* ───── Main render ───── */
  return (
    <ScreenShell title="Subscriptions" accentColor={ACCENT}>
      {subs.length === 0 ? renderEmpty() : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          renderItem={renderCard}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: Spacing.lg }}>
              {renderSummary()}
              {renderFilters()}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Ionicons name="funnel-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.noResultsText, { color: colors.textMuted }]}>No subscriptions in this filter</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {subs.length > 0 && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: ACCENT }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      )}

      {renderAddModal()}
      {renderDetailModal()}
    </ScreenShell>
  );
}

/* ═══════ STYLES ═══════ */
const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, marginTop: Spacing.sm },
    summaryCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radii.lg, borderWidth: 1.5 },
    summaryIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    summaryVal: { fontSize: 18, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 1 },

    filterScroll: { marginBottom: Spacing.md },
    filterRow: { flexDirection: 'row', gap: Spacing.xs },
    filterPill: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    filterPillText: { fontSize: 12, fontFamily: Fonts.medium },

    card: { borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
    cardTop: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    cardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontFamily: Fonts.semibold },
    cardSub: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    cardAmount: { fontSize: 16, fontFamily: Fonts.bold },
    cardMonthly: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
    statusText: { fontSize: 11, fontFamily: Fonts.semibold },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1, flexWrap: 'wrap', gap: 4 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardMetaText: { fontSize: 11, fontFamily: Fonts.regular },
    progressTrack: { height: 3, borderBottomLeftRadius: Radii.lg, borderBottomRightRadius: Radii.lg },
    progressFill: { height: 3, borderBottomLeftRadius: Radii.lg, borderBottomRightRadius: Radii.lg },

    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingTop: 60 },
    emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
    emptyTitle: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
    emptyDesc: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.pill },
    emptyBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semibold },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    modalTitle: { fontSize: 20, fontFamily: Fonts.bold, flex: 1 },

    sectionLabel: { fontSize: 14, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },
    fieldLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4, marginTop: Spacing.md },
    input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 15, fontFamily: Fonts.regular },
    textArea: { minHeight: 72, textAlignVertical: 'top' },

    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    presetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.pill, borderWidth: 1 },
    presetText: { fontSize: 13, fontFamily: Fonts.medium },

    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { fontSize: 12, fontFamily: Fonts.regular },

    cycleToggle: { flexDirection: 'row', borderRadius: Radii.md, borderWidth: 1, overflow: 'hidden' },
    cycleBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
    cycleBtnText: { fontSize: 12, fontFamily: Fonts.semibold },

    catRow: { flexDirection: 'row', gap: Spacing.sm },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.pill, borderWidth: 1 },
    catChipText: { fontSize: 12, fontFamily: Fonts.medium },

    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.lg },
    toggleLabel: { fontSize: 14, fontFamily: Fonts.medium },
    toggleTrack: { width: 44, height: 24, borderRadius: 12, justifyContent: 'center' },
    toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },

    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radii.lg, marginTop: Spacing.xl },
    primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: Fonts.semibold },

    detailHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    detailIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    detailActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    smallBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    detailTitleInput: { fontSize: 18, fontFamily: Fonts.bold, flex: 1, borderBottomWidth: 2, paddingBottom: 2 },
    detailStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.lg },
    detailStatusInfo: { flex: 1 },
    detailStatusLabel: { fontSize: 16, fontFamily: Fonts.bold },
    detailStatusSub: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 2 },

    editSection: { padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },

    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    infoCell: { width: '48%' as any, flexGrow: 1, flexBasis: '46%', padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1, gap: 3 },
    infoCellLabel: { fontSize: 10, fontFamily: Fonts.medium },
    infoCellValue: { fontSize: 14, fontFamily: Fonts.semibold },

    notesBox: { padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
    notesLabel: { fontSize: 11, fontFamily: Fonts.medium, marginBottom: 4 },
    notesText: { fontSize: 14, fontFamily: Fonts.regular, lineHeight: 20 },

    secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radii.lg, marginBottom: Spacing.sm },
    secondaryBtnText: { fontSize: 15, fontFamily: Fonts.semibold },

    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 12, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.xxl },
    deleteBtnText: { color: '#DC2626', fontSize: 14, fontFamily: Fonts.semibold },

    noResults: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
    noResultsText: { fontSize: 14, fontFamily: Fonts.medium },

    fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  });
