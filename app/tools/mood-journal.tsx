import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F59E0B';

type MoodEntry = { id: string; date: string; mood: number; note: string };

const MOODS = [
  { emoji: '😢', label: 'Awful', color: '#EF4444' },
  { emoji: '😟', label: 'Bad', color: '#F97316' },
  { emoji: '😐', label: 'Meh', color: '#F59E0B' },
  { emoji: '🙂', label: 'Good', color: '#3B82F6' },
  { emoji: '😄', label: 'Great', color: '#10B981' },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function MoodJournalScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    loadJSON<MoodEntry[]>(KEYS.moodJournal, []).then(setEntries);
  }, []);

  const persist = useCallback((e: MoodEntry[]) => {
    setEntries(e);
    saveJSON(KEYS.moodJournal, e);
  }, []);

  const today = todayISO();
  const todayEntry = entries.find(e => e.date === today);

  const logMood = () => {
    if (selectedMood === null) return;
    const existing = entries.filter(e => e.date !== today);
    const entry: MoodEntry = { id: todayEntry?.id || uid(), date: today, mood: selectedMood, note: note.trim() };
    persist([entry, ...existing]);
    setSelectedMood(null);
    setNote('');
  };

  const deleteEntry = (id: string) => {
    persist(entries.filter(e => e.id !== id));
  };

  const stats = useMemo(() => {
    if (entries.length === 0) return null;
    const last7 = entries.slice(0, 7);
    const last30 = entries.slice(0, 30);
    const avg7 = last7.reduce((s, e) => s + e.mood, 0) / last7.length;
    const avg30 = last30.reduce((s, e) => s + e.mood, 0) / last30.length;
    const moodCounts = [0, 0, 0, 0, 0];
    for (const e of entries) moodCounts[e.mood]++;
    const mostCommon = moodCounts.indexOf(Math.max(...moodCounts));
    const streak = (() => {
      let count = 0;
      const d = new Date();
      for (let i = 0; i < 365; i++) {
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        if (entries.some(e => e.date === iso)) count++;
        else break;
        d.setDate(d.getDate() - 1);
      }
      return count;
    })();
    return { avg7, avg30, mostCommon, streak, total: entries.length };
  }, [entries]);

  const last7 = entries.slice(0, 7).reverse();

  return (
    <ScreenShell title="Mood Journal" accentColor={ACCENT}>
      {/* Today's mood */}
      <View style={[styles.todayCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.todayTitle, { color: colors.text }]}>
          {todayEntry ? "Today's Mood" : "How are you feeling?"}
        </Text>
        {todayEntry && (
          <View style={styles.todayMood}>
            <Text style={{ fontSize: 48 }}>{MOODS[todayEntry.mood].emoji}</Text>
            <Text style={[styles.todayLabel, { color: MOODS[todayEntry.mood].color }]}>{MOODS[todayEntry.mood].label}</Text>
            {todayEntry.note ? <Text style={[styles.todayNote, { color: colors.textMuted }]}>{todayEntry.note}</Text> : null}
          </View>
        )}
        <View style={styles.moodRow}>
          {MOODS.map((m, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.moodBtn, selectedMood === i && { backgroundColor: m.color + '20', borderColor: m.color }]}
              onPress={() => setSelectedMood(i)}
            >
              <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
              <Text style={[styles.moodLabel, { color: selectedMood === i ? m.color : colors.textMuted }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={[styles.noteInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={note}
          onChangeText={setNote}
          placeholder="Add a note (optional)..."
          placeholderTextColor={colors.textMuted}
          multiline
        />
        <TouchableOpacity
          style={[styles.logBtn, { backgroundColor: selectedMood !== null ? ACCENT : colors.surface }]}
          onPress={logMood}
          disabled={selectedMood === null}
        >
          <Text style={[styles.logBtnText, { color: selectedMood !== null ? '#fff' : colors.textMuted }]}>
            {todayEntry ? 'Update Mood' : 'Log Mood'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Mini chart */}
      {last7.length > 1 && (
        <View style={[styles.chartCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Last 7 Days</Text>
          <View style={styles.chart}>
            {last7.map((e, i) => {
              const height = ((e.mood + 1) / 5) * 80;
              return (
                <View key={e.id} style={styles.barWrap}>
                  <View style={[styles.bar, { height, backgroundColor: MOODS[e.mood].color }]} />
                  <Text style={{ fontSize: 14 }}>{MOODS[e.mood].emoji}</Text>
                  <Text style={[styles.barDate, { color: colors.textMuted }]}>{e.date.slice(5)}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Stats */}
      {stats && (
        <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: ACCENT }]}>{stats.streak}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Day Streak</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: ACCENT }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Entries</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={{ fontSize: 24 }}>{MOODS[Math.round(stats.avg7)].emoji}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>7-Day Avg</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={{ fontSize: 24 }}>{MOODS[stats.mostCommon].emoji}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Most Common</Text>
            </View>
          </View>
        </View>
      )}

      {/* History */}
      {entries.length > 0 && (
        <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>History</Text>
          {entries.slice(0, 20).map(entry => (
            <View key={entry.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
              <Text style={{ fontSize: 22 }}>{MOODS[entry.mood].emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyDate, { color: colors.text }]}>{entry.date}</Text>
                {entry.note ? <Text style={[styles.historyNote, { color: colors.textMuted }]} numberOfLines={1}>{entry.note}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => deleteEntry(entry.id)}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    todayCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    todayTitle: { fontSize: 18, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: Spacing.md },
    todayMood: { alignItems: 'center', marginBottom: Spacing.lg },
    todayLabel: { fontSize: 16, fontFamily: Fonts.bold, marginTop: 4 },
    todayNote: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 4 },
    moodRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.md },
    moodBtn: { alignItems: 'center', padding: 8, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: 'transparent' },
    moodLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    noteInput: { borderWidth: 1, borderRadius: Radii.md, padding: Spacing.md, fontSize: 14, fontFamily: Fonts.regular, minHeight: 50, marginBottom: Spacing.md },
    logBtn: { paddingVertical: 14, borderRadius: Radii.xl, alignItems: 'center' },
    logBtnText: { fontSize: 16, fontFamily: Fonts.bold },
    chartCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    chart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 },
    barWrap: { alignItems: 'center', gap: 2 },
    bar: { width: 24, borderRadius: 4 },
    barDate: { fontSize: 9, fontFamily: Fonts.regular },
    statsCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 24, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    historyCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 0.5 },
    historyDate: { fontSize: 13, fontFamily: Fonts.semibold },
    historyNote: { fontSize: 12, fontFamily: Fonts.regular },
  });
