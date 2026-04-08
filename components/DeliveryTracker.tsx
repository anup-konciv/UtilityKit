/**
 * Shared delivery tracker.
 *
 * Milk, Water Can, Flower and Newspaper trackers were ~2 000 LOC of duplicated
 * calendar/list/payment-log scaffolding. They differ in *what* they record
 * each day:
 *
 *   - Milk      → two quantity slots (morning + evening), per-unit pricing,
 *                 no payment log (kept lightweight on purpose).
 *   - Water Can → single quantity slot (cans), per-unit pricing, payment log.
 *   - Flower    → binary delivered/missed, per-day pricing, payment log.
 *   - Newspaper → binary delivered/missed, fixed monthly subscription, no
 *                 payment log.
 *
 * One unified component with a `mode` discriminator now handles all four.
 * Each tool file becomes a 15-line wrapper (see milk/water-can/flower/
 * newspaper-tracker.tsx). Adding a new delivery service is a one-line config.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import EmptyState from '@/components/EmptyState';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { loadJSON, saveJSON } from '@/lib/storage';
import { haptics } from '@/lib/haptics';

// ── Types ─────────────────────────────────────────────────────────────────────
type PaymentRecord = { id: string; date: string; amount: number; note: string };

type DeliveryRecord = {
  date: string;
  /** qty-single mode: the quantity for that day. */
  qty?: number;
  /** qty-dual mode: first slot quantity. */
  slot1?: number;
  /** qty-dual mode: second slot quantity. */
  slot2?: number;
  /** binary mode: whether the delivery happened. */
  delivered?: boolean;
};

type DeliveryData = {
  vendorName: string;
  pricePerUnit: number;       // qty-* and binary modes
  monthlyCost: number;        // subscription mode (newspaper)
  defaultSlot1: number;       // qty-dual
  defaultSlot2: number;       // qty-dual
  records: DeliveryRecord[];
  payments: PaymentRecord[];
};

export type DeliveryMode = 'qty-single' | 'qty-dual' | 'binary';

type SlotMeta = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

