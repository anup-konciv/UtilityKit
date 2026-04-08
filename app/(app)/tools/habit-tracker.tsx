import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';
import { schedule, cancel } from '@/lib/notifications';
import { haptics } from '@/lib/haptics';
import EmptyState from '@/components/EmptyState';

// ─── Constants ───────────────────────────────────────────────────────────────
const ACCENT = '#8B5CF6';
const ACCENT_DIM = 'rgba(139,92,246,0.15)';

const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

type HabitCategory = 'Health' | 'Fitness' | 'Learning' | 'Mindfulness' | 'Productivity' | 'Other';

const CATEGORIES: HabitCategory[] = ['Health', 'Fitness', 'Learning', 'Mindfulness', 'Productivity', 'Other'];

const CATEGORY_META: Record<HabitCategory, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  Health:       { icon: 'heart-outline',      color: '#EF4444' },
  Fitness:      { icon: 'barbell-outline',     color: '#F97316' },
  Learning:     { icon: 'book-outline',        color: '#3B82F6' },
  Mindfulness:  { icon: 'leaf-outline',        color: '#10B981' },
  Productivity: { icon: 'rocket-outline',      color: '#8B5CF6' },
  Other:        { icon: 'ellipsis-horizontal', color: '#64748B' },
};

const ENCOURAGEMENTS = [
  "All done — incredible work today!",
  "Perfect day! You're on fire!",
  "100% complete! Keep it up!",
  "All habits done! You nailed it!",
  "Outstanding! Every habit checked off!",
];

// ─── Types ───────────────────────────────────────────────────────────────────
type Habit = {
  id: string;
  name: string;
  color: string;
  category: HabitCategory;
  createdAt: string;
  bestStreak: number;
};

type HabitLogs = Record<string, string[]>; // "YYYY-MM-DD" -> habit IDs

