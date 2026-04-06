import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#0284C7';

const WEEKDAYS_CAL = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
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

type DeliverySlot = 'morning' | 'evening';
type DayRecord = { date: string; morning: number; evening: number };
type MilkData = {
  pricePerLiter: number;
  defaultMorning: number;
  defaultEvening: number;
  records: DayRecord[];
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const count = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= count; i++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`);
  }
  return days;
}

function getDayName(dateStr: string): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(dateStr + 'T00:00:00').getDay()];
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const QUICK_QTY = [0, 0.25, 0.5, 1, 1.5, 2];

export default function MilkTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<MilkData>({
    pricePerLiter: 0,
    defaultMorning: 1,
    defaultEvening: 0,
    records: [],
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showEdit, setShowEdit] = useState<{ date: string; slot: DeliverySlot } | null>(null);
  const [editQty, setEditQty] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [defMorning, setDefMorning] = useState('1');
  const [defEvening, setDefEvening] = useState('0');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  useEffect(() => {
    loadJSON<MilkData>(KEYS.milkTracker, {
      pricePerLiter: 0,
      defaultMorning: 1,
      defaultEvening: 0,
      records: [],
    }).then(d => {
      setData(d);
      setPriceInput(d.pricePerLiter > 0 ? String(d.pricePerLiter) : '');
      setDefMorning(String(d.defaultMorning));
      setDefEvening(String(d.defaultEvening));
    });
  }, []);

  const persist = useCallback((d: MilkData) => {
    setData(d);
    saveJSON(KEYS.milkTracker, d);
  }, []);

  const getRecord = (dateStr: string): DayRecord | undefined => data.records.find(r => r.date === dateStr);

  const setQuantity = (dateStr: string, slot: DeliverySlot, qty: number) => {
    const existing = data.records.find(r => r.date === dateStr);
    if (existing) {
      persist({
        ...data,
        records: data.records.map(r => r.date === dateStr ? { ...r, [slot]: qty } : r),
      });
    } else {
      persist({
        ...data,
        records: [...data.records, {
          date: dateStr,
          morning: slot === 'morning' ? qty : data.defaultMorning,
          evening: slot === 'evening' ? qty : data.defaultEvening,
        }],
      });
    }
  };

  const quickMark = (dateStr: string) => {
    const existing = data.records.find(r => r.date === dateStr);
    if (existing) {
      // Toggle: if has values → set to 0 (no delivery), if 0 → set defaults
      if (existing.morning > 0 || existing.evening > 0) {
        persist({ ...data, records: data.records.map(r => r.date === dateStr ? { ...r, morning: 0, evening: 0 } : r) });
      } else {
        persist({ ...data, records: data.records.map(r => r.date === dateStr ? { ...r, morning: data.defaultMorning, evening: data.defaultEvening } : r) });
      }
    } else {
      persist({ ...data, records: [...data.records, { date: dateStr, morning: data.defaultMorning, evening: data.defaultEvening }] });
    }
  };

  const saveSettings = () => {
    persist({
      ...data,
      pricePerLiter: parseFloat(priceInput) || 0,
      defaultMorning: parseFloat(defMorning) || 0,
      defaultEvening: parseFloat(defEvening) || 0,
    });
    setShowSettings(false);
  };

  const saveEdit = () => {
    if (!showEdit) return;
    setQuantity(showEdit.date, showEdit.slot, parseFloat(editQty) || 0);
    setShowEdit(null);
  };

  const monthDays = getMonthDays(viewMonth.year, viewMonth.month);
  const today = todayISO();
  const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;

  const monthRecords = data.records.filter(r => r.date.startsWith(monthKey));
  const totalMorning = monthRecords.reduce((s, r) => s + r.morning, 0);
  const totalEvening = monthRecords.reduce((s, r) => s + r.evening, 0);
  const totalLiters = totalMorning + totalEvening;
  const totalCost = totalLiters * data.pricePerLiter;
  const daysDelivered = monthRecords.filter(r => r.morning > 0 || r.evening > 0).length;
  const avgDaily = daysDelivered > 0 ? totalLiters / daysDelivered : 0;

  const prevMonth = () => setViewMonth(prev => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 });
  const nextMonth = () => setViewMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });

  const renderCalGrid = () => {
    const calWeeks = buildCalWeeks(viewMonth.year, viewMonth.month);
    return (
      <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Daily Log</Text>
        <View style={styles.calLegendRow}>
          <View style={styles.legendItemCal}>
            <View style={[styles.legendDotCal, { backgroundColor: ACCENT }]} />
            <Text style={[styles.legendTextCal, { color: colors.textMuted }]}>Delivered</Text>
          </View>
          <View style={styles.legendItemCal}>
            <View style={[styles.legendDotCal, { backgroundColor: colors.border }]} />
            <Text style={[styles.legendTextCal, { color: colors.textMuted }]}>No delivery</Text>
          </View>
        </View>
        <View style={styles.weekRow}>
          {WEEKDAYS_CAL.map(w => (
            <View key={w} style={styles.weekCell}>
              <Text style={[styles.weekText, { color: w === 'Sun' ? '#EF4444' : colors.textMuted }]}>{w}</Text>
            </View>
          ))}
        </View>
        {calWeeks.map((week, wi) => (
          <View key={wi} style={styles.calRow}>
            {week.map((d, di) => {
              if (d === null) {
                return <View key={`empty-${wi}-${di}`} style={styles.calCellWrap} />;
              }
              const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              const record = getRecord(dateStr);
              const isToday = dateStr === today;
              const isFuture = dateStr > today;
              const morning = record?.morning ?? 0;
              const evening = record?.evening ?? 0;
              const dayTotal = morning + evening;
              const hasDelivery = dayTotal > 0;
              return (
                <TouchableOpacity
                  key={dateStr}
                  style={[
                    styles.calCellWrap,
                    hasDelivery && { borderWidth: 1.5, borderColor: ACCENT, backgroundColor: ACCENT + '20', borderRadius: Radii.md },
                    isFuture && { opacity: 0.35 },
                  ]}
                  onPress={() => {
                    if (!isFuture) {
                      setEditQty(String(morning));
                      setShowEdit({ date: dateStr, slot: 'morning' });
                    }
                  }}
                  disabled={isFuture}
                >
                  <Text style={[styles.calDayNum, { color: colors.text, fontFamily: Fonts.bold }]}>{d}</Text>
                  {hasDelivery && <Text style={[styles.calDayLabel, { color: ACCENT }]}>{dayTotal.toFixed(1)}</Text>}
                  {isToday && <View style={[styles.todayDotCal, { backgroundColor: ACCENT }]} />}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  return (
    <ScreenShell
      title="Milk Tracker"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => {
          setPriceInput(data.pricePerLiter > 0 ? String(data.pricePerLiter) : '');
          setDefMorning(String(data.defaultMorning));
          setDefEvening(String(data.defaultEvening));
          setShowSettings(true);
        }}>
          <Ionicons name="settings-outline" size={24} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Month Navigator */}
      <View style={styles.monthNav}>
        <TouchableOpacity onPress={prevMonth}><Ionicons name="chevron-back" size={24} color={colors.text} /></TouchableOpacity>
        <Text style={[styles.monthLabel, { color: colors.text }]}>{MONTHS[viewMonth.month]} {viewMonth.year}</Text>
        <TouchableOpacity onPress={nextMonth}><Ionicons name="chevron-forward" size={24} color={colors.text} /></TouchableOpacity>
      </View>

      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryMain}>
          <Ionicons name="water" size={28} color={ACCENT} />
          <Text style={[styles.totalLiters, { color: ACCENT }]}>{totalLiters.toFixed(1)} L</Text>
          <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total this month</Text>
        </View>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Ionicons name="sunny-outline" size={16} color="#F59E0B" />
            <Text style={[styles.summaryVal, { color: colors.text }]}>{totalMorning.toFixed(1)} L</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Morning</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="moon-outline" size={16} color="#6366F1" />
            <Text style={[styles.summaryVal, { color: colors.text }]}>{totalEvening.toFixed(1)} L</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Evening</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="calendar-outline" size={16} color="#10B981" />
            <Text style={[styles.summaryVal, { color: colors.text }]}>{daysDelivered}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Days</Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="trending-up-outline" size={16} color="#3B82F6" />
            <Text style={[styles.summaryVal, { color: colors.text }]}>{avgDaily.toFixed(1)} L</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Avg/Day</Text>
          </View>
        </View>

        {data.pricePerLiter > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.costRow}>
              <Text style={[styles.costLabel, { color: colors.textMuted }]}>Total Cost ({data.pricePerLiter}/L)</Text>
              <Text style={[styles.costVal, { color: ACCENT }]}>{totalCost.toFixed(0)}</Text>
            </View>
          </>
        )}
      </View>

      {/* View Toggle */}
      <View style={[styles.viewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { k: 'list' as const, ic: 'list-outline', lb: 'List' },
          { k: 'calendar' as const, ic: 'calendar-outline', lb: 'Calendar' },
        ].map(v => (
          <TouchableOpacity key={v.k} style={[styles.viewBtn, viewMode === v.k && { backgroundColor: ACCENT }]} onPress={() => setViewMode(v.k)}>
            <Ionicons name={v.ic as any} size={15} color={viewMode === v.k ? '#fff' : colors.textMuted} />
            <Text style={[styles.viewBtnText, { color: viewMode === v.k ? '#fff' : colors.textMuted }]}>{v.lb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {viewMode === 'calendar' ? renderCalGrid() : (
      <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Daily Log</Text>
        <View style={styles.colHeader}>
          <Text style={[styles.colLabel, { color: colors.textMuted, width: 70 }]}>Date</Text>
          <Text style={[styles.colLabel, { color: '#F59E0B', flex: 1, textAlign: 'center' }]}>Morning</Text>
          <Text style={[styles.colLabel, { color: '#6366F1', flex: 1, textAlign: 'center' }]}>Evening</Text>
          <Text style={[styles.colLabel, { color: colors.textMuted, width: 50, textAlign: 'right' }]}>Total</Text>
        </View>

        {monthDays.map(dateStr => {
          const record = getRecord(dateStr);
          const isToday = dateStr === today;
          const isFuture = dateStr > today;
          const day = parseInt(dateStr.slice(8));
          const dayName = getDayName(dateStr);
          const isSunday = dayName === 'Sun';
          const morning = record?.morning ?? 0;
          const evening = record?.evening ?? 0;
          const dayTotal = morning + evening;
          const hasRecord = !!record;

          return (
            <TouchableOpacity
              key={dateStr}
              style={[styles.dayRow, { borderBottomColor: colors.border }, isToday && { backgroundColor: ACCENT + '08' }]}
              onPress={() => !isFuture && quickMark(dateStr)}
              disabled={isFuture}
            >
              <View style={[styles.dayLeft, { width: 70 }]}>
                <Text style={[styles.dayNum, { color: isSunday ? '#EF4444' : colors.text }, isFuture && { opacity: 0.3 }]}>{day}</Text>
                <Text style={[styles.dayName, { color: isSunday ? '#EF4444' : colors.textMuted }, isFuture && { opacity: 0.3 }]}>{dayName}</Text>
                {isToday && <View style={[styles.todayDot, { backgroundColor: ACCENT }]} />}
              </View>

              <TouchableOpacity
                style={[styles.qtyCell, { flex: 1 }]}
                onPress={() => { if (!isFuture) { setEditQty(String(morning)); setShowEdit({ date: dateStr, slot: 'morning' }); } }}
                disabled={isFuture}
              >
                <Text style={[styles.qtyText, { color: morning > 0 ? '#F59E0B' : colors.border }, isFuture && { opacity: 0.3 }]}>
                  {hasRecord ? `${morning} L` : '—'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.qtyCell, { flex: 1 }]}
                onPress={() => { if (!isFuture) { setEditQty(String(evening)); setShowEdit({ date: dateStr, slot: 'evening' }); } }}
                disabled={isFuture}
              >
                <Text style={[styles.qtyText, { color: evening > 0 ? '#6366F1' : colors.border }, isFuture && { opacity: 0.3 }]}>
                  {hasRecord ? `${evening} L` : '—'}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.dayTotal, { color: dayTotal > 0 ? colors.text : colors.border, width: 50 }, isFuture && { opacity: 0.3 }]}>
                {hasRecord ? `${dayTotal.toFixed(1)}` : '—'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      )}

      {/* Edit Quantity Modal */}
      <Modal visible={showEdit !== null} transparent animationType="fade" onRequestClose={() => setShowEdit(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {showEdit?.slot === 'morning' ? 'Morning' : 'Evening'} — {showEdit?.date.slice(8)}/{MONTHS[viewMonth.month]}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={editQty} onChangeText={setEditQty} placeholder="Liters" placeholderTextColor={colors.textMuted}
              keyboardType="numeric" autoFocus
            />
            <View style={styles.quickRow}>
              {QUICK_QTY.map(q => (
                <TouchableOpacity key={q} style={[styles.quickBtn, { backgroundColor: ACCENT + '15' }]} onPress={() => setEditQty(String(q))}>
                  <Text style={[styles.quickText, { color: ACCENT }]}>{q} L</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowEdit(null)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveEdit}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Milk Settings</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Price per Liter</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={priceInput} onChangeText={setPriceInput} placeholder="e.g. 60" placeholderTextColor={colors.textMuted} keyboardType="numeric" autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Default Morning (Liters)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={defMorning} onChangeText={setDefMorning} placeholder="e.g. 1" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Default Evening (Liters)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={defEvening} onChangeText={setDefEvening} placeholder="e.g. 0.5" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowSettings(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveSettings}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
    monthLabel: { fontSize: 18, fontFamily: Fonts.bold },
    summaryCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    summaryMain: { alignItems: 'center', marginBottom: Spacing.lg },
    totalLiters: { fontSize: 36, fontFamily: Fonts.bold, marginTop: 4 },
    totalLabel: { fontSize: 12, fontFamily: Fonts.medium },
    summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center', gap: 2 },
    summaryVal: { fontSize: 16, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium },
    divider: { height: 1, marginVertical: Spacing.md },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { fontSize: 13, fontFamily: Fonts.medium },
    costVal: { fontSize: 22, fontFamily: Fonts.bold },
    calCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, paddingHorizontal: Spacing.sm },
    colHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: c.border },
    colLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderBottomWidth: 0.5 },
    dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dayNum: { fontSize: 14, fontFamily: Fonts.bold, width: 22, textAlign: 'right' },
    dayName: { fontSize: 10, fontFamily: Fonts.medium, width: 28 },
    todayDot: { width: 5, height: 5, borderRadius: 2.5 },
    qtyCell: { alignItems: 'center', paddingVertical: 2 },
    qtyText: { fontSize: 13, fontFamily: Fonts.semibold },
    dayTotal: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'right' },
    quickRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md, flexWrap: 'wrap' },
    quickBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.md },
    quickText: { fontSize: 13, fontFamily: Fonts.bold },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
    viewToggle: { flexDirection: 'row', borderRadius: Radii.lg, borderWidth: 1, padding: 3, gap: 3, marginBottom: Spacing.md },
    viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: Radii.md },
    viewBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    weekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
    weekText: { fontSize: 11, fontFamily: Fonts.semibold },
    calRow: { flexDirection: 'row' },
    calCellWrap: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    calDayNum: { fontSize: 14 },
    calDayLabel: { fontSize: 9, fontFamily: Fonts.bold, marginTop: 1 },
    todayDotCal: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
    calLegendRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
    legendItemCal: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDotCal: { width: 8, height: 8, borderRadius: 4 },
    legendTextCal: { fontSize: 11, fontFamily: Fonts.medium },
  });
