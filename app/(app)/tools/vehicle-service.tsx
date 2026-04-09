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
import { haptics } from '@/lib/haptics';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#0891B2';

/* ───── Types ───── */
type VehicleType = 'car' | 'bike' | 'scooter' | 'truck' | 'other';
type FrequencyUnit = 'days' | 'weeks' | 'months' | 'years';

type ServiceEntry = {
  id: string;
  date: string;
  serviceType: string;
  cost: number;
  odometer: number;
  garage: string;
  notes: string;
};

type Vehicle = {
  id: string;
  name: string;
  type: VehicleType;
  registration: string;
  currentOdometer: number;
  serviceFrequencyValue: number;
  serviceFrequencyUnit: FrequencyUnit;
  lastServiceDate: string;
  serviceLogs: ServiceEntry[];
  createdAt: string;
};

type VehicleStore = { vehicles: Vehicle[] };

/* ───── Constants ───── */
const VEHICLE_TYPES: { key: VehicleType; icon: string; color: string; label: string }[] = [
  { key: 'car', icon: 'car-sport-outline', color: '#3B82F6', label: 'Car' },
  { key: 'bike', icon: 'bicycle-outline', color: '#10B981', label: 'Bike' },
  { key: 'scooter', icon: 'bicycle-outline', color: '#F97316', label: 'Scooter' },
  { key: 'truck', icon: 'bus-outline', color: '#8B5CF6', label: 'Truck' },
  { key: 'other', icon: 'car-outline', color: '#64748B', label: 'Other' },
];

