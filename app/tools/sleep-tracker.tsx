import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#6366F1';

type SleepEntry = { id: string; date: string; bedTime: string; wakeTime: string; quality: number };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcDuration(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60; // next day
  return (wakeMins - bedMins) / 60;
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h ${m}m`;
}

const QUALITY = [
  { emoji: '😩', label: 'Terrible', color: '#EF4444' },
  { emoji: '😴', label: 'Poor', color: '#F97316' },
  { emoji: '😐', label: 'Fair', color: '#F59E0B' },
  { emoji: '😊', label: 'Good', color: '#3B82F6' },
  { emoji: '🌟', label: 'Excellent', color: '#10B981' },
];

export default function SleepTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<SleepEntry[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState(3);
  const [date, setDate] = useState(todayISO());

  useEffect(() => {
    loadJSON<SleepEntry[]>(KEYS.sleepLog, []).then(setEntries);
  }, []);

  const persist = useCallback((e: SleepEntry[]) => {
    setEntries(e);
    saveJSON(KEYS.sleepLog, e);
  }, []);

  const addEntry = () => {
    if (!/^\d{2}:\d{2}$/.test(bedTime) || !/^\d{2}:\d{2}$/.test(wakeTime)) return;
    const existing = entries.filter(e => e.date !== date);
    persist([{ id: uid(), date, bedTime, wakeTime, quality }, ...existing]);
    setShowAdd(false);
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Delete Entry', 'Remove this sleep log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(entries.filter(e => e.id !== id)) },
    ]);
  };

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const last7 = entries.slice(0, 7);
    const durations = last7.map(e => calcDuration(e.bedTime, e.wakeTime));
    const avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length;
    const avgQuality = last7.reduce((s, e) => s + e.quality, 0) / last7.length;

    const bedTimes = last7.map(e => {
      const [h, m] = e.bedTime.split(':').map(Number);
      return h >= 12 ? h * 60 + m : (h + 24) * 60 + m;
    });
    const avgBedMin = bedTimes.reduce((s, t) => s + t, 0) / bedTimes.length;
    const avgBedH = Math.floor(avgBedMin / 60) % 24;
    const avgBedM = Math.round(avgBedMin % 60);
    const avgBed = `${String(avgBedH).padStart(2, '0')}:${String(avgBedM).padStart(2, '0')}`;

    const wakeTimes = last7.map(e => {
      const [h, m] = e.wakeTime.split(':').map(Number);
      return h * 60 + m;
    });
    const avgWakeMin = wakeTimes.reduce((s, t) => s + t, 0) / wakeTimes.length;
    const avgWakeH = Math.floor(avgWakeMin / 60);
    const avgWakeM = Math.round(avgWakeMin % 60);
    const avgWake = `${String(avgWakeH).padStart(2, '0')}:${String(avgWakeM).padStart(2, '0')}`;

    return { avgDuration, avgQuality, avgBed, avgWake, total: entries.length };
  }, [entries]);

  const last7 = entries.slice(0, 7).reverse();

  const getDurationColor = (h: number) => {
    if (h >= 7 && h <= 9) return '#10B981';
    if (h >= 6) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <ScreenShell
      title="Sleep Tracker"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => { setBedTime('23:00'); setWakeTime('07:00'); setQuality(3); setDate(todayISO()); setShowAdd(true); }}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Stats */}
      {stats && (
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>7-Day Average</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: getDurationColor(stats.avgDuration) }]}>
                {formatDuration(stats.avgDuration)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Duration</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={{ fontSize: 28 }}>{QUALITY[Math.round(stats.avgQuality)].emoji}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Quality</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: ACCENT }]}>{stats.avgBed}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Bedtime</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: ACCENT }]}>{stats.avgWake}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wake</Text>
            </View>
          </View>
        </View>
      )}

      {/* Week Chart */}
      {last7.length > 1 && (
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Sleep Duration</Text>
          <View style={styles.chart}>
            {last7.map(e => {
              const dur = calcDuration(e.bedTime, e.wakeTime);
              const h = (dur / 12) * 80;
              return (
                <View key={e.id} style={styles.barWrap}>
                  <Text style={[styles.barVal, { color: colors.textMuted }]}>{dur.toFixed(1)}</Text>
                  <View style={[styles.bar, { height: Math.max(4, h), backgroundColor: getDurationColor(dur) }]} />
                  <Text style={[styles.barDate, { color: colors.textMuted }]}>{e.date.slice(8)}</Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.idealLine, { borderColor: '#10B98140' }]}>
            <Text style={[styles.idealText, { color: '#10B981' }]}>Ideal: 7-9h</Text>
          </View>
        </View>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="moon-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No sleep logs yet. Tap + to log your sleep!</Text>
        </View>
      ) : (
        <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>History</Text>
          {entries.slice(0, 14).map(entry => {
            const dur = calcDuration(entry.bedTime, entry.wakeTime);
            return (
              <View key={entry.id} style={[styles.entryRow, { borderBottomColor: colors.border }]}>
                <View style={styles.entryLeft}>
                  <Text style={[styles.entryDate, { color: colors.text }]}>{entry.date}</Text>
                  <View style={styles.entryTimes}>
                    <Ionicons name="moon" size={12} color={ACCENT} />
                    <Text style={[styles.entryTime, { color: colors.textMuted }]}>{entry.bedTime}</Text>
                    <Ionicons name="sunny" size={12} color="#F59E0B" />
                    <Text style={[styles.entryTime, { color: colors.textMuted }]}>{entry.wakeTime}</Text>
                  </View>
                </View>
                <View style={styles.entryRight}>
                  <Text style={[styles.entryDuration, { color: getDurationColor(dur) }]}>{formatDuration(dur)}</Text>
                  <Text style={{ fontSize: 16 }}>{QUALITY[entry.quality].emoji}</Text>
                </View>
                <TouchableOpacity onPress={() => deleteEntry(entry.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* Add Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Log Sleep</Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} maxLength={10}
            />

            <View style={styles.timeRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Bedtime</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={bedTime} onChangeText={setBedTime} placeholder="23:00" placeholderTextColor={colors.textMuted} maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Wake Time</Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={wakeTime} onChangeText={setWakeTime} placeholder="07:00" placeholderTextColor={colors.textMuted} maxLength={5}
                />
              </View>
            </View>

            {bedTime && wakeTime && /^\d{2}:\d{2}$/.test(bedTime) && /^\d{2}:\d{2}$/.test(wakeTime) && (
              <Text style={[styles.previewDuration, { color: ACCENT }]}>
                Duration: {formatDuration(calcDuration(bedTime, wakeTime))}
              </Text>
            )}

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Sleep Quality</Text>
            <View style={styles.qualityRow}>
              {QUALITY.map((q, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.qualityBtn, quality === i && { backgroundColor: q.color + '20', borderColor: q.color }]}
                  onPress={() => setQuality(i)}
                >
                  <Text style={{ fontSize: 22 }}>{q.emoji}</Text>
                  <Text style={[styles.qualityLabel, { color: quality === i ? q.color : colors.textMuted }]}>{q.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addEntry}>
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
    statsCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 18, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    chartCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    chart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 110 },
    barWrap: { alignItems: 'center', gap: 2, flex: 1 },
    barVal: { fontSize: 9, fontFamily: Fonts.medium },
    bar: { width: 20, borderRadius: 4 },
    barDate: { fontSize: 10, fontFamily: Fonts.medium },
    idealLine: { borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 4, marginTop: Spacing.sm },
    idealText: { fontSize: 10, fontFamily: Fonts.medium, textAlign: 'right' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center' },
    historyCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg },
    entryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 0.5 },
    entryLeft: { flex: 1 },
    entryDate: { fontSize: 14, fontFamily: Fonts.bold },
    entryTimes: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    entryTime: { fontSize: 12, fontFamily: Fonts.regular },
    entryRight: { alignItems: 'center', marginRight: 8 },
    entryDuration: { fontSize: 14, fontFamily: Fonts.bold },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    timeRow: { flexDirection: 'row', gap: Spacing.md },
    previewDuration: { fontSize: 14, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: Spacing.md },
    qualityRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.lg },
    qualityBtn: { alignItems: 'center', padding: 6, borderRadius: Radii.md, borderWidth: 1.5, borderColor: 'transparent' },
    qualityLabel: { fontSize: 9, fontFamily: Fonts.medium, marginTop: 2 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
