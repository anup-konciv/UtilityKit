import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#0891B2';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

type DayRecord = { date: string; cans: number };
type PaymentRecord = { id: string; date: string; amount: number; note: string };
type WaterCanData = {
  vendorName: string;
  pricePerCan: number;
  deliveries: DayRecord[];
  payments: PaymentRecord[];
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

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

const QUICK_CAN = [0, 1, 2, 3, 4, 5];

export default function WaterCanTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<WaterCanData>({
    vendorName: 'Water Vendor',
    pricePerCan: 0,
    deliveries: [],
    payments: [],
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [editCans, setEditCans] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [priceInput, setPriceInput] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [payNote, setPayNote] = useState('');
  const [payDate, setPayDate] = useState(todayISO());
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    loadJSON<WaterCanData>(KEYS.waterCanTracker, {
      vendorName: 'Water Vendor',
      pricePerCan: 0,
      deliveries: [],
      payments: [],
    }).then(d => {
      setData(d);
      setNameInput(d.vendorName);
      setPriceInput(d.pricePerCan > 0 ? String(d.pricePerCan) : '');
    });
  }, []);

  const persist = useCallback((d: WaterCanData) => {
    setData(d);
    saveJSON(KEYS.waterCanTracker, d);
  }, []);

  const setCansForDay = (dateStr: string, cans: number) => {
    const existing = data.deliveries.find(a => a.date === dateStr);
    if (existing) {
      persist({ ...data, deliveries: data.deliveries.map(a => a.date === dateStr ? { ...a, cans } : a) });
    } else {
      persist({ ...data, deliveries: [...data.deliveries, { date: dateStr, cans }] });
    }
  };

  const openEditModal = (dateStr: string) => {
    const existing = data.deliveries.find(a => a.date === dateStr);
    setEditCans(existing ? String(existing.cans) : '0');
    setShowEdit(dateStr);
  };

  const saveEdit = () => {
    if (!showEdit) return;
    setCansForDay(showEdit, parseInt(editCans) || 0);
    setShowEdit(null);
  };

  const saveSettings = () => {
    persist({ ...data, vendorName: nameInput.trim() || 'Water Vendor', pricePerCan: parseFloat(priceInput) || 0 });
    setShowSettings(false);
  };

  const addPayment = () => {
    const amt = parseFloat(payAmount);
    if (!amt || amt <= 0) return;
    const payment: PaymentRecord = { id: uid(), date: payDate, amount: amt, note: payNote.trim() };
    persist({ ...data, payments: [payment, ...data.payments].sort((a, b) => b.date.localeCompare(a.date)) });
    setPayAmount('');
    setPayNote('');
    setShowPayment(false);
  };

  const deletePayment = (id: string) => {
    Alert.alert('Delete Payment', 'Remove this payment record?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist({ ...data, payments: data.payments.filter(p => p.id !== id) }) },
    ]);
  };

  const monthDays = getMonthDays(viewMonth.year, viewMonth.month);
  const today = todayISO();
  const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;

  const monthDeliveries = data.deliveries.filter(a => a.date.startsWith(monthKey));
  const totalCans = monthDeliveries.reduce((s, a) => s + a.cans, 0);
  const totalCost = totalCans * data.pricePerCan;
  const weeksInMonth = monthDays.length / 7;
  const avgPerWeek = weeksInMonth > 0 ? totalCans / weeksInMonth : 0;

  const monthPayments = data.payments.filter(p => p.date.startsWith(monthKey));
  const totalPaid = monthPayments.reduce((s, p) => s + p.amount, 0);
  const balance = totalCost - totalPaid;

  const prevMonth = () => {
    setViewMonth(prev => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 });
  };
  const nextMonth = () => {
    setViewMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };

  const calWeeks = buildCalWeeks(viewMonth.year, viewMonth.month);

  return (
    <ScreenShell
      title={data.vendorName}
      accentColor={ACCENT}
      rightAction={
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => { setPayAmount(''); setPayNote(''); setPayDate(todayISO()); setShowPayment(true); }}>
            <Ionicons name="cash-outline" size={24} color={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setNameInput(data.vendorName); setPriceInput(data.pricePerCan > 0 ? String(data.pricePerCan) : ''); setShowSettings(true); }}>
            <Ionicons name="settings-outline" size={24} color={ACCENT} />
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

      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: ACCENT }]}>{totalCans}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cans</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{totalCost.toFixed(0)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Cost</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#3B82F6' }]}>{avgPerWeek.toFixed(1)}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Avg/Week</Text>
          </View>
        </View>

        {data.pricePerCan > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
                <Text style={[styles.financeVal, { color: balance >= 0 ? '#EF4444' : '#10B981' }]}>
                  {balance >= 0 ? `${balance.toFixed(0)} due` : `${Math.abs(balance).toFixed(0)} extra`}
                </Text>
              </View>
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

      {/* Calendar Grid View */}
      {viewMode === 'calendar' && (
        <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.calLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Has Cans</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>None</Text>
            </View>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map(w => (
              <View key={w} style={styles.weekCell}>
                <Text style={[styles.weekText, { color: w === 'Sun' ? '#EF4444' : colors.textMuted }]}>{w}</Text>
              </View>
            ))}
          </View>

          {calWeeks.map((week, wi) => (
            <View key={wi} style={styles.calRow}>
              {week.map((day, di) => {
                if (day === null) return <View key={`empty-${wi}-${di}`} style={styles.calCell} />;
                const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const record = data.deliveries.find(a => a.date === dateStr);
                const isToday = dateStr === today;
                const isFuture = dateStr > today;
                const cans = record?.cans ?? 0;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.calCell,
                      cans > 0 && { backgroundColor: ACCENT + '20', borderRadius: Radii.md },
                      isToday && { borderWidth: 1.5, borderColor: ACCENT, borderRadius: Radii.md },
                    ]}
                    onPress={() => !isFuture && openEditModal(dateStr)}
                    disabled={isFuture}
                  >
                    <Text style={[
                      styles.calDayNum,
                      { color: colors.text },
                      isFuture && { opacity: 0.3 },
                    ]}>{day}</Text>
                    {cans > 0 && (
                      <Text style={[styles.calDayLabel, { color: ACCENT }]}>{cans}</Text>
                    )}
                    {isToday && <View style={[styles.todayDot, { backgroundColor: ACCENT }]} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <View style={[styles.calCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Daily Log</Text>

          {monthDays.map(dateStr => {
            const record = data.deliveries.find(a => a.date === dateStr);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            const day = parseInt(dateStr.slice(8));
            const dayName = getDayName(dateStr);
            const isSunday = dayName === 'Sun';
            const cans = record?.cans ?? 0;

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayRow,
                  { borderBottomColor: colors.border },
                  isToday && { backgroundColor: ACCENT + '10' },
                ]}
                onPress={() => !isFuture && openEditModal(dateStr)}
                disabled={isFuture}
              >
                <View style={styles.dayLeft}>
                  <Text style={[styles.dayNum, { color: isSunday ? '#EF4444' : colors.text }, isFuture && { opacity: 0.4 }]}>{day}</Text>
                  <Text style={[styles.dayName, { color: isSunday ? '#EF4444' : colors.textMuted }, isFuture && { opacity: 0.4 }]}>{dayName}</Text>
                </View>
                {isToday && <View style={[styles.todayBadge, { backgroundColor: ACCENT }]}><Text style={styles.todayTextBadge}>Today</Text></View>}
                <View style={styles.dayRight}>
                  {record ? (
                    cans > 0 ? (
                      <View style={[styles.statusBadge, { backgroundColor: ACCENT + '20' }]}>
                        <Ionicons name="water" size={16} color={ACCENT} />
                        <Text style={[styles.statusText, { color: ACCENT }]}>{cans} {cans === 1 ? 'can' : 'cans'}</Text>
                      </View>
                    ) : (
                      <Text style={[styles.unmarked, { color: colors.textMuted }]}>0 cans</Text>
                    )
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
      )}

      {/* Payment History */}
      {data.payments.length > 0 && (
        <View style={[styles.payCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Payment History</Text>
          {data.payments.slice(0, 20).map(p => (
            <View key={p.id} style={[styles.payRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.payDate, { color: colors.text }]}>{p.date}</Text>
                {p.note ? <Text style={[styles.payNote, { color: colors.textMuted }]}>{p.note}</Text> : null}
              </View>
              <Text style={[styles.payAmt, { color: '#10B981' }]}>{p.amount.toLocaleString()}</Text>
              <TouchableOpacity onPress={() => deletePayment(p.id)} style={{ marginLeft: 8 }}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Edit Cans Modal */}
      <Modal visible={showEdit !== null} transparent animationType="fade" onRequestClose={() => setShowEdit(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Cans — {showEdit ? `${parseInt(showEdit.slice(8))} ${MONTHS[viewMonth.month]}` : ''}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={editCans} onChangeText={setEditCans} placeholder="Number of cans" placeholderTextColor={colors.textMuted}
              keyboardType="numeric" autoFocus
            />
            <View style={styles.quickRow}>
              {QUICK_CAN.map(q => (
                <TouchableOpacity key={q} style={[styles.quickBtn, { backgroundColor: ACCENT + '15' }]} onPress={() => setEditCans(String(q))}>
                  <Text style={[styles.quickText, { color: ACCENT }]}>{q}</Text>
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Water Can Settings</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Vendor Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={nameInput} onChangeText={setNameInput} placeholder="Vendor name" placeholderTextColor={colors.textMuted} autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Price per Can</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={priceInput} onChangeText={setPriceInput} placeholder="e.g. 30" placeholderTextColor={colors.textMuted} keyboardType="numeric"
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

      {/* Payment Modal */}
      <Modal visible={showPayment} transparent animationType="fade" onRequestClose={() => setShowPayment(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Record Payment</Text>

            {/* Date Picker */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
            <View style={styles.datePickerWrap}>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() => {
                  const d = new Date(payDate + 'T00:00:00');
                  d.setDate(d.getDate() - 1);
                  setPayDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dateDisplay, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                onPress={() => setPayDate(todayISO())}
              >
                <Ionicons name="calendar-outline" size={16} color={ACCENT} />
                <Text style={[styles.dateText, { color: colors.text }]}>{payDate}</Text>
                {payDate === todayISO() && <Text style={[styles.todayTag, { color: ACCENT }]}>Today</Text>}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateArrow}
                onPress={() => {
                  const d = new Date(payDate + 'T00:00:00');
                  d.setDate(d.getDate() + 1);
                  setPayDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
                }}
              >
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Quick date buttons */}
            <View style={styles.dateBtnsRow}>
              {(() => {
                const btns: { label: string; date: string }[] = [];
                const d = new Date();
                btns.push({ label: 'Today', date: todayISO() });
                d.setDate(d.getDate() - 1);
                btns.push({ label: 'Yesterday', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` });
                const now = new Date();
                btns.push({ label: `1st ${MONTHS[now.getMonth()]}`, date: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01` });
                return btns;
              })().map(b => (
                <TouchableOpacity
                  key={b.label}
                  style={[styles.dateQuickBtn, payDate === b.date && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]}
                  onPress={() => setPayDate(b.date)}
                >
                  <Text style={[styles.dateQuickText, { color: payDate === b.date ? ACCENT : colors.textMuted }]}>{b.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Amount</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={payAmount} onChangeText={setPayAmount} placeholder="Amount paid" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={payNote} onChangeText={setPayNote} placeholder="Note (optional)" placeholderTextColor={colors.textMuted}
            />
            {data.pricePerCan > 0 && (
              <View style={styles.quickRow}>
                {[data.pricePerCan * 20, data.pricePerCan * 10, 500, 1000].map(a => (
                  <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: ACCENT + '15' }]} onPress={() => setPayAmount(String(a))}>
                    <Text style={[styles.quickText, { color: ACCENT }]}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowPayment(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addPayment}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add Payment</Text>
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
    summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 24, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    divider: { height: 1, marginVertical: Spacing.md },
    financeRow: { flexDirection: 'row', justifyContent: 'space-around' },
    financeItem: { alignItems: 'center' },
    financeLabel: { fontSize: 10, fontFamily: Fonts.medium },
    financeVal: { fontSize: 16, fontFamily: Fonts.bold, marginTop: 2 },
    viewToggle: { flexDirection: 'row', borderRadius: Radii.lg, borderWidth: 1, padding: 3, gap: 3, marginBottom: Spacing.md },
    viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: Radii.md },
    viewBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    calCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md, paddingHorizontal: Spacing.sm },
    legend: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md, paddingHorizontal: Spacing.sm, flexWrap: 'wrap' },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 10, fontFamily: Fonts.medium },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    weekCell: { flex: 1, alignItems: 'center', paddingVertical: 6 },
    weekText: { fontSize: 11, fontFamily: Fonts.semibold },
    calRow: { flexDirection: 'row' },
    calCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
    calDayNum: { fontSize: 14 },
    calDayLabel: { fontSize: 9, fontFamily: Fonts.bold, marginTop: 1 },
    todayDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
    calLegend: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
    dayRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderBottomWidth: 0.5 },
    dayLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, width: 60 },
    dayNum: { fontSize: 15, fontFamily: Fonts.bold, width: 24, textAlign: 'right' },
    dayName: { fontSize: 11, fontFamily: Fonts.medium },
    todayBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.pill, marginRight: 'auto', marginLeft: 8 },
    todayTextBadge: { fontSize: 9, fontFamily: Fonts.bold, color: '#fff' },
    dayRight: { marginLeft: 'auto' },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill },
    statusText: { fontSize: 12, fontFamily: Fonts.bold },
    unmarked: { fontSize: 12, fontFamily: Fonts.medium },
    payCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    payRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5 },
    payDate: { fontSize: 13, fontFamily: Fonts.semibold },
    payNote: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 1 },
    payAmt: { fontSize: 16, fontFamily: Fonts.bold },
    quickRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    quickBtn: { flex: 1, paddingVertical: 8, borderRadius: Radii.md, alignItems: 'center' },
    quickText: { fontSize: 13, fontFamily: Fonts.bold },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    datePickerWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
    dateArrow: { padding: 6 },
    dateDisplay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: Radii.md, paddingVertical: 12 },
    dateText: { fontSize: 15, fontFamily: Fonts.bold },
    todayTag: { fontSize: 10, fontFamily: Fonts.bold },
    dateBtnsRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.lg },
    dateQuickBtn: { flex: 1, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, borderColor: c.border, alignItems: 'center' },
    dateQuickText: { fontSize: 11, fontFamily: Fonts.semibold },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
