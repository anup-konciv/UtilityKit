import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#64748B';

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

type DayRecord = { date: string; delivered: boolean };
type NewspaperData = {
  paperName: string;
  monthlyCost: number;
  deliveries: DayRecord[];
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

export default function NewspaperTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<NewspaperData>({
    paperName: 'Newspaper',
    monthlyCost: 0,
    deliveries: [],
  });
  const [showSettings, setShowSettings] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [costInput, setCostInput] = useState('');
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  useEffect(() => {
    loadJSON<NewspaperData>(KEYS.newspaperTracker, {
      paperName: 'Newspaper',
      monthlyCost: 0,
      deliveries: [],
    }).then(d => {
      setData(d);
      setNameInput(d.paperName);
      setCostInput(d.monthlyCost > 0 ? String(d.monthlyCost) : '');
    });
  }, []);

  const persist = useCallback((d: NewspaperData) => {
    setData(d);
    saveJSON(KEYS.newspaperTracker, d);
  }, []);

  const toggleDelivery = (dateStr: string) => {
    const existing = data.deliveries.find(a => a.date === dateStr);
    if (!existing) {
      persist({ ...data, deliveries: [...data.deliveries, { date: dateStr, delivered: true }] });
    } else {
      persist({ ...data, deliveries: data.deliveries.map(a => a.date === dateStr ? { ...a, delivered: !a.delivered } : a) });
    }
  };

  const saveSettings = () => {
    persist({ ...data, paperName: nameInput.trim() || 'Newspaper', monthlyCost: parseFloat(costInput) || 0 });
    setShowSettings(false);
  };

  const monthDays = getMonthDays(viewMonth.year, viewMonth.month);
  const today = todayISO();
  const monthKey = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;

  const monthDeliveries = data.deliveries.filter(a => a.date.startsWith(monthKey));
  const daysDelivered = monthDeliveries.filter(a => a.delivered).length;
  const daysMissed = monthDeliveries.filter(a => !a.delivered).length;
  const totalMarked = daysDelivered + daysMissed;
  const deliveryRate = totalMarked > 0 ? ((daysDelivered / totalMarked) * 100).toFixed(0) : '—';

  const prevMonth = () => {
    setViewMonth(prev => prev.month === 0 ? { year: prev.year - 1, month: 11 } : { ...prev, month: prev.month - 1 });
  };
  const nextMonth = () => {
    setViewMonth(prev => prev.month === 11 ? { year: prev.year + 1, month: 0 } : { ...prev, month: prev.month + 1 });
  };

  const calWeeks = buildCalWeeks(viewMonth.year, viewMonth.month);

  return (
    <ScreenShell
      title={data.paperName}
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => { setNameInput(data.paperName); setCostInput(data.monthlyCost > 0 ? String(data.monthlyCost) : ''); setShowSettings(true); }}>
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
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{daysDelivered}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Delivered</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#EF4444' }]}>{daysMissed}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Missed</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: ACCENT }]}>{deliveryRate}{deliveryRate !== '—' ? '%' : ''}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Rate</Text>
          </View>
        </View>

        {data.monthlyCost > 0 && (
          <>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <View style={styles.costRow}>
              <Text style={[styles.costLabel, { color: colors.textMuted }]}>Monthly Subscription</Text>
              <Text style={[styles.costVal, { color: ACCENT }]}>{data.monthlyCost.toFixed(0)}</Text>
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
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Delivered</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Unmarked</Text>
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
                if (day === null) {
                  return <View key={`empty-${wi}-${di}`} style={styles.calCell} />;
                }
                const dateStr = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const record = data.deliveries.find(a => a.date === dateStr);
                const isToday = dateStr === today;
                const isFuture = dateStr > today;
                const delivered = record?.delivered === true;

                return (
                  <TouchableOpacity
                    key={dateStr}
                    style={[
                      styles.calCell,
                      delivered && { backgroundColor: '#10B981' + '25', borderRadius: Radii.md },
                      isToday && { borderWidth: 1.5, borderColor: ACCENT, borderRadius: Radii.md },
                    ]}
                    onPress={() => !isFuture && toggleDelivery(dateStr)}
                    disabled={isFuture}
                  >
                    <Text style={[
                      styles.calDayNum,
                      { color: delivered ? '#10B981' : colors.text },
                      isFuture && { opacity: 0.3 },
                    ]}>{day}</Text>
                    {delivered && <Ionicons name="checkmark" size={10} color="#10B981" />}
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
          <Text style={styles.sectionTitle}>Deliveries</Text>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Delivered</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Missed</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.border }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Unmarked</Text>
            </View>
          </View>

          {monthDays.map(dateStr => {
            const record = data.deliveries.find(a => a.date === dateStr);
            const isToday = dateStr === today;
            const isFuture = dateStr > today;
            const day = parseInt(dateStr.slice(8));
            const dayName = getDayName(dateStr);
            const isSunday = dayName === 'Sun';

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayRow,
                  { borderBottomColor: colors.border },
                  isToday && { backgroundColor: ACCENT + '10' },
                ]}
                onPress={() => !isFuture && toggleDelivery(dateStr)}
                disabled={isFuture}
              >
                <View style={styles.dayLeft}>
                  <Text style={[styles.dayNum, { color: isSunday ? '#EF4444' : colors.text }, isFuture && { opacity: 0.4 }]}>{day}</Text>
                  <Text style={[styles.dayName, { color: isSunday ? '#EF4444' : colors.textMuted }, isFuture && { opacity: 0.4 }]}>{dayName}</Text>
                </View>
                {isToday && <View style={[styles.todayBadge, { backgroundColor: ACCENT }]}><Text style={styles.todayTextBadge}>Today</Text></View>}
                <View style={styles.dayRight}>
                  {record ? (
                    record.delivered ? (
                      <View style={[styles.statusBadge, { backgroundColor: '#10B981' + '20' }]}>
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        <Text style={[styles.statusText, { color: '#10B981' }]}>Done</Text>
                      </View>
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: '#EF4444' + '20' }]}>
                        <Ionicons name="close-circle" size={16} color="#EF4444" />
                        <Text style={[styles.statusText, { color: '#EF4444' }]}>Missed</Text>
                      </View>
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

      {/* Settings Modal */}
      <Modal visible={showSettings} transparent animationType="fade" onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Paper Settings</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Paper Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={nameInput} onChangeText={setNameInput} placeholder="Paper name" placeholderTextColor={colors.textMuted} autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Monthly Cost</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={costInput} onChangeText={setCostInput} placeholder="e.g. 300" placeholderTextColor={colors.textMuted} keyboardType="numeric"
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
    summaryGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 24, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    divider: { height: 1, marginVertical: Spacing.md },
    costRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    costLabel: { fontSize: 13, fontFamily: Fonts.medium },
    costVal: { fontSize: 22, fontFamily: Fonts.bold },
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
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