type Props = {
  storageKey: string;
  mode: DeliveryMode;
  /** Default vendor / paper name. Used as title until edited. */
  defaultName: string;
  accent: string;
  /** Singular unit (e.g. "L", "can", "delivery"). */
  unit: string;
  /** Plural unit. Defaults to `unit + "s"`. */
  unitPlural?: string;
  /** Heading icon shown in the summary hero. */
  primaryIcon: keyof typeof Ionicons.glyphMap;
  /** Quick-pick values shown in the edit-quantity modal. Ignored for binary mode. */
  quickValues?: number[];
  /** Show payment log + balance? Newspaper says no. */
  showPaymentLog?: boolean;
  /** Subscription mode: a fixed monthly cost instead of per-unit pricing. */
  subscription?: boolean;
  /** Label for the price field in Settings. */
  priceLabel?: string;
  /** Placeholder for the price input. */
  pricePlaceholder?: string;
  /** Default values for `defaultSlot1` / `defaultSlot2` (qty-dual only). */
  defaultSlot1?: number;
  defaultSlot2?: number;
  /** Label / icon / colour for slot 1 (qty-dual only). */
  slot1?: SlotMeta;
  /** Label / icon / colour for slot 2 (qty-dual only). */
  slot2?: SlotMeta;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

/** Pure function: did this record represent an actual delivery on its day? */
function recordIsDelivered(rec: DeliveryRecord, mode: DeliveryMode): boolean {
  if (mode === 'binary') return !!rec.delivered;
  if (mode === 'qty-single') return (rec.qty ?? 0) > 0;
  return (rec.slot1 ?? 0) + (rec.slot2 ?? 0) > 0;
}

/** Pure function: total quantity for one record. */
function recordQty(rec: DeliveryRecord, mode: DeliveryMode): number {
  if (mode === 'binary') return rec.delivered ? 1 : 0;
  if (mode === 'qty-single') return rec.qty ?? 0;
  return (rec.slot1 ?? 0) + (rec.slot2 ?? 0);
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function DeliveryTracker(props: Props) {
  const {
    storageKey,
    mode,
    defaultName,
    accent,
    unit,
    primaryIcon,
    quickValues = [0, 1, 2, 3, 4, 5],
    showPaymentLog = true,
    subscription = false,
    priceLabel,
    pricePlaceholder = 'e.g. 60',
    defaultSlot1: initialSlot1 = 1,
    defaultSlot2: initialSlot2 = 0,
    slot1,
    slot2,
  } = props;
  const unitPlural = props.unitPlural ?? `${unit}s`;
  const computedPriceLabel = priceLabel ?? (subscription ? 'Monthly Subscription' : `Price per ${unit}`);

  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors, accent), [colors, accent]);

  const [data, setData] = useState<DeliveryData>({
    vendorName: defaultName,
    pricePerUnit: 0,
    monthlyCost: 0,
    defaultSlot1: initialSlot1,
    defaultSlot2: initialSlot2,
    records: [],
    payments: [],
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [editTarget, setEditTarget] = useState<{ date: string; slot?: 'slot1' | 'slot2' } | null>(null);
  const [editQty, setEditQty] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [defSlot1Input, setDefSlot1Input] = useState(String(initialSlot1));
  const [defSlot2Input, setDefSlot2Input] = useState(String(initialSlot2));
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(todayISO());
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    loadJSON<DeliveryData>(storageKey, {
      vendorName: defaultName,
      pricePerUnit: 0,
      monthlyCost: 0,
      defaultSlot1: initialSlot1,
      defaultSlot2: initialSlot2,
      records: [],
      payments: [],
    }).then((d) => {
      setData(d);
      setNameInput(d.vendorName);
      setPriceInput(
        subscription
          ? d.monthlyCost > 0 ? String(d.monthlyCost) : ''
          : d.pricePerUnit > 0 ? String(d.pricePerUnit) : ''
      );
      setDefSlot1Input(String(d.defaultSlot1));
      setDefSlot2Input(String(d.defaultSlot2));
    });
  }, [storageKey, defaultName, initialSlot1, initialSlot2, subscription]);

  const persist = useCallback(
    (d: DeliveryData) => {
      setData(d);
      saveJSON(storageKey, d);
    },
    [storageKey]
  );

  // ── Mutation helpers ────────────────────────────────────────────────────────
  const upsertRecord = (dateStr: string, mutator: (rec: DeliveryRecord) => DeliveryRecord) => {
    const existing = data.records.find((r) => r.date === dateStr);
    if (existing) {
      persist({
        ...data,
        records: data.records.map((r) => (r.date === dateStr ? mutator(r) : r)),
      });
    } else {
      // Seed an empty record for the day, then mutate it.
      const seed: DeliveryRecord =
        mode === 'binary'
          ? { date: dateStr, delivered: false }
          : mode === 'qty-single'
            ? { date: dateStr, qty: 0 }
            : { date: dateStr, slot1: data.defaultSlot1, slot2: data.defaultSlot2 };
      persist({ ...data, records: [...data.records, mutator(seed)] });
    }
  };

  const setQuantity = (dateStr: string, slot: 'qty' | 'slot1' | 'slot2', value: number) => {
    upsertRecord(dateStr, (rec) => ({ ...rec, [slot]: value }));
  };

  const toggleBinary = (dateStr: string) => {
    haptics.tap();
    const existing = data.records.find((r) => r.date === dateStr);
    if (!existing) {
      persist({ ...data, records: [...data.records, { date: dateStr, delivered: true }] });
    } else {
      persist({
        ...data,
        records: data.records.map((r) =>
          r.date === dateStr ? { ...r, delivered: !r.delivered } : r
        ),
      });
    }
  };

  const quickMarkQtyDual = (dateStr: string) => {
    haptics.tap();
    const existing = data.records.find((r) => r.date === dateStr);
    if (existing) {
      const hasDelivery = (existing.slot1 ?? 0) + (existing.slot2 ?? 0) > 0;
      persist({
        ...data,
        records: data.records.map((r) =>
          r.date === dateStr
            ? {
                ...r,
                slot1: hasDelivery ? 0 : data.defaultSlot1,
                slot2: hasDelivery ? 0 : data.defaultSlot2,
              }
            : r
        ),
      });
    } else {
      persist({
        ...data,
        records: [
          ...data.records,
          { date: dateStr, slot1: data.defaultSlot1, slot2: data.defaultSlot2 },
        ],
      });
    }
  };

  const saveSettings = () => {
    const priceVal = parseFloat(priceInput) || 0;
    persist({
      ...data,
      vendorName: nameInput.trim() || defaultName,
      pricePerUnit: subscription ? data.pricePerUnit : priceVal,
      monthlyCost: subscription ? priceVal : data.monthlyCost,
      defaultSlot1: parseFloat(defSlot1Input) || 0,
      defaultSlot2: parseFloat(defSlot2Input) || 0,
    });
    haptics.success();
    setShowSettings(false);
  };

  const saveEdit = () => {
    if (!editTarget) return;
    const value = parseFloat(editQty) || 0;
    if (mode === 'qty-single') {
      setQuantity(editTarget.date, 'qty', value);
    } else if (mode === 'qty-dual' && editTarget.slot) {
      setQuantity(editTarget.date, editTarget.slot, value);
    }
    haptics.success();
    setEditTarget(null);
  };

  const addPayment = () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) {
      haptics.error();
      return;
    }
    const payment: PaymentRecord = { id: uid(), date: payDate, amount: amt, note: payNote.trim() };
    persist({
      ...data,
      payments: [payment, ...data.payments].sort((a, b) => b.date.localeCompare(a.date)),
    });
    haptics.success();
    setPayAmount('');
    setPayNote('');
    setShowPayment(false);
  };

  const deletePayment = (id: string) => {
    Alert.alert('Delete Payment', 'Remove this payment record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          persist({ ...data, payments: data.payments.filter((p) => p.id !== id) });
        },
      },
    ]);
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const monthDays = getMonthDays(viewMonth.year, viewMonth.month);
  const today = todayISO();
  const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
  const monthRecords = data.records.filter((r) => r.date.startsWith(monthKey));
  const totalQty = monthRecords.reduce((s, r) => s + recordQty(r, mode), 0);
  const daysDelivered = monthRecords.filter((r) => recordIsDelivered(r, mode)).length;
  const daysMissed = mode === 'binary' ? monthRecords.filter((r) => r.delivered === false).length : 0;
  const totalSlot1 = mode === 'qty-dual' ? monthRecords.reduce((s, r) => s + (r.slot1 ?? 0), 0) : 0;
  const totalSlot2 = mode === 'qty-dual' ? monthRecords.reduce((s, r) => s + (r.slot2 ?? 0), 0) : 0;
  const avgPerDay = daysDelivered > 0 ? totalQty / daysDelivered : 0;
  const totalCost = subscription ? data.monthlyCost : totalQty * data.pricePerUnit;
  const monthPayments = data.payments.filter((p) => p.date.startsWith(monthKey));
  const totalPaid = monthPayments.reduce((s, p) => s + p.amount, 0);
  const balance = totalCost - totalPaid;
  const totalMarked = mode === 'binary' ? daysDelivered + daysMissed : 0;
  const deliveryRate =
    mode === 'binary' && totalMarked > 0 ? `${Math.round((daysDelivered / totalMarked) * 100)}%` : '—';

  const prevMonth = () => {
    haptics.tap();
    setViewMonth((p) => (p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 }));
  };
  const nextMonth = () => {
    haptics.tap();
    setViewMonth((p) => (p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 }));
  };

  // ── Renderers ───────────────────────────────────────────────────────────────
  const renderSummary = () => (
    <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.summaryMain}>
        <Ionicons name={primaryIcon} size={28} color={accent} />
        {mode !== 'binary' ? (
          <>
            <Text style={[styles.totalNumber, { color: accent }]}>
              {totalQty.toFixed(mode === 'qty-dual' ? 1 : 0)} {totalQty === 1 ? unit : unitPlural}
            </Text>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total this month</Text>
          </>
        ) : (
          <>
            <Text style={[styles.totalNumber, { color: accent }]}>{deliveryRate}</Text>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Delivery rate</Text>
          </>
        )}
      </View>

      <View style={styles.summaryGrid}>
        {mode === 'qty-dual' && slot1 && slot2 && (
          <>
            <View style={styles.summaryItem}>
              <Ionicons name={slot1.icon} size={16} color={slot1.color} />
              <Text style={[styles.summaryVal, { color: colors.text }]}>{totalSlot1.toFixed(1)} {unit}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{slot1.label}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name={slot2.icon} size={16} color={slot2.color} />
              <Text style={[styles.summaryVal, { color: colors.text }]}>{totalSlot2.toFixed(1)} {unit}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{slot2.label}</Text>
            </View>
          </>
        )}
        {mode === 'qty-single' && (
          <View style={styles.summaryItem}>
            <Ionicons name="cube-outline" size={16} color={accent} />
            <Text style={[styles.summaryVal, { color: colors.text }]}>{totalQty}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total {unitPlural}</Text>
          </View>
        )}
        {mode === 'binary' && (
          <>
            <View style={styles.summaryItem}>
              <Ionicons name="checkmark-circle" size={16} color="#10B981" />
              <Text style={[styles.summaryVal, { color: colors.text }]}>{daysDelivered}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Delivered</Text>
            </View>
            <View style={styles.summaryItem}>
              <Ionicons name="close-circle" size={16} color="#EF4444" />
              <Text style={[styles.summaryVal, { color: colors.text }]}>{daysMissed}</Text>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Missed</Text>
            </View>
          </>
        )}
        <View style={styles.summaryItem}>
          <Ionicons name="calendar-outline" size={16} color="#10B981" />
          <Text style={[styles.summaryVal, { color: colors.text }]}>{daysDelivered}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Days</Text>
        </View>
        {mode !== 'binary' && (
          <View style={styles.summaryItem}>
            <Ionicons name="trending-up-outline" size={16} color="#3B82F6" />
            <Text style={[styles.summaryVal, { color: colors.text }]}>{avgPerDay.toFixed(1)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Avg/Day</Text>
          </View>
        )}
      </View>

      {(subscription ? data.monthlyCost > 0 : data.pricePerUnit > 0) && (
        <>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {showPaymentLog ? (
            <View style={styles.financeRow}>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Cost</Text>
                <Text style={[styles.financeVal, { color: '#10B981' }]}>{totalCost.toFixed(0)}</Text>
              </View>
              <View style={styles.financeItem}>
                <Text style={[styles.financeLabel, { color: colors.textMuted }]}>Paid</Text>
                <Text style={[styles.financeVal, { color: '#3B82F6' }]}>{totalPaid.toFixed(0)}</Text>
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
          ) : (
            <View style={styles.costRow}>
              <Text style={[styles.costLabel, { color: colors.textMuted }]}>
                {subscription ? 'Monthly Subscription' : `Total (${data.pricePerUnit}/${unit})`}
              </Text>
              <Text style={[styles.costVal, { color: accent }]}>{totalCost.toFixed(0)}</Text>
            </View>
          )}
        </>
      )}
    </View>
  );

  const renderCellContent = (rec: DeliveryRecord | undefined, day: number) => {
    if (!rec) return null;
    if (mode === 'binary') {
      if (rec.delivered) return <Ionicons name="checkmark" size={12} color="#10B981" />;
      if (rec.delivered === false) return <Ionicons name="close" size={12} color="#EF4444" />;
      return null;
    }
    const total = recordQty(rec, mode);
    if (total <= 0) return null;
    return <Text style={[styles.calDayLabel, { color: accent }]}>{total.toFixed(mode === 'qty-dual' ? 1 : 0)}</Text>;
  };

  const renderCalendar = () => {
    const calWeeks = buildCalWeeks(viewMonth.year, viewMonth.month);
    return (
      <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Daily Log</Text>
        <View style={styles.calLegendRow}>
          {mode === 'binary' ? (
            <>
              <View style={styles.legendItemCal}>
                <View style={[styles.legendDotCal, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.legendTextCal, { color: colors.textMuted }]}>Delivered</Text>
              </View>
              <View style={styles.legendItemCal}>
                <View style={[styles.legendDotCal, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.legendTextCal, { color: colors.textMuted }]}>Missed</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.legendItemCal}>
                <View style={[styles.legendDotCal, { backgroundColor: accent }]} />
                <Text style={[styles.legendTextCal, { color: colors.textMuted }]}>Delivered</Text>
              </View>
              <View style={styles.legendItemCal}>
                <View style={[styles.legendDotCal, { backgroundColor: colors.border }]} />
                <Text style={[styles.legendTextCal, { color: colors.textMuted }]}>None</Text>
              </View>
            </>
          )}
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
              const record = data.records.find((r) => r.date === dateStr);
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              const delivered = record ? recordIsDelivered(record, mode) : false;
              const cellBorder =
                mode === 'binary'
                  ? record?.delivered === false
                    ? '#EF4444'
                    : delivered
                      ? '#10B981'
                      : null
                  : delivered
                    ? accent
                    : null;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.calCellWrap,
                    cellBorder && {
                      borderWidth: 1.5,
                      borderColor: cellBorder,
                      backgroundColor: withAlpha(cellBorder, '20'),
                      borderRadius: Radii.md,
                    },
                    isFuture && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (isFuture) return;
                    if (mode === 'binary') {
                      toggleBinary(dateStr);
                    } else if (mode === 'qty-single') {
                      const cur = record?.qty ?? 0;
                      setEditQty(String(cur));
                      setEditTarget({ date: dateStr });
                    } else {
                      const cur = record?.slot1 ?? 0;
                      setEditQty(String(cur));
                      setEditTarget({ date: dateStr, slot: 'slot1' });
                    }
                  }}
                  disabled={isFuture}
                >
                  <Text style={[styles.calDayNum, { color: colors.text }]}>{d}</Text>
                  {renderCellContent(record, d)}
                  {isToday && <View style={[styles.todayDotCal, { backgroundColor: accent }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  const renderListRow = (dateStr: string) => {
    const record = data.records.find((r) => r.date === dateStr);
    const isToday = dateStr === today;
    const isFuture = dateStr > today;
    const day = parseInt(dateStr.slice(8), 10);
    const dayName = getDayName(dateStr);
    const isSunday = dayName === 'Sun';

    if (mode === 'binary') {
      const delivered = record?.delivered === true;
      const missed = record?.delivered === false;
      return (
        <TouchableOpacity
          key={dateStr}
          style={[
            styles.dayRow,
            { borderBottomColor: colors.border },
            isToday && { backgroundColor: withAlpha(accent, '0A') },
          ]}
          onPress={() => !isFuture && toggleBinary(dateStr)}
          disabled={isFuture}
        >
          <View style={styles.dayLeft}>
            <Text
              style={[
                styles.dayNum,
                { color: isSunday ? '#EF4444' : colors.text },
                isFuture && { opacity: 0.3 },
              ]}
            >
              {day}
            </Text>
            <Text
              style={[
                styles.dayName,
                { color: isSunday ? '#EF4444' : colors.textMuted },
                isFuture && { opacity: 0.3 },
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
            {delivered ? (
              <View style={[styles.statusBadge, { backgroundColor: withAlpha('#10B981', '20') }]}>
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text style={[styles.statusText, { color: '#10B981' }]}>Delivered</Text>
              </View>
            ) : missed ? (
              <View style={[styles.statusBadge, { backgroundColor: withAlpha('#EF4444', '20') }]}>
                <Ionicons name="close-circle" size={16} color="#EF4444" />
                <Text style={[styles.statusText, { color: '#EF4444' }]}>Missed</Text>
              </View>
            ) : isFuture ? (
              <Text style={[styles.unmarked, { color: colors.border }]}>—</Text>
            ) : (
              <Text style={[styles.unmarked, { color: colors.textMuted }]}>Tap</Text>
            )}
          </View>
        </TouchableOpacity>
      );
    }

    if (mode === 'qty-single') {
      const qty = record?.qty ?? 0;
      const has = !!record;
      return (
        <TouchableOpacity
          key={dateStr}
          style={[
            styles.dayRow,
            { borderBottomColor: colors.border },
            isToday && { backgroundColor: withAlpha(accent, '0A') },
          ]}
          onPress={() => {
            if (isFuture) return;
            setEditQty(String(qty));
            setEditTarget({ date: dateStr });
          }}
          disabled={isFuture}
        >
          <View style={styles.dayLeft}>
            <Text
              style={[
                styles.dayNum,
                { color: isSunday ? '#EF4444' : colors.text },
                isFuture && { opacity: 0.3 },
              ]}
            >
              {day}
            </Text>
            <Text
              style={[
                styles.dayName,
                { color: isSunday ? '#EF4444' : colors.textMuted },
                isFuture && { opacity: 0.3 },
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
            <Text
              style={[
                styles.qtyText,
                { color: qty > 0 ? accent : colors.textMuted },
                isFuture && { opacity: 0.3 },
              ]}
            >
              {has ? `${qty} ${qty === 1 ? unit : unitPlural}` : 'Tap'}
            </Text>
          </View>
        </TouchableOpacity>
      );
    }

    // qty-dual
    const morning = record?.slot1 ?? 0;
    const evening = record?.slot2 ?? 0;
    const dayTotal = morning + evening;
    const has = !!record;
    return (
      <TouchableOpacity
        key={dateStr}
        style={[
          styles.dayRow,
          { borderBottomColor: colors.border },
          isToday && { backgroundColor: withAlpha(accent, '0A') },
        ]}
        onPress={() => !isFuture && quickMarkQtyDual(dateStr)}
        disabled={isFuture}
      >
        <View style={[styles.dayLeft, { width: 70 }]}>
          <Text
            style={[
              styles.dayNum,
              { color: isSunday ? '#EF4444' : colors.text },
              isFuture && { opacity: 0.3 },
            ]}
          >
            {day}
          </Text>
          <Text
            style={[
              styles.dayName,
              { color: isSunday ? '#EF4444' : colors.textMuted },
              isFuture && { opacity: 0.3 },
            ]}
          >
            {dayName}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.qtyCell, { flex: 1 }]}
          onPress={() => {
            if (isFuture) return;
            setEditQty(String(morning));
            setEditTarget({ date: dateStr, slot: 'slot1' });
          }}
          disabled={isFuture}
        >
          <Text
            style={[
              styles.qtyText,
              { color: morning > 0 ? slot1?.color ?? accent : colors.border },
              isFuture && { opacity: 0.3 },
            ]}
          >
            {has ? `${morning} ${unit}` : '—'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.qtyCell, { flex: 1 }]}
          onPress={() => {
            if (isFuture) return;
            setEditQty(String(evening));
            setEditTarget({ date: dateStr, slot: 'slot2' });
          }}
          disabled={isFuture}
        >
          <Text
            style={[
              styles.qtyText,
              { color: evening > 0 ? slot2?.color ?? accent : colors.border },
              isFuture && { opacity: 0.3 },
            ]}
          >
            {has ? `${evening} ${unit}` : '—'}
          </Text>
        </TouchableOpacity>
        <Text
          style={[
            styles.dayTotal,
            { color: dayTotal > 0 ? colors.text : colors.border, width: 50 },
            isFuture && { opacity: 0.3 },
          ]}
        >
          {has ? `${dayTotal.toFixed(1)}` : '—'}
        </Text>
      </TouchableOpacity>
    );
  };

  const isUnconfigured = subscription ? data.monthlyCost === 0 : data.pricePerUnit === 0;

  return (
    <ScreenShell
      title={data.vendorName}
      accentColor={accent}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {showPaymentLog && (
            <TouchableOpacity
              onPress={() => {
                setPayAmount('');
                setPayNote('');
                setPayDate(todayISO());
                setShowPayment(true);
              }}
            >
              <Ionicons name="cash-outline" size={24} color={accent} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => {
              setNameInput(data.vendorName);
              setPriceInput(
                subscription
                  ? data.monthlyCost > 0 ? String(data.monthlyCost) : ''
                  : data.pricePerUnit > 0 ? String(data.pricePerUnit) : ''
              );
              setDefSlot1Input(String(data.defaultSlot1));
              setDefSlot2Input(String(data.defaultSlot2));
              setShowSettings(true);
            }}
          >
            <Ionicons name="settings-outline" size={24} color={accent} />
          </TouchableOpacity>
        </View>
      }
    >
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

      {renderSummary()}

      {isUnconfigured && (
        <EmptyState
          icon={primaryIcon}
          title={`Configure ${defaultName.toLowerCase()}`}
          hint={`Set the ${computedPriceLabel.toLowerCase()} so monthly costs and balances appear automatically.`}
          accent={accent}
          actionLabel="Open Settings"
          onAction={() => setShowSettings(true)}
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

      {viewMode === 'calendar' ? (
        renderCalendar()
      ) : (
        <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Daily Log</Text>
          {mode === 'qty-dual' && slot1 && slot2 && (
            <View style={styles.colHeader}>
              <Text style={[styles.colLabel, { color: colors.textMuted, width: 70 }]}>Date</Text>
              <Text style={[styles.colLabel, { color: slot1.color, flex: 1, textAlign: 'center' }]}>
                {slot1.label}
              </Text>
              <Text style={[styles.colLabel, { color: slot2.color, flex: 1, textAlign: 'center' }]}>
                {slot2.label}
              </Text>
              <Text
                style={[styles.colLabel, { color: colors.textMuted, width: 50, textAlign: 'right' }]}
              >
                Total
              </Text>
            </View>
          )}
          {monthDays.map(renderListRow)}
        </View>
      )}

      {/* Payment History */}
      {showPaymentLog && data.payments.length > 0 && (
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
              <Text style={[styles.payAmt, { color: '#10B981' }]}>{p.amount.toLocaleString()}</Text>
              <TouchableOpacity onPress={() => deletePayment(p.id)} style={{ marginLeft: 8 }}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Edit Quantity Modal */}
      <Modal
        visible={editTarget !== null && mode !== 'binary'}
        transparent
        animationType="fade"
        onRequestClose={() => setEditTarget(null)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editTarget?.slot === 'slot1' && slot1
                ? slot1.label
                : editTarget?.slot === 'slot2' && slot2
                  ? slot2.label
                  : `Edit ${unit}`}{' '}
              — {editTarget?.date.slice(8)}/{MONTHS[viewMonth.month]}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={editQty}
              onChangeText={setEditQty}
              placeholder={unitPlural}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              autoFocus
            />
            <View style={styles.quickRow}>
              {quickValues.map((q) => (
                <TouchableOpacity
                  key={q}
                  style={[styles.quickBtn, { backgroundColor: withAlpha(accent, '15') }]}
                  onPress={() => setEditQty(String(q))}
                >
                  <Text style={[styles.quickText, { color: accent }]}>
                    {q} {unit}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setEditTarget(null)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: accent }]}
                onPress={saveEdit}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
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
              placeholder={defaultName}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{computedPriceLabel}</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={priceInput}
              onChangeText={setPriceInput}
              placeholder={pricePlaceholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
            {mode === 'qty-dual' && slot1 && slot2 && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  Default {slot1.label} ({unit})
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                  ]}
                  value={defSlot1Input}
                  onChangeText={setDefSlot1Input}
                  placeholder="e.g. 1"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                  Default {slot2.label} ({unit})
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
                  ]}
                  value={defSlot2Input}
                  onChangeText={setDefSlot2Input}
                  placeholder="e.g. 0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </>
            )}
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
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        visible={showPayment}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPayment(false)}
      >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Record Payment</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={payDate}
              onChangeText={setPayDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
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
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors'], accent: string) =>
  StyleSheet.create({
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
    summaryMain: { alignItems: 'center', marginBottom: Spacing.lg },
    totalNumber: { fontSize: 36, fontFamily: Fonts.bold, marginTop: 4 },
    totalLabel: { fontSize: 12, fontFamily: Fonts.medium },
    summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center', gap: 2 },
    summaryVal: { fontSize: 16, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium },
    divider: { height: 1, marginVertical: Spacing.md },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { fontSize: 13, fontFamily: Fonts.medium },
    costVal: { fontSize: 22, fontFamily: Fonts.bold },
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
    colHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.sm,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
    colLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
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
    qtyCell: { alignItems: 'center', paddingVertical: 2 },
    qtyText: { fontSize: 13, fontFamily: Fonts.semibold },
    dayTotal: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'right' },
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
    quickRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md, flexWrap: 'wrap' },
    quickBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.md },
    quickText: { fontSize: 13, fontFamily: Fonts.bold },
    fieldLabel: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 4,
    },
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
