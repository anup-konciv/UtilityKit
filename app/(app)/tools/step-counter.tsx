import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const ACCENT = '#10B981';
const ACCENT_DIM = 'rgba(16,185,129,0.18)';
const ACCENT_DARK_BG = '#064E3B';
const ACCENT_LIGHT_BG = '#D1FAE5';
const STORAGE_KEY_LOG = 'uk_step_log';
const STORAGE_KEY_GOAL = 'uk_step_goal';
const DEFAULT_GOAL = 10000;
const RING_SIZE = 200;
const RING_THICKNESS = 16;
const CAL_PER_STEP = 0.04;
const KM_PER_STEP = 0.0008;

// ─── Types ──────────────────────────────────────────────────────────────────
type StepLog = Record<string, number>; // dateKey -> steps

// ─── Helpers ────────────────────────────────────────────────────────────────
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayKey() { return dateKey(new Date()); }

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

function formatDate(key: string): string {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function fmtNum(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtDist(km: number): string {
  return km >= 1 ? `${km.toFixed(1)} km` : `${Math.round(km * 1000)} m`;
}

// ─── Circular Progress Ring (View-based) ────────────────────────────────────
function ProgressRing({
  progress,
  steps,
  goal,
  goalReached,
  calories,
  distance,
  colors,
}: {
  progress: number;
  steps: number;
  goal: number;
  goalReached: boolean;
  calories: number;
  distance: number;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const pct = Math.min(progress, 1);
  const ringColor = goalReached ? '#F59E0B' : ACCENT;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View
        style={{
          position: 'absolute',
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          borderWidth: RING_THICKNESS,
          borderColor: ACCENT_DIM,
        }}
      />
      {/* Active ring: uses quadrant coloring for a smooth progress illusion */}
      <View
        style={{
          position: 'absolute',
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          borderWidth: RING_THICKNESS,
          borderTopColor: pct >= 0.25 ? ringColor : pct > 0 ? ringColor : ACCENT_DIM,
          borderRightColor: pct >= 0.5 ? ringColor : ACCENT_DIM,
          borderBottomColor: pct >= 0.75 ? ringColor : ACCENT_DIM,
          borderLeftColor: pct >= 1.0 ? ringColor : ACCENT_DIM,
          transform: [{ rotate: '-90deg' }],
        }}
      />
      {/* Center content */}
      <View style={{ alignItems: 'center' }}>
        <Ionicons
          name={goalReached ? 'trophy' : 'footsteps'}
          size={26}
          color={ringColor}
        />
        <Text style={{ fontSize: 34, fontFamily: Fonts.bold, color: ringColor, marginTop: 2 }}>
          {fmtNum(steps)}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: Fonts.medium, color: colors.textMuted }}>
          of {fmtNum(goal)} steps
        </Text>
        <View style={{ flexDirection: 'row', gap: Spacing.md, marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="flame-outline" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 11, fontFamily: Fonts.medium, color: colors.textMuted }}>
              {Math.round(calories)} cal
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Ionicons name="navigate-outline" size={12} color={colors.textMuted} />
            <Text style={{ fontSize: 11, fontFamily: Fonts.medium, color: colors.textMuted }}>
              {fmtDist(distance)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function StepCounterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = colors.bg === '#0B1120';

  const [log, setLog] = useState<StepLog>({});
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editInput, setEditInput] = useState('');
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  // Load persisted data
  useEffect(() => {
    loadJSON<StepLog>(STORAGE_KEY_LOG, {}).then(setLog);
    loadJSON<number>(STORAGE_KEY_GOAL, DEFAULT_GOAL).then(setGoal);
  }, []);

  const today = todayKey();
  const todaySteps = log[today] ?? 0;
  const progress = Math.min(todaySteps / Math.max(goal, 1), 1.0);
  const percent = Math.round(progress * 100);
  const goalReached = todaySteps >= goal;
  const calories = todaySteps * CAL_PER_STEP;
  const distance = todaySteps * KM_PER_STEP;

  // Persist helper
  const persistLog = useCallback((updated: StepLog) => {
    setLog(updated);
    saveJSON(STORAGE_KEY_LOG, updated);
  }, []);

  // Add steps
  const addSteps = useCallback(
    (amount: number) => {
      if (!amount || amount <= 0) return;
      const current = log[today] ?? 0;
      persistLog({ ...log, [today]: current + amount });
    },
    [log, today, persistLog],
  );

  // Set today's steps directly
  const setTodaySteps = useCallback(
    (amount: number) => {
      persistLog({ ...log, [today]: Math.max(0, amount) });
    },
    [log, today, persistLog],
  );

  // Streak calculation (consecutive days before today where goal was met)
  const streak = useMemo(() => {
    if (goal <= 0) return 0;
    let count = 0;
    // Include today if goal met
    if (todaySteps >= goal) count++;
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const key = dateKey(cursor);
      if ((log[key] ?? 0) < goal) break;
      count++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [log, goal, todaySteps]);

  // 7-day data
  const weekKeys = useMemo(() => last7Keys(), []);
  const weekData = useMemo(
    () => weekKeys.map((k) => ({ key: k, steps: log[k] ?? 0 })),
    [weekKeys, log],
  );

  const weekStats = useMemo(() => {
    const totals = weekData.map((d) => d.steps);
    const daysWithData = totals.filter((t) => t > 0);
    const avg =
      daysWithData.length > 0
        ? Math.round(daysWithData.reduce((s, t) => s + t, 0) / daysWithData.length)
        : 0;
    const daysGoalMet = totals.filter((t) => t >= goal).length;
    const weekTotal = totals.reduce((s, t) => s + t, 0);
    const bestDay = Math.max(...totals, 0);
    return { avg, daysGoalMet, weekTotal, bestDay };
  }, [weekData, goal]);

  const maxBar = useMemo(
    () => Math.max(goal, ...weekData.map((d) => d.steps), 1),
    [weekData, goal],
  );

  // History: last 30 days with entries
  const history = useMemo(() => {
    const entries: { key: string; steps: number; metGoal: boolean }[] = [];
    const cursor = new Date();
    for (let i = 0; i < 30; i++) {
      const key = dateKey(cursor);
      const steps = log[key] ?? 0;
      if (steps > 0) {
        entries.push({ key, steps, metGoal: steps >= goal });
      }
      cursor.setDate(cursor.getDate() - 1);
    }
    return entries;
  }, [log, goal]);

  // Handlers
  const handleEditSave = () => {
    const val = parseInt(editInput.trim(), 10);
    if (isNaN(val) || val < 0) {
      Alert.alert('Invalid', 'Enter a valid step count.');
      return;
    }
    setTodaySteps(val);
    setEditInput('');
    setEditModalVisible(false);
  };

  const handleGoalSave = () => {
    const val = parseInt(goalInput.trim(), 10);
    if (isNaN(val) || val <= 0) {
      Alert.alert('Invalid', 'Enter a valid daily goal.');
      return;
    }
    setGoal(val);
    saveJSON(STORAGE_KEY_GOAL, val);
    setGoalInput('');
    setGoalModalVisible(false);
  };

  return (
    <ScreenShell title="Step Counter" accentColor={ACCENT} scrollable>
      {/* ── Progress Ring Card ──────────────────────────────── */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ProgressRing
          progress={progress}
          steps={todaySteps}
          goal={goal}
          goalReached={goalReached}
          calories={calories}
          distance={distance}
          colors={colors}
        />

        <Text
          style={[
            styles.progressSubtitle,
            { color: goalReached ? '#F59E0B' : colors.textMuted },
          ]}
        >
          {goalReached
            ? 'Goal reached! Great job!'
            : `${percent}% -- ${fmtNum(Math.max(0, goal - todaySteps))} steps to go`}
        </Text>

        {/* Chips */}
        <View style={styles.statsChips}>
          <View style={[styles.chip, { backgroundColor: isDark ? ACCENT_DARK_BG : ACCENT_LIGHT_BG }]}>
            <Ionicons name="flame" size={14} color={ACCENT} />
            <Text style={[styles.chipText, { color: ACCENT }]}>
              {streak > 0 ? `${streak}-day streak` : 'No streak'}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: isDark ? ACCENT_DARK_BG : ACCENT_LIGHT_BG }]}>
            <Ionicons name="footsteps" size={14} color={ACCENT} />
            <Text style={[styles.chipText, { color: ACCENT }]}>
              {fmtDist(distance)}
            </Text>
          </View>
        </View>

        {/* Goal badge + Edit today */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TouchableOpacity
            style={[styles.goalBadge, { borderColor: colors.border }]}
            onPress={() => {
              setGoalInput(String(goal));
              setGoalModalVisible(true);
            }}
          >
            <Ionicons name="flag" size={12} color={ACCENT} />
            <Text style={[styles.goalBadgeText, { color: colors.textMuted }]}>
              Goal: {fmtNum(goal)}
            </Text>
            <Ionicons name="pencil" size={10} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.goalBadge, { borderColor: colors.border }]}
            onPress={() => {
              setEditInput(String(todaySteps));
              setEditModalVisible(true);
            }}
          >
            <Ionicons name="create-outline" size={12} color={ACCENT} />
            <Text style={[styles.goalBadgeText, { color: colors.textMuted }]}>Edit</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Quick Add ──────────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Quick Add Steps</Text>
        <View style={styles.quickRow}>
          {[1000, 2000, 5000].map((amt) => (
            <TouchableOpacity
              key={amt}
              style={[
                styles.quickBtn,
                { backgroundColor: isDark ? ACCENT_DARK_BG : ACCENT_LIGHT_BG, borderColor: ACCENT + '30' },
              ]}
              onPress={() => addSteps(amt)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color={ACCENT} />
              <Text style={[styles.quickBtnText, { color: ACCENT }]}>
                {fmtNum(amt)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom add input inline */}
        <View style={styles.customAddRow}>
          <TextInput
            style={[
              styles.customInput,
              { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
            ]}
            placeholder="Custom steps..."
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            value={editInput === '' ? '' : undefined}
            onChangeText={(t) => setEditInput(t)}
            returnKeyType="done"
            onSubmitEditing={() => {
              const val = parseInt(editInput.trim(), 10);
              if (!isNaN(val) && val > 0) {
                addSteps(val);
                setEditInput('');
              }
            }}
          />
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: ACCENT }]}
            onPress={() => {
              const val = parseInt(editInput.trim(), 10);
              if (!isNaN(val) && val > 0) {
                addSteps(val);
                setEditInput('');
              }
            }}
          >
            <Ionicons name="add-circle" size={20} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Estimates Card ─────────────────────────────────── */}
      <View style={styles.estimatesRow}>
        <View style={[styles.estimateTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="flame" size={20} color="#EF4444" />
          <Text style={[styles.estimateVal, { color: colors.text }]}>{Math.round(calories)}</Text>
          <Text style={[styles.estimateLabel, { color: colors.textMuted }]}>Calories</Text>
        </View>
        <View style={[styles.estimateTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="navigate" size={20} color="#3B82F6" />
          <Text style={[styles.estimateVal, { color: colors.text }]}>{fmtDist(distance)}</Text>
          <Text style={[styles.estimateLabel, { color: colors.textMuted }]}>Distance</Text>
        </View>
        <View style={[styles.estimateTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="time" size={20} color="#8B5CF6" />
          <Text style={[styles.estimateVal, { color: colors.text }]}>
            {Math.round(todaySteps * 0.01)} min
          </Text>
          <Text style={[styles.estimateLabel, { color: colors.textMuted }]}>Walk Time</Text>
        </View>
      </View>

      {/* ── 7-Day Bar Chart ────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.chartArea}>
          {/* Goal line */}
          <View
            style={[
              styles.goalLine,
              { bottom: `${(goal / maxBar) * 100}%`, borderColor: ACCENT + '50' },
            ]}
          >
            <Text style={[styles.goalLineLabel, { color: ACCENT }]}>{fmtNum(goal)}</Text>
          </View>
          <View style={styles.barRow}>
            {weekData.map((d) => {
              const barH =
                maxBar > 0 ? Math.max(d.steps > 0 ? 6 : 0, (d.steps / maxBar) * 100) : 0;
              const isToday = d.key === today;
              const metGoal = d.steps >= goal;
              return (
                <View key={d.key} style={styles.barCol}>
                  <Text
                    style={[styles.barAmt, { color: isToday ? ACCENT : colors.textMuted }]}
                    numberOfLines={1}
                  >
                    {d.steps > 0 ? fmtNum(d.steps) : ''}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.border + '40' }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${barH}%`,
                          backgroundColor: metGoal
                            ? '#F59E0B'
                            : isToday
                              ? ACCENT
                              : ACCENT + '70',
                          borderRadius: 4,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.barDay,
                      {
                        color: isToday ? ACCENT : colors.textMuted,
                        fontFamily: isToday ? Fonts.bold : Fonts.medium,
                      },
                    ]}
                  >
                    {shortDay(d.key)}
                  </Text>
                  {metGoal && <Ionicons name="checkmark-circle" size={12} color="#F59E0B" />}
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Weekly Stats ───────────────────────────────────── */}
      <View style={styles.statsRow}>
        {[
          {
            label: 'Avg/Day',
            val: fmtNum(weekStats.avg),
            icon: 'analytics-outline' as const,
            color: ACCENT,
          },
          {
            label: 'Best Day',
            val: fmtNum(weekStats.bestDay),
            icon: 'trophy-outline' as const,
            color: '#F59E0B',
          },
          {
            label: 'Week Total',
            val: fmtNum(weekStats.weekTotal),
            icon: 'footsteps-outline' as const,
            color: '#3B82F6',
          },
          {
            label: 'Goal Met',
            val: `${weekStats.daysGoalMet}/7`,
            icon: 'checkmark-circle-outline' as const,
            color: '#10B981',
          },
        ].map((s) => (
          <View
            key={s.label}
            style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}
          >
            <Ionicons name={s.icon} size={16} color={s.color} />
            <Text style={[styles.statVal, { color: colors.text }]}>{s.val}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Streak & Motivation ────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Motivation</Text>
        <View style={styles.motivationRow}>
          <View style={[styles.motivationIcon, { backgroundColor: isDark ? ACCENT_DARK_BG : ACCENT_LIGHT_BG }]}>
            <Ionicons name="flame" size={28} color={streak > 0 ? '#F59E0B' : colors.textMuted} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.motivationTitle, { color: colors.text }]}>
              {streak === 0
                ? 'Start your streak!'
                : streak === 1
                  ? '1 day streak!'
                  : `${streak}-day streak!`}
            </Text>
            <Text style={[styles.motivationSub, { color: colors.textMuted }]}>
              {streak === 0
                ? 'Hit your daily goal to begin a streak.'
                : streak < 7
                  ? `Keep it up! ${7 - streak} more days to a full week.`
                  : 'Incredible consistency! You are on fire!'}
            </Text>
          </View>
        </View>

        {/* Weekly calories & distance */}
        <View style={{ flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md }}>
          <View
            style={[
              styles.miniStat,
              { backgroundColor: isDark ? '#3B0D0D' : '#FEE2E2', borderColor: '#EF4444' + '30' },
            ]}
          >
            <Text style={[styles.miniStatVal, { color: '#EF4444' }]}>
              {fmtNum(Math.round(weekStats.weekTotal * CAL_PER_STEP))}
            </Text>
            <Text style={[styles.miniStatLabel, { color: '#EF4444' }]}>Weekly Cal</Text>
          </View>
          <View
            style={[
              styles.miniStat,
              { backgroundColor: isDark ? '#0C2D48' : '#DBEAFE', borderColor: '#3B82F6' + '30' },
            ]}
          >
            <Text style={[styles.miniStatVal, { color: '#3B82F6' }]}>
              {fmtDist(weekStats.weekTotal * KM_PER_STEP)}
            </Text>
            <Text style={[styles.miniStatLabel, { color: '#3B82F6' }]}>Weekly Dist</Text>
          </View>
        </View>
      </View>

      {/* ── History ────────────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>
          History
          {history.length > 0 && (
            <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: 13 }}>
              {' '}({history.length})
            </Text>
          )}
        </Text>
        {history.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="footsteps-outline" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No steps logged yet.{'\n'}Add your first steps above!
            </Text>
          </View>
        ) : (
          history.map((entry, i) => (
            <View
              key={entry.key}
              style={[
                styles.historyItem,
                i < history.length - 1 && {
                  borderBottomColor: colors.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
            >
              <View
                style={[
                  styles.historyIcon,
                  {
                    backgroundColor: entry.metGoal
                      ? isDark
                        ? '#422006'
                        : '#FEF3C7'
                      : isDark
                        ? ACCENT_DARK_BG
                        : ACCENT_LIGHT_BG,
                  },
                ]}
              >
                <Ionicons
                  name={entry.metGoal ? 'trophy' : 'footsteps'}
                  size={16}
                  color={entry.metGoal ? '#F59E0B' : ACCENT}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.historySteps, { color: colors.text }]}>
                  {fmtNum(entry.steps)} steps
                </Text>
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>
                  {formatDate(entry.key)} {entry.key === today ? '(Today)' : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: Fonts.medium,
                    color: entry.metGoal ? '#F59E0B' : colors.textMuted,
                  }}
                >
                  {entry.metGoal ? 'Goal met' : `${Math.round((entry.steps / goal) * 100)}%`}
                </Text>
                <Text style={{ fontSize: 10, fontFamily: Fonts.regular, color: colors.textMuted }}>
                  {Math.round(entry.steps * CAL_PER_STEP)} cal | {fmtDist(entry.steps * KM_PER_STEP)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* ── Edit Today's Steps Modal ───────────────────────── */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Today's Steps</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              Set the total step count for today
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={editInput}
              onChangeText={setEditInput}
              placeholder="e.g. 8500"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1.5 }]}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: ACCENT }]}
                onPress={handleEditSave}
              >
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Goal Modal ─────────────────────────────────────── */}
      <Modal
        visible={goalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Daily Step Goal</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>
              How many steps do you want to aim for?
            </Text>
            {/* Preset goals */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md }}>
              {[5000, 7500, 10000, 12000, 15000, 20000].map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.goalPreset,
                    {
                      borderColor: goalInput === String(g) ? ACCENT : colors.border,
                      backgroundColor: goalInput === String(g) ? ACCENT + '18' : colors.inputBg,
                    },
                  ]}
                  onPress={() => setGoalInput(String(g))}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontFamily: Fonts.semibold,
                      color: goalInput === String(g) ? ACCENT : colors.text,
                    }}
                  >
                    {fmtNum(g)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={goalInput}
              onChangeText={setGoalInput}
              placeholder="Or type custom"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1.5 }]}
                onPress={() => setGoalModalVisible(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: ACCENT }]}
                onPress={handleGoalSave}
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

// ─── Styles ─────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Progress Card
    progressCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.xl,
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    progressSubtitle: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    statsChips: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radii.pill,
    },
    chipText: { fontSize: 12, fontFamily: Fonts.semibold },
    goalBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    goalBadgeText: { fontSize: 12, fontFamily: Fonts.medium },

    // Sections
    section: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },

    // Quick Add
    quickRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    quickBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingVertical: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
    },
    quickBtnText: { fontSize: 15, fontFamily: Fonts.bold },

    // Custom add inline
    customAddRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    customInput: {
      flex: 1,
      borderWidth: 1.5,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 16,
      fontFamily: Fonts.semibold,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 4,
      paddingHorizontal: Spacing.lg,
      borderRadius: Radii.md,
    },
    addBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },

    // Estimates
    estimatesRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    estimateTile: {
      flex: 1,
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radii.xl,
      borderWidth: 1,
      gap: 4,
    },
    estimateVal: { fontSize: 16, fontFamily: Fonts.bold },
    estimateLabel: { fontSize: 10, fontFamily: Fonts.medium },

    // Bar Chart
    chartArea: { height: 150, position: 'relative', marginBottom: Spacing.sm },
    goalLine: {
      position: 'absolute',
      left: 0,
      right: 0,
      borderTopWidth: 1.5,
      borderStyle: 'dashed',
      zIndex: 1,
    },
    goalLineLabel: {
      fontSize: 9,
      fontFamily: Fonts.medium,
      position: 'absolute',
      right: 0,
      top: -14,
    },
    barRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: '100%',
      gap: 4,
      paddingTop: 16,
    },
    barCol: { flex: 1, alignItems: 'center', gap: 3 },
    barAmt: { fontSize: 9, fontFamily: Fonts.medium, height: 12 },
    barTrack: {
      width: '80%',
      height: 90,
      borderRadius: 4,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    barFill: { width: '100%' },
    barDay: { fontSize: 10 },

    // Weekly Stats
    statsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    statTile: {
      flex: 1,
      minWidth: '46%',
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      gap: 3,
    },
    statVal: { fontSize: 16, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium },

    // Motivation
    motivationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    motivationIcon: {
      width: 52,
      height: 52,
      borderRadius: Radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    motivationTitle: {
      fontSize: 16,
      fontFamily: Fonts.bold,
      marginBottom: 2,
    },
    motivationSub: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      lineHeight: 18,
    },
    miniStat: {
      flex: 1,
      alignItems: 'center',
      padding: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
      gap: 2,
    },
    miniStatVal: { fontSize: 14, fontFamily: Fonts.bold },
    miniStatLabel: { fontSize: 10, fontFamily: Fonts.medium },

    // History
    historyItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    historyIcon: {
      width: 32,
      height: 32,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    historySteps: { fontSize: 14, fontFamily: Fonts.semibold },
    historyDate: { fontSize: 11, fontFamily: Fonts.regular },

    // Empty
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      gap: Spacing.sm,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      lineHeight: 20,
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
      padding: Spacing.xl,
    },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: 2 },
    modalSub: { fontSize: 13, fontFamily: Fonts.regular, marginBottom: Spacing.lg },
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
    goalPreset: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1.5,
    },
    modalBtns: { flexDirection: 'row', gap: Spacing.sm },
    modalBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
    },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.semibold },
  });
