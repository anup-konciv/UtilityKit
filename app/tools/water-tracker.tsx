import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Storage keys ───────────────────────────────────────────────────────────
const WATER_LOGS_KEY = KEYS.waterLogs;
const WATER_GOAL_KEY = KEYS.waterGoal;
const DEFAULT_GOAL = 2000;
const ACCENT = '#0EA5E9';
const ACCENT_LIGHT = '#E0F2FE';
const ACCENT_DIM = 'rgba(14,165,233,0.18)';

// ─── Types ───────────────────────────────────────────────────────────────────
type WaterEntry = { id: string; amount: number; time: string }; // time = "HH:MM"
type WaterLogs = Record<string, WaterEntry[]>; // key = "YYYY-MM-DD"

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function totalAmount(entries: WaterEntry[]): number {
  return entries.reduce((sum, e) => sum + e.amount, 0);
}

function currentTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function formatDate(key: string): string {
  // key = "YYYY-MM-DD"
  const [y, m, day] = key.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function shortDay(key: string): string {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { weekday: 'short' });
}

function last7Keys(): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    keys.push(`${y}-${mo}-${da}`);
  }
  return keys;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function WaterTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // State
  const [logs, setLogs] = useState<WaterLogs>({});
  const [goal, setGoal] = useState<number>(DEFAULT_GOAL);

  // Modal state
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // Load on mount
  useEffect(() => {
    loadJSON<WaterLogs>(WATER_LOGS_KEY, {}).then(setLogs);
    loadJSON<number>(WATER_GOAL_KEY, DEFAULT_GOAL).then(setGoal);
  }, []);

  // Derived
  const today = todayKey();
  const todayEntries: WaterEntry[] = useMemo(
    () => (logs[today] ?? []).slice().sort((a, b) => b.time.localeCompare(a.time)),
    [logs, today],
  );
  const total = useMemo(() => totalAmount(todayEntries), [todayEntries]);
  const progress = Math.min(total / Math.max(goal, 1), 1.0);
  const percent = Math.round(progress * 100);
  const goalReached = total >= goal;

  // Goal streak: consecutive past days where goal was met
  const goalStreak = useMemo(() => {
    if (goal <= 0) return 0;
    let streak = 0;
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 1); // start from yesterday
    while (true) {
      const y = cursor.getFullYear();
      const m = String(cursor.getMonth() + 1).padStart(2, '0');
      const d = String(cursor.getDate()).padStart(2, '0');
      const key = `${y}-${m}-${d}`;
      const entries = logs[key] ?? [];
      if (totalAmount(entries) < goal) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [logs, goal]);

  // Persist helpers
  const persistLogs = useCallback(
    (updated: WaterLogs) => {
      setLogs(updated);
      saveJSON(WATER_LOGS_KEY, updated);
    },
    [],
  );

  const addEntry = useCallback(
    (amount: number) => {
      if (!amount || amount <= 0) return;
      const entry: WaterEntry = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        amount,
        time: currentTime(),
      };
      const existing = logs[today] ?? [];
      persistLogs({ ...logs, [today]: [entry, ...existing] });
    },
    [logs, today, persistLogs],
  );

  const deleteEntry = useCallback(
    (id: string) => {
      const existing = logs[today] ?? [];
      persistLogs({ ...logs, [today]: existing.filter(e => e.id !== id) });
    },
    [logs, today, persistLogs],
  );

  // Quick-add handlers
  const handleQuickAdd = (ml: number) => addEntry(ml);

  const handleCustomAdd = () => {
    const val = parseInt(customInput.trim(), 10);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid amount', 'Please enter a valid amount in ml.');
      return;
    }
    addEntry(val);
    setCustomInput('');
    setCustomModalVisible(false);
  };

  const handleSaveGoal = () => {
    const val = parseInt(goalInput.trim(), 10);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid goal', 'Please enter a valid goal in ml.');
      return;
    }
    setGoal(val);
    saveJSON(WATER_GOAL_KEY, val);
    setGoalInput('');
    setGoalModalVisible(false);
  };

  // 7-day data
  const weekKeys = useMemo(() => last7Keys(), []);

  return (
    <ScreenShell title="Water Tracker" accentColor={ACCENT} scrollable>
      {/* ── Progress Card ─────────────────────────────────────── */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* ml display */}
        <Text style={styles.mlDisplay}>
          <Text style={[styles.mlCurrent, { color: ACCENT }]}>{total}</Text>
          <Text style={[styles.mlSep, { color: colors.textMuted }]}> / </Text>
          <Text style={[styles.mlGoal, { color: colors.textMuted }]}>{goal} ml</Text>
        </Text>

        {/* Subtitle */}
        <Text style={[styles.progressSubtitle, { color: goalReached ? ACCENT : colors.textMuted }]}>
          {goalReached ? 'Goal reached! 🎉' : `${percent}% of daily goal`}
        </Text>

        {/* Progress bar */}
        <View style={[styles.barTrack, { backgroundColor: ACCENT_DIM }]}>
          <View
            style={[
              styles.barFill,
              {
                width: `${Math.max(progress * 100, progress > 0 ? 4 : 0)}%`,
                backgroundColor: goalReached ? '#10B981' : ACCENT,
              },
            ]}
          />
        </View>

        {/* Date */}
        <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Today: {formatDate(today)}</Text>
      </View>

      {/* ── Streak Row ──────────────────────────────────────── */}
      <View style={[styles.streakRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.streakIcon}>🔥</Text>
        <Text style={[styles.streakText, { color: colors.text }]}>
          {goalStreak > 0 ? `${goalStreak}-day streak` : 'No streak yet'}
        </Text>
      </View>

      {/* ── Quick Add Buttons ─────────────────────────────────── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Add</Text>
        <View style={styles.quickRow}>
          {[200, 350, 500, 750].map(ml => (
            <TouchableOpacity
              key={ml}
              style={[styles.quickBtn, { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT }]}
              onPress={() => handleQuickAdd(ml)}
              activeOpacity={0.75}
            >
              <Ionicons name="water" size={16} color={ACCENT} />
              <Text style={[styles.quickBtnText, { color: ACCENT }]}>+{ml} ml</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.quickBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setCustomModalVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.quickBtnText, { color: colors.textMuted }]}>Custom</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Goal Row ──────────────────────────────────────────── */}
      <View
        style={[styles.goalRow, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <Ionicons name="flag-outline" size={18} color={ACCENT} />
        <Text style={[styles.goalText, { color: colors.text }]}>
          Daily Goal:{' '}
          <Text style={[styles.goalValue, { color: ACCENT }]}>{goal} ml</Text>
        </Text>
        <TouchableOpacity
          onPress={() => {
            setGoalInput(String(goal));
            setGoalModalVisible(true);
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={[styles.editBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="pencil" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Today's Log ───────────────────────────────────────── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Today's Log
          {todayEntries.length > 0 && (
            <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
              {' '}({todayEntries.length})
            </Text>
          )}
        </Text>

        {todayEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="water-outline" size={36} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No entries yet. Start tracking!
            </Text>
          </View>
        ) : (
          todayEntries.map(entry => (
            <View
              key={entry.id}
              style={[styles.logItem, { borderBottomColor: colors.border }]}
            >
              <View style={[styles.logIconWrap, { backgroundColor: ACCENT_LIGHT }]}>
                <Ionicons name="water" size={16} color={ACCENT} />
              </View>
              <Text style={[styles.logAmount, { color: colors.text }]}>{entry.amount} ml</Text>
              <Text style={[styles.logTime, { color: colors.textMuted }]}>{entry.time}</Text>
              <TouchableOpacity
                onPress={() => deleteEntry(entry.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* ── 7-Day History ─────────────────────────────────────── */}
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>7-Day History</Text>
        <View style={styles.weekRow}>
          {weekKeys.map(key => {
            const dayEntries = logs[key] ?? [];
            const dayTotal = totalAmount(dayEntries);
            const isToday = key === today;
            const filled = dayTotal >= goal && goal > 0;
            return (
              <View key={key} style={styles.dayTile}>
                <Text style={[styles.dayLabel, { color: isToday ? ACCENT : colors.textMuted }]}>
                  {shortDay(key)}
                </Text>
                <View
                  style={[
                    styles.dayDot,
                    {
                      backgroundColor: filled
                        ? ACCENT
                        : dayTotal > 0
                        ? ACCENT_DIM
                        : colors.surface,
                      borderColor: isToday ? ACCENT : colors.border,
                    },
                  ]}
                >
                  {filled && <Ionicons name="checkmark" size={10} color="#fff" />}
                </View>
                <Text style={[styles.dayAmount, { color: isToday ? ACCENT : colors.textMuted }]}>
                  {dayTotal >= 1000
                    ? `${(dayTotal / 1000).toFixed(1)}L`
                    : `${dayTotal}ml`}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* ── Custom Amount Modal ───────────────────────────────── */}
      <Modal
        visible={customModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Custom Amount</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Enter amount in ml</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={customInput}
              onChangeText={setCustomInput}
              placeholder="e.g. 250"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.border }]}
                onPress={() => {
                  setCustomInput('');
                  setCustomModalVisible(false);
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: ACCENT }]}
                onPress={handleCustomAdd}
              >
                <Ionicons name="water" size={16} color="#fff" />
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Goal Edit Modal ───────────────────────────────────── */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Daily Goal</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Set your daily water goal (ml)
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={goalInput}
              onChangeText={setGoalInput}
              placeholder="e.g. 2000"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel, { borderColor: colors.border }]}
                onPress={() => {
                  setGoalInput('');
                  setGoalModalVisible(false);
                }}
              >
                <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary, { backgroundColor: ACCENT }]}
                onPress={handleSaveGoal}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Progress Card
    progressCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.xl,
      marginBottom: Spacing.md,
      alignItems: 'center',
    },
    mlDisplay: {
      flexDirection: 'row',
      alignItems: 'baseline',
      marginBottom: Spacing.xs,
    },
    mlCurrent: {
      fontSize: 48,
      fontFamily: Fonts.bold,
      lineHeight: 56,
    },
    mlSep: {
      fontSize: 24,
      fontFamily: Fonts.regular,
    },
    mlGoal: {
      fontSize: 20,
      fontFamily: Fonts.medium,
    },
    progressSubtitle: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.lg,
    },
    barTrack: {
      width: '100%',
      height: 16,
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: Spacing.md,
    },
    barFill: {
      height: '100%',
      borderRadius: 8,
    },
    dateLabel: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      marginTop: Spacing.xs,
    },

    // Streak Row
    streakRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radii.lg,
      borderWidth: 1,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
    },
    streakIcon: {
      fontSize: 18,
    },
    streakText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },

    // Section Card
    sectionCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    sectionTitle: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.md,
    },
    sectionCount: {
      fontSize: 13,
      fontFamily: Fonts.regular,
    },

    // Quick Add
    quickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    quickBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.pill,
      borderWidth: 1.5,
    },
    quickBtnText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },

    // Goal Row
    goalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radii.lg,
      borderWidth: 1,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.md,
    },
    goalText: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.medium,
    },
    goalValue: {
      fontFamily: Fonts.bold,
    },
    editBtn: {
      width: 30,
      height: 30,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Log Items
    logItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    logIconWrap: {
      width: 30,
      height: 30,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    logAmount: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    logTime: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      marginRight: Spacing.sm,
    },

    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },

    // 7-Day History
    weekRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    dayTile: {
      alignItems: 'center',
      gap: Spacing.xs,
      flex: 1,
    },
    dayLabel: {
      fontSize: 11,
      fontFamily: Fonts.medium,
    },
    dayDot: {
      width: 28,
      height: 28,
      borderRadius: 14,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayAmount: {
      fontSize: 10,
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.xl,
    },
    modalBox: {
      width: '100%',
      maxWidth: 340,
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.xl,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.xs,
    },
    modalSubtitle: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      marginBottom: Spacing.lg,
    },
    modalInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 20,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.lg,
      textAlign: 'center',
    },
    modalActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    modalBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
    },
    modalBtnCancel: {
      borderWidth: 1.5,
    },
    modalBtnPrimary: {},
    modalBtnText: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
  });
