import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F59E0B';

type ElectricityEntry = {
  id: string;
  month: string; // "YYYY-MM"
  label: string; // "Jan 2026"
  startReading: number;
  endReading: number;
  units: number;
  ratePerUnit: number;
  fixedCharge: number;
  totalCost: number;
  paid: boolean;
  paidDate: string;
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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export default function ElectricityBillScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<ElectricityEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Form
  const [monthKey, setMonthKey] = useState(currentMonthKey());
  const [startReading, setStartReading] = useState('');
  const [endReading, setEndReading] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [fixedCharge, setFixedCharge] = useState('');
  const [entryNote, setEntryNote] = useState('');

  useEffect(() => {
    loadJSON<ElectricityEntry[]>(KEYS.electricityBills, []).then(setEntries);
  }, []);

  const persist = useCallback((e: ElectricityEntry[]) => {
    setEntries(e);
    saveJSON(KEYS.electricityBills, e);
  }, []);

  const openAdd = (entry?: ElectricityEntry) => {
    if (entry) {
      setEditId(entry.id);
      setMonthKey(entry.month);
      setStartReading(String(entry.startReading));
      setEndReading(String(entry.endReading));
      setRatePerUnit(String(entry.ratePerUnit));
      setFixedCharge(String(entry.fixedCharge));
      setEntryNote(entry.note);
    } else {
      setEditId(null);
      setMonthKey(currentMonthKey());
      // Auto-fill start reading from last entry's end reading
      if (entries.length > 0) {
        setStartReading(String(entries[0].endReading));
      } else {
        setStartReading('');
      }
      setEndReading('');
      // Keep last used rate
      if (entries.length > 0) {
        setRatePerUnit(String(entries[0].ratePerUnit));
        setFixedCharge(String(entries[0].fixedCharge));
      } else {
        setRatePerUnit('');
        setFixedCharge('0');
      }
      setEntryNote('');
    }
    setShowAdd(true);
  };

  const saveEntry = () => {
    const sr = parseFloat(startReading);
    const er = parseFloat(endReading);
    const rate = parseFloat(ratePerUnit);
    if (isNaN(sr) || isNaN(er) || isNaN(rate) || er < sr) return;
    const units = er - sr;
    const fc = parseFloat(fixedCharge) || 0;
    const totalCost = units * rate + fc;
    const label = monthLabel(monthKey);

    if (editId) {
      persist(entries.map(e => e.id === editId ? {
        ...e, month: monthKey, label, startReading: sr, endReading: er, units, ratePerUnit: rate, fixedCharge: fc, totalCost, note: entryNote.trim(),
      } : e));
    } else {
      persist([{
        id: uid(), month: monthKey, label, startReading: sr, endReading: er,
        units, ratePerUnit: rate, fixedCharge: fc, totalCost,
        paid: false, paidDate: '', note: entryNote.trim(),
      }, ...entries].sort((a, b) => b.month.localeCompare(a.month)));
    }
    setShowAdd(false);
  };

  const togglePaid = (id: string) => {
    persist(entries.map(e => {
      if (e.id !== id) return e;
      return { ...e, paid: !e.paid, paidDate: !e.paid ? todayISO() : '' };
    }));
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Delete Entry', 'Remove this electricity bill?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(entries.filter(e => e.id !== id)) },
    ]);
  };

  // Stats
  const last6 = entries.slice(0, 6);
  const avgUnits = last6.length > 0 ? last6.reduce((s, e) => s + e.units, 0) / last6.length : 0;
  const avgCost = last6.length > 0 ? last6.reduce((s, e) => s + e.totalCost, 0) / last6.length : 0;
  const maxUnits = entries.length > 0 ? Math.max(...entries.map(e => e.units)) : 1;
  const totalSpent = entries.reduce((s, e) => s + e.totalCost, 0);
  const unpaid = entries.filter(e => !e.paid).reduce((s, e) => s + e.totalCost, 0);

  // Month-over-month change
  const momChange = useMemo(() => {
    if (entries.length < 2) return null;
    const curr = entries[0].units;
    const prev = entries[1].units;
    if (prev === 0) return null;
    const pct = ((curr - prev) / prev) * 100;
    return { pct: Math.round(pct), up: pct > 0 };
  }, [entries]);

  // Month navigation for month input
  const adjustMonth = (delta: number) => {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonthKey(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <ScreenShell
      title="Electricity Bill"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => openAdd()}>
          <Ionicons name="add-circle-outline" size={24} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Hero Card */}
      <LinearGradient
        colors={['#78350F', '#B45309', '#F59E0B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>ELECTRICITY</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Text style={styles.heroTitle}>
            {entries.length > 0 ? `${entries[0].units} units` : 'No bills yet'}
          </Text>
          {momChange && (
            <View style={[styles.momBadge, { backgroundColor: momChange.up ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)' }]}>
              <Ionicons name={momChange.up ? 'trending-up' : 'trending-down'} size={12} color="#fff" />
              <Text style={styles.momText}>{Math.abs(momChange.pct)}%</Text>
            </View>
          )}
        </View>
        <Text style={styles.heroSub}>
          {entries.length > 0 ? `Last: ${entries[0].label} — ${Math.round(entries[0].totalCost).toLocaleString()}` : 'Tap + to add your first bill'}
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{Math.round(avgUnits)}</Text>
            <Text style={styles.heroStatLabel}>AVG UNITS</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{Math.round(avgCost)}</Text>
            <Text style={styles.heroStatLabel}>AVG COST</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{Math.round(totalSpent)}</Text>
            <Text style={styles.heroStatLabel}>TOTAL</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatVal, { color: unpaid > 0 ? '#FEF3C7' : '#fff' }]}>{Math.round(unpaid)}</Text>
            <Text style={styles.heroStatLabel}>UNPAID</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Trend chart */}
      {entries.length > 1 && (() => {
        const maxCost = Math.max(...entries.map(e => e.totalCost));
        return (
          <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Usage & Cost Trend</Text>
            <View style={styles.chartLegend}>
              <View style={styles.chartLegendItem}>
                <View style={[styles.chartLegendDot, { backgroundColor: ACCENT }]} />
                <Text style={[styles.chartLegendText, { color: colors.textMuted }]}>Units</Text>
              </View>
              <View style={styles.chartLegendItem}>
                <View style={[styles.chartLegendDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.chartLegendText, { color: colors.textMuted }]}>Cost</Text>
              </View>
            </View>
            <View style={styles.chartWrap}>
              {[...last6].reverse().map((e) => {
                const hUnits = maxUnits > 0 ? (e.units / maxUnits) * 100 : 0;
                const hCost = maxCost > 0 ? (e.totalCost / maxCost) * 100 : 0;
                return (
                  <View key={e.id} style={styles.barCol}>
                    <Text style={[styles.barVal, { color: colors.text }]}>{e.units}</Text>
                    <View style={styles.dualBarWrap}>
                      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
                        <View style={[styles.barFill, { height: `${Math.max(hUnits, 5)}%`, backgroundColor: ACCENT }]} />
                      </View>
                      <View style={[styles.barTrackSmall, { backgroundColor: colors.border }]}>
                        <View style={[styles.barFill, { height: `${Math.max(hCost, 5)}%`, backgroundColor: '#10B981' }]} />
                      </View>
                    </View>
                    <Text style={[styles.barLabel, { color: colors.textMuted }]}>{e.label.split(' ')[0]}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        );
      })()}

      {/* Entries */}
      {entries.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="flash-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No bills recorded yet</Text>
        </View>
      ) : (
        <View style={[styles.listCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Monthly Bills</Text>
          {entries.map(e => (
            <TouchableOpacity
              key={e.id}
              style={[styles.entryRow, { borderBottomColor: colors.border }]}
              onPress={() => togglePaid(e.id)}
              onLongPress={() => deleteEntry(e.id)}
            >
              <View style={styles.entryLeft}>
                <View style={[styles.entryIcon, { backgroundColor: ACCENT + '20' }]}>
                  <Ionicons name="flash" size={16} color={ACCENT} />
                </View>
                <View>
                  <Text style={[styles.entryMonth, { color: colors.text }]}>{e.label}</Text>
                  <Text style={[styles.entryMeta, { color: colors.textMuted }]}>
                    {e.startReading} → {e.endReading} ({e.units} units)
                  </Text>
                  <Text style={[styles.entryMeta, { color: colors.textMuted }]}>
                    Rate: {e.ratePerUnit}/unit{e.fixedCharge > 0 ? ` + ${e.fixedCharge} fixed` : ''}
                  </Text>
                  {e.note ? <Text style={[styles.entryNote, { color: colors.textMuted }]}>{e.note}</Text> : null}
                </View>
              </View>
              <View style={styles.entryRight}>
                <Text style={[styles.entryCost, { color: e.paid ? '#10B981' : colors.text }]}>{Math.round(e.totalCost).toLocaleString()}</Text>
                <Ionicons
                  name={e.paid ? 'checkmark-circle' : 'ellipse-outline'}
                  size={20}
                  color={e.paid ? '#10B981' : colors.textMuted}
                />
                <TouchableOpacity onPress={() => openAdd(e)} style={{ marginTop: 4 }}>
                  <Ionicons name="create-outline" size={14} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editId ? 'Edit Bill' : 'New Bill'}</Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Month</Text>
            <View style={styles.monthPicker}>
              <TouchableOpacity onPress={() => adjustMonth(-1)} style={styles.monthArrow}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </TouchableOpacity>
              <View style={[styles.monthDisplay, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                <Ionicons name="calendar-outline" size={16} color={ACCENT} />
                <Text style={[styles.monthText, { color: colors.text }]}>{monthLabel(monthKey)}</Text>
              </View>
              <TouchableOpacity onPress={() => adjustMonth(1)} style={styles.monthArrow}>
                <Ionicons name="chevron-forward" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Start Reading</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={startReading} onChangeText={setStartReading} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>End Reading</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={endReading} onChangeText={setEndReading} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
            </View>

            {/* Live calc preview */}
            {startReading && endReading && parseFloat(endReading) >= parseFloat(startReading) && (
              <View style={[styles.calcPreview, { backgroundColor: ACCENT + '12' }]}>
                <Ionicons name="flash" size={16} color={ACCENT} />
                <Text style={[styles.calcText, { color: ACCENT }]}>
                  {parseFloat(endReading) - parseFloat(startReading)} units
                  {ratePerUnit ? ` = ${Math.round((parseFloat(endReading) - parseFloat(startReading)) * parseFloat(ratePerUnit) + (parseFloat(fixedCharge) || 0))}` : ''}
                </Text>
              </View>
            )}

            <View style={styles.rowInputs}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Rate / Unit</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={ratePerUnit} onChangeText={setRatePerUnit} placeholder="e.g. 7.5" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Fixed Charge</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={fixedCharge} onChangeText={setFixedCharge} placeholder="0" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={entryNote} onChangeText={setEntryNote} placeholder="Optional note" placeholderTextColor={colors.textMuted}
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveEntry}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{editId ? 'Update' : 'Add Bill'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.lg },
    momBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
    momText: { fontSize: 11, fontFamily: Fonts.bold, color: '#fff' },
    heroLabel: { fontSize: 10, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 4 },
    heroTitle: { fontSize: 26, fontFamily: Fonts.bold, color: '#fff', marginBottom: 2 },
    heroSub: { fontSize: 13, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.lg },
    heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    heroStat: { alignItems: 'center' },
    heroStatVal: { fontSize: 17, fontFamily: Fonts.bold, color: '#fff' },
    heroStatLabel: { fontSize: 9, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginTop: 2 },
    heroDivider: { width: 1, height: 30 },
    chartCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    chartLegend: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
    chartLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    chartLegendDot: { width: 8, height: 8, borderRadius: 4 },
    chartLegendText: { fontSize: 11, fontFamily: Fonts.medium },
    chartWrap: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 140 },
    barCol: { alignItems: 'center', flex: 1 },
    barVal: { fontSize: 10, fontFamily: Fonts.bold, marginBottom: 4 },
    dualBarWrap: { flexDirection: 'row', gap: 2, height: 100 },
    barTrack: { width: 16, height: 100, borderRadius: 8, overflow: 'hidden', justifyContent: 'flex-end' },
    barTrackSmall: { width: 10, height: 100, borderRadius: 5, overflow: 'hidden', justifyContent: 'flex-end' },
    barFill: { width: '100%', borderRadius: 8 },
    barLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 4 },
    emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium },
    listCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    entryRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
    entryLeft: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
    entryIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    entryMonth: { fontSize: 14, fontFamily: Fonts.bold },
    entryMeta: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 1 },
    entryNote: { fontSize: 10, fontFamily: Fonts.regular, marginTop: 2, fontStyle: 'italic' },
    entryRight: { alignItems: 'flex-end', gap: 2 },
    entryCost: { fontSize: 18, fontFamily: Fonts.bold },
    monthPicker: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
    monthArrow: { padding: 6 },
    monthDisplay: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderRadius: Radii.md, paddingVertical: 12 },
    monthText: { fontSize: 15, fontFamily: Fonts.bold },
    rowInputs: { flexDirection: 'row', gap: Spacing.md },
    calcPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.md, marginBottom: Spacing.md },
    calcText: { fontSize: 14, fontFamily: Fonts.bold },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
