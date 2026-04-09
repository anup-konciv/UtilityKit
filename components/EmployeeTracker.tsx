/**
 * Shared "salary attendance" tracker.
 *
 * Cook, Maid, Driver and Office Boy were each ~600 LOC of duplicated code:
 * the same Present/Half/Absent calendar, the same effective-days math, the
 * same payment log + balance UI. This component absorbs the entire scaffold
 * so each tool file becomes a 5-line wrapper:
 *
 *   export default function CookTrackerScreen() {
 *     return (
 *       <EmployeeTracker
 *         storageKey={KEYS.cookTracker}
 *         defaultName="Cook"
 *         accent="#D97706"
 *         placeholderSalary="e.g. 8000"
 *       />
 *     );
 *   }
 *
 * Adding a new role (gardener, tutor, …) is now one storage key + one route.
 * Bug fixes (e.g. month-edge salary math, payment rounding) only need to
 * land here once.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { loadJSON, saveJSON } from '@/lib/storage';
import { haptics } from '@/lib/haptics';
import EmptyState from '@/components/EmptyState';

// ── Types ─────────────────────────────────────────────────────────────────────
type AttendanceStatus = 'present' | 'absent' | 'half';
type DayRecord = { date: string; status: AttendanceStatus };
type PaymentRecord = { id: string; date: string; amount: number; note: string };

/**
 * Single-employee record. The `id` field is new — legacy single-employee
 * data gets auto-migrated on first load (see `migrateStore`).
 */
type EmployeeData = {
  id: string;
  name: string;
  monthlySalary: number;
  attendance: DayRecord[];
  payments: PaymentRecord[];
};

/** Root store persisted under the AsyncStorage key. */
type EmployeeStore = {
  employees: EmployeeData[];
  /** User preference — which view shows first when opening an employee. */
  defaultView?: 'list' | 'calendar';
};

/** Legacy shape — used only for migration detection. */
type LegacyEmployeeData = {
  name: string;
  monthlySalary: number;
  attendance: DayRecord[];
  payments: PaymentRecord[];
};

/**
 * If the stored data is the old single-employee format, wrap it into the
 * new multi-employee store. Returns a valid `EmployeeStore` either way.
 */
function migrateStore(raw: any, defaultName: string): EmployeeStore {
  if (raw && Array.isArray(raw.employees)) return raw as EmployeeStore;
  // Old format — single EmployeeData at the root
  if (raw && typeof raw.name === 'string' && Array.isArray(raw.attendance)) {
    const legacy = raw as LegacyEmployeeData;
    return {
      employees: [{
        id: uid(),
        name: legacy.name || defaultName,
        monthlySalary: legacy.monthlySalary ?? 0,
        attendance: legacy.attendance ?? [],
        payments: legacy.payments ?? [],
      }],
    };
  }
  // Fresh install
  return { employees: [] };
}

