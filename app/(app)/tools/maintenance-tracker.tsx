import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert,
  FlatList, ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import DateField from '@/components/DateField';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { schedule, cancel, ensureNotificationPermission } from '@/lib/notifications';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#E67E22';

/* ───── Types ───── */
type FrequencyUnit = 'days' | 'weeks' | 'months' | 'years';

type ServiceLog = {
  id: string;
  date: string;
  cost: number;
  note: string;
  technician: string;
};

type Appliance = {
  id: string;
  name: string;
  category: string;
  icon: string;
  frequencyValue: number;
  frequencyUnit: FrequencyUnit;
  lastServiceDate: string;
  serviceLogs: ServiceLog[];
  createdAt: string;
};

type ApplianceStore = {
  appliances: Appliance[];
};

/* ───── Preset categories ───── */
const PRESETS: { name: string; icon: string; category: string; freqVal: number; freqUnit: FrequencyUnit }[] = [
  { name: 'Water Purifier', icon: 'water', category: 'Filter', freqVal: 3, freqUnit: 'months' },
  { name: 'AC Service', icon: 'snow', category: 'Cooling', freqVal: 6, freqUnit: 'months' },
  { name: 'Geyser', icon: 'flame', category: 'Heating', freqVal: 12, freqUnit: 'months' },
  { name: 'Home Cleaning', icon: 'sparkles', category: 'Cleaning', freqVal: 1, freqUnit: 'months' },
  { name: 'Painting', icon: 'color-fill', category: 'Decor', freqVal: 3, freqUnit: 'years' },
  { name: 'Washing Machine', icon: 'shirt', category: 'Appliance', freqVal: 6, freqUnit: 'months' },
  { name: 'Refrigerator', icon: 'cube', category: 'Appliance', freqVal: 12, freqUnit: 'months' },
  { name: 'Chimney', icon: 'cloud', category: 'Kitchen', freqVal: 3, freqUnit: 'months' },
  { name: 'Pest Control', icon: 'bug', category: 'Cleaning', freqVal: 6, freqUnit: 'months' },
  { name: 'Car Service', icon: 'car', category: 'Vehicle', freqVal: 6, freqUnit: 'months' },
  { name: 'Inverter Battery', icon: 'battery-half', category: 'Electric', freqVal: 12, freqUnit: 'months' },
  { name: 'RO Membrane', icon: 'filter', category: 'Filter', freqVal: 12, freqUnit: 'months' },
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

function addToDate(iso: string, value: number, unit: FrequencyUnit): Date {
  const d = new Date(iso + 'T00:00:00');
  if (unit === 'days') d.setDate(d.getDate() + value);
  else if (unit === 'weeks') d.setDate(d.getDate() + value * 7);
  else if (unit === 'months') d.setMonth(d.getMonth() + value);
  else d.setFullYear(d.getFullYear() + value);
  return d;
}

function getNextDueDate(a: Appliance): Date {
  return addToDate(a.lastServiceDate, a.frequencyValue, a.frequencyUnit);
}

function getDaysRemaining(a: Appliance): number {
  const next = getNextDueDate(a);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type StatusInfo = { label: string; color: string; bgColor: string; icon: string };

function getStatus(a: Appliance): StatusInfo {
  const days = getDaysRemaining(a);
  if (days < 0) return { label: 'Overdue', color: '#DC2626', bgColor: '#FEE2E2', icon: 'alert-circle' };
  if (days <= 7) return { label: 'Due Soon', color: '#D97706', bgColor: '#FEF3C7', icon: 'warning' };
  if (days <= 30) return { label: 'Upcoming', color: '#2563EB', bgColor: '#DBEAFE', icon: 'time' };
  return { label: 'Good', color: '#059669', bgColor: '#D1FAE5', icon: 'checkmark-circle' };
}

function getTotalCost(a: Appliance): number {
  return a.serviceLogs.reduce((s, l) => s + l.cost, 0);
}

function freqLabel(v: number, u: FrequencyUnit) {
  const singular = u.slice(0, -1);
  return `${v} ${v === 1 ? singular : u}`;
}

function toISO(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function dateToISO(d: Date) {
  return toISO(d.getFullYear(), d.getMonth(), d.getDate());
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

type CalEvent = {
  type: 'service' | 'due' | 'overdue';
  appliance: Appliance;
  log?: ServiceLog;
  date: string;
};

function buildCalWeeks(year: number, month: number): (number | null)[][] {
  const firstDow = new Date(year, month, 1).getDay();
  const total = new Date(year, month + 1, 0).getDate();
  const flat: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) flat.push(null);
  for (let d = 1; d <= total; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

/* ───── Component ───── */
export default function MaintenanceTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [store, setStore] = useState<ApplianceStore>({ appliances: [] });
  const [viewTab, setViewTab] = useState<'dashboard' | 'calendar'>('dashboard');
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showLogService, setShowLogService] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'due' | 'good'>('all');

  // Calendar state
  const [calMonth, setCalMonth] = useState(() => ({ year: new Date().getFullYear(), month: new Date().getMonth() }));
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());

  // Add form
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addIcon, setAddIcon] = useState('build');
  const [addFreqVal, setAddFreqVal] = useState('3');
  const [addFreqUnit, setAddFreqUnit] = useState<FrequencyUnit>('months');
  const [addLastDate, setAddLastDate] = useState(todayISO());
  const [showPresets, setShowPresets] = useState(true);

  // Log service form
  const [logDate, setLogDate] = useState(todayISO());
  const [logCost, setLogCost] = useState('');
  const [logNote, setLogNote] = useState('');
  const [logTech, setLogTech] = useState('');

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editFreqVal, setEditFreqVal] = useState('');
  const [editFreqUnit, setEditFreqUnit] = useState<FrequencyUnit>('months');

  useEffect(() => {
    loadJSON<ApplianceStore>(KEYS.maintenanceTracker, { appliances: [] }).then(setStore);
  }, []);

  const persist = useCallback((s: ApplianceStore) => {
    setStore(s);
    saveJSON(KEYS.maintenanceTracker, s);
  }, []);

  // Schedule a "service due" reminder 7 days before next due date for the
  // given appliance. Cancels any prior schedule first so updates dedupe.
  const scheduleAppliance = useCallback(async (a: Appliance) => {
    const dueDate = getNextDueDate(a);
    const remindAt = new Date(dueDate);
    remindAt.setDate(remindAt.getDate() - 7);
    remindAt.setHours(9, 0, 0, 0);
    if (remindAt.getTime() <= Date.now()) {
      // Either overdue already or within 7 days — fire tomorrow morning so
      // the user still gets a near-term nudge instead of nothing.
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      remindAt.setTime(tomorrow.getTime());
    }
    await ensureNotificationPermission();
    await schedule({
      id: a.id,
      namespace: 'maintenance',
      title: `${a.name} due soon`,
      body: `Next service ${formatDate(dateToISO(dueDate))}`,
      date: remindAt,
      repeat: 'none',
    });
  }, []);

  const detailAppliance = store.appliances.find(a => a.id === showDetail);

  /* ───── Sorted & filtered list ───── */
  const sortedAppliances = useMemo(() => {
    let list = [...store.appliances];
    // Sort by urgency (overdue first, then due soon, then by days remaining)
    list.sort((a, b) => getDaysRemaining(a) - getDaysRemaining(b));
    if (filterStatus === 'overdue') list = list.filter(a => getDaysRemaining(a) < 0);
    else if (filterStatus === 'due') list = list.filter(a => { const d = getDaysRemaining(a); return d >= 0 && d <= 30; });
    else if (filterStatus === 'good') list = list.filter(a => getDaysRemaining(a) > 30);
    return list;
  }, [store.appliances, filterStatus]);

  /* ───── Summary stats ───── */
  const stats = useMemo(() => {
    const all = store.appliances;
    const overdue = all.filter(a => getDaysRemaining(a) < 0).length;
    const dueSoon = all.filter(a => { const d = getDaysRemaining(a); return d >= 0 && d <= 7; }).length;
    const upcoming = all.filter(a => { const d = getDaysRemaining(a); return d > 7 && d <= 30; }).length;
    const good = all.filter(a => getDaysRemaining(a) > 30).length;
    const totalSpent = all.reduce((s, a) => s + getTotalCost(a), 0);
    return { overdue, dueSoon, upcoming, good, total: all.length, totalSpent };
  }, [store.appliances]);

  /* ───── Calendar events map ───── */
  const calendarData = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    const todayStr = todayISO();

    const addEvent = (date: string, ev: CalEvent) => {
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(ev);
    };

    for (const a of store.appliances) {
      // Past services
      for (const log of a.serviceLogs) {
        addEvent(log.date, { type: 'service', appliance: a, log, date: log.date });
      }
      // Next due date
      const next = getNextDueDate(a);
      const nextStr = dateToISO(next);
      const isOverdue = nextStr < todayStr;
      addEvent(nextStr, { type: isOverdue ? 'overdue' : 'due', appliance: a, date: nextStr });
    }

    return map;
  }, [store.appliances]);

  const selectedEvents = useMemo(() => {
    return calendarData.get(selectedDate) || [];
  }, [calendarData, selectedDate]);

  /* ───── Upcoming timeline (next 60 days) ───── */
  const upcomingTimeline = useMemo(() => {
    const events: CalEvent[] = [];
    const todayStr = todayISO();
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 60);

    for (const a of store.appliances) {
      const next = getNextDueDate(a);
      const nextStr = dateToISO(next);
      if (nextStr < todayStr) {
        events.push({ type: 'overdue', appliance: a, date: nextStr });
      } else if (next <= cutoff) {
        events.push({ type: 'due', appliance: a, date: nextStr });
      }
    }

    events.sort((a, b) => a.date.localeCompare(b.date));
    return events;
  }, [store.appliances]);

  /* ───── Add appliance ───── */
  const addAppliance = () => {
    if (!addName.trim()) return;
    const newItem: Appliance = {
      id: uid(),
      name: addName.trim(),
      category: addCategory.trim() || 'General',
      icon: addIcon,
      frequencyValue: Math.max(1, parseInt(addFreqVal) || 3),
      frequencyUnit: addFreqUnit,
      lastServiceDate: addLastDate,
      serviceLogs: [{
        id: uid(),
        date: addLastDate,
        cost: 0,
        note: 'Initial setup',
        technician: '',
      }],
      createdAt: todayISO(),
    };
    persist({ appliances: [...store.appliances, newItem] });
    void scheduleAppliance(newItem);
    resetAddForm();
    setShowAdd(false);
  };

  const selectPreset = (p: typeof PRESETS[0]) => {
    setAddName(p.name);
    setAddCategory(p.category);
    setAddIcon(p.icon);
    setAddFreqVal(String(p.freqVal));
    setAddFreqUnit(p.freqUnit);
    setShowPresets(false);
  };

  const resetAddForm = () => {
    setAddName(''); setAddCategory(''); setAddIcon('build');
    setAddFreqVal('3'); setAddFreqUnit('months'); setAddLastDate(todayISO());
    setShowPresets(true);
  };

  /* ───── Log service ───── */
  const logService = () => {
    if (!detailAppliance) return;
    const cost = parseFloat(logCost) || 0;
    const log: ServiceLog = {
      id: uid(), date: logDate, cost, note: logNote.trim(), technician: logTech.trim(),
    };
    const updated = store.appliances.map(a =>
      a.id === detailAppliance.id
        ? { ...a, lastServiceDate: logDate, serviceLogs: [log, ...a.serviceLogs] }
        : a
    );
    persist({ appliances: updated });
    // Reschedule the next due reminder now that the service date has moved.
    const next = updated.find(a => a.id === detailAppliance.id);
    if (next) void scheduleAppliance(next);
    setLogDate(todayISO()); setLogCost(''); setLogNote(''); setLogTech('');
    setShowLogService(false);
  };

  /* ───── Delete appliance ───── */
  const deleteAppliance = (id: string) => {
    Alert.alert('Delete', 'Remove this appliance and all its service history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          persist({ appliances: store.appliances.filter(a => a.id !== id) });
          void cancel('maintenance', id);
          setShowDetail(null);
        },
      },
    ]);
  };

  /* ───── Save edit ───── */
  const saveEdit = () => {
    if (!detailAppliance || !editName.trim()) return;
    const updated = store.appliances.map(a =>
      a.id === detailAppliance.id
        ? { ...a, name: editName.trim(), frequencyValue: Math.max(1, parseInt(editFreqVal) || 3), frequencyUnit: editFreqUnit }
        : a
    );
    persist({ appliances: updated });
    // Frequency may have changed, so the due date may have shifted too.
    const next = updated.find(a => a.id === detailAppliance.id);
    if (next) void scheduleAppliance(next);
    setEditMode(false);
  };

  /* ───── Delete a service log ───── */
  const deleteLog = (appId: string, logId: string) => {
    const app = store.appliances.find(a => a.id === appId);
    if (!app || app.serviceLogs.length <= 1) return;
    const newLogs = app.serviceLogs.filter(l => l.id !== logId);
    const latestDate = newLogs.reduce((max, l) => l.date > max ? l.date : max, newLogs[0].date);
    const updated = store.appliances.map(a =>
      a.id === appId ? { ...a, serviceLogs: newLogs, lastServiceDate: latestDate } : a
    );
    persist({ appliances: updated });
  };

  /* ───── Render: Status summary cards ───── */
  const renderSummary = () => (
    <View style={styles.summaryRow}>
      {[
        { key: 'overdue' as const, val: stats.overdue, label: 'Overdue', color: '#DC2626', bg: '#FEE2E2', ic: 'alert-circle' },
        { key: 'due' as const, val: stats.dueSoon, label: 'Due Soon', color: '#D97706', bg: '#FEF3C7', ic: 'warning' },
        { key: 'good' as const, val: stats.upcoming + stats.good, label: 'On Track', color: '#059669', bg: '#D1FAE5', ic: 'checkmark-circle' },
      ].map(s => (
        <TouchableOpacity
          key={s.key}
          style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: filterStatus === s.key ? s.color : colors.border }]}
          onPress={() => setFilterStatus(filterStatus === s.key ? 'all' : s.key)}
          activeOpacity={0.7}
        >
          <View style={[styles.summaryIconWrap, { backgroundColor: s.bg }]}>
            <Ionicons name={s.ic as any} size={18} color={s.color} />
          </View>
          <Text style={[styles.summaryVal, { color: s.color }]}>{s.val}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{s.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /* ───── Render: Cost summary ───── */
  const renderCostBanner = () => {
    if (stats.totalSpent <= 0) return null;
    return (
      <View style={[styles.costBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.costBannerLeft}>
          <Ionicons name="card-outline" size={18} color={ACCENT} />
          <Text style={[styles.costBannerLabel, { color: colors.textSub }]}>Total Spent</Text>
        </View>
        <Text style={[styles.costBannerVal, { color: ACCENT }]}>{'\u20B9'}{stats.totalSpent.toLocaleString('en-IN')}</Text>
      </View>
    );
  };

  /* ───── Render: Appliance card ───── */
  const renderCard = ({ item }: { item: Appliance }) => {
    const status = getStatus(item);
    const daysLeft = getDaysRemaining(item);
    const nextDate = getNextDueDate(item);
    const nextISO = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {
          setShowDetail(item.id);
          setEditMode(false);
          setEditName(item.name);
          setEditFreqVal(String(item.frequencyValue));
          setEditFreqUnit(item.frequencyUnit);
        }}
        activeOpacity={0.7}
      >
        {/* Top row: icon, name, status badge */}
        <View style={styles.cardTop}>
          <View style={[styles.cardIconWrap, { backgroundColor: status.bgColor }]}>
            <Ionicons name={item.icon as any} size={22} color={status.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.cardCategory, { color: colors.textMuted }]}>{item.category}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

        {/* Bottom row: next due, days remaining */}
        <View style={[styles.cardBottom, { borderTopColor: colors.border }]}>
          <View style={styles.cardMeta}>
            <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.cardMetaText, { color: colors.textSub }]}>Next: {formatDate(nextISO)}</Text>
          </View>
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.cardMetaText, { color: daysLeft < 0 ? '#DC2626' : daysLeft <= 7 ? '#D97706' : colors.textSub }]}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
            </Text>
          </View>
          <View style={styles.cardMeta}>
            <Ionicons name="repeat-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.cardMetaText, { color: colors.textSub }]}>Every {freqLabel(item.frequencyValue, item.frequencyUnit)}</Text>
          </View>
        </View>

        {/* Progress bar showing time elapsed */}
        {(() => {
          const totalDays = Math.max(1, Math.ceil((getNextDueDate(item).getTime() - new Date(item.lastServiceDate + 'T00:00:00').getTime()) / 86400000));
          const elapsed = totalDays - daysLeft;
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

  /* ───── Render: Empty state ───── */
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Ionicons name="construct-outline" size={48} color={ACCENT} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Appliances Yet</Text>
      <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
        Add your home appliances to track{'\n'}their maintenance schedules
      </Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: ACCENT }]} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Add First Appliance</Text>
      </TouchableOpacity>
    </View>
  );

  /* ───── Render: Add modal ───── */
  const renderAddModal = () => (
    <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Appliance</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); resetAddForm(); }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            {/* Quick presets */}
            {showPresets && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Quick Add</Text>
                <View style={styles.presetGrid}>
                  {PRESETS.filter(p => !store.appliances.some(a => a.name === p.name)).map(p => (
                    <TouchableOpacity
                      key={p.name}
                      style={[styles.presetChip, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => selectPreset(p)}
                    >
                      <Ionicons name={p.icon as any} size={16} color={ACCENT} />
                      <Text style={[styles.presetText, { color: colors.text }]} numberOfLines={1}>{p.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.dividerRow}>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.dividerText, { color: colors.textMuted }]}>or add custom</Text>
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                </View>
              </>
            )}

            {/* Form */}
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Appliance Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={addName}
              onChangeText={setAddName}
              placeholder="e.g. Water Purifier"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Category</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={addCategory}
              onChangeText={setAddCategory}
              placeholder="e.g. Kitchen, Vehicle, Electric"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Service Frequency</Text>
            <View style={styles.freqRow}>
              <TextInput
                style={[styles.input, styles.freqInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={addFreqVal}
                onChangeText={setAddFreqVal}
                keyboardType="number-pad"
                placeholder="3"
                placeholderTextColor={colors.textMuted}
              />
              <View style={[styles.unitToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {(['days', 'weeks', 'months', 'years'] as FrequencyUnit[]).map(u => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.unitBtn, addFreqUnit === u && { backgroundColor: ACCENT }]}
                    onPress={() => setAddFreqUnit(u)}
                  >
                    <Text style={[styles.unitBtnText, { color: addFreqUnit === u ? '#fff' : colors.textMuted }]}>
                      {u.charAt(0).toUpperCase() + u.slice(1, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Last Service Date</Text>
            <DateField
              value={addLastDate}
              onChange={setAddLastDate}
              accent={ACCENT}
              placeholder="When was it last serviced?"
              maxDate={todayISO()}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: ACCENT, opacity: addName.trim() ? 1 : 0.5 }]}
            onPress={addAppliance}
            disabled={!addName.trim()}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Add Appliance</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ───── Render: Detail modal ───── */
  const renderDetailModal = () => {
    if (!detailAppliance) return null;
    const status = getStatus(detailAppliance);
    const daysLeft = getDaysRemaining(detailAppliance);
    const nextDate = getNextDueDate(detailAppliance);
    const nextISO = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
    const totalCost = getTotalCost(detailAppliance);

    return (
      <Modal visible={!!showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '88%' }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.detailHeaderLeft}>
                <View style={[styles.detailIconWrap, { backgroundColor: status.bgColor }]}>
                  <Ionicons name={detailAppliance.icon as any} size={24} color={status.color} />
                </View>
                {editMode ? (
                  <TextInput
                    style={[styles.detailTitleInput, { color: colors.text, borderColor: ACCENT }]}
                    value={editName}
                    onChangeText={setEditName}
                    autoFocus
                  />
                ) : (
                  <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>{detailAppliance.name}</Text>
                )}
              </View>
              <View style={styles.detailActions}>
                {editMode ? (
                  <TouchableOpacity onPress={saveEdit} style={[styles.smallBtn, { backgroundColor: '#059669' }]}>
                    <Ionicons name="checkmark" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode(true)} style={[styles.smallBtn, { backgroundColor: colors.card }]}>
                    <Ionicons name="create-outline" size={16} color={colors.textSub} />
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
                <Ionicons name={status.icon as any} size={20} color={status.color} />
                <View style={styles.detailStatusInfo}>
                  <Text style={[styles.detailStatusLabel, { color: status.color }]}>{status.label}</Text>
                  <Text style={[styles.detailStatusSub, { color: status.color + 'CC' }]}>
                    {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : daysLeft === 0 ? 'Due today!' : `${daysLeft} days remaining`}
                  </Text>
                </View>
              </View>

              {/* Info grid */}
              <View style={styles.infoGrid}>
                {[
                  { icon: 'calendar', label: 'Last Service', value: formatDate(detailAppliance.lastServiceDate) },
                  { icon: 'calendar-outline', label: 'Next Due', value: formatDate(nextISO) },
                  { icon: 'repeat', label: 'Frequency', value: `Every ${freqLabel(detailAppliance.frequencyValue, detailAppliance.frequencyUnit)}` },
                  { icon: 'card', label: 'Total Spent', value: `\u20B9${totalCost.toLocaleString('en-IN')}` },
                  { icon: 'build', label: 'Services Done', value: String(detailAppliance.serviceLogs.length) },
                  { icon: 'pricetag', label: 'Category', value: detailAppliance.category },
                ].map((info, i) => (
                  <View key={i} style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name={info.icon as any} size={16} color={ACCENT} />
                    <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>{info.label}</Text>
                    <Text style={[styles.infoCellValue, { color: colors.text }]} numberOfLines={1}>{info.value}</Text>
                  </View>
                ))}
              </View>

              {/* Edit frequency */}
              {editMode && (
                <View style={[styles.editFreqSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Service Frequency</Text>
                  <View style={styles.freqRow}>
                    <TextInput
                      style={[styles.input, styles.freqInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                      value={editFreqVal}
                      onChangeText={setEditFreqVal}
                      keyboardType="number-pad"
                    />
                    <View style={[styles.unitToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      {(['days', 'weeks', 'months', 'years'] as FrequencyUnit[]).map(u => (
                        <TouchableOpacity
                          key={u}
                          style={[styles.unitBtn, editFreqUnit === u && { backgroundColor: ACCENT }]}
                          onPress={() => setEditFreqUnit(u)}
                        >
                          <Text style={[styles.unitBtnText, { color: editFreqUnit === u ? '#fff' : colors.textMuted }]}>
                            {u.charAt(0).toUpperCase() + u.slice(1, 3)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {/* Log service button */}
              <TouchableOpacity
                style={[styles.logServiceBtn, { backgroundColor: ACCENT }]}
                onPress={() => { setLogDate(todayISO()); setShowLogService(true); }}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.logServiceBtnText}>Log New Service</Text>
              </TouchableOpacity>

              {/* Service history */}
              <Text style={[styles.sectionLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>Service History</Text>
              {detailAppliance.serviceLogs.map(log => (
                <View key={log.id} style={[styles.logCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.logTop}>
                    <View style={styles.logDateWrap}>
                      <Ionicons name="calendar-outline" size={14} color={ACCENT} />
                      <Text style={[styles.logDate, { color: colors.text }]}>{formatDate(log.date)}</Text>
                    </View>
                    <View style={styles.logRight}>
                      {log.cost > 0 && (
                        <Text style={[styles.logCost, { color: ACCENT }]}>{'\u20B9'}{log.cost.toLocaleString('en-IN')}</Text>
                      )}
                      {detailAppliance.serviceLogs.length > 1 && (
                        <TouchableOpacity onPress={() => deleteLog(detailAppliance.id, log.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  {(log.note || log.technician) ? (
                    <View style={styles.logBottom}>
                      {log.note ? <Text style={[styles.logNote, { color: colors.textSub }]}>{log.note}</Text> : null}
                      {log.technician ? (
                        <View style={styles.logTechRow}>
                          <Ionicons name="person-outline" size={12} color={colors.textMuted} />
                          <Text style={[styles.logTech, { color: colors.textMuted }]}>{log.technician}</Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              ))}

              {/* Delete button */}
              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: '#DC262640' }]}
                onPress={() => deleteAppliance(detailAppliance.id)}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={styles.deleteBtnText}>Delete Appliance</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  /* ───── Render: Log service modal ───── */
  const renderLogModal = () => (
    <Modal visible={showLogService} transparent animationType="slide" onRequestClose={() => setShowLogService(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Log Service</Text>
            <TouchableOpacity onPress={() => setShowLogService(false)}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Service Date</Text>
          <DateField
            value={logDate}
            onChange={setLogDate}
            accent={ACCENT}
            placeholder="Date of service"
            maxDate={todayISO()}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Cost ({'\u20B9'})</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={logCost} onChangeText={setLogCost}
            keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Technician Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={logTech} onChangeText={setLogTech}
            placeholder="Optional" placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={logNote} onChangeText={setLogNote}
            placeholder="What was done?" placeholderTextColor={colors.textMuted}
            multiline numberOfLines={3}
          />

          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: ACCENT }]} onPress={logService}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Save Service Log</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ───── Render: Calendar View ───── */
  const renderCalendarView = () => {
    const { year, month } = calMonth;
    const calWeeks = buildCalWeeks(year, month);
    const todayStr = todayISO();

    const prevMonth = () => setCalMonth(m => m.month === 0 ? { year: m.year - 1, month: 11 } : { ...m, month: m.month - 1 });
    const nextMonth = () => setCalMonth(m => m.month === 11 ? { year: m.year + 1, month: 0 } : { ...m, month: m.month + 1 });

    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Month nav */}
        <View style={[styles.calMonthNav, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { const d = new Date(); setCalMonth({ year: d.getFullYear(), month: d.getMonth() }); }}>
            <Text style={[styles.calMonthText, { color: colors.text }]}>{MONTH_NAMES[month]} {year}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Weekday headers */}
        <View style={styles.calWeekRow}>
          {WEEKDAYS.map(d => (
            <View key={d} style={styles.calWeekCell}>
              <Text style={[styles.calWeekText, { color: colors.textMuted }]}>{d}</Text>
            </View>
          ))}
        </View>

        {/* Calendar grid */}
        {calWeeks.map((week, wi) => (
          <View key={wi} style={styles.calRow}>
            {week.map((day, di) => {
              if (day === null) return <View key={`e-${wi}-${di}`} style={styles.calCell} />;

              const dateStr = toISO(year, month, day);
              const events = calendarData.get(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const hasService = events?.some(e => e.type === 'service');
              const hasDue = events?.some(e => e.type === 'due');
              const hasOverdue = events?.some(e => e.type === 'overdue');

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.calCell,
                    isSelected && { backgroundColor: ACCENT + '20', borderRadius: 10 },
                    isToday && !isSelected && { backgroundColor: colors.card, borderRadius: 10 },
                  ]}
                  onPress={() => setSelectedDate(dateStr)}
                  activeOpacity={0.6}
                >
                  <Text style={[
                    styles.calDayText,
                    { color: isSelected ? ACCENT : isToday ? colors.text : colors.textSub },
                    isToday && { fontFamily: Fonts.bold },
                    isSelected && { fontFamily: Fonts.bold },
                  ]}>{day}</Text>
                  {/* Dots */}
                  <View style={styles.calDots}>
                    {hasService && <View style={[styles.calDot, { backgroundColor: '#059669' }]} />}
                    {hasDue && <View style={[styles.calDot, { backgroundColor: '#D97706' }]} />}
                    {hasOverdue && <View style={[styles.calDot, { backgroundColor: '#DC2626' }]} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

        {/* Legend */}
        <View style={styles.calLegend}>
          {[
            { color: '#059669', label: 'Serviced' },
            { color: '#D97706', label: 'Due' },
            { color: '#DC2626', label: 'Overdue' },
          ].map(l => (
            <View key={l.label} style={styles.calLegendItem}>
              <View style={[styles.calDot, { backgroundColor: l.color, marginTop: 0 }]} />
              <Text style={[styles.calLegendText, { color: colors.textMuted }]}>{l.label}</Text>
            </View>
          ))}
        </View>

        {/* Selected date events */}
        <View style={[styles.calDateHeader, { borderColor: colors.border }]}>
          <Ionicons name="calendar" size={16} color={ACCENT} />
          <Text style={[styles.calDateTitle, { color: colors.text }]}>{formatDate(selectedDate)}</Text>
          {selectedDate === todayStr && (
            <View style={[styles.todayBadge, { backgroundColor: ACCENT + '20' }]}>
              <Text style={[styles.todayBadgeText, { color: ACCENT }]}>Today</Text>
            </View>
          )}
        </View>

        {selectedEvents.length === 0 ? (
          <View style={styles.calNoEvents}>
            <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
            <Text style={[styles.calNoEventsText, { color: colors.textMuted }]}>No events on this date</Text>
          </View>
        ) : (
          selectedEvents.map((ev, i) => (
            <TouchableOpacity
              key={`${ev.appliance.id}-${ev.type}-${i}`}
              style={[styles.calEventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => {
                setShowDetail(ev.appliance.id);
                setEditMode(false);
                setEditName(ev.appliance.name);
                setEditFreqVal(String(ev.appliance.frequencyValue));
                setEditFreqUnit(ev.appliance.frequencyUnit);
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.calEventStripe, {
                backgroundColor: ev.type === 'service' ? '#059669' : ev.type === 'overdue' ? '#DC2626' : '#D97706',
              }]} />
              <View style={[styles.calEventIcon, {
                backgroundColor: ev.type === 'service' ? '#D1FAE5' : ev.type === 'overdue' ? '#FEE2E2' : '#FEF3C7',
              }]}>
                <Ionicons
                  name={ev.appliance.icon as any}
                  size={18}
                  color={ev.type === 'service' ? '#059669' : ev.type === 'overdue' ? '#DC2626' : '#D97706'}
                />
              </View>
              <View style={styles.calEventInfo}>
                <Text style={[styles.calEventName, { color: colors.text }]}>{ev.appliance.name}</Text>
                <Text style={[styles.calEventType, {
                  color: ev.type === 'service' ? '#059669' : ev.type === 'overdue' ? '#DC2626' : '#D97706',
                }]}>
                  {ev.type === 'service'
                    ? `Serviced${ev.log?.cost ? ` \u2022 \u20B9${ev.log.cost.toLocaleString('en-IN')}` : ''}`
                    : ev.type === 'overdue' ? 'Overdue for service' : 'Service due'}
                </Text>
                {ev.log?.note && ev.log.note !== 'Initial setup' ? (
                  <Text style={[styles.calEventNote, { color: colors.textMuted }]} numberOfLines={1}>{ev.log.note}</Text>
                ) : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}

        {/* Upcoming timeline */}
        {upcomingTimeline.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: colors.textSub, marginTop: Spacing.xl }]}>Upcoming (Next 60 Days)</Text>
            {upcomingTimeline.map((ev, i) => {
              const dLeft = getDaysRemaining(ev.appliance);
              const isOverdue = ev.type === 'overdue';
              return (
                <View key={`tl-${ev.appliance.id}-${i}`} style={styles.tlRow}>
                  {/* Timeline connector */}
                  <View style={styles.tlConnector}>
                    <View style={[styles.tlDot, { backgroundColor: isOverdue ? '#DC2626' : dLeft <= 7 ? '#D97706' : '#059669' }]} />
                    {i < upcomingTimeline.length - 1 && <View style={[styles.tlLine, { backgroundColor: colors.border }]} />}
                  </View>
                  {/* Event content */}
                  <TouchableOpacity
                    style={[styles.tlCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => {
                      setShowDetail(ev.appliance.id);
                      setEditMode(false);
                      setEditName(ev.appliance.name);
                      setEditFreqVal(String(ev.appliance.frequencyValue));
                      setEditFreqUnit(ev.appliance.frequencyUnit);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tlCardTop}>
                      <Ionicons name={ev.appliance.icon as any} size={16} color={isOverdue ? '#DC2626' : ACCENT} />
                      <Text style={[styles.tlCardName, { color: colors.text }]}>{ev.appliance.name}</Text>
                      <View style={[styles.tlBadge, {
                        backgroundColor: isOverdue ? '#FEE2E2' : dLeft <= 7 ? '#FEF3C7' : '#D1FAE5',
                      }]}>
                        <Text style={[styles.tlBadgeText, {
                          color: isOverdue ? '#DC2626' : dLeft <= 7 ? '#D97706' : '#059669',
                        }]}>
                          {isOverdue ? `${Math.abs(dLeft)}d overdue` : dLeft === 0 ? 'Today' : `${dLeft}d`}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.tlCardDate, { color: colors.textMuted }]}>{formatDate(ev.date)}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    );
  };

  /* ═══════ MAIN RENDER ═══════ */
  return (
    <ScreenShell
      title="Maintenance Tracker"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={
        <TouchableOpacity onPress={() => { resetAddForm(); setShowAdd(true); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* View tab toggle */}
      {store.appliances.length > 0 && (
        <View style={[styles.tabRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {([
            { key: 'dashboard' as const, icon: 'list-outline', label: 'Dashboard' },
            { key: 'calendar' as const, icon: 'calendar-outline', label: 'Calendar' },
          ]).map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, viewTab === t.key && styles.tabBtnActive, viewTab === t.key && { backgroundColor: ACCENT }]}
              onPress={() => setViewTab(t.key)}
            >
              <Ionicons name={t.icon as any} size={16} color={viewTab === t.key ? '#fff' : colors.textMuted} />
              <Text style={[styles.tabBtnText, { color: viewTab === t.key ? '#fff' : colors.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {store.appliances.length === 0 ? renderEmpty() : viewTab === 'calendar' ? renderCalendarView() : (
        <FlatList
          data={sortedAppliances}
          keyExtractor={item => item.id}
          renderItem={renderCard}
          ListHeaderComponent={
            <>
              {renderSummary()}
              {renderCostBanner()}
              {/* Filter pills */}
              <View style={styles.filterRow}>
                {(['all', 'overdue', 'due', 'good'] as const).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterPill, { backgroundColor: filterStatus === f ? ACCENT : colors.card, borderColor: filterStatus === f ? ACCENT : colors.border }]}
                    onPress={() => setFilterStatus(f)}
                  >
                    <Text style={[styles.filterPillText, { color: filterStatus === f ? '#fff' : colors.textSub }]}>
                      {f === 'all' ? `All (${stats.total})` : f === 'overdue' ? `Overdue (${stats.overdue})` : f === 'due' ? `Due (${stats.dueSoon + stats.upcoming})` : `Good (${stats.good})`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Ionicons name="funnel-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.noResultsText, { color: colors.textMuted }]}>No appliances in this filter</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {renderAddModal()}
      {renderDetailModal()}
      {renderLogModal()}
    </ScreenShell>
  );
}

/* ═══════ STYLES ═══════ */
const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    /* Summary */
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, marginTop: Spacing.sm },
    summaryCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radii.lg, borderWidth: 1.5 },
    summaryIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    summaryVal: { fontSize: 22, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 1 },

    /* Cost banner */
    costBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
    costBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    costBannerLabel: { fontSize: 13, fontFamily: Fonts.medium },
    costBannerVal: { fontSize: 18, fontFamily: Fonts.bold },

    /* Filter row */
    filterRow: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    filterPill: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    filterPillText: { fontSize: 12, fontFamily: Fonts.medium },

    /* Card */
    card: { borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
    cardTop: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    cardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontFamily: Fonts.semibold },
    cardCategory: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
    statusText: { fontSize: 11, fontFamily: Fonts.semibold },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1, flexWrap: 'wrap', gap: 4 },
    cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
    cardMetaText: { fontSize: 11, fontFamily: Fonts.regular },
    progressTrack: { height: 3, borderBottomLeftRadius: Radii.lg, borderBottomRightRadius: Radii.lg },
    progressFill: { height: 3, borderBottomLeftRadius: Radii.lg, borderBottomRightRadius: Radii.lg },

    /* Empty */
    emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, paddingTop: 60 },
    emptyIcon: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
    emptyTitle: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
    emptyDesc: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.xl },
    emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: Radii.pill },
    emptyBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semibold },

    /* Modal common */
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    modalTitle: { fontSize: 20, fontFamily: Fonts.bold, flex: 1 },

    /* Presets */
    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    presetChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.pill, borderWidth: 1 },
    presetText: { fontSize: 13, fontFamily: Fonts.medium },

    /* Divider */
    dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.md },
    dividerLine: { flex: 1, height: 1 },
    dividerText: { fontSize: 12, fontFamily: Fonts.regular },

    /* Form */
    sectionLabel: { fontSize: 14, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },
    fieldLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4, marginTop: Spacing.md },
    input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 15, fontFamily: Fonts.regular },
    textArea: { minHeight: 72, textAlignVertical: 'top' },
    freqRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    freqInput: { width: 64, textAlign: 'center' },
    unitToggle: { flexDirection: 'row', borderRadius: Radii.md, borderWidth: 1, overflow: 'hidden', flex: 1 },
    unitBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
    unitBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radii.lg, marginTop: Spacing.xl },
    primaryBtnText: { color: '#fff', fontSize: 16, fontFamily: Fonts.semibold },

    /* Detail modal */
    detailHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
    detailIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    detailActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    smallBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    detailTitleInput: { fontSize: 18, fontFamily: Fonts.bold, flex: 1, borderBottomWidth: 2, paddingBottom: 2 },
    detailStatus: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.lg },
    detailStatusInfo: { flex: 1 },
    detailStatusLabel: { fontSize: 16, fontFamily: Fonts.bold },
    detailStatusSub: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 2 },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    infoCell: { width: '48%' as any, flexGrow: 1, flexBasis: '46%', padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1, gap: 3 },
    infoCellLabel: { fontSize: 10, fontFamily: Fonts.medium },
    infoCellValue: { fontSize: 14, fontFamily: Fonts.semibold },
    editFreqSection: { padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
    logServiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radii.lg },
    logServiceBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semibold },

    /* Service log cards */
    logCard: { borderRadius: Radii.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
    logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    logDate: { fontSize: 14, fontFamily: Fonts.semibold },
    logRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    logCost: { fontSize: 14, fontFamily: Fonts.bold },
    logBottom: { marginTop: Spacing.sm },
    logNote: { fontSize: 13, fontFamily: Fonts.regular, lineHeight: 18 },
    logTechRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
    logTech: { fontSize: 12, fontFamily: Fonts.regular },

    /* Delete */
    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 12, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.xl, marginBottom: Spacing.xxl },
    deleteBtnText: { color: '#DC2626', fontSize: 14, fontFamily: Fonts.semibold },

    /* No results */
    noResults: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
    noResultsText: { fontSize: 14, fontFamily: Fonts.medium },

    /* View tabs */
    tabRow: { flexDirection: 'row', marginHorizontal: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.sm, borderRadius: Radii.lg, borderWidth: 1, padding: 3, gap: 3 },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: Radii.md },
    tabBtnActive: {},
    tabBtnText: { fontSize: 13, fontFamily: Fonts.semibold },

    /* Calendar */
    calMonthNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.sm, marginBottom: Spacing.md },
    calMonthText: { fontSize: 17, fontFamily: Fonts.bold },
    calWeekRow: { flexDirection: 'row' },
    calWeekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
    calWeekText: { fontSize: 11, fontFamily: Fonts.semibold },
    calRow: { flexDirection: 'row' },
    calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    calDayText: { fontSize: 14, fontFamily: Fonts.medium },
    calDots: { flexDirection: 'row', gap: 2, marginTop: 2, height: 6 },
    calDot: { width: 5, height: 5, borderRadius: 3 },
    calLegend: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginTop: Spacing.sm, marginBottom: Spacing.lg },
    calLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    calLegendText: { fontSize: 11, fontFamily: Fonts.medium },

    /* Selected date */
    calDateHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.sm, marginBottom: Spacing.sm, borderBottomWidth: 1 },
    calDateTitle: { fontSize: 15, fontFamily: Fonts.bold, flex: 1 },
    todayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill },
    todayBadgeText: { fontSize: 11, fontFamily: Fonts.semibold },
    calNoEvents: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    calNoEventsText: { fontSize: 13, fontFamily: Fonts.medium },

    /* Calendar event cards */
    calEventCard: { flexDirection: 'row', alignItems: 'center', borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.sm, overflow: 'hidden' },
    calEventStripe: { width: 4, alignSelf: 'stretch' },
    calEventIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginLeft: Spacing.md },
    calEventInfo: { flex: 1, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md },
    calEventName: { fontSize: 14, fontFamily: Fonts.semibold },
    calEventType: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 1 },
    calEventNote: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },

    /* Timeline */
    tlRow: { flexDirection: 'row', minHeight: 60 },
    tlConnector: { width: 24, alignItems: 'center' },
    tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: 14 },
    tlLine: { width: 2, flex: 1, marginTop: 2 },
    tlCard: { flex: 1, marginLeft: Spacing.sm, marginBottom: Spacing.sm, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    tlCardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    tlCardName: { fontSize: 14, fontFamily: Fonts.semibold, flex: 1 },
    tlBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill },
    tlBadgeText: { fontSize: 11, fontFamily: Fonts.semibold },
    tlCardDate: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 3 },
  });
