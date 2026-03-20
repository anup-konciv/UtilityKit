import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EF4444';

type FoodEntry = { id: string; name: string; calories: number; time: string };
type DayLog = { date: string; entries: FoodEntry[] };

const QUICK_FOODS = [
  { name: 'Apple', cal: 95 }, { name: 'Banana', cal: 105 }, { name: 'Rice (1 cup)', cal: 206 },
  { name: 'Bread (1 slice)', cal: 79 }, { name: 'Egg', cal: 78 }, { name: 'Chicken Breast', cal: 165 },
  { name: 'Milk (1 cup)', cal: 149 }, { name: 'Coffee', cal: 2 }, { name: 'Tea', cal: 2 },
  { name: 'Pasta (1 cup)', cal: 220 }, { name: 'Salad', cal: 50 }, { name: 'Orange Juice', cal: 112 },
  { name: 'Yogurt', cal: 100 }, { name: 'Cheese (1 oz)', cal: 113 }, { name: 'Oatmeal', cal: 150 },
];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function CalorieCounterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [logs, setLogs] = useState<DayLog[]>([]);
  const [goal, setGoal] = useState(2000);
  const [showAdd, setShowAdd] = useState(false);
  const [showGoal, setShowGoal] = useState(false);
  const [foodName, setFoodName] = useState('');
  const [foodCal, setFoodCal] = useState('');
  const [goalInput, setGoalInput] = useState('2000');

  useEffect(() => {
    Promise.all([
      loadJSON<DayLog[]>(KEYS.calorieLog, []),
      loadJSON<number>(KEYS.calorieGoal, 2000),
    ]).then(([l, g]) => { setLogs(l); setGoal(g); setGoalInput(String(g)); });
  }, []);

  const persist = useCallback((l: DayLog[]) => {
    setLogs(l);
    saveJSON(KEYS.calorieLog, l);
  }, []);

  const today = todayISO();
  const todayLog = logs.find(l => l.date === today);
  const todayEntries = todayLog?.entries || [];
  const totalCal = todayEntries.reduce((s, e) => s + e.calories, 0);
  const progress = Math.min(1, totalCal / goal);
  const remaining = Math.max(0, goal - totalCal);

  const addFood = (name: string, cal: number) => {
    const entry: FoodEntry = { id: uid(), name, calories: cal, time: timeNow() };
    const updated = logs.map(l => l.date === today ? { ...l, entries: [...l.entries, entry] } : l);
    if (!todayLog) updated.unshift({ date: today, entries: [entry] });
    persist(updated);
    setFoodName(''); setFoodCal(''); setShowAdd(false);
  };

  const removeEntry = (id: string) => {
    persist(logs.map(l => l.date === today ? { ...l, entries: l.entries.filter(e => e.id !== id) } : l));
  };

  const saveGoal = () => {
    const g = parseInt(goalInput);
    if (g && g > 0) {
      setGoal(g);
      saveJSON(KEYS.calorieGoal, g);
    }
    setShowGoal(false);
  };

  const weekData = useMemo(() => {
    const data: { date: string; total: number }[] = [];
    const d = new Date();
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
      const log = logs.find(l => l.date === iso);
      data.push({ date: iso, total: log?.entries.reduce((s, e) => s + e.calories, 0) || 0 });
    }
    return data;
  }, [logs]);

  const maxWeek = Math.max(goal, ...weekData.map(d => d.total));

  return (
    <ScreenShell title="Calorie Counter" accentColor={ACCENT}>
      {/* Today Summary */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.goalBtn} onPress={() => { setGoalInput(String(goal)); setShowGoal(true); }}>
          <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.dateText, { color: colors.textMuted }]}>Today</Text>
        <Text style={[styles.calTotal, { color: totalCal > goal ? '#EF4444' : ACCENT }]}>{totalCal}</Text>
        <Text style={[styles.calLabel, { color: colors.textMuted }]}>of {goal} kcal</Text>

        <View style={[styles.progressRing, { borderColor: colors.border }]}>
          <View style={[styles.progressArc, { borderColor: totalCal > goal ? '#EF4444' : ACCENT }, { transform: [{ rotate: `${progress * 360}deg` }] }]} />
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%`, backgroundColor: totalCal > goal ? '#EF4444' : ACCENT }]} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: '#10B981' }]}>{remaining}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Remaining</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.text }]}>{todayEntries.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Items</Text>
          </View>
        </View>
      </View>

      {/* Quick Add */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <View style={styles.quickGrid}>
          {QUICK_FOODS.map(f => (
            <TouchableOpacity
              key={f.name}
              style={[styles.quickBtn, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30' }]}
              onPress={() => addFood(f.name, f.cal)}
            >
              <Text style={[styles.quickName, { color: colors.text }]}>{f.name}</Text>
              <Text style={[styles.quickCal, { color: ACCENT }]}>{f.cal}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.customBtn, { backgroundColor: ACCENT }]}
          onPress={() => { setFoodName(''); setFoodCal(''); setShowAdd(true); }}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.customBtnText}>Custom Entry</Text>
        </TouchableOpacity>
      </View>

      {/* Week Chart */}
      {weekData.some(d => d.total > 0) && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.chart}>
            {weekData.map(d => {
              const h = maxWeek > 0 ? (d.total / maxWeek) * 80 : 0;
              const overGoal = d.total > goal;
              return (
                <View key={d.date} style={styles.barWrap}>
                  <Text style={[styles.barVal, { color: colors.textMuted }]}>{d.total > 0 ? d.total : ''}</Text>
                  <View style={[styles.bar, { height: Math.max(4, h), backgroundColor: overGoal ? '#EF4444' : ACCENT }]} />
                  <Text style={[styles.barLabel, { color: colors.textMuted }]}>{d.date.slice(8)}</Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.goalLine, { borderColor: ACCENT + '40' }]}>
            <Text style={[styles.goalLineText, { color: ACCENT }]}>Goal: {goal}</Text>
          </View>
        </View>
      )}

      {/* Today's entries */}
      {todayEntries.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Today's Log</Text>
          {todayEntries.map(entry => (
            <View key={entry.id} style={[styles.entryRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.entryName, { color: colors.text }]}>{entry.name}</Text>
                <Text style={[styles.entryTime, { color: colors.textMuted }]}>{entry.time}</Text>
              </View>
              <Text style={[styles.entryCal, { color: ACCENT }]}>{entry.calories} kcal</Text>
              <TouchableOpacity onPress={() => removeEntry(entry.id)}>
                <Ionicons name="close-circle" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* Custom Add Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Food</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={foodName} onChangeText={setFoodName}
              placeholder="Food name" placeholderTextColor={colors.textMuted} autoFocus
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={foodCal} onChangeText={setFoodCal}
              placeholder="Calories (kcal)" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: ACCENT }]}
                onPress={() => { const cal = parseInt(foodCal); if (foodName.trim() && cal > 0) addFood(foodName.trim(), cal); }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Goal Modal */}
      <Modal visible={showGoal} transparent animationType="fade" onRequestClose={() => setShowGoal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Daily Calorie Goal</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={goalInput} onChangeText={setGoalInput}
              keyboardType="numeric" autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowGoal(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveGoal}>
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
    summaryCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg, position: 'relative' },
    goalBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md },
    dateText: { fontSize: 12, fontFamily: Fonts.medium },
    calTotal: { fontSize: 52, fontFamily: Fonts.bold },
    calLabel: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: Spacing.md },
    progressRing: { display: 'none' },
    progressArc: { display: 'none' },
    progressTrack: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.md },
    progressFill: { height: '100%', borderRadius: 4 },
    statsRow: { flexDirection: 'row', gap: Spacing.xl },
    stat: { alignItems: 'center' },
    statVal: { fontSize: 20, fontFamily: Fonts.bold },
    statLabel: { fontSize: 11, fontFamily: Fonts.medium },
    section: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
    quickBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.md, borderWidth: 1, flexDirection: 'row', gap: 4, alignItems: 'center' },
    quickName: { fontSize: 11, fontFamily: Fonts.medium },
    quickCal: { fontSize: 11, fontFamily: Fonts.bold },
    customBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: Radii.md },
    customBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    chart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 110, marginBottom: Spacing.sm },
    barWrap: { alignItems: 'center', gap: 2, flex: 1 },
    barVal: { fontSize: 9, fontFamily: Fonts.medium },
    bar: { width: 20, borderRadius: 4 },
    barLabel: { fontSize: 10, fontFamily: Fonts.medium },
    goalLine: { borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 4 },
    goalLineText: { fontSize: 10, fontFamily: Fonts.medium, textAlign: 'right' },
    entryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 0.5 },
    entryName: { fontSize: 14, fontFamily: Fonts.semibold },
    entryTime: { fontSize: 11, fontFamily: Fonts.regular },
    entryCal: { fontSize: 14, fontFamily: Fonts.bold, marginRight: 8 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
