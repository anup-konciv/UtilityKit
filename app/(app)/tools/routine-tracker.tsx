import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert,
} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import EmptyState from '@/components/EmptyState';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#8B5CF6';

type Routine = {
  id: string;
  name: string;
  icon: string;
  color: string;
  steps: string[];
  createdAt: string;
};
type RoutineLogs = Record<string, Record<string, boolean[]>>;
// key = "YYYY-MM-DD", value = { routineId: [stepDone, stepDone, ...] }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getStreak(routineId: string, logs: RoutineLogs, steps: number): number {
  let streak = 0;
  const cursor = new Date();
  const todayDone = isRoutineDone(todayISO(), routineId, logs, steps);
  if (todayDone) {
    streak = 1;
    cursor.setDate(cursor.getDate() - 1);
  } else {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = dateKey(cursor);
    if (!isRoutineDone(key, routineId, logs, steps)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
    if (streak > 365) break;
  }
  return streak;
}

function isRoutineDone(date: string, routineId: string, logs: RoutineLogs, totalSteps: number): boolean {
  const dayLog = logs[date]?.[routineId];
  if (!dayLog || totalSteps === 0) return false;
  return dayLog.filter(Boolean).length === totalSteps;
}

const ICONS = ['sunny-outline', 'moon-outline', 'barbell-outline', 'book-outline', 'briefcase-outline', 'cafe-outline', 'heart-outline', 'musical-notes-outline'];
const COLORS = ['#EF4444', '#F97316', '#F59E0B', '#10B981', '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899'];

function last7Keys(): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

function shortDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()];
}

