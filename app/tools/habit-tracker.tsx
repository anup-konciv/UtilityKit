import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { loadJSON, saveJSON } from '@/lib/storage';

// ─── Constants ──────────────────────────────────────────────────────────────
const HABITS_KEY = 'uk_habits';
const LOGS_KEY = 'uk_habit_logs';
const ACCENT = '#8B5CF6';
const ACCENT_DIM = 'rgba(139,92,246,0.15)';

const COLOR_PALETTE = [
  '#EF4444', '#F97316', '#F59E0B', '#10B981',
  '#3B82F6', '#6366F1', '#8B5CF6', '#EC4899',
];

// ─── Types ──────────────────────────────────────────────────────────────────
type Habit = { id: string; name: string; color: string; createdAt: string };
type HabitLogs = Record<string, string[]>; // key = "YYYY-MM-DD", value = array of habit IDs completed

// ─── Helpers ────────────────────────────────────────────────────────────────
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function shortDay(key: string): string {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { weekday: 'short' });
}

function getStreak(habitId: string, logs: HabitLogs): number {
  let streak = 0;
  const cursor = new Date();
  // Check today first
  const todayCompleted = (logs[todayKey()] ?? []).includes(habitId);
  if (todayCompleted) {
    streak = 1;
    cursor.setDate(cursor.getDate() - 1);
  } else {
    // Start from yesterday if today not completed
    cursor.setDate(cursor.getDate() - 1);
  }
  while (true) {
    const key = dateKey(cursor);
    const dayLogs = logs[key] ?? [];
    if (!dayLogs.includes(habitId)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getWeeklyRate(habitId: string, logs: HabitLogs): number {
  const keys = last7Keys();
  let completed = 0;
  for (const key of keys) {
    if ((logs[key] ?? []).includes(habitId)) completed++;
  }
  return Math.round((completed / 7) * 100);
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function HabitTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // State
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<HabitLogs>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[0]);

  // Load on mount
  useEffect(() => {
    loadJSON<Habit[]>(HABITS_KEY, []).then(setHabits);
    loadJSON<HabitLogs>(LOGS_KEY, {}).then(setLogs);
  }, []);

  // Persist helpers
  const persistHabits = useCallback((updated: Habit[]) => {
    setHabits(updated);
    saveJSON(HABITS_KEY, updated);
  }, []);

  const persistLogs = useCallback((updated: HabitLogs) => {
    setLogs(updated);
    saveJSON(LOGS_KEY, updated);
  }, []);

  // Derived
  const today = todayKey();
  const todayCompleted = useMemo(() => logs[today] ?? [], [logs, today]);
  const weekKeys = useMemo(() => last7Keys(), []);

  // Actions
  const addHabit = useCallback(() => {
    const trimmed = newName.trim();
    if (!trimmed) {
      Alert.alert('Invalid name', 'Please enter a habit name.');
      return;
    }
    const habit: Habit = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmed,
      color: selectedColor,
      createdAt: new Date().toISOString(),
    };
    persistHabits([...habits, habit]);
    setNewName('');
    setSelectedColor(COLOR_PALETTE[0]);
    setShowAdd(false);
  }, [newName, selectedColor, habits, persistHabits]);

  const deleteHabit = useCallback((id: string) => {
    Alert.alert('Delete Habit', 'Are you sure you want to delete this habit and all its data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          persistHabits(habits.filter(h => h.id !== id));
          // Clean up logs
          const cleaned: HabitLogs = {};
          for (const [key, ids] of Object.entries(logs)) {
            const filtered = ids.filter(hid => hid !== id);
            if (filtered.length > 0) cleaned[key] = filtered;
          }
          persistLogs(cleaned);
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
    persistLogs({ ...logs, [today]: updated });
  }, [logs, today, persistLogs]);

  // Overall stats
  const totalCompleted = todayCompleted.length;
  const totalHabits = habits.length;
  const todayPercent = totalHabits > 0 ? Math.round((totalCompleted / totalHabits) * 100) : 0;

  const renderHabit = useCallback(({ item }: { item: Habit }) => {
    const isCompleted = todayCompleted.includes(item.id);
    const streak = getStreak(item.id, logs);
    const weeklyRate = getWeeklyRate(item.id, logs);

    return (
      <View style={[styles.habitCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Top row: checkbox, name, delete */}
        <View style={styles.habitTopRow}>
          <TouchableOpacity
            onPress={() => toggleHabit(item.id)}
            style={[
              styles.checkbox,
              {
                backgroundColor: isCompleted ? item.color : 'transparent',
                borderColor: isCompleted ? item.color : colors.borderStrong,
              },
            ]}
            activeOpacity={0.7}
          >
            {isCompleted && <Ionicons name="checkmark" size={16} color="#fff" />}
          </TouchableOpacity>

          <View style={styles.habitInfo}>
            <Text
              style={[
                styles.habitName,
                { color: colors.text },
                isCompleted && styles.habitNameDone,
              ]}
              numberOfLines={1}
            >
              {item.name}
            </Text>
            <View style={styles.habitStats}>
              {streak > 0 && (
                <View style={styles.statBadge}>
                  <Ionicons name="flame" size={12} color="#F97316" />
                  <Text style={[styles.statText, { color: colors.textMuted }]}>
                    {streak}d streak
                  </Text>
                </View>
              )}
              <View style={styles.statBadge}>
                <Ionicons name="trending-up" size={12} color={item.color} />
                <Text style={[styles.statText, { color: colors.textMuted }]}>
                  {weeklyRate}% this week
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={() => deleteHabit(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Weekly dots */}
        <View style={styles.weekDotsRow}>
          {weekKeys.map(key => {
            const done = (logs[key] ?? []).includes(item.id);
            const isToday = key === today;
            return (
              <View key={key} style={styles.weekDotCol}>
                <Text style={[styles.weekDotLabel, { color: isToday ? item.color : colors.textMuted }]}>
                  {shortDay(key).charAt(0)}
                </Text>
                <View
                  style={[
                    styles.weekDot,
                    {
                      backgroundColor: done ? item.color : 'transparent',
                      borderColor: isToday ? item.color : colors.border,
                    },
                  ]}
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  }, [todayCompleted, logs, weekKeys, today, colors, styles, toggleHabit, deleteHabit]);

  return (
    <ScreenShell title="Habit Tracker" accentColor={ACCENT} scrollable={false}>
      {/* ── Summary Card ─────────────────────────────────────── */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryLeft}>
          <Text style={[styles.summaryPercent, { color: ACCENT }]}>{todayPercent}%</Text>
          <Text style={[styles.summarySub, { color: colors.textMuted }]}>
            {totalCompleted}/{totalHabits} done today
          </Text>
        </View>
        <View style={[styles.summaryRing, { borderColor: ACCENT_DIM }]}>
          <View
            style={[
              styles.summaryRingInner,
              { backgroundColor: todayPercent === 100 ? '#10B981' : ACCENT },
            ]}
          >
            {todayPercent === 100 ? (
              <Ionicons name="checkmark-done" size={20} color="#fff" />
            ) : (
              <Ionicons name="today-outline" size={20} color="#fff" />
            )}
          </View>
        </View>
      </View>

      {/* ── Add Habit Toggle ─────────────────────────────────── */}
      {showAdd ? (
        <View style={[styles.addCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.addTitle, { color: colors.text }]}>New Habit</Text>
          <TextInput
            style={[styles.addInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={newName}
            onChangeText={setNewName}
            placeholder="e.g. Read 30 min"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <Text style={[styles.addLabel, { color: colors.textSub }]}>Color</Text>
          <View style={styles.colorRow}>
            {COLOR_PALETTE.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setSelectedColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorDotSelected,
                ]}
                activeOpacity={0.7}
              >
                {selectedColor === c && <Ionicons name="checkmark" size={14} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.addActions}>
            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnCancel, { borderColor: colors.border }]}
              onPress={() => { setShowAdd(false); setNewName(''); }}
            >
              <Text style={[styles.addBtnText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addBtn, styles.addBtnPrimary, { backgroundColor: ACCENT }]}
              onPress={addHabit}
            >
              <Ionicons name="add" size={16} color="#fff" />
              <Text style={[styles.addBtnText, { color: '#fff' }]}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.addToggle, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setShowAdd(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color={ACCENT} />
          <Text style={[styles.addToggleText, { color: ACCENT }]}>Add Habit</Text>
        </TouchableOpacity>
      )}

      {/* ── Habit List ───────────────────────────────────────── */}
      {habits.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyTitle, { color: colors.textMuted }]}>No habits yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Add your first habit to start tracking
          </Text>
        </View>
      ) : (
        <FlatList
          data={habits}
          keyExtractor={item => item.id}
          renderItem={renderHabit}
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
    // Summary Card
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.xl,
      marginBottom: Spacing.md,
    },
    summaryLeft: {
      flex: 1,
    },
    summaryPercent: {
      fontSize: 40,
      fontFamily: Fonts.bold,
      lineHeight: 48,
    },
    summarySub: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      marginTop: Spacing.xs,
    },
    summaryRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryRingInner: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Add Toggle
    addToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.md,
    },
    addToggleText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },

    // Add Card
    addCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    addTitle: {
      fontSize: 16,
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
      fontSize: 13,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.sm,
    },
    colorRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
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

    // Habit Card
    habitCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.sm,
    },
    habitTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    checkbox: {
      width: 28,
      height: 28,
      borderRadius: Radii.sm,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
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
      opacity: 0.6,
    },
    habitStats: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: 3,
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

    // Weekly Dots
    weekDotsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.border,
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
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1.5,
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