type Props = {
  /** AsyncStorage key from `KEYS`. */
  storageKey: string;
  /** Default employee name shown until the user edits Settings. */
  defaultName: string;
  /** Accent colour for the screen + buttons. */
  accent: string;
  /** Placeholder shown in the salary input. */
  placeholderSalary?: string;
  /** Override the screen title. Defaults to the saved employee name. */
  titleOverride?: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const STATUS_CONFIG = {
  present: { icon: 'checkmark-circle' as const, color: '#10B981', label: 'P' },
  absent: { icon: 'close-circle' as const, color: '#EF4444', label: 'A' },
  half: { icon: 'remove-circle' as const, color: '#F59E0B', label: 'H' },
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const count = new Date(year, month + 1, 0).getDate();
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  for (let i = 1; i <= count; i++) days.push(`${prefix}-${String(i).padStart(2, '0')}`);
  return days;
}

function getDayName(dateStr: string): string {
  return WEEKDAYS[new Date(dateStr + 'T00:00:00').getDay()];
}

function buildCalWeeks(y: number, m: number): (number | null)[][] {
  const dow = new Date(y, m, 1).getDay();
  const dim = new Date(y, m + 1, 0).getDate();
  const flat: (number | null)[] = [];
  for (let i = 0; i < dow; i++) flat.push(null);
  for (let d = 1; d <= dim; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EmployeeTracker({
  storageKey,
  defaultName,
  accent,
  placeholderSalary = 'e.g. 8000',
  titleOverride,
}: Props) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, accent), [colors, accent]);

  const [store, setStore] = useState<EmployeeStore>({ employees: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [salaryInput, setSalaryInput] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(todayISO());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  // Sync viewMode with store.defaultView once on load.
  const defaultViewApplied = useRef(false);
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  // The employee currently being viewed (null = list screen).
  const data = store.employees.find(e => e.id === selectedId) ?? null;

  useEffect(() => {
    loadJSON<any>(storageKey, null).then((raw) => {
      const migrated = migrateStore(raw, defaultName);
      setStore(migrated);
      // Persist the migrated format so old data is converted once.
      saveJSON(storageKey, migrated);
      // If there's exactly 1 employee, auto-select them for backwards
      // compatibility — the user goes straight to the detail screen.
      if (migrated.employees.length === 1) {
        setSelectedId(migrated.employees[0].id);
      }
      // Apply the saved default view preference.
      if (!defaultViewApplied.current && migrated.defaultView) {
        setViewMode(migrated.defaultView);
        defaultViewApplied.current = true;
      }
    });
  }, [storageKey, defaultName]);

  const persistStore = useCallback(
    (s: EmployeeStore) => {
      setStore(s);
      saveJSON(storageKey, s);
    },
    [storageKey],
  );

  /** Update a single employee inside the store. */
  const persistEmployee = useCallback(
    (d: EmployeeData) => {
      persistStore({
        employees: store.employees.map(e => e.id === d.id ? d : e),
      });
    },
    [store.employees, persistStore],
  );

  const addEmployee = () => {
    const name = nameInput.trim() || `${defaultName} ${store.employees.length + 1}`;
    const salary = parseFloat(salaryInput) || 0;
    const newEmp: EmployeeData = {
      id: uid(),
      name,
      monthlySalary: salary,
      attendance: [],
      payments: [],
    };
    persistStore({ employees: [...store.employees, newEmp] });
    setSelectedId(newEmp.id);
    setShowAddEmployee(false);
    setNameInput('');
    setSalaryInput('');
    haptics.success();
  };

  const deleteEmployee = (id: string) => {
    Alert.alert('Delete', 'Remove this person and all their attendance/payment data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          persistStore({ employees: store.employees.filter(e => e.id !== id) });
          setSelectedId(null);
          haptics.warning();
        },
      },
    ]);
  };

  const toggleAttendance = (dateStr: string) => {
    if (!data) return;
    haptics.tap();
    const existing = data.attendance.find((a) => a.date === dateStr);
    let newStatus: AttendanceStatus;
    if (!existing) newStatus = 'present';
    else if (existing.status === 'present') newStatus = 'half';
    else if (existing.status === 'half') newStatus = 'absent';
    else newStatus = 'present';
    const filtered = data.attendance.filter((a) => a.date !== dateStr);
    persistEmployee({ ...data, attendance: [...filtered, { date: dateStr, status: newStatus }] });
  };

  const clearDay = (dateStr: string) => {
    if (!data) return;
    haptics.warning();
    persistEmployee({ ...data, attendance: data.attendance.filter((a) => a.date !== dateStr) });
  };

  const saveSettings = () => {
    if (!data) return;
    persistEmployee({
      ...data,
      name: nameInput.trim() || defaultName,
      monthlySalary: parseFloat(salaryInput) || 0,
    });
    haptics.success();
    setShowSettings(false);
  };

  const addPayment = () => {
    if (!data) return;
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      haptics.error();
      return;
    }
    const payment: PaymentRecord = { id: uid(), date: payDate, amount: amt, note: payNote.trim() };
    persistEmployee({
      ...data,
      payments: [payment, ...data.payments].sort((a, b) => b.date.localeCompare(a.date)),
    });
    haptics.success();
    setPayAmount('');
    setPayNote('');
    setShowPayment(false);
  };

  const deletePayment = (id: string) => {
    if (!data) return;
    Alert.alert('Delete Payment', 'Remove this payment record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          persistEmployee({ ...data, payments: data.payments.filter((p) => p.id !== id) });
        },
      },
    ]);
  };

  const monthDays = getMonthDays(viewMonth.year, viewMonth.month);
  const today = todayISO();
  const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
  // All computed values guard against `data` being null (list-screen state).
  const monthAttendance = data?.attendance.filter((a) => a.date.startsWith(monthKey)) ?? [];
  const presentDays = monthAttendance.filter((a) => a.status === 'present').length;
  const halfDays = monthAttendance.filter((a) => a.status === 'half').length;
  const absentDays = monthAttendance.filter((a) => a.status === 'absent').length;
  const effectiveDays = presentDays + halfDays * 0.5;
  const totalDaysInMonth = monthDays.length;
  const dailyRate = (data?.monthlySalary ?? 0) > 0 ? (data?.monthlySalary ?? 0) / totalDaysInMonth : 0;
  const monthEarned = dailyRate * effectiveDays;
  const monthPayments = data?.payments.filter((p) => p.date.startsWith(monthKey)) ?? [];
  const totalPaid = monthPayments.reduce((s, p) => s + p.amount, 0);
  const balance = monthEarned - totalPaid;

  const prevMonth = () => {
    haptics.tap();
    setViewMonth((prev) =>
      prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 }
    );
  };
  const nextMonth = () => {
    haptics.tap();
    setViewMonth((prev) =>
      prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 }
    );
  };

  const renderCalendar = () => {
    const calWeeks = buildCalWeeks(viewMonth.year, viewMonth.month);
    return (
      <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Attendance</Text>
        <View style={styles.calLegendRow}>
          {(['present', 'half', 'absent'] as const).map((k) => (
            <View key={k} style={styles.legendItemCal}>
              <View style={[styles.legendDotCal, { backgroundColor: STATUS_CONFIG[k].color }]} />
              <Text style={[styles.legendTextCal, { color: colors.textMuted }]}>
                {k === 'present' ? 'Present' : k === 'half' ? 'Half Day' : 'Absent'}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.weekRow}>
          {WEEKDAYS.map((w) => (
            <View key={w} style={styles.weekCell}>
              <Text style={[styles.weekText, { color: w === 'Sun' ? '#EF4444' : colors.textMuted }]}>
                {w}
              </Text>
            </View>
          ))}
        </View>
        {calWeeks.map((week, wi) => (
          <View key={wi} style={styles.calRow}>
            {week.map((d, di) => {
              if (d === null) return <View key={`empty-${wi}-${di}`} style={styles.calCellWrap} />;
              const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
              const record = data!.attendance.find((a) => a.date === dateStr);
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              const statusCfg = record ? STATUS_CONFIG[record.status] : null;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.calCellWrap,
                    statusCfg && {
                      borderWidth: 1.5,
                      borderColor: statusCfg.color,
                      backgroundColor: withAlpha(statusCfg.color, '20'),
                      borderRadius: Radii.md,
                    },
                    isFuture && { opacity: 0.35 },
                  ]}
                  onPress={() => !isFuture && toggleAttendance(dateStr)}
                  onLongPress={() => !isFuture && record && clearDay(dateStr)}
                  disabled={isFuture}
                >
                  <Text style={[styles.calDayNum, { color: colors.text }]}>{d}</Text>
                  {statusCfg && (
                    <Text style={[styles.calDayLabel, { color: statusCfg.color }]}>
                      {statusCfg.label}
                    </Text>
                  )}
                  {isToday && <View style={[styles.todayDotCal, { backgroundColor: accent }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderList = () => (
    <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={styles.sectionTitle}>Attendance</Text>
      <View style={styles.legend}>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: cfg.color }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Text>
          </View>
        ))}
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Unmarked</Text>
        </View>
      </View>
      {monthDays.map((dateStr) => {
        const record = data!.attendance.find((a) => a.date === dateStr);
        const isToday = dateStr === today;
        const isFuture = dateStr > today;
        const day = parseInt(dateStr.slice(8), 10);
        const dayName = getDayName(dateStr);
        const isSunday = dayName === 'Sun';
        return (
          <TouchableOpacity
            key={dateStr}
            style={[
              styles.dayRow,
              { borderBottomColor: colors.border },
              isToday && { backgroundColor: withAlpha(accent, '10') },
            ]}
            onPress={() => !isFuture && toggleAttendance(dateStr)}
            onLongPress={() => !isFuture && record && clearDay(dateStr)}
            disabled={isFuture}
          >
            <View style={styles.dayLeft}>
              <Text
                style={[
                  styles.dayNum,
                  { color: isSunday ? '#EF4444' : colors.text },
                  isFuture && { opacity: 0.4 },
                ]}
              >
                {day}
              </Text>
              <Text
                style={[
                  styles.dayName,
                  { color: isSunday ? '#EF4444' : colors.textMuted },
                  isFuture && { opacity: 0.4 },
                ]}
              >
                {dayName}
              </Text>
            </View>
            {isToday && (
              <View style={[styles.todayBadge, { backgroundColor: accent }]}>
                <Text style={styles.todayText}>Today</Text>
              </View>
            )}
            <View style={styles.dayRight}>
              {record ? (
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: withAlpha(STATUS_CONFIG[record.status].color, '20') },
                  ]}
                >
                  <Ionicons
                    name={STATUS_CONFIG[record.status].icon}
                    size={16}
                    color={STATUS_CONFIG[record.status].color}
                  />
                  <Text
                    style={[styles.statusText, { color: STATUS_CONFIG[record.status].color }]}
                  >
                    {STATUS_CONFIG[record.status].label}
                  </Text>
                </View>
              ) : isFuture ? (
                <Text style={[styles.unmarked, { color: colors.border }]}>—</Text>
              ) : (
                <Text style={[styles.unmarked, { color: colors.textMuted }]}>Tap</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ── Employee list screen (when no one is selected) ──────────────────────────
  if (!data) {
    return (
      <ScreenShell
        title={titleOverride ?? `${defaultName}s`}
        accentColor={accent}
        rightAction={
          <TouchableOpacity
            onPress={() => {
              setNameInput('');
              setSalaryInput('');
              setShowAddEmployee(true);
            }}
          >
            <Ionicons name="add-circle" size={28} color={accent} />
          </TouchableOpacity>
        }
      >
        {store.employees.length === 0 ? (
          <EmptyState
            icon="people-outline"
            title={`No ${defaultName.toLowerCase()}s yet`}
            hint={`Tap the + button to add your first ${defaultName.toLowerCase()}.`}
            accent={accent}
            actionLabel={`Add ${defaultName}`}
            onAction={() => {
              setNameInput('');
              setSalaryInput('');
              setShowAddEmployee(true);
            }}
          />
        ) : (
          store.employees.map(emp => {
            const mk = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
            const att = emp.attendance.filter(a => a.date.startsWith(mk));
            const pres = att.filter(a => a.status === 'present').length + att.filter(a => a.status === 'half').length * 0.5;
            return (
              <TouchableOpacity
                key={emp.id}
                style={[styles.empCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => setSelectedId(emp.id)}
                activeOpacity={0.7}
              >
                <View style={[styles.empAvatar, { backgroundColor: withAlpha(accent, '18') }]}>
                  <Text style={[styles.empAvatarText, { color: accent }]}>
                    {emp.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.empName, { color: colors.text }]}>{emp.name}</Text>
                  <Text style={[styles.empSub, { color: colors.textMuted }]}>
                    {emp.monthlySalary > 0 ? `₹${emp.monthlySalary.toLocaleString()}/mo` : 'No salary set'}
                    {' · '}{pres} days this month
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            );
          })
        )}

        {/* Add Employee Modal */}
        <KeyboardAwareModal
          visible={showAddEmployee}
          transparent
          animationType="fade"
          onRequestClose={() => setShowAddEmployee(false)}
        >
          <View style={styles.modalBg}>
            <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add {defaultName}</Text>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder={`${defaultName} name`}
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Monthly Salary</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={salaryInput}
                onChangeText={setSalaryInput}
                placeholder={placeholderSalary}
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                  onPress={() => setShowAddEmployee(false)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: accent }]}
                  onPress={addEmployee}
                >
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAwareModal>
      </ScreenShell>
    );
  }

  // ── Employee detail screen ─────────────────────────────────────────────────
  return (
    <ScreenShell
      title={titleOverride ?? data.name}
      accentColor={accent}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity
            onPress={() => {
              setNameInput('');
              setSalaryInput('');
              setShowAddEmployee(true);
            }}
          >
            <Ionicons name="person-add-outline" size={22} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setPayAmount('');
              setPayNote('');
              setPayDate(todayISO());
              setShowPayment(true);
            }}
          >
            <Ionicons name="cash-outline" size={22} color={accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setNameInput(data.name);
              setSalaryInput(data.monthlySalary > 0 ? String(data.monthlySalary) : '');
              setShowSettings(true);
            }}
          >
            <Ionicons name="settings-outline" size={22} color={accent} />
          </TouchableOpacity>
        </View>
      }
    >
      {/* Back to list — always visible so the user can access the full list
          and see other employees. */}
      {store.employees.length > 1 && (
        <TouchableOpacity
          style={[styles.backToList, { borderColor: colors.border }]}
          onPress={() => setSelectedId(null)}
          activeOpacity={0.7}
        >
          <Ionicons name="people-outline" size={16} color={accent} />
          <Text style={[styles.backToListText, { color: accent }]}>
            All {defaultName}s ({store.employees.length})
          </Text>
        </TouchableOpacity>
      )}

      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>
          {MONTHS[viewMonth.month]} {viewMonth.year}
        </Text>
        <TouchableOpacity onPress={nextMonth}>
          <Ionicons name="chevron-forward" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{presentDays}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Present</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#F59E0B' }]}>{halfDays}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Half Day</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#EF4444' }]}>{absentDays}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Absent</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: accent }]}>{effectiveDays}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Effective</Text>
          </View>
        </View>

        {data.monthlySalary > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.financeRow}>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Earned</Text>
                <Text style={[styles.financeVal, { color: '#10B981' }]}>
                  {monthEarned.toFixed(0)}
                </Text>
              </View>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Paid</Text>
                <Text style={[styles.financeVal, { color: '#3B82F6' }]}>
                  {totalPaid.toFixed(0)}
                </Text>
              </View>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Balance</Text>
                <Text
                  style={[
                    styles.financeVal,
                    { color: balance >= 0 ? '#EF4444' : '#10B981' },
                  ]}
                >
                  {balance >= 0
                    ? `${balance.toFixed(0)} due`
                    : `${Math.abs(balance).toFixed(0)} extra`}
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {data.monthlySalary === 0 && (
        <EmptyState
          icon="briefcase-outline"
          title={`Set ${defaultName.toLowerCase()} salary`}
          hint="Tap the gear icon above to enter the monthly salary. The daily rate, earned amount and balance will then update automatically as you mark attendance."
          accent={accent}
          actionLabel="Open Settings"
          onAction={() => {
            setNameInput(data.name);
            setSalaryInput('');
            setShowSettings(true);
          }}
          compact
        />
      )}

      {/* View Toggle */}
      <View style={[styles.viewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { k: 'list' as const, ic: 'list-outline', lb: 'List' },
          { k: 'calendar' as const, ic: 'calendar-outline', lb: 'Calendar' },
        ].map((v) => (
          <TouchableOpacity
            key={v.k}
            style={[styles.viewBtn, viewMode === v.k && { backgroundColor: accent }]}
            onPress={() => {
              haptics.selection();
              setViewMode(v.k);
            }}
          >
            <Ionicons
              name={v.ic as any}
              size={15}
              color={viewMode === v.k ? '#fff' : colors.textMuted}
            />
            <Text
              style={[
                styles.viewBtnText,
                { color: viewMode === v.k ? '#fff' : colors.textMuted },
              ]}
            >
              {v.lb}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'calendar' ? renderCalendar() : renderList()}

      {/* Payment History */}
      {data.payments.length > 0 && (
        <View style={[styles.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {data.payments.slice(0, 20).map((p) => (
            <View key={p.id} style={[styles.payRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.payDate, { color: colors.text }]}>{p.date}</Text>
                {p.note ? (
                  <Text style={[styles.payNote, { color: colors.textMuted }]}>{p.note}</Text>
                ) : null}
              </View>
              <Text style={[styles.payAmt, { color: '#10B981' }]}>
                {p.amount.toLocaleString()}
              </Text>
              <TouchableOpacity onPress={() => deletePayment(p.id)} style={{ marginLeft: 8 }}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Settings Modal */}
      <KeyboardAwareModal
        visible={showSettings}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{defaultName} Settings</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={`${defaultName} name`}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Monthly Salary</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={salaryInput}
              onChangeText={setSalaryInput}
              placeholder={placeholderSalary}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />

            {/* Default view toggle */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Default View</Text>
            <View style={[styles.defaultViewToggle, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              {([
                { key: 'list' as const, icon: 'list-outline', label: 'List' },
                { key: 'calendar' as const, icon: 'calendar-outline', label: 'Calendar' },
              ]).map(opt => {
                const active = (store.defaultView ?? 'list') === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={[styles.defaultViewBtn, active && { backgroundColor: accent }]}
                    onPress={() => {
                      persistStore({ ...store, defaultView: opt.key });
                      setViewMode(opt.key);
                    }}
                  >
                    <Ionicons
                      name={opt.icon as any}
                      size={15}
                      color={active ? '#fff' : colors.textMuted}
                    />
                    <Text style={[styles.defaultViewText, { color: active ? '#fff' : colors.textMuted }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowSettings(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: accent }]}
                onPress={saveSettings}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
            {/* Delete this employee — show the confirm alert FIRST, then
                close the modal only after the user taps Delete. Closing the
                modal and showing Alert simultaneously causes a race where
                the Alert never appears on some platforms. */}
            <TouchableOpacity
              style={[styles.deleteRow, { borderColor: '#FEE2E2' }]}
              onPress={() => {
                Alert.alert(
                  'Delete',
                  `Remove ${data.name} and all their attendance/payment data?`,
                  [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: () => {
                        setShowSettings(false);
                        persistStore({ employees: store.employees.filter(e => e.id !== data.id) });
                        setSelectedId(null);
                        haptics.warning();
                      },
                    },
                  ],
                );
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontFamily: Fonts.semibold, fontSize: 13 }}>
                Remove {data.name}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>

      {/* Payment Modal */}
      <KeyboardAwareModal
        visible={showPayment}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayment(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Record Payment</Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
            <View style={styles.datePickerWrap}>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() => {
                  const d = new Date(payDate + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  setPayDate(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  );
                }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dateDisplay,
                  { backgroundColor: colors.inputBg, borderColor: colors.border },
                ]}
                onPress={() => setPayDate(todayISO())}
              >
                <Ionicons name="calendar-outline" size={16} color={accent} />
                <Text style={[styles.dateText, { color: colors.text }]}>{payDate}</Text>
                {payDate === todayISO() && (
                  <Text style={[styles.todayTag, { color: accent }]}>Today</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() => {
                  const d = new Date(payDate + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  setPayDate(
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                  );
                }}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.dateBtnsRow}>
              {(() => {
                const btns: { label: string; date: string }[] = [];
                const d = new Date();
                btns.push({ label: 'Today', date: todayISO() });
                d.setDate(d.getDate() - 1);
                btns.push({
                  label: 'Yesterday',
                  date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
                });
                const now = new Date();
                btns.push({
                  label: `1st ${MONTHS[now.getMonth()]}`,
                  date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`,
                });
                return btns;
              })().map((b) => (
                <TouchableOpacity
                  key={b.label}
                  style={[
                    styles.dateQuickBtn,
                    payDate === b.date && {
                      backgroundColor: withAlpha(accent, '20'),
                      borderColor: accent,
                    },
                  ]}
                  onPress={() => setPayDate(b.date)}
                >
                  <Text
                    style={[
                      styles.dateQuickText,
                      { color: payDate === b.date ? accent : colors.textMuted },
                    ]}
                  >
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Amount</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="Amount paid"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={payNote}
              onChangeText={setPayNote}
              placeholder="Note (optional)"
              placeholderTextColor={colors.textMuted}
            />
            {data.monthlySalary > 0 && (
              <View style={styles.quickRow}>
                {[data.monthlySalary, Math.round(data.monthlySalary / 2), 500, 1000].map((a) => (
                  <TouchableOpacity
                    key={a}
                    style={[styles.quickBtn, { backgroundColor: withAlpha(accent, '15') }]}
                    onPress={() => setPayAmount(String(a))}
                  >
                    <Text style={[styles.quickText, { color: accent }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowPayment(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: accent }]}
                onPress={addPayment}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add Payment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>

      {/* Add Employee Modal (accessible from detail screen header) */}
      <KeyboardAwareModal
        visible={showAddEmployee}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddEmployee(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add {defaultName}</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={`${defaultName} name`}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Monthly Salary</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={salaryInput}
              onChangeText={setSalaryInput}
              placeholder={placeholderSalary}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowAddEmployee(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: accent }]}
                onPress={addEmployee}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors'], accent: string) =>
  StyleSheet.create({
    // ── Employee list ──
    empCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.lg,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginBottom: Spacing.sm,
    },
    empAvatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    empAvatarText: { fontSize: 20, fontFamily: Fonts.bold },
    empName: { fontSize: 15, fontFamily: Fonts.semibold, marginBottom: 2 },
    empSub: { fontSize: 12, fontFamily: Fonts.regular },
    // ── Back to list ──
    backToList: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'flex-start',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1,
      marginBottom: Spacing.md,
    },
    backToListText: { fontSize: 12, fontFamily: Fonts.semibold },
    // ── Default view toggle ──
    defaultViewToggle: {
      flexDirection: 'row',
      borderRadius: Radii.md,
      borderWidth: 1,
      overflow: 'hidden',
      marginBottom: Spacing.md,
    },
    defaultViewBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 10,
    },
    defaultViewText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    // ── Delete row ──
    deleteRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginTop: Spacing.md,
    },
    // ── Detail screen ──
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    monthLabel: { fontSize: 18, fontFamily: Fonts.bold },
    summaryCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 24, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    divider: { height: 1, marginVertical: Spacing.md },
    financeRow: { flexDirection: 'row', justifyContent: 'space-around' },
    financeItem: { alignItems: 'center' },
    financeLabel: { fontSize: 10, fontFamily: Fonts.medium },
    financeVal: { fontSize: 16, fontFamily: Fonts.bold, marginTop: 2 },
    calCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    legend: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
      flexWrap: 'wrap',
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 10, fontFamily: Fonts.medium },
    dayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: Spacing.sm,
      borderBottomWidth: 0.5,
    },
    dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 60 },
    dayNum: { fontSize: 15, fontFamily: Fonts.bold, width: 24, textAlign: 'right' },
    dayName: { fontSize: 11, fontFamily: Fonts.medium },
    todayBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radii.pill,
      marginRight: 'auto',
      marginLeft: 8,
    },
    todayText: { fontSize: 9, fontFamily: Fonts.bold, color: '#fff' },
    dayRight: { marginLeft: 'auto' },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: Radii.pill,
    },
    statusText: { fontSize: 12, fontFamily: Fonts.bold },
    unmarked: { fontSize: 12, fontFamily: Fonts.medium },
    payCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    payRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 0.5,
    },
    payDate: { fontSize: 13, fontFamily: Fonts.semibold },
    payNote: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    payAmt: { fontSize: 16, fontFamily: Fonts.bold },
    quickRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    quickBtn: { flex: 1, paddingVertical: 8, borderRadius: Radii.md, alignItems: 'center' },
    quickText: { fontSize: 13, fontFamily: Fonts.bold },
    fieldLabel: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
    datePickerWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: Spacing.sm,
    },
    dateArrow: { padding: 6 },
    dateDisplay: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderRadius: Radii.md,
      paddingVertical: 12,
    },
    dateText: { fontSize: 15, fontFamily: Fonts.bold },
    todayTag: { fontSize: 10, fontFamily: Fonts.bold },
    dateBtnsRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.lg },
    dateQuickBtn: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
    },
    dateQuickText: { fontSize: 11, fontFamily: Fonts.semibold },
    modalBg: {
      flex: 1,
      backgroundColor: '#00000066',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 15,
      fontFamily: Fonts.regular,
      marginBottom: Spacing.md,
    },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
    viewToggle: {
      flexDirection: 'row',
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: 3,
      gap: 3,
      marginBottom: Spacing.md,
    },
    viewBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 8,
      borderRadius: Radii.md,
    },
    viewBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    weekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
    weekText: { fontSize: 11, fontFamily: Fonts.semibold },
    calRow: { flexDirection: 'row' },
    calCellWrap: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    calDayNum: { fontSize: 14, fontFamily: Fonts.bold },
    calDayLabel: { fontSize: 9, fontFamily: Fonts.bold, marginTop: 1 },
    todayDotCal: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
    calLegendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    legendItemCal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDotCal: { width: 8, height: 8, borderRadius: 4 },
    legendTextCal: { fontSize: 11, fontFamily: Fonts.medium },
  });