export default function RoutineTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [routines, setRoutines] = useState<Routine[]>([]);
  const [logs, setLogs] = useState<RoutineLogs>({});
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayISO());

  // Form
  const [name, setName] = useState('');
  const [selIcon, setSelIcon] = useState(ICONS[0]);
  const [selColor, setSelColor] = useState(COLORS[0]);
  const [stepsText, setStepsText] = useState('');

  useEffect(() => {
    loadJSON<Routine[]>(KEYS.routines, []).then(setRoutines);
    loadJSON<RoutineLogs>(KEYS.routineLogs, {}).then(setLogs);
  }, []);

  const persistRoutines = useCallback((r: Routine[]) => {
    setRoutines(r);
    saveJSON(KEYS.routines, r);
  }, []);

  const persistLogs = useCallback((l: RoutineLogs) => {
    setLogs(l);
    saveJSON(KEYS.routineLogs, l);
  }, []);

  const openAdd = (routine?: Routine) => {
    if (routine) {
      setEditId(routine.id);
      setName(routine.name);
      setSelIcon(routine.icon);
      setSelColor(routine.color);
      setStepsText(routine.steps.join('\n'));
    } else {
      setEditId(null);
      setName('');
      setSelIcon(ICONS[0]);
      setSelColor(COLORS[0]);
      setStepsText('');
    }
    setShowAdd(true);
  };

  const saveRoutine = () => {
    const steps = stepsText.split('\n').map(s => s.trim()).filter(Boolean);
    if (!name.trim() || steps.length === 0) return;
    if (editId) {
      persistRoutines(routines.map(r => r.id === editId ? { ...r, name: name.trim(), icon: selIcon, color: selColor, steps } : r));
    } else {
      persistRoutines([...routines, { id: uid(), name: name.trim(), icon: selIcon, color: selColor, steps, createdAt: todayISO() }]);
    }
    setShowAdd(false);
  };

  const deleteRoutine = (id: string) => {
    Alert.alert('Delete Routine', 'Remove this routine and all its logs?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persistRoutines(routines.filter(r => r.id !== id)) },
    ]);
  };

  const toggleStep = (routineId: string, stepIdx: number) => {
    const dayLog = { ...logs };
    if (!dayLog[selectedDate]) dayLog[selectedDate] = {};
    const routineSteps = routines.find(r => r.id === routineId)?.steps.length ?? 0;
    if (!dayLog[selectedDate][routineId]) dayLog[selectedDate][routineId] = new Array(routineSteps).fill(false);
    dayLog[selectedDate][routineId] = [...dayLog[selectedDate][routineId]];
    dayLog[selectedDate][routineId][stepIdx] = !dayLog[selectedDate][routineId][stepIdx];
    persistLogs(dayLog);
  };

  const today = todayISO();
  const week = last7Keys();

  const completeAllSteps = (routineId: string) => {
    const routine = routines.find(r => r.id === routineId);
    if (!routine) return;
    const dayLog = { ...logs };
    if (!dayLog[selectedDate]) dayLog[selectedDate] = {};
    const allDone = dayLog[selectedDate][routineId]?.every(Boolean) ?? false;
    dayLog[selectedDate][routineId] = new Array(routine.steps.length).fill(!allDone);
    persistLogs(dayLog);
  };

  // Stats
  const todayCompleted = routines.filter(r => isRoutineDone(today, r.id, logs, r.steps.length)).length;
  const bestStreak = routines.length > 0 ? Math.max(...routines.map(r => getStreak(r.id, logs, r.steps.length))) : 0;
  const weekCompletions = week.reduce((sum, k) => sum + routines.filter(r => isRoutineDone(k, r.id, logs, r.steps.length)).length, 0);

  return (
    <ScreenShell
      title="Routines"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => openAdd()}>
          <Ionicons name="add-circle-outline" size={24} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Hero Card */}
      {routines.length > 0 && (
        <LinearGradient
          colors={['#3B0764', '#7C3AED', '#A78BFA']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <Text style={styles.heroLabel}>TODAY'S PROGRESS</Text>
          <Text style={styles.heroTitle}>{todayCompleted}/{routines.length} Done</Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{bestStreak}d</Text>
              <Text style={styles.heroStatLabel}>BEST STREAK</Text>
            </View>
            <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{weekCompletions}</Text>
              <Text style={styles.heroStatLabel}>THIS WEEK</Text>
            </View>
            <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{routines.reduce((s, r) => s + r.steps.length, 0)}</Text>
              <Text style={styles.heroStatLabel}>TOTAL STEPS</Text>
            </View>
          </View>
        </LinearGradient>
      )}

      {/* Week Strip */}
      <View style={[styles.weekStrip, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {week.map(k => {
          const isSelected = k === selectedDate;
          const isToday = k === today;
          const allDone = routines.length > 0 && routines.every(r => isRoutineDone(k, r.id, logs, r.steps.length));
          return (
            <TouchableOpacity key={k} style={[styles.weekDay, isSelected && { backgroundColor: ACCENT + '20' }]} onPress={() => setSelectedDate(k)}>
              <Text style={[styles.weekDayLabel, { color: isSelected ? ACCENT : colors.textMuted }]}>{shortDay(k)}</Text>
              <Text style={[styles.weekDayNum, { color: isSelected ? ACCENT : colors.text }]}>{k.split('-')[2]}</Text>
              {allDone && <View style={[styles.weekDot, { backgroundColor: '#10B981' }]} />}
              {isToday && !allDone && <View style={[styles.weekDot, { backgroundColor: ACCENT }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Routines */}
      {routines.length === 0 ? (
        <EmptyState
          icon="time-outline"
          title="No routines yet"
          hint="Group recurring tasks like Morning routine or Workout into a single checklist with streak tracking."
          accent={ACCENT}
          actionLabel="Create routine"
          onAction={() => openAdd()}
        />
      ) : routines.map(routine => {
        const daySteps = logs[selectedDate]?.[routine.id] ?? [];
        const doneCount = daySteps.filter(Boolean).length;
        const totalSteps = routine.steps.length;
        const allDone = doneCount === totalSteps;
        const streak = getStreak(routine.id, logs, totalSteps);
        const pct = totalSteps > 0 ? (doneCount / totalSteps) * 100 : 0;

        return (
          <View key={routine.id} style={[styles.routineCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.routineHeader}>
              <View style={[styles.routineIcon, { backgroundColor: routine.color + '20' }]}>
                <Ionicons name={routine.icon as any} size={20} color={routine.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.routineName, { color: colors.text }]}>{routine.name}</Text>
                <Text style={[styles.routineMeta, { color: colors.textMuted }]}>
                  {doneCount}/{totalSteps} steps{streak > 0 ? `  •  ${streak}d streak` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => completeAllSteps(routine.id)} style={{ marginLeft: 4 }}>
                <Ionicons name={allDone ? 'checkmark-circle' : 'checkmark-done-circle-outline'} size={24} color={allDone ? '#10B981' : colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => openAdd(routine)} style={{ marginLeft: 4 }}>
                <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: routine.color }]} />
            </View>

            {/* Steps */}
            {routine.steps.map((step, idx) => {
              const done = daySteps[idx] ?? false;
              return (
                <TouchableOpacity key={idx} style={styles.stepRow} onPress={() => toggleStep(routine.id, idx)}>
                  <Ionicons
                    name={done ? 'checkmark-circle' : 'ellipse-outline'}
                    size={22}
                    color={done ? routine.color : colors.textMuted}
                  />
                  <Text style={[styles.stepText, { color: done ? colors.textMuted : colors.text, textDecorationLine: done ? 'line-through' : 'none' }]}>
                    {step}
                  </Text>
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteRoutine(routine.id)}>
              <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Add/Edit Modal */}
      <KeyboardAwareModal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editId ? 'Edit Routine' : 'New Routine'}</Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={name} onChangeText={setName} placeholder="e.g. Morning Routine" placeholderTextColor={colors.textMuted} autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Icon</Text>
            <View style={styles.iconRow}>
              {ICONS.map(ic => (
                <TouchableOpacity key={ic} style={[styles.iconBtn, selIcon === ic && { backgroundColor: selColor + '20', borderColor: selColor }]} onPress={() => setSelIcon(ic)}>
                  <Ionicons name={ic as any} size={20} color={selIcon === ic ? selColor : colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Color</Text>
            <View style={styles.colorRow}>
              {COLORS.map(cl => (
                <TouchableOpacity key={cl} style={[styles.colorBtn, { backgroundColor: cl }, selColor === cl && styles.colorBtnSel]} onPress={() => setSelColor(cl)} />
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Steps (one per line)</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, height: 100, textAlignVertical: 'top' }]}
              value={stepsText} onChangeText={setStepsText} placeholder={'Brush teeth\nExercise\nShower\nBreakfast'} placeholderTextColor={colors.textMuted} multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveRoutine}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{editId ? 'Update' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.lg },
    heroLabel: { fontSize: 10, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 4 },
    heroTitle: { fontSize: 26, fontFamily: Fonts.bold, color: '#fff', marginBottom: Spacing.lg },
    heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    heroStat: { alignItems: 'center' },
    heroStatVal: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff' },
    heroStatLabel: { fontSize: 9, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginTop: 2 },
    heroDivider: { width: 1, height: 30 },
    weekStrip: { flexDirection: 'row', borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xs, marginBottom: Spacing.lg },
    weekDay: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radii.md },
    weekDayLabel: { fontSize: 10, fontFamily: Fonts.medium },
    weekDayNum: { fontSize: 16, fontFamily: Fonts.bold, marginTop: 2 },
    weekDot: { width: 5, height: 5, borderRadius: 3, marginTop: 3 },
    emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 8 },
    emptyText: { fontSize: 15, fontFamily: Fonts.semibold },
    emptyHint: { fontSize: 12, fontFamily: Fonts.regular },
    routineCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    routineHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: Spacing.sm },
    routineIcon: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    routineName: { fontSize: 16, fontFamily: Fonts.bold },
    routineMeta: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 1 },
    progressBar: { height: 4, borderRadius: 2, marginBottom: Spacing.md, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    stepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    stepText: { fontSize: 14, fontFamily: Fonts.medium, flex: 1 },
    deleteBtn: { alignSelf: 'flex-end', marginTop: Spacing.sm, padding: 4 },
    iconRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md, flexWrap: 'wrap' },
    iconBtn: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: c.border },
    colorRow: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md },
    colorBtn: { width: 28, height: 28, borderRadius: 14 },
    colorBtnSel: { borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.3, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 4 },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