type CalendarView = 'week' | 'month';
type FilterCategory = HabitCategory | 'All';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayKey(): string {
  return dateKey(new Date());
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function last7Keys(): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

function last30Keys(): string[] {
  const keys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

function shortDay(key: string): string {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { weekday: 'short' });
}

function getStreak(habitId: string, logs: HabitLogs): number {
  let streak = 0;
  const cursor = new Date();
  const todayCompleted = (logs[todayKey()] ?? []).includes(habitId);
  if (todayCompleted) {
    streak = 1;
    cursor.setDate(cursor.getDate() - 1);
  } else {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = dateKey(cursor);
    if (!(logs[key] ?? []).includes(habitId)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getWeeklyDaysCompleted(habitId: string, logs: HabitLogs): number {
  return last7Keys().filter(k => (logs[k] ?? []).includes(habitId)).length;
}

function getWeeklyRate(habitId: string, logs: HabitLogs): number {
  return Math.round((getWeeklyDaysCompleted(habitId, logs) / 7) * 100);
}

// Returns the calendar grid for a given month (year, 0-based month)
// Each row is a week (7 cells), cell = "YYYY-MM-DD" or null (padding)
function buildMonthGrid(year: number, month: number): (string | null)[][] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Week starts Monday (1). Sunday=0 -> shift to 6, else day-1
  const startPad = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(dateKey(new Date(year, month, d)));
  }
  // pad to complete last row
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function HabitTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLogs>({});

  // Add / Edit modal
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState<Habit | null>(null);
  const [modalName, setModalName] = useState('');
  const [modalColor, setModalColor] = useState(COLOR_PALETTE[0]);
  const [modalCategory, setModalCategory] = useState<HabitCategory>('Other');

  // View toggles
  const [calView, setCalView] = useState<CalendarView>('week');
  const [filterCat, setFilterCat] = useState<FilterCategory>('All');

  // Month calendar state
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());
  const [dayDetail, setDayDetail] = useState<string | null>(null); // dateKey

  // Streak refresh flag (to recompute best streaks after toggle)
  const [tick, setTick] = useState(0);

  // Load on mount
  useEffect(() => {
    loadJSON<Habit[]>(KEYS.habits, []).then(data => {
      // Migrate old habits that lack category/bestStreak
      const migrated = data.map(h => ({
        ...h,
        category: (h as any).category ?? 'Other',
        bestStreak: (h as any).bestStreak ?? 0,
      })) as Habit[];
      setHabits(migrated);
    });
    loadJSON<HabitLogs>(KEYS.habitLogs, {}).then(setLogs);
  }, []);

  // Persist helpers
  const persistHabits = useCallback((updated: Habit[]) => {
    setHabits(updated);
    saveJSON(KEYS.habits, updated);
  }, []);

  const persistLogs = useCallback((updated: HabitLogs) => {
    setLogs(updated);
    saveJSON(KEYS.habitLogs, updated);
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────
  const today = todayKey();
  const todayCompleted = useMemo(() => logs[today] ?? [], [logs, today]);
  const weekKeys = useMemo(() => last7Keys(), []);

  const filteredHabits = useMemo(
    () => filterCat === 'All' ? habits : habits.filter(h => h.category === filterCat),
    [habits, filterCat],
  );

  const allDoneToday = habits.length > 0 && todayCompleted.length >= habits.length;

  // Stats dashboard
  const stats = useMemo(() => {
    const total = habits.length;
    const todayRate = total > 0 ? Math.round((todayCompleted.length / total) * 100) : 0;
    const week7 = last7Keys();
    const month30 = last30Keys();
    let week7Sum = 0;
    let month30Sum = 0;
    for (const h of habits) {
      week7Sum += week7.filter(k => (logs[k] ?? []).includes(h.id)).length;
      month30Sum += month30.filter(k => (logs[k] ?? []).includes(h.id)).length;
    }
    const weekRate = total > 0 ? Math.round(week7Sum / (total * 7) * 100) : 0;
    const monthRate = total > 0 ? Math.round(month30Sum / (total * 30) * 100) : 0;

    let longestStreak = 0;
    let mostConsistentName = '—';
    let mostConsistentRate = -1;
    for (const h of habits) {
      const streak = getStreak(h.id, logs);
      if (streak > longestStreak) longestStreak = streak;
      const rate = getWeeklyRate(h.id, logs);
      if (rate > mostConsistentRate) {
        mostConsistentRate = rate;
        mostConsistentName = h.name;
      }
    }
    return { total, todayRate, weekRate, monthRate, longestStreak, mostConsistentName };
  }, [habits, logs, todayCompleted, tick]);

  // Month grid
  const monthGrid = useMemo(() => buildMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const monthLabel = useMemo(() => {
    return new Date(calYear, calMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }, [calYear, calMonth]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const openAddModal = useCallback(() => {
    setEditTarget(null);
    setModalName('');
    setModalColor(COLOR_PALETTE[0]);
    setModalCategory('Other');
    setShowAdd(true);
  }, []);

  const openEditModal = useCallback((habit: Habit) => {
    setEditTarget(habit);
    setModalName(habit.name);
    setModalColor(habit.color);
    setModalCategory(habit.category);
    setShowAdd(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowAdd(false);
    setEditTarget(null);
    setModalName('');
  }, []);

  // Schedule a daily 9 AM reminder for the habit. Tools will need an
  // expo-notifications install before these actually fire — until then the
  // call is a graceful no-op (see lib/notifications.ts).
  const scheduleHabitReminder = useCallback(async (habit: Habit) => {
    const at = new Date();
    at.setHours(9, 0, 0, 0);
    await schedule({
      id: habit.id,
      namespace: 'habit',
      title: `Don't break the streak`,
      body: `Time for: ${habit.name}`,
      date: at,
      repeat: 'daily',
      data: { habitId: habit.id },
    });
  }, []);

  const saveHabit = useCallback(() => {
    const trimmed = modalName.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Please enter a habit name.');
      return;
    }
    if (editTarget) {
      // Update existing
      const updated: Habit = {
        ...editTarget,
        name: trimmed,
        color: modalColor,
        category: modalCategory,
      };
      persistHabits(habits.map(h => (h.id === editTarget.id ? updated : h)));
      void scheduleHabitReminder(updated);
    } else {
      // New habit
      const habit: Habit = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmed,
        color: modalColor,
        category: modalCategory,
        createdAt: new Date().toISOString(),
        bestStreak: 0,
      };
      persistHabits([...habits, habit]);
      void scheduleHabitReminder(habit);
    }
    haptics.success();
    closeModal();
  }, [modalName, modalColor, modalCategory, editTarget, habits, persistHabits, closeModal, scheduleHabitReminder]);

  const deleteHabit = useCallback((id: string) => {
    Alert.alert('Delete Habit', 'Remove this habit and all its history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          haptics.warning();
          persistHabits(habits.filter(h => h.id !== id));
          const cleaned: HabitLogs = {};
          for (const [key, ids] of Object.entries(logs)) {
            const filtered = ids.filter(hid => hid !== id);
            if (filtered.length > 0) cleaned[key] = filtered;
          }
          persistLogs(cleaned);
          void cancel('habit', id);
        },
      },
    ]);
  }, [habits, logs, persistHabits, persistLogs]);

  const toggleHabit = useCallback((habitId: string) => {
    const dayLogs = logs[today] ?? [];
    const isCompleted = dayLogs.includes(habitId);
    const updated = isCompleted
      ? dayLogs.filter(id => id !== habitId)
      : [...dayLogs, habitId];
    const newLogs = { ...logs, [today]: updated };
    persistLogs(newLogs);
    // Update bestStreak stored on habit when completing
    if (!isCompleted) {
      setHabits(prev => {
        const updated2 = prev.map(h => {
          if (h.id !== habitId) return h;
          const currentStreak = getStreak(habitId, newLogs);
          const best = Math.max(h.bestStreak ?? 0, currentStreak);
          return { ...h, bestStreak: best };
        });
        saveJSON(KEYS.habits, updated2);
        return updated2;
      });
    }
    setTick(t => t + 1);
  }, [logs, today, persistLogs]);

  // ── Render Helpers ─────────────────────────────────────────────────────────
  const renderHabit = useCallback(({ item }: { item: Habit }) => {
    const isCompleted = todayCompleted.includes(item.id);
    const streak = getStreak(item.id, logs);
    const bestStreak = Math.max(item.bestStreak ?? 0, streak);
    const daysThisWeek = getWeeklyDaysCompleted(item.id, logs);
    const catMeta = CATEGORY_META[item.category ?? 'Other'];

    return (
      <View style={[styles.habitCard, {
        backgroundColor: colors.card,
        borderColor: isCompleted ? withAlpha(item.color, '33') : colors.border,
        shadowColor: item.color,
      }]}>
        {/* Top row */}
        <View style={styles.habitTopRow}>
          {/* Progress ring + checkbox */}
          <TouchableOpacity onPress={() => toggleHabit(item.id)} activeOpacity={0.75}>
            <View style={styles.ringWrap}>
              {/* Track */}
              <View style={[styles.ringTrack, { borderColor: withAlpha(item.color, '33') }]} />
              {/* Fill arc using border segments */}
              {daysThisWeek > 0 && (
                <View style={styles.ringFillWrap}>
                  {/* Right half */}
                  <View style={[styles.ringHalfRight, { overflow: 'hidden' }]}>
                    <View style={[styles.ringHalfCircle, {
                      borderColor: item.color,
                      transform: [{ rotate: `${Math.min(180, daysThisWeek / 7 * 360)}deg` }],
                    }]} />
                  </View>
                  {/* Left half (when > 50%) */}
                  {daysThisWeek / 7 > 0.5 && (
                    <View style={[styles.ringHalfLeft, { overflow: 'hidden' }]}>
                      <View style={[styles.ringHalfCircle, {
                        borderColor: item.color,
                        transform: [{ rotate: `-${(daysThisWeek / 7 - 0.5) * 360}deg` }],
                      }]} />
                    </View>
                  )}
                </View>
              )}
              {/* Center checkbox */}
              <View style={[styles.ringCenter, {
                backgroundColor: isCompleted ? item.color : colors.card,
                borderColor: isCompleted ? item.color : colors.borderStrong,
              }]}>
                {isCompleted
                  ? <Ionicons name="checkmark" size={14} color="#fff" />
                  : <View style={[styles.ringCenterDot, { backgroundColor: item.color }]} />
                }
              </View>
            </View>
          </TouchableOpacity>

          {/* Name + stats */}
          <TouchableOpacity style={styles.habitInfo} onPress={() => openEditModal(item)} activeOpacity={0.7}>
            <Text
              style={[styles.habitName, { color: colors.text }, isCompleted && styles.habitNameDone]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.habitMeta}>
              {/* Category pill */}
              <View style={[styles.catPill, { backgroundColor: withAlpha(catMeta.color, '22') }]}>
                <Ionicons name={catMeta.icon} size={9} color={catMeta.color} />
                <Text style={[styles.catPillText, { color: catMeta.color }]}>{item.category}</Text>
              </View>
              {/* Streak */}
              {streak > 0 && (
                <View style={styles.statBadge}>
                  <Ionicons name="flame" size={11} color="#F97316" />
                  <Text style={[styles.statText, { color: colors.textMuted }]}>{streak}d</Text>
                </View>
              )}
              {/* Best streak */}
              {bestStreak > 0 && (
                <View style={styles.statBadge}>
                  <Ionicons name="trophy-outline" size={11} color="#F59E0B" />
                  <Text style={[styles.statText, { color: colors.textMuted }]}>Best: {bestStreak}d</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>

          {/* Week progress label */}
          <View style={styles.weekCountWrap}>
            <Text style={[styles.weekCountNum, { color: item.color }]}>{daysThisWeek}</Text>
            <Text style={[styles.weekCountDen, { color: colors.textMuted }]}>/7</Text>
          </View>

          {/* Delete */}
          <TouchableOpacity onPress={() => deleteHabit(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Weekly dots (week view only) */}
        {calView === 'week' && (
          <View style={[styles.weekDotsRow, { borderTopColor: colors.border }]}>
            {weekKeys.map(key => {
              const done = (logs[key] ?? []).includes(item.id);
              const isToday = key === today;
              return (
                <View key={key} style={styles.weekDotCol}>
                  <Text style={[styles.weekDotLabel, { color: isToday ? item.color : colors.textMuted }]}>
                    {shortDay(key).charAt(0)}
                  </Text>
                  <View style={[styles.weekDot, {
                    backgroundColor: done ? item.color : 'transparent',
                    borderColor: done ? item.color : (isToday ? item.color : colors.border),
                    borderWidth: isToday ? 2 : 1.5,
                  }]} />
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }, [todayCompleted, logs, weekKeys, today, colors, styles, toggleHabit, deleteHabit, openEditModal, calView, tick]);

  // ── Add/Edit Modal ─────────────────────────────────────────────────────────
  const renderModal = () => (
    <Modal visible={showAdd} transparent animationType="fade" onRequestClose={closeModal}>
      <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {editTarget ? 'Edit Habit' : 'New Habit'}
          </Text>

          <TextInput
            style={[styles.addInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={modalName}
            onChangeText={setModalName}
            placeholder="e.g. Read 30 min"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          {/* Category picker */}
          <Text style={[styles.addLabel, { color: colors.textSub }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map(cat => {
              const meta = CATEGORY_META[cat];
              const active = modalCategory === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setModalCategory(cat)}
                  style={[styles.catOption, {
                    backgroundColor: active ? withAlpha(meta.color, '22') : colors.inputBg,
                    borderColor: active ? meta.color : colors.border,
                  }]}
                  activeOpacity={0.7}
                >
                  <Ionicons name={meta.icon} size={14} color={active ? meta.color : colors.textMuted} />
                  <Text style={[styles.catOptionText, { color: active ? meta.color : colors.textMuted }]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Color picker */}
          <Text style={[styles.addLabel, { color: colors.textSub }]}>Color</Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTE.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setModalColor(c)}
                style={[styles.colorDot, { backgroundColor: c }, modalColor === c && styles.colorDotSelected]}
                activeOpacity={0.7}
              >
                {modalColor === c && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.addActions}>
            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnCancel, { borderColor: colors.border }]}
              onPress={closeModal}
            >
              <Text style={[styles.addBtnText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnPrimary, { backgroundColor: ACCENT }]}
              onPress={saveHabit}
            >
              <Ionicons name={editTarget ? 'checkmark' : 'add'} size={16} color="#fff" />
              <Text style={[styles.addBtnText, { color: '#fff' }]}>{editTarget ? 'Save' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  // ── Day Detail Modal (month view tap) ─────────────────────────────────────
  const renderDayDetail = () => {
    if (!dayDetail) return null;
    const doneIds = logs[dayDetail] ?? [];
    const doneHabits = habits.filter(h => doneIds.includes(h.id));
    const [y, m, d] = dayDetail.split('-').map(Number);
    const label = new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
    return (
      <Modal visible={!!dayDetail} transparent animationType="fade" onRequestClose={() => setDayDetail(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setDayDetail(null)}>
          <TouchableOpacity activeOpacity={1} style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{label}</Text>
            {doneHabits.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textMuted, textAlign: 'center', marginTop: Spacing.md }]}>
                No habits completed.
              </Text>
            ) : (
              doneHabits.map(h => (
                <View key={h.id} style={[styles.dayDetailRow, { borderColor: colors.border }]}>
                  <View style={[styles.dayDetailDot, { backgroundColor: h.color }]} />
                  <Text style={[styles.dayDetailName, { color: colors.text }]}>{h.name}</Text>
                  <View style={[styles.catPill, { backgroundColor: withAlpha(CATEGORY_META[h.category ?? 'Other'].color, '22') }]}>
                    <Text style={[styles.catPillText, { color: CATEGORY_META[h.category ?? 'Other'].color }]}>{h.category}</Text>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnPrimary, { backgroundColor: ACCENT, marginTop: Spacing.lg }]}
              onPress={() => setDayDetail(null)}
            >
              <Text style={[styles.addBtnText, { color: '#fff' }]}>Close</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    );
  };

  // ── Month Calendar ─────────────────────────────────────────────────────────
  const renderMonthCalendar = () => {
    const DAY_HEADERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    return (
      <View style={[styles.monthCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Header row: prev / month label / next */}
        <View style={styles.monthHeader}>
          <TouchableOpacity
            onPress={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
              else setCalMonth(m => m - 1);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.textMuted} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: colors.text }]}>{monthLabel}</Text>
          <TouchableOpacity
            onPress={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
              else setCalMonth(m => m + 1);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Day headers */}
        <View style={styles.monthDayHeaders}>
          {DAY_HEADERS.map((d, i) => (
            <Text key={i} style={[styles.monthDayHeader, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>

        {/* Grid */}
        {monthGrid.map((row, ri) => (
          <View key={ri} style={styles.monthRow}>
            {row.map((cell, ci) => {
              if (!cell) return <View key={ci} style={styles.monthCell} />;
              const dayNum = parseInt(cell.split('-')[2], 10);
              const isToday2 = cell === today;
              const doneIds = logs[cell] ?? [];
              const doneHabitsForDay = habits.filter(h => doneIds.includes(h.id));
              const hasDots = doneHabitsForDay.length > 0;
              return (
                <TouchableOpacity
                  key={ci}
                  style={[styles.monthCell, isToday2 && { backgroundColor: withAlpha(ACCENT, '20') }]}
                  onPress={() => setDayDetail(cell)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.monthCellNum, {
                    color: isToday2 ? ACCENT : colors.text,
                    fontFamily: isToday2 ? Fonts.bold : Fonts.medium,
                  }]}>{dayNum}</Text>
                  {hasDots && (
                    <View style={styles.monthDots}>
                      {doneHabitsForDay.slice(0, 3).map(h => (
                        <View key={h.id} style={[styles.monthDot, { backgroundColor: h.color }]} />
                      ))}
                      {doneHabitsForDay.length > 3 && (
                        <View style={[styles.monthDot, { backgroundColor: colors.textMuted }]} />
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    );
  };

  // ── List Header (stats + controls) ────────────────────────────────────────
  const ListHeader = useMemo(() => {
    const todayCount = todayCompleted.length;
    const totalCount = habits.length;
    const todayPct = totalCount > 0 ? Math.round((todayCount / totalCount) * 100) : 0;

    return (
      <View>
        {/* ── Stats Dashboard ─── */}
        <View style={[styles.dashCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Top row: today % big + icon */}
          <View style={styles.dashTopRow}>
            <View style={styles.dashLeft}>
              <Text style={[styles.dashPct, { color: ACCENT }]}>{todayPct}%</Text>
              <Text style={[styles.dashSub, { color: colors.textMuted }]}>
                {todayCount}/{totalCount} today
              </Text>
              {allDoneToday && totalCount > 0 && (
                <View style={[styles.encourageBadge, { backgroundColor: withAlpha('#10B981', '20') }]}>
                  <Ionicons name="trophy" size={12} color="#10B981" />
                  <Text style={[styles.encourageText, { color: '#10B981' }]}>
                    {ENCOURAGEMENTS[Math.floor(Date.now() / 86400000) % ENCOURAGEMENTS.length]}
                  </Text>
                </View>
              )}
            </View>
            <View style={[styles.dashRingOuter, { borderColor: ACCENT_DIM }]}>
              <View style={[styles.dashRingInner, { backgroundColor: allDoneToday ? '#10B981' : ACCENT }]}>
                <Ionicons name={allDoneToday ? 'checkmark-done' : 'today-outline'} size={20} color="#fff" />
              </View>
            </View>
          </View>

          {/* Rate pills */}
          <View style={styles.dashRateRow}>
            {[
              { label: '7-day', value: `${stats.weekRate}%` },
              { label: '30-day', value: `${stats.monthRate}%` },
              { label: 'Habits', value: `${stats.total}` },
              { label: 'Top streak', value: `${stats.longestStreak}d` },
            ].map(item => (
              <View key={item.label} style={[styles.dashPill, { backgroundColor: withAlpha(ACCENT, '12') }]}>
                <Text style={[styles.dashPillVal, { color: ACCENT }]}>{item.value}</Text>
                <Text style={[styles.dashPillLbl, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          {/* Most consistent */}
          {stats.mostConsistentName !== '—' && (
            <View style={[styles.mostConsistentRow, { borderTopColor: colors.border }]}>
              <Ionicons name="star-outline" size={12} color="#F59E0B" />
              <Text style={[styles.mostConsistentText, { color: colors.textMuted }]}>
                Most consistent: <Text style={{ color: colors.text, fontFamily: Fonts.semibold }}>{stats.mostConsistentName}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* ── Add + View toggle ─── */}
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.addToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={openAddModal}
            activeOpacity={0.7}
          >
            <Ionicons name="add-circle-outline" size={18} color={ACCENT} />
            <Text style={[styles.addToggleText, { color: ACCENT }]}>Add Habit</Text>
          </TouchableOpacity>

          {/* Week / Month toggle */}
          <View style={[styles.viewToggle, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['week', 'month'] as CalendarView[]).map(v => (
              <TouchableOpacity
                key={v}
                onPress={() => setCalView(v)}
                style={[styles.viewToggleBtn, calView === v && { backgroundColor: ACCENT }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.viewToggleText, { color: calView === v ? '#fff' : colors.textMuted }]}>
                  {v.charAt(0).toUpperCase() + v.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Category filter ─── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={styles.filterContent}>
          {(['All', ...CATEGORIES] as FilterCategory[]).map(cat => {
            const isActive = filterCat === cat;
            const color = cat === 'All' ? ACCENT : CATEGORY_META[cat as HabitCategory].color;
            return (
              <TouchableOpacity
                key={cat}
                onPress={() => setFilterCat(cat)}
                style={[styles.filterPill, {
                  backgroundColor: isActive ? withAlpha(color, '22') : colors.card,
                  borderColor: isActive ? color : colors.border,
                }]}
                activeOpacity={0.7}
              >
                {cat !== 'All' && (
                  <Ionicons name={CATEGORY_META[cat as HabitCategory].icon} size={12} color={isActive ? color : colors.textMuted} />
                )}
                <Text style={[styles.filterPillText, { color: isActive ? color : colors.textMuted }]}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Month Calendar (when month view) ─── */}
        {calView === 'month' && renderMonthCalendar()}
      </View>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habits, logs, todayCompleted, allDoneToday, stats, calView, filterCat, monthGrid, monthLabel, colors, styles, today, tick]);

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <ScreenShell title="Habit Tracker" accentColor={ACCENT} scrollable={false}>
      {renderModal()}
      {renderDayDetail()}

      {filteredHabits.length === 0 && habits.length === 0 ? (
        <>
          {ListHeader}
          <EmptyState
            icon="trending-up-outline"
            title="No habits yet"
            hint="Track up to a dozen habits at once. Each one schedules a daily 9 AM reminder so the streak never breaks."
            accent={ACCENT}
            actionLabel="Add habit"
            onAction={openAddModal}
          />
        </>
      ) : (
        <FlatList
          data={filteredHabits}
          keyExtractor={item => item.id}
          renderItem={renderHabit}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <EmptyState
              icon="filter-outline"
              title="Nothing in this category"
              hint="Switch the category filter, or add a habit tagged with this one."
              accent={ACCENT}
              compact
            />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ScreenShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // ── Dashboard ──────────────────────────────────────────────────────────
    dashCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    dashTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    dashLeft: { flex: 1 },
    dashPct: {
      fontSize: 40,
      fontFamily: Fonts.bold,
      lineHeight: 48,
    },
    dashSub: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    encourageBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      marginTop: Spacing.sm,
      alignSelf: 'flex-start',
    },
    encourageText: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
    },
    dashRingOuter: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dashRingInner: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dashRateRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    dashPill: {
      flex: 1,
      borderRadius: Radii.md,
      paddingVertical: Spacing.sm,
      alignItems: 'center',
    },
    dashPillVal: {
      fontSize: 14,
      fontFamily: Fonts.bold,
    },
    dashPillLbl: {
      fontSize: 10,
      fontFamily: Fonts.medium,
      marginTop: 1,
    },
    mostConsistentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    mostConsistentText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },

    // ── Controls ───────────────────────────────────────────────────────────
    controlRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    addToggle: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
    },
    addToggleText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    viewToggle: {
      flexDirection: 'row',
      borderRadius: Radii.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    viewToggleBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
    },
    viewToggleText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },

    // ── Category filter ────────────────────────────────────────────────────
    filterScroll: {
      marginBottom: Spacing.md,
    },
    filterContent: {
      gap: Spacing.sm,
      paddingRight: Spacing.md,
    },
    filterPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: Radii.pill,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    filterPillText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    // ── Month Calendar ─────────────────────────────────────────────────────
    monthCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    monthHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    monthLabel: {
      fontSize: 15,
      fontFamily: Fonts.bold,
    },
    monthDayHeaders: {
      flexDirection: 'row',
      marginBottom: Spacing.xs,
    },
    monthDayHeader: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontFamily: Fonts.semibold,
    },
    monthRow: {
      flexDirection: 'row',
    },
    monthCell: {
      flex: 1,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radii.sm,
      padding: 2,
    },
    monthCellNum: {
      fontSize: 12,
    },
    monthDots: {
      flexDirection: 'row',
      gap: 2,
      marginTop: 2,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    monthDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
    },

    // ── Add/Edit Modal ─────────────────────────────────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      paddingHorizontal: Spacing.lg,
    },
    modalCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
    },
    modalTitle: {
      fontSize: 17,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.md,
    },
    addInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 15,
      fontFamily: Fonts.medium,
      marginBottom: Spacing.md,
    },
    addLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.xs,
      marginBottom: Spacing.md,
    },
    catOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderRadius: Radii.pill,
      borderWidth: 1,
      paddingHorizontal: Spacing.sm,
      paddingVertical: Spacing.xs,
    },
    catOptionText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    colorRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
      flexWrap: 'wrap',
    },
    colorDot: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorDotSelected: {
      borderWidth: 2.5,
      borderColor: '#fff',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 4,
    },
    addActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    addBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
    },
    addBtnCancel: {
      borderWidth: 1.5,
    },
    addBtnPrimary: {},
    addBtnText: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },

    // ── Habit Card ─────────────────────────────────────────────────────────
    habitCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 2,
    },
    habitTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },

    // Progress ring
    ringWrap: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringTrack: {
      position: 'absolute',
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 3,
    },
    ringFillWrap: {
      position: 'absolute',
      width: 40,
      height: 40,
    },
    ringHalfRight: {
      position: 'absolute',
      right: 0,
      width: 20,
      height: 40,
    },
    ringHalfLeft: {
      position: 'absolute',
      left: 0,
      width: 20,
      height: 40,
    },
    ringHalfCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      borderWidth: 3,
      borderColor: 'transparent',
    },
    ringCenter: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ringCenterDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      opacity: 0.5,
    },

    habitInfo: {
      flex: 1,
    },
    habitName: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    habitNameDone: {
      textDecorationLine: 'line-through',
      opacity: 0.55,
    },
    habitMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: 3,
      flexWrap: 'wrap',
    },
    catPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderRadius: Radii.pill,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    catPillText: {
      fontSize: 10,
      fontFamily: Fonts.semibold,
    },
    statBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    statText: {
      fontSize: 11,
      fontFamily: Fonts.medium,
    },

    weekCountWrap: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    weekCountNum: {
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    weekCountDen: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },

    // Weekly dots
    weekDotsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.sm,
      paddingTop: Spacing.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    weekDotCol: {
      alignItems: 'center',
      gap: Spacing.xs,
      flex: 1,
    },
    weekDotLabel: {
      fontSize: 10,
      fontFamily: Fonts.medium,
    },
    weekDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },

    // Day Detail
    dayDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dayDetailDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    dayDetailName: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.medium,
    },

    // Empty State
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.huge,
      gap: Spacing.sm,
    },
    emptyTitle: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },

    // List
    listContent: {
      paddingBottom: Spacing.xxl,
    },
  });
