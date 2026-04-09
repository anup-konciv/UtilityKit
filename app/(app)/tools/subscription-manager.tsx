import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert,
  FlatList, ScrollView, Platform,} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import DateField from '@/components/DateField';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { schedule, cancel, ensureNotificationPermission } from '@/lib/notifications';
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
  /**
   * ISO date of the most recent payment for this subscription. Optional so
   * existing stored data (which never had this field) loads cleanly. The
   * "Mark as Paid" action sets this and advances `nextBillingDate`.
   */
  lastPaymentDate?: string;
};

/* ───── Constants ───── */
type Category = {
  id: string;
  label: string;
  icon: string;
  color: string;
  /** Marks user-created categories. Built-ins are immutable. */
  custom?: boolean;
};

const CATEGORIES: readonly Category[] = [
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

// Curated picker palette for the "Create category" sheet — biased toward
// subscription-shaped icons (streaming, devices, lifestyle, work).
const ICON_CHOICES: string[] = [
  'play-circle-outline', 'film-outline', 'tv-outline', 'videocam-outline',
  'musical-notes-outline', 'headset-outline', 'mic-outline', 'radio-outline',
  'cloud-outline', 'cloud-upload-outline', 'wifi-outline', 'cellular-outline',
  'code-slash-outline', 'terminal-outline', 'desktop-outline', 'laptop-outline',
  'phone-portrait-outline', 'tablet-portrait-outline', 'newspaper-outline', 'book-outline',
  'school-outline', 'library-outline', 'briefcase-outline', 'business-outline',
  'barbell-outline', 'fitness-outline', 'heart-outline', 'medkit-outline',
  'game-controller-outline', 'rocket-outline', 'star-outline', 'gift-outline',
  'fast-food-outline', 'cafe-outline', 'pizza-outline', 'wine-outline',
  'cart-outline', 'bag-outline', 'card-outline', 'wallet-outline',
  'home-outline', 'car-outline', 'paw-outline', 'shield-checkmark-outline',
];

const COLOR_CHOICES: string[] = [
  '#F97316', '#EF4444', '#EC4899', '#A855F7',
  '#8B5CF6', '#6366F1', '#3B82F6', '#06B6D4',
  '#14B8A6', '#10B981', '#84CC16', '#F59E0B',
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

// Module-level resolver. Mirrors the pattern used in the expense tracker so
// `getCat` can stay parameter-less and existing call sites (cards, detail
// modal, presets) keep working when custom categories are introduced.
let _allCats: readonly Category[] = CATEGORIES;
function setAllCats(list: readonly Category[]) { _allCats = list; }

function getCat(id: string): Category {
  return _allCats.find(c => c.id === id)
      ?? CATEGORIES.find(c => c.id === 'other')
      ?? CATEGORIES[CATEGORIES.length - 1];
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

function previousBillingDate(currentDate: string, cycle: BillingCycle): string {
  const d = new Date(currentDate + 'T00:00:00');
  const info = CYCLES.find(c => c.key === cycle)!;
  d.setMonth(d.getMonth() - info.months);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns how many days late the most recent payment was, relative to the
 * billing date that produced the current `nextBillingDate`. Returns `null`
 * when there's no payment history or the payment was on time / early.
 */
function getLatePaymentDays(sub: Subscription): number | null {
  if (!sub.lastPaymentDate) return null;
  const expected = previousBillingDate(sub.nextBillingDate, sub.cycle);
  const expectedDate = new Date(expected + 'T00:00:00');
  const paidDate = new Date(sub.lastPaymentDate + 'T00:00:00');
  const days = Math.ceil((paidDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

/* ───── Category Editor Modal ───── */
function CategoryEditor({ visible, existingLabels, onSave, onClose, colors }: {
  visible: boolean;
  existingLabels: string[];
  onSave: (cat: Category) => void;
  onClose: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const [name,  setName]  = useState('');
  const [icon,  setIcon]  = useState<string>(ICON_CHOICES[0]);
  const [color, setColor] = useState<string>(COLOR_CHOICES[0]);
  const e = useMemo(() => editorSt(colors), [colors]);

  // Reset state every time the modal is opened so the user always starts
  // from a clean slate (avoids stale name/icon from a previous session).
  useEffect(() => {
    if (visible) {
      setName('');
      setIcon(ICON_CHOICES[0]);
      setColor(COLOR_CHOICES[0]);
    }
  }, [visible]);

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
    onClose();
  };

  return (
    <KeyboardAwareModal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={e.overlay}>
        <View style={[e.box, { backgroundColor: colors.card }]}>
          {/* Live preview pill */}
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
            placeholder="e.g. Productivity, AI tools, Family plan"
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
      </KeyboardAwareModal>
  );
}

const editorSt = (c: ReturnType<typeof useAppTheme>['colors']) => StyleSheet.create({
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

/* ───── Component ───── */
export default function SubscriptionManagerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [subs, setSubs] = useState<Subscription[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'due' | 'cancelled'>('all');
  const [showPresets, setShowPresets] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [categoryEditorOpen, setCategoryEditorOpen] = useState(false);

  // Built-ins always come first; user-created categories follow.
  const allCategories = useMemo<readonly Category[]>(
    () => [...CATEGORIES, ...customCategories],
    [customCategories],
  );

  // Keep the module-level resolver in lockstep so `getCat` everywhere sees
  // custom categories.
  useEffect(() => { setAllCats(allCategories); }, [allCategories]);

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
  const [editNextDate, setEditNextDate] = useState('');
  const [editLastPaid, setEditLastPaid] = useState('');

  useEffect(() => {
    loadJSON<Subscription[]>(KEYS.subscriptions, []).then(setSubs);
    loadJSON<Category[]>(KEYS.subscriptionCustomCategories, []).then(setCustomCategories);
  }, []);

  const persist = useCallback((list: Subscription[]) => {
    setSubs(list);
    saveJSON(KEYS.subscriptions, list);
  }, []);

  const persistCustomCategories = (next: Category[]) => {
    setCustomCategories(next);
    saveJSON(KEYS.subscriptionCustomCategories, next);
  };
  const handleAddCategory = (cat: Category) => {
    persistCustomCategories([...customCategories, cat]);
    // The newly created category becomes the active selection in whichever
    // form opened the editor (add or edit).
    if (showAdd) setFormCategory(cat.id);
    if (showDetail && editMode) setEditCategory(cat.id);
  };
  const handleDeleteCategory = (id: string) => {
    // Block when subscriptions still reference this category — silently
    // re-tagging would surprise the user.
    const inUse = subs.filter(s => s.category === id).length;
    if (inUse > 0) {
      Alert.alert(
        'Category in use',
        `${inUse} subscription${inUse === 1 ? '' : 's'} use this category. Re-tag or delete those first.`,
      );
      return;
    }
    persistCustomCategories(customCategories.filter(c => c.id !== id));
  };

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
    // Prompt for OS-level permission on first save. Idempotent — the OS
    // won't re-ask once the user has answered.
    await ensureNotificationPermission();
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

    // Free-text search across name, category label, and notes.
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(s => {
        const cat = getCat(s.category);
        return (
          s.name.toLowerCase().includes(q)
          || cat.label.toLowerCase().includes(q)
          || (s.notes ?? '').toLowerCase().includes(q)
        );
      });
    }

    // Active subs always above cancelled, then by due date so urgent items
    // rise to the top.
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      return getDaysUntil(a.nextBillingDate) - getDaysUntil(b.nextBillingDate);
    });
    return list;
  }, [subs, filterStatus, searchQuery]);

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
    const trimmedNext = editNextDate.trim();
    const trimmedPaid = editLastPaid.trim();
    // Validate optional date fields. Both expect ISO YYYY-MM-DD; empty
    // strings keep the previous value (last paid stays empty if cleared).
    const dateRe = /^\d{4}-\d{2}-\d{2}$/;
    if (trimmedNext && !dateRe.test(trimmedNext)) {
      Alert.alert('Invalid date', 'Next billing date must be in YYYY-MM-DD format.');
      return;
    }
    if (trimmedPaid && !dateRe.test(trimmedPaid)) {
      Alert.alert('Invalid date', 'Last payment date must be in YYYY-MM-DD format.');
      return;
    }
    const updated = subs.map(s =>
      s.id === detailSub.id
        ? {
            ...s,
            name: editName.trim(),
            amount: parseFloat(editAmount) || s.amount,
            cycle: editCycle,
            category: editCategory,
            autoRenew: editAutoRenew,
            notes: editNotes.trim(),
            nextBillingDate: trimmedNext || s.nextBillingDate,
            lastPaymentDate: trimmedPaid || undefined,
          }
        : s
    );
    persist(updated);
    haptics.success();
    const editedSub = updated.find(s => s.id === detailSub.id);
    if (editedSub) void scheduleSubscription(editedSub);
    setEditMode(false);
  };

  /* ───── Mark as Paid ───── */
  const markAsPaid = (id: string) => {
    const sub = subs.find(s => s.id === id);
    if (!sub) return;
    const today = todayISO();
    const advancedNext = nextBillingAfterPayment(sub.nextBillingDate, sub.cycle);
    Alert.alert(
      'Mark as Paid',
      `Record ${sub.name} as paid today and roll the next bill forward to ${formatDate(advancedNext)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Paid',
          onPress: () => {
            const updated = subs.map(s =>
              s.id === id
                ? { ...s, lastPaymentDate: today, nextBillingDate: advancedNext }
                : s,
            );
            persist(updated);
            haptics.success();
            const next = updated.find(s => s.id === id);
            if (next) void scheduleSubscription(next);
          },
        },
      ],
    );
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
    // Single hero card. Counts are already in the filter pills below — no
    // need for a second row of stat tiles saying the same thing.
    <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.heroLeft}>
        <Text style={[styles.heroLabel, { color: colors.textMuted }]}>Total per month</Text>
        <Text style={[styles.heroValue, { color: ACCENT }]} numberOfLines={1} adjustsFontSizeToFit>
          {'\u20B9'}{stats.monthlyTotal.toLocaleString('en-IN')}
        </Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          {'\u20B9'}{stats.yearlyTotal.toLocaleString('en-IN')} per year
        </Text>
      </View>
      <View style={[styles.heroIconWrap, { backgroundColor: ACCENT + '18' }]}>
        <Ionicons name="card-outline" size={28} color={ACCENT} />
      </View>
    </View>
  );

  /* ───── Render: Search ───── */
  const renderSearch = () => (
    <View style={[styles.searchWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
      <Ionicons name="search-outline" size={16} color={colors.textMuted} />
      <TextInput
        style={[styles.searchInput, { color: colors.text }]}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholder="Search subscriptions…"
        placeholderTextColor={colors.textMuted}
        returnKeyType="search"
      />
      {searchQuery.length > 0 && (
        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  /* ───── Render: Filter pills ───── */
  const renderFilters = () => (
    // Bleed the horizontal ScrollView out of the parent's `paddingHorizontal:
    // Spacing.lg` so the rightmost pill never gets clipped by the right
    // padding edge. The content keeps its own internal padding to align with
    // the surrounding cards.
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.filterScroll, { marginHorizontal: -Spacing.lg }]}
      contentContainerStyle={[styles.filterRow, { paddingHorizontal: Spacing.lg }]}
    >
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
    const cat = getCat(item.category);
    const daysLeft = getDaysUntil(item.nextBillingDate);
    const monthlyAmt = getMonthlyAmount(item.amount, item.cycle);
    const isCancelled = item.status === 'cancelled';
    const urgencyColor =
      isCancelled       ? colors.textMuted
      : daysLeft < 0    ? '#DC2626'
      : daysLeft <= 7   ? '#D97706'
      : colors.textMuted;
    const urgencyText =
      isCancelled       ? 'Cancelled'
      : daysLeft < 0    ? `${Math.abs(daysLeft)}d overdue`
      : daysLeft === 0  ? 'Due today'
      : `${daysLeft}d left`;

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
          setEditNextDate(item.nextBillingDate);
          setEditLastPaid(item.lastPaymentDate ?? '');
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardTopRow}>
          <View style={[styles.cardIconWrap, { backgroundColor: cat.color + '18' }]}>
            <Ionicons name={cat.icon as any} size={20} color={cat.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]} numberOfLines={1}>
              {cat.label} · {getCycleLabel(item.cycle)}
            </Text>
          </View>
          {/* Fixed-width amount column so prices align across rows
              regardless of digit count (₹199 vs ₹1,499). */}
          <View style={styles.cardAmountCol}>
            <Text style={[styles.cardAmount, { color: colors.text }]} numberOfLines={1}>
              {'\u20B9'}{item.amount.toLocaleString('en-IN')}
            </Text>
            {item.cycle !== 'monthly' && (
              <Text style={[styles.cardMonthly, { color: colors.textMuted }]} numberOfLines={1}>
                {'\u20B9'}{monthlyAmt}/mo
              </Text>
            )}
          </View>
        </View>

        {/* Single subtle meta line. No separator border, no badge, no
            inline button — just date and urgency text in one line. */}
        <Text style={[styles.cardMetaText, { color: colors.textMuted }]}>
          {isCancelled
            ? 'Cancelled'
            : <>
                {formatDate(item.nextBillingDate)}
                <Text style={{ color: urgencyColor, fontFamily: daysLeft <= 7 ? Fonts.semibold : Fonts.regular }}>
                  {' · '}{urgencyText}
                </Text>
              </>}
        </Text>
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
    <KeyboardAwareModal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
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
                {allCategories.map(c => (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.catChip, {
                      backgroundColor: formCategory === c.id ? c.color : colors.card,
                      borderColor: formCategory === c.id ? c.color : colors.border,
                    }]}
                    onPress={() => setFormCategory(c.id)}
                    onLongPress={() => {
                      if (!c.custom) return;
                      Alert.alert(
                        'Delete category',
                        `Remove "${c.label}"?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteCategory(c.id) },
                        ],
                      );
                    }}
                    delayLongPress={350}
                  >
                    <Ionicons name={c.icon as any} size={14} color={formCategory === c.id ? '#fff' : c.color} />
                    <Text style={[styles.catChipText, { color: formCategory === c.id ? '#fff' : colors.textSub }]}>{c.label}</Text>
                  </TouchableOpacity>
                ))}
                {/* + New pill — opens the category editor modal. */}
                <TouchableOpacity
                  style={[styles.catChip, styles.catChipNew, { borderColor: ACCENT, backgroundColor: ACCENT + '12' }]}
                  onPress={() => setCategoryEditorOpen(true)}
                >
                  <Ionicons name="add-outline" size={14} color={ACCENT} />
                  <Text style={[styles.catChipText, { color: ACCENT }]}>New</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            {allCategories.some(c => c.custom) && (
              <Text style={[styles.catHint, { color: colors.textMuted }]}>
                Long-press a custom category to remove it.
              </Text>
            )}

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Next Billing Date</Text>
            <DateField
              value={formNextDate}
              onChange={setFormNextDate}
              accent={ACCENT}
              placeholder="Pick a date"
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
      </KeyboardAwareModal>
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
      <KeyboardAwareModal visible={!!showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(null)}>
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
                      {allCategories.map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={[styles.catChip, {
                            backgroundColor: editCategory === c.id ? c.color : colors.card,
                            borderColor: editCategory === c.id ? c.color : colors.border,
                          }]}
                          onPress={() => setEditCategory(c.id)}
                          onLongPress={() => {
                            if (!c.custom) return;
                            Alert.alert(
                              'Delete category',
                              `Remove "${c.label}"?`,
                              [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => handleDeleteCategory(c.id) },
                              ],
                            );
                          }}
                          delayLongPress={350}
                        >
                          <Ionicons name={c.icon as any} size={14} color={editCategory === c.id ? '#fff' : c.color} />
                          <Text style={[styles.catChipText, { color: editCategory === c.id ? '#fff' : colors.textSub }]}>{c.label}</Text>
                        </TouchableOpacity>
                      ))}
                      <TouchableOpacity
                        style={[styles.catChip, styles.catChipNew, { borderColor: ACCENT, backgroundColor: ACCENT + '12' }]}
                        onPress={() => setCategoryEditorOpen(true)}
                      >
                        <Ionicons name="add-outline" size={14} color={ACCENT} />
                        <Text style={[styles.catChipText, { color: ACCENT }]}>New</Text>
                      </TouchableOpacity>
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
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Next Billing Date</Text>
                  <DateField
                    value={editNextDate}
                    onChange={setEditNextDate}
                    accent={ACCENT}
                    placeholder="Pick a date"
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Last Payment Date (optional)</Text>
                  <DateField
                    value={editLastPaid}
                    onChange={setEditLastPaid}
                    accent={ACCENT}
                    placeholder="Not paid yet"
                  />

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
                      { label: 'Last Paid', value: detailSub.lastPaymentDate ? formatDate(detailSub.lastPaymentDate) : '—', icon: 'checkmark-done-outline' },
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

                  {/* Late-payment hint when applicable */}
                  {(() => {
                    const lateDays = getLatePaymentDays(detailSub);
                    return lateDays !== null ? (
                      <View style={[styles.lateHint, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' }]}>
                        <Ionicons name="warning-outline" size={14} color="#D97706" />
                        <Text style={[styles.lateHintText, { color: '#92400E' }]}>
                          Last payment was {lateDays} day{lateDays === 1 ? '' : 's'} late.
                        </Text>
                      </View>
                    ) : null;
                  })()}

                  {!!detailSub.notes && (
                    <View style={[styles.notesBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Text style={[styles.notesLabel, { color: colors.textMuted }]}>Notes</Text>
                      <Text style={[styles.notesText, { color: colors.textSub }]}>{detailSub.notes}</Text>
                    </View>
                  )}

                  {/* Mark as Paid — primary action for active subs */}
                  {detailSub.status === 'active' && (
                    <TouchableOpacity
                      style={[styles.secondaryBtn, { backgroundColor: '#D1FAE5' }]}
                      onPress={() => markAsPaid(detailSub.id)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="checkmark-done-outline" size={20} color="#059669" />
                      <Text style={[styles.secondaryBtnText, { color: '#059669' }]}>
                        Mark as Paid
                      </Text>
                    </TouchableOpacity>
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
      </KeyboardAwareModal>
    );
  };

  /* ───── Main render ───── */
  const handleExport = async () => {
    if (subs.length === 0) {
      Alert.alert('No Data', 'No subscriptions to export.');
      return;
    }
    // Plain JSON dump — easy to round-trip and easy to inspect.
    const json = JSON.stringify(subs, null, 2);
    try {
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(json);
      Alert.alert('Exported', `${subs.length} subscription${subs.length === 1 ? '' : 's'} copied as JSON to clipboard.`);
    } catch {
      Alert.alert('Exported', 'Subscriptions are ready in the data layer.');
    }
  };

  return (
    <ScreenShell
      title="Subscriptions"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity
          style={styles.headerSettingsBtn}
          onPress={() => setSettingsOpen(true)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="settings-outline" size={20} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {subs.length === 0 ? renderEmpty() : (
        <FlatList
          data={filtered}
          keyExtractor={s => s.id}
          renderItem={renderCard}
          ListHeaderComponent={
            // No inner padding here — the FlatList's contentContainerStyle
            // already pads horizontally, so wrapping the header in another
            // padded View was making the hero, search and filters appear
            // narrower than the cards below them.
            <View>
              {renderSummary()}
              {renderSearch()}
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

      <CategoryEditor
        visible={categoryEditorOpen}
        existingLabels={allCategories.map(c => c.label.toLowerCase())}
        onSave={handleAddCategory}
        onClose={() => setCategoryEditorOpen(false)}
        colors={colors}
      />

      {/* Settings sheet */}
      <KeyboardAwareModal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setSettingsOpen(false)} />
          <View style={[styles.settingsSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.settingsHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text, marginBottom: Spacing.lg }]}>Settings</Text>

            <TouchableOpacity
              style={[styles.settingsRow, { borderColor: colors.border }]}
              onPress={() => { setSettingsOpen(false); setCategoryEditorOpen(true); }}
              activeOpacity={0.7}
            >
              <View style={[styles.settingsIconWrap, { backgroundColor: ACCENT + '18' }]}>
                <Ionicons name="pricetags-outline" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingsRowTitle, { color: colors.text }]}>New category</Text>
                <Text style={[styles.settingsRowSub, { color: colors.textMuted }]}>
                  Add a custom category with your own icon and name
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsRow, { borderColor: colors.border }]}
              onPress={() => { setSettingsOpen(false); handleExport(); }}
              activeOpacity={0.7}
              disabled={subs.length === 0}
            >
              <View style={[styles.settingsIconWrap, { backgroundColor: ACCENT + '18' }]}>
                <Ionicons name="download-outline" size={18} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingsRowTitle, { color: subs.length === 0 ? colors.textMuted : colors.text }]}>
                  Export as JSON
                </Text>
                <Text style={[styles.settingsRowSub, { color: colors.textMuted }]}>
                  {subs.length === 0
                    ? 'Nothing to export yet'
                    : `Copy ${subs.length} subscription${subs.length === 1 ? '' : 's'} to clipboard`}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.settingsCloseBtn, { borderColor: colors.border }]}
              onPress={() => setSettingsOpen(false)}
            >
              <Text style={[styles.settingsCloseTxt, { color: colors.textMuted }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

/* ═══════ STYLES ═══════ */
const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Hero monthly card
    heroCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderRadius: Radii.xl, borderWidth: 1, marginTop: Spacing.sm, marginBottom: Spacing.md },
    heroLeft: { flex: 1 },
    heroLabel: { fontSize: 11, fontFamily: Fonts.medium, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
    heroValue: { fontSize: 32, fontFamily: Fonts.bold, lineHeight: 36 },
    heroSub: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 2 },
    heroIconWrap: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    // Search bar
    searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, height: 40, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular },
    // Header settings gear
    headerSettingsBtn: { width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    // Settings sheet
    settingsSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.lg, paddingBottom: 36 },
    settingsHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },
    settingsRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.sm },
    settingsIconWrap: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    settingsRowTitle: { fontSize: 14, fontFamily: Fonts.semibold, marginBottom: 2 },
    settingsRowSub: { fontSize: 12, fontFamily: Fonts.regular },
    settingsCloseBtn: { height: 44, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, marginTop: Spacing.sm },
    settingsCloseTxt: { fontSize: 14, fontFamily: Fonts.semibold },

    filterScroll: { marginBottom: Spacing.md },
    filterRow: { flexDirection: 'row', gap: 6 },
    // Tighter pill: smaller padding + smaller font so all 4 fit on a phone
    // without scrolling. Cancelled is rare so its count is short.
    filterPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    filterPillText: { fontSize: 11, fontFamily: Fonts.medium },

    // Plain card — no colored stripe, no row layout. Single padded container
    // with the top row (icon · info · amount) and a meta line below.
    card: { padding: Spacing.lg, gap: 8, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.sm, overflow: 'hidden' },
    cardTopRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    cardIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 15, fontFamily: Fonts.semibold },
    cardSub: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    // Fixed-width amount column so ₹199 and ₹1,499 align cleanly across rows.
    cardAmountCol: { width: 88, alignItems: 'flex-end' },
    cardAmount: { fontSize: 16, fontFamily: Fonts.bold },
    cardMonthly: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    cardMetaText: { fontSize: 12, fontFamily: Fonts.regular },
    lateHint: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
    lateHintText: { flex: 1, fontSize: 12, fontFamily: Fonts.medium },

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
    catChipNew: { borderStyle: 'dashed' },
    catChipText: { fontSize: 12, fontFamily: Fonts.medium },
    catHint: { fontSize: 11, fontFamily: Fonts.regular, fontStyle: 'italic', marginBottom: Spacing.sm },

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