const SERVICE_PRESETS = [
  'Oil Change', 'Tire Rotation', 'Brake Service', 'Battery Replace',
  'AC Service', 'General Service', 'Wash & Detailing', 'Insurance Renewal',
  'Pollution Check (PUC)', 'Wheel Alignment', 'Spark Plug', 'Air Filter', 'Clutch Service',
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

function getNextDueDate(v: Vehicle): Date {
  return addToDate(v.lastServiceDate, v.serviceFrequencyValue, v.serviceFrequencyUnit);
}

function getDaysRemaining(v: Vehicle): number {
  const next = getNextDueDate(v);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

type StatusInfo = { label: string; color: string; bgColor: string; icon: string };

function getStatus(v: Vehicle): StatusInfo {
  const days = getDaysRemaining(v);
  if (days < 0) return { label: 'Overdue', color: '#DC2626', bgColor: '#FEE2E2', icon: 'alert-circle' };
  if (days <= 7) return { label: 'Due Soon', color: '#D97706', bgColor: '#FEF3C7', icon: 'warning' };
  if (days <= 30) return { label: 'Upcoming', color: '#2563EB', bgColor: '#DBEAFE', icon: 'time' };
  return { label: 'Good', color: '#059669', bgColor: '#D1FAE5', icon: 'checkmark-circle' };
}

function getTotalCost(v: Vehicle): number {
  return v.serviceLogs.reduce((s, l) => s + l.cost, 0);
}

function freqLabel(v: number, u: FrequencyUnit) {
  const singular = u.slice(0, -1);
  return `${v} ${v === 1 ? singular : u}`;
}

function getVehicleTypeInfo(type: VehicleType) {
  return VEHICLE_TYPES.find(t => t.key === type) ?? VEHICLE_TYPES[4];
}

/* ───── Component ───── */
export default function VehicleServiceScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [store, setStore] = useState<VehicleStore>({ vehicles: [] });
  const [showAdd, setShowAdd] = useState(false);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [showLogService, setShowLogService] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'overdue' | 'due' | 'good'>('all');

  // Add vehicle form
  const [addName, setAddName] = useState('');
  const [addType, setAddType] = useState<VehicleType>('car');
  const [addReg, setAddReg] = useState('');
  const [addOdometer, setAddOdometer] = useState('');
  const [addFreqVal, setAddFreqVal] = useState('6');
  const [addFreqUnit, setAddFreqUnit] = useState<FrequencyUnit>('months');
  const [addLastDate, setAddLastDate] = useState(todayISO());

  // Log service form
  const [logDate, setLogDate] = useState(todayISO());
  const [logType, setLogType] = useState('');
  const [logCustomType, setLogCustomType] = useState('');
  const [logCost, setLogCost] = useState('');
  const [logOdometer, setLogOdometer] = useState('');
  const [logGarage, setLogGarage] = useState('');
  const [logNotes, setLogNotes] = useState('');

  // Edit mode
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');
  const [editReg, setEditReg] = useState('');
  const [editFreqVal, setEditFreqVal] = useState('');
  const [editFreqUnit, setEditFreqUnit] = useState<FrequencyUnit>('months');

  useEffect(() => {
    loadJSON<VehicleStore>(KEYS.vehicleService, { vehicles: [] }).then(setStore);
  }, []);

  const persist = useCallback((s: VehicleStore) => {
    setStore(s);
    saveJSON(KEYS.vehicleService, s);
  }, []);

  // Schedule a service-due notification 7 days before the next service
  // is due. Cancels first so re-logging a service moves the notification.
  // Uses the dedicated `vehicle` namespace so cancellations are cheap.
  const scheduleVehicleReminder = useCallback(async (v: Vehicle) => {
    await cancel('vehicle', v.id);
    // Also clear any legacy schedule from when this used the `custom`
    // namespace, so upgrading users don't end up with double reminders.
    await cancel('custom', `vehicle-${v.id}`);
    const due = getNextDueDate(v);
    due.setHours(9, 0, 0, 0);
    const fireAt = new Date(due.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (fireAt.getTime() <= Date.now()) return;
    await ensureNotificationPermission();
    await schedule({
      id: v.id,
      namespace: 'vehicle',
      title: `${v.name} service due in 1 week`,
      body: `Last serviced ${v.lastServiceDate}. Book ahead.`,
      date: fireAt,
      repeat: 'none',
      data: { vehicleId: v.id },
    });
  }, []);

  const detailVehicle = store.vehicles.find(v => v.id === showDetail);

  /* ───── Sorted & filtered ───── */
  const sortedVehicles = useMemo(() => {
    let list = [...store.vehicles];
    list.sort((a, b) => getDaysRemaining(a) - getDaysRemaining(b));
    if (filterStatus === 'overdue') list = list.filter(v => getDaysRemaining(v) < 0);
    else if (filterStatus === 'due') list = list.filter(v => { const d = getDaysRemaining(v); return d >= 0 && d <= 30; });
    else if (filterStatus === 'good') list = list.filter(v => getDaysRemaining(v) > 30);
    return list;
  }, [store.vehicles, filterStatus]);

  /* ───── Stats ───── */
  const stats = useMemo(() => {
    const all = store.vehicles;
    const overdue = all.filter(v => getDaysRemaining(v) < 0).length;
    const dueSoon = all.filter(v => { const d = getDaysRemaining(v); return d >= 0 && d <= 7; }).length;
    const totalSpent = all.reduce((s, v) => s + getTotalCost(v), 0);
    return { total: all.length, overdue, dueSoon, totalSpent };
  }, [store.vehicles]);

  /* ───── Add vehicle ───── */
  const addVehicle = () => {
    if (!addName.trim()) return;
    const newV: Vehicle = {
      id: uid(),
      name: addName.trim(),
      type: addType,
      registration: addReg.trim().toUpperCase(),
      currentOdometer: parseInt(addOdometer) || 0,
      serviceFrequencyValue: Math.max(1, parseInt(addFreqVal) || 6),
      serviceFrequencyUnit: addFreqUnit,
      lastServiceDate: addLastDate,
      serviceLogs: [{
        id: uid(), date: addLastDate, serviceType: 'Initial Setup',
        cost: 0, odometer: parseInt(addOdometer) || 0, garage: '', notes: 'Vehicle added',
      }],
      createdAt: todayISO(),
    };
    persist({ vehicles: [...store.vehicles, newV] });
    haptics.success();
    void scheduleVehicleReminder(newV);
    resetAddForm();
    setShowAdd(false);
  };

  const resetAddForm = () => {
    setAddName(''); setAddType('car'); setAddReg(''); setAddOdometer('');
    setAddFreqVal('6'); setAddFreqUnit('months'); setAddLastDate(todayISO());
  };

  /* ───── Log service ───── */
  const logService = () => {
    if (!detailVehicle) return;
    const sType = logType || logCustomType.trim() || 'General Service';
    const cost = parseFloat(logCost) || 0;
    const odo = parseInt(logOdometer) || detailVehicle.currentOdometer;
    const entry: ServiceEntry = {
      id: uid(), date: logDate, serviceType: sType,
      cost, odometer: odo, garage: logGarage.trim(), notes: logNotes.trim(),
    };
    const updated = store.vehicles.map(v =>
      v.id === detailVehicle.id
        ? { ...v, lastServiceDate: logDate, currentOdometer: odo, serviceLogs: [entry, ...v.serviceLogs] }
        : v
    );
    persist({ vehicles: updated });
    haptics.success();
    const target = updated.find(v => v.id === detailVehicle.id);
    if (target) void scheduleVehicleReminder(target);
    resetLogForm();
    setShowLogService(false);
  };

  const resetLogForm = () => {
    setLogDate(todayISO()); setLogType(''); setLogCustomType('');
    setLogCost(''); setLogOdometer(''); setLogGarage(''); setLogNotes('');
  };

  /* ───── Edit vehicle ───── */
  const saveEdit = () => {
    if (!detailVehicle || !editName.trim()) return;
    const updated = store.vehicles.map(v =>
      v.id === detailVehicle.id
        ? {
            ...v, name: editName.trim(), registration: editReg.trim().toUpperCase(),
            serviceFrequencyValue: Math.max(1, parseInt(editFreqVal) || 6),
            serviceFrequencyUnit: editFreqUnit,
          }
        : v
    );
    persist({ vehicles: updated });
    haptics.success();
    const target = updated.find(v => v.id === detailVehicle.id);
    if (target) void scheduleVehicleReminder(target);
    setEditMode(false);
  };

  /* ───── Delete ───── */
  const deleteVehicle = (id: string) => {
    Alert.alert('Delete', 'Remove this vehicle and all its service history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          haptics.warning();
          persist({ vehicles: store.vehicles.filter(v => v.id !== id) });
          void cancel('vehicle', id);
          // Clear legacy schedule too.
          void cancel('custom', `vehicle-${id}`);
          setShowDetail(null);
        },
      },
    ]);
  };

  const deleteLog = (vehId: string, logId: string) => {
    const veh = store.vehicles.find(v => v.id === vehId);
    if (!veh || veh.serviceLogs.length <= 1) return;
    Alert.alert('Delete Log', 'Remove this service entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          const newLogs = veh.serviceLogs.filter(l => l.id !== logId);
          const latestDate = newLogs.reduce((max, l) => l.date > max ? l.date : max, newLogs[0].date);
          const updated = store.vehicles.map(v =>
            v.id === vehId ? { ...v, serviceLogs: newLogs, lastServiceDate: latestDate } : v
          );
          persist({ vehicles: updated });
        },
      },
    ]);
  };

  /* ───── Render: Summary ───── */
  const renderSummary = () => (
    <View style={styles.summaryRow}>
      {[
        { key: 'all' as const, val: stats.total, label: 'Vehicles', color: ACCENT, bg: '#ECFEFF', ic: 'car-sport' },
        { key: 'overdue' as const, val: stats.overdue, label: 'Overdue', color: '#DC2626', bg: '#FEE2E2', ic: 'alert-circle' },
        { key: 'due' as const, val: stats.dueSoon, label: 'Due Soon', color: '#D97706', bg: '#FEF3C7', ic: 'warning' },
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

  /* ───── Render: Cost banner ───── */
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

  /* ───── Render: Vehicle card ───── */
  const renderCard = ({ item }: { item: Vehicle }) => {
    const status = getStatus(item);
    const daysLeft = getDaysRemaining(item);
    const typeInfo = getVehicleTypeInfo(item.type);
    const totalCost = getTotalCost(item);
    const nextDate = getNextDueDate(item);
    const nextISO = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {
          setShowDetail(item.id);
          setEditMode(false);
          setEditName(item.name);
          setEditReg(item.registration);
          setEditFreqVal(String(item.serviceFrequencyValue));
          setEditFreqUnit(item.serviceFrequencyUnit);
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardTop}>
          <View style={[styles.cardIconWrap, { backgroundColor: status.bgColor }]}>
            <Ionicons name={typeInfo.icon as any} size={22} color={typeInfo.color} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
            <Text style={[styles.cardSub, { color: colors.textMuted }]}>{item.registration || typeInfo.label}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bgColor }]}>
            <Ionicons name={status.icon as any} size={12} color={status.color} />
            <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
          </View>
        </View>

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
          {totalCost > 0 && (
            <View style={styles.cardMeta}>
              <Ionicons name="card-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.cardMetaText, { color: colors.textSub }]}>{'\u20B9'}{totalCost.toLocaleString('en-IN')}</Text>
            </View>
          )}
        </View>

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

  /* ───── Render: Empty ───── */
  const renderEmpty = () => (
    <View style={styles.emptyWrap}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.card }]}>
        <Ionicons name="car-sport-outline" size={48} color={ACCENT} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Vehicles Yet</Text>
      <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>
        Add your vehicles to track{'\n'}their service schedules & costs
      </Text>
      <TouchableOpacity style={[styles.emptyBtn, { backgroundColor: ACCENT }]} onPress={() => setShowAdd(true)}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyBtnText}>Add First Vehicle</Text>
      </TouchableOpacity>
    </View>
  );

  /* ───── Render: Add modal ───── */
  const renderAddModal = () => (
    <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Vehicle</Text>
            <TouchableOpacity onPress={() => { setShowAdd(false); resetAddForm(); }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Vehicle Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={addName} onChangeText={setAddName}
              placeholder="e.g. My Car, Honda Activa"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Type</Text>
            <View style={styles.typeRow}>
              {VEHICLE_TYPES.map(t => (
                <TouchableOpacity
                  key={t.key}
                  style={[styles.typeBtn, { backgroundColor: addType === t.key ? t.color : colors.card, borderColor: addType === t.key ? t.color : colors.border }]}
                  onPress={() => setAddType(t.key)}
                  activeOpacity={0.7}
                >
                  <Ionicons name={t.icon as any} size={20} color={addType === t.key ? '#fff' : t.color} />
                  <Text style={[styles.typeBtnText, { color: addType === t.key ? '#fff' : colors.textSub }]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Registration Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={addReg} onChangeText={setAddReg}
              placeholder="e.g. KA01AB1234"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Current Odometer (km)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={addOdometer} onChangeText={setAddOdometer}
              placeholder="e.g. 25000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Service Frequency</Text>
            <View style={styles.freqRow}>
              <TextInput
                style={[styles.input, styles.freqInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={addFreqVal} onChangeText={setAddFreqVal}
                keyboardType="number-pad" placeholder="6" placeholderTextColor={colors.textMuted}
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
            onPress={addVehicle} disabled={!addName.trim()}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ───── Render: Detail modal ───── */
  const renderDetailModal = () => {
    if (!detailVehicle) return null;
    const status = getStatus(detailVehicle);
    const daysLeft = getDaysRemaining(detailVehicle);
    const typeInfo = getVehicleTypeInfo(detailVehicle.type);
    const totalCost = getTotalCost(detailVehicle);
    const nextDate = getNextDueDate(detailVehicle);
    const nextISO = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

    return (
      <Modal visible={!!showDetail} transparent animationType="slide" onRequestClose={() => setShowDetail(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface, maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={styles.detailHeaderLeft}>
                <View style={[styles.detailIconWrap, { backgroundColor: status.bgColor }]}>
                  <Ionicons name={typeInfo.icon as any} size={24} color={typeInfo.color} />
                </View>
                {editMode ? (
                  <TextInput
                    style={[styles.detailTitleInput, { color: colors.text, borderColor: ACCENT }]}
                    value={editName} onChangeText={setEditName} autoFocus
                  />
                ) : (
                  <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>{detailVehicle.name}</Text>
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
                    {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : daysLeft === 0 ? 'Service due today' : `${daysLeft} days until next service`}
                  </Text>
                </View>
              </View>

              {/* Info grid */}
              {editMode ? (
                <View style={[styles.editSection, { borderColor: colors.border }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Registration</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={editReg} onChangeText={setEditReg} autoCapitalize="characters"
                  />
                  <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Service Frequency</Text>
                  <View style={styles.freqRow}>
                    <TextInput
                      style={[styles.input, styles.freqInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                      value={editFreqVal} onChangeText={setEditFreqVal} keyboardType="number-pad"
                    />
                    <View style={[styles.unitToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
              ) : (
                <View style={styles.infoGrid}>
                  {[
                    { label: 'Registration', value: detailVehicle.registration || '—', icon: 'document-text-outline' },
                    { label: 'Type', value: typeInfo.label, icon: typeInfo.icon },
                    { label: 'Odometer', value: `${detailVehicle.currentOdometer.toLocaleString('en-IN')} km`, icon: 'speedometer-outline' },
                    { label: 'Frequency', value: `Every ${freqLabel(detailVehicle.serviceFrequencyValue, detailVehicle.serviceFrequencyUnit)}`, icon: 'repeat-outline' },
                    { label: 'Next Service', value: formatDate(nextISO), icon: 'calendar-outline' },
                    { label: 'Total Spent', value: `\u20B9${totalCost.toLocaleString('en-IN')}`, icon: 'card-outline' },
                  ].map((info, i) => (
                    <View key={i} style={[styles.infoCell, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      <Ionicons name={info.icon as any} size={14} color={ACCENT} />
                      <Text style={[styles.infoCellLabel, { color: colors.textMuted }]}>{info.label}</Text>
                      <Text style={[styles.infoCellValue, { color: colors.text }]}>{info.value}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Log service button */}
              {!editMode && (
                <TouchableOpacity
                  style={[styles.logServiceBtn, { backgroundColor: ACCENT }]}
                  onPress={() => {
                    setLogOdometer(String(detailVehicle.currentOdometer));
                    setShowLogService(true);
                  }}
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.logServiceBtnText}>Log Service</Text>
                </TouchableOpacity>
              )}

              {/* Service history */}
              {!editMode && detailVehicle.serviceLogs.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>
                    Service History ({detailVehicle.serviceLogs.length})
                  </Text>
                  {detailVehicle.serviceLogs.map(log => (
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
                          {detailVehicle.serviceLogs.length > 1 && (
                            <TouchableOpacity onPress={() => deleteLog(detailVehicle.id, log.id)}>
                              <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                      <View style={[styles.logTypeBadge, { backgroundColor: ACCENT + '18' }]}>
                        <Text style={[styles.logTypeText, { color: ACCENT }]}>{log.serviceType}</Text>
                      </View>
                      {(log.odometer > 0 || log.garage || log.notes) && (
                        <View style={styles.logBottom}>
                          {log.odometer > 0 && (
                            <View style={styles.logMetaRow}>
                              <Ionicons name="speedometer-outline" size={12} color={colors.textMuted} />
                              <Text style={[styles.logMetaText, { color: colors.textSub }]}>{log.odometer.toLocaleString('en-IN')} km</Text>
                            </View>
                          )}
                          {!!log.garage && (
                            <View style={styles.logMetaRow}>
                              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
                              <Text style={[styles.logMetaText, { color: colors.textSub }]}>{log.garage}</Text>
                            </View>
                          )}
                          {!!log.notes && (
                            <Text style={[styles.logNote, { color: colors.textMuted }]}>{log.notes}</Text>
                          )}
                        </View>
                      )}
                    </View>
                  ))}
                </>
              )}

              {/* Delete button */}
              {!editMode && (
                <TouchableOpacity
                  style={[styles.deleteBtn, { borderColor: '#FEE2E2' }]}
                  onPress={() => deleteVehicle(detailVehicle.id)}
                >
                  <Ionicons name="trash-outline" size={18} color="#DC2626" />
                  <Text style={styles.deleteBtnText}>Delete Vehicle</Text>
                </TouchableOpacity>
              )}
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
            <TouchableOpacity onPress={() => { setShowLogService(false); resetLogForm(); }}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Service Type</Text>
            <View style={styles.presetGrid}>
              {SERVICE_PRESETS.map(p => (
                <TouchableOpacity
                  key={p}
                  style={[styles.presetChip, {
                    backgroundColor: logType === p ? ACCENT : colors.card,
                    borderColor: logType === p ? ACCENT : colors.border,
                  }]}
                  onPress={() => { setLogType(logType === p ? '' : p); setLogCustomType(''); }}
                >
                  <Text style={[styles.presetText, { color: logType === p ? '#fff' : colors.text }]} numberOfLines={1}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {!logType && (
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, marginTop: Spacing.sm }]}
                value={logCustomType} onChangeText={setLogCustomType}
                placeholder="Or type custom service..." placeholderTextColor={colors.textMuted}
              />
            )}

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Date</Text>
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
              placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="number-pad"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Odometer (km)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={logOdometer} onChangeText={setLogOdometer}
              placeholder={detailVehicle ? String(detailVehicle.currentOdometer) : '0'}
              placeholderTextColor={colors.textMuted} keyboardType="number-pad"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Garage / Mechanic</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={logGarage} onChangeText={setLogGarage}
              placeholder="e.g. Quick Fit Auto" placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={logNotes} onChangeText={setLogNotes}
              placeholder="Any additional notes..." placeholderTextColor={colors.textMuted}
              multiline numberOfLines={3}
            />
          </ScrollView>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={logService}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.primaryBtnText}>Save Service Log</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  /* ───── Main render ───── */
  return (
    <ScreenShell title="Vehicle Service" accentColor={ACCENT}>
      {store.vehicles.length === 0 ? renderEmpty() : (
        <FlatList
          data={sortedVehicles}
          keyExtractor={v => v.id}
          renderItem={renderCard}
          ListHeaderComponent={
            // No inner horizontal padding — `contentContainerStyle` already
            // pads the FlatList. Wrapping the header in a second padded
            // View was making the summary + banner narrower than the cards.
            <>
              {renderSummary()}
              {renderCostBanner()}
            </>
          }
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Ionicons name="funnel-outline" size={32} color={colors.textMuted} />
              <Text style={[styles.noResultsText, { color: colors.textMuted }]}>No vehicles in this filter</Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      {store.vehicles.length > 0 && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: ACCENT }]} onPress={() => setShowAdd(true)} activeOpacity={0.8}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
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
    summaryRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, marginTop: Spacing.sm },
    summaryCard: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radii.lg, borderWidth: 1.5 },
    summaryIconWrap: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    summaryVal: { fontSize: 22, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 1 },

    costBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radii.md, borderWidth: 1, marginBottom: Spacing.md },
    costBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    costBannerLabel: { fontSize: 13, fontFamily: Fonts.medium },
    costBannerVal: { fontSize: 18, fontFamily: Fonts.bold },

    card: { borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
    cardTop: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.md },
    cardIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1 },
    cardName: { fontSize: 16, fontFamily: Fonts.semibold },
    cardSub: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
    statusText: { fontSize: 11, fontFamily: Fonts.semibold },
    cardBottom: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderTopWidth: 1, flexWrap: 'wrap', gap: 4 },
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

    fieldLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4, marginTop: Spacing.md },
    sectionLabel: { fontSize: 14, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },
    input: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 12 : 10, fontSize: 15, fontFamily: Fonts.regular },
    textArea: { minHeight: 72, textAlignVertical: 'top' },

    typeRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
    typeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.md, borderWidth: 1 },
    typeBtnText: { fontSize: 12, fontFamily: Fonts.semibold },

    freqRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    freqInput: { width: 64, textAlign: 'center' },
    unitToggle: { flexDirection: 'row', borderRadius: Radii.md, borderWidth: 1, overflow: 'hidden', flex: 1 },
    unitBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
    unitBtnText: { fontSize: 12, fontFamily: Fonts.semibold },

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

    logServiceBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radii.lg },
    logServiceBtnText: { color: '#fff', fontSize: 15, fontFamily: Fonts.semibold },

    logCard: { borderRadius: Radii.md, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
    logTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    logDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    logDate: { fontSize: 14, fontFamily: Fonts.semibold },
    logRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    logCost: { fontSize: 14, fontFamily: Fonts.bold },
    logTypeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.pill, marginTop: Spacing.sm },
    logTypeText: { fontSize: 12, fontFamily: Fonts.semibold },
    logBottom: { marginTop: Spacing.sm, gap: 4 },
    logMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    logMetaText: { fontSize: 12, fontFamily: Fonts.regular },
    logNote: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 2, lineHeight: 17 },

    deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 12, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.xl, marginBottom: Spacing.xxl },
    deleteBtnText: { color: '#DC2626', fontSize: 14, fontFamily: Fonts.semibold },

    noResults: { alignItems: 'center', paddingTop: 60, gap: Spacing.sm },
    noResultsText: { fontSize: 14, fontFamily: Fonts.medium },

    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    presetChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.pill, borderWidth: 1 },
    presetText: { fontSize: 13, fontFamily: Fonts.medium },

    fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 5 },
  });
