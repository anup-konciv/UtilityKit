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
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Constants ──────────────────────────────────────────────────────────────
const WATER_LOGS_KEY = KEYS.waterLogs;
const WATER_GOAL_KEY = KEYS.waterGoal;
const DEFAULT_GOAL = 2000;
const ACCENT = '#0EA5E9';
const ACCENT_DIM = 'rgba(14,165,233,0.18)';
const RING_SIZE = 180;
const RING_THICKNESS = 14;

// ─── Types ──────────────────────────────────────────────────────────────────
type WaterEntry = { id: string; amount: number; time: string };
type WaterLogs = Record<string, WaterEntry[]>;

// ─── Quick-add presets ──────────────────────────────────────────────────────
const QUICK_PRESETS = [
  { label: 'Glass', ml: 250, icon: 'water' as const },
  { label: 'Cup', ml: 200, icon: 'cafe-outline' as const },
  { label: 'Bottle', ml: 500, icon: 'water-outline' as const },
  { label: 'Large', ml: 750, icon: 'beaker-outline' as const },
  { label: 'Sip', ml: 100, icon: 'water' as const },
  { label: '1 Litre', ml: 1000, icon: 'water' as const },
];

// ─── Helpers ────────────────────────────────────────────────────────────────
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function todayKey() { return dateKey(new Date()); }
function currentTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function totalAmount(entries: WaterEntry[]) { return entries.reduce((s, e) => s + e.amount, 0); }
function shortDay(key: string) {
  const [y, m, day] = key.split('-').map(Number);
  return new Date(y, m - 1, day).toLocaleDateString('en-GB', { weekday: 'short' });
}
function last7Keys() {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}
function fmtMl(ml: number) { return ml >= 1000 ? `${(ml / 1000).toFixed(1)}L` : `${ml}ml`; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ─── Circular Progress Ring ─────────────────────────────────────────────────
function ProgressRing({ progress, total, goal, goalReached, colors }: {
  progress: number; total: number; goal: number; goalReached: boolean;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const pct = Math.min(progress, 1);
  const circumference = Math.PI * (RING_SIZE - RING_THICKNESS);
  const segments = 40;
  const activeSegments = Math.round(pct * segments);
  const ringColor = goalReached ? '#10B981' : ACCENT;

  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Background ring */}
      <View style={{
        position: 'absolute', width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
        borderWidth: RING_THICKNESS, borderColor: ACCENT_DIM,
      }} />
      {/* Active ring segments (simulated with a thick border + dash pattern) */}
      <View style={{
        position: 'absolute', width: RING_SIZE, height: RING_SIZE, borderRadius: RING_SIZE / 2,
        borderWidth: RING_THICKNESS, borderColor: ringColor,
        borderTopColor: pct >= 0.25 ? ringColor : ACCENT_DIM,
        borderRightColor: pct >= 0.5 ? ringColor : ACCENT_DIM,
        borderBottomColor: pct >= 0.75 ? ringColor : ACCENT_DIM,
        borderLeftColor: pct >= 1.0 ? ringColor : ACCENT_DIM,
        transform: [{ rotate: '-90deg' }],
      }} />
      {/* Center content */}
      <View style={{ alignItems: 'center' }}>
        <Ionicons name={goalReached ? 'checkmark-circle' : 'water'} size={24} color={ringColor} />
        <Text style={{ fontSize: 32, fontFamily: Fonts.bold, color: ringColor, marginTop: 2 }}>
          {total >= 1000 ? `${(total / 1000).toFixed(1)}` : total}
        </Text>
        <Text style={{ fontSize: 12, fontFamily: Fonts.medium, color: colors.textMuted }}>
          {total >= 1000 ? 'litres' : 'ml'} / {fmtMl(goal)}
        </Text>
      </View>
    </View>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function WaterTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = colors.bg === '#0B1120';

  const [logs, setLogs] = useState<WaterLogs>({});
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [goalInput, setGoalInput] = useState('');

  useEffect(() => {
    loadJSON<WaterLogs>(WATER_LOGS_KEY, {}).then(setLogs);
    loadJSON<number>(WATER_GOAL_KEY, DEFAULT_GOAL).then(setGoal);
  }, []);

  const today = todayKey();
  const todayEntries = useMemo(
    () => (logs[today] ?? []).slice().sort((a, b) => b.time.localeCompare(a.time)),
    [logs, today],
  );
  const total = useMemo(() => totalAmount(todayEntries), [todayEntries]);
  const progress = Math.min(total / Math.max(goal, 1), 1.0);
  const percent = Math.round(progress * 100);
  const goalReached = total >= goal;

  // Streak
  const goalStreak = useMemo(() => {
    if (goal <= 0) return 0;
    let streak = 0;
    const cursor = new Date();
    cursor.setDate(cursor.getDate() - 1);
    for (let i = 0; i < 365; i++) {
      const key = dateKey(cursor);
      if (totalAmount(logs[key] ?? []) < goal) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }, [logs, goal]);

  // 7-day data
  const weekKeys = useMemo(() => last7Keys(), []);
  const weekData = useMemo(() => weekKeys.map(k => ({
    key: k, total: totalAmount(logs[k] ?? []),
  })), [weekKeys, logs]);

  const weekStats = useMemo(() => {
    const totals = weekData.map(d => d.total);
    const daysWithData = totals.filter(t => t > 0);
    const avg = daysWithData.length > 0 ? Math.round(daysWithData.reduce((s, t) => s + t, 0) / daysWithData.length) : 0;
    const daysGoalMet = totals.filter(t => t >= goal).length;
    const weekTotal = totals.reduce((s, t) => s + t, 0);
    const bestDay = Math.max(...totals);
    return { avg, daysGoalMet, weekTotal, bestDay };
  }, [weekData, goal]);

  const maxBar = useMemo(() => Math.max(goal, ...weekData.map(d => d.total), 1), [weekData, goal]);

  // Persist
  const persistLogs = useCallback((updated: WaterLogs) => {
    setLogs(updated);
    saveJSON(WATER_LOGS_KEY, updated);
  }, []);

  const addEntry = useCallback((amount: number) => {
    if (!amount || amount <= 0) return;
    const entry: WaterEntry = { id: uid(), amount, time: currentTime() };
    const existing = logs[today] ?? [];
    persistLogs({ ...logs, [today]: [entry, ...existing] });
  }, [logs, today, persistLogs]);

  const deleteEntry = useCallback((id: string) => {
    const existing = logs[today] ?? [];
    persistLogs({ ...logs, [today]: existing.filter(e => e.id !== id) });
  }, [logs, today, persistLogs]);

  const handleCustomAdd = () => {
    const val = parseInt(customInput.trim(), 10);
    if (isNaN(val) || val <= 0) { Alert.alert('Invalid amount', 'Enter a valid amount in ml.'); return; }
    addEntry(val);
    setCustomInput('');
    setCustomModalVisible(false);
  };

  const handleSaveGoal = () => {
    const val = parseInt(goalInput.trim(), 10);
    if (isNaN(val) || val <= 0) { Alert.alert('Invalid goal', 'Enter a valid goal in ml.'); return; }
    setGoal(val);
    saveJSON(WATER_GOAL_KEY, val);
    setGoalInput('');
    setGoalModalVisible(false);
  };

  // Hourly breakdown for today
  const hourlyData = useMemo(() => {
    const hours: Record<number, number> = {};
    for (const e of todayEntries) {
      const h = parseInt(e.time.split(':')[0], 10);
      hours[h] = (hours[h] ?? 0) + e.amount;
    }
    return hours;
  }, [todayEntries]);

  return (
    <ScreenShell title="Water Tracker" accentColor={ACCENT} scrollable>
      {/* ── Progress Ring Card ──────────────────────────────── */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <ProgressRing progress={progress} total={total} goal={goal} goalReached={goalReached} colors={colors} />

        <Text style={[styles.progressSubtitle, { color: goalReached ? '#10B981' : colors.textMuted }]}>
          {goalReached ? 'Daily goal reached!' : `${percent}% — ${fmtMl(Math.max(0, goal - total))} remaining`}
        </Text>

        {/* Stats chips */}
        <View style={styles.statsChips}>
          <View style={[styles.chip, { backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE' }]}>
            <Ionicons name="flame-outline" size={14} color={ACCENT} />
            <Text style={[styles.chipText, { color: ACCENT }]}>
              {goalStreak > 0 ? `${goalStreak}-day streak` : 'No streak'}
            </Text>
          </View>
          <View style={[styles.chip, { backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE' }]}>
            <Ionicons name="time-outline" size={14} color={ACCENT} />
            <Text style={[styles.chipText, { color: ACCENT }]}>{todayEntries.length} entries</Text>
          </View>
        </View>

        {/* Goal edit */}
        <TouchableOpacity
          style={[styles.goalBadge, { borderColor: colors.border }]}
          onPress={() => { setGoalInput(String(goal)); setGoalModalVisible(true); }}
        >
          <Ionicons name="flag" size={12} color={ACCENT} />
          <Text style={[styles.goalBadgeText, { color: colors.textMuted }]}>Goal: {fmtMl(goal)}</Text>
          <Ionicons name="pencil" size={10} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* ── Quick Add Grid ─────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Quick Add</Text>
        <View style={styles.quickGrid}>
          {QUICK_PRESETS.map(p => (
            <TouchableOpacity
              key={p.label}
              style={[styles.quickTile, { backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE', borderColor: ACCENT + '30' }]}
              onPress={() => addEntry(p.ml)}
              activeOpacity={0.7}
            >
              <Ionicons name={p.icon} size={20} color={ACCENT} />
              <Text style={[styles.quickLabel, { color: colors.text }]}>{p.label}</Text>
              <Text style={[styles.quickMl, { color: ACCENT }]}>{p.ml}ml</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.customBtn, { backgroundColor: ACCENT }]}
          onPress={() => { setCustomInput(''); setCustomModalVisible(true); }}
        >
          <Ionicons name="add-circle-outline" size={18} color="#fff" />
          <Text style={styles.customBtnText}>Custom Amount</Text>
        </TouchableOpacity>
      </View>

      {/* ── 7-Day Bar Chart ────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.chartArea}>
          {/* Goal line */}
          <View style={[styles.goalLine, { bottom: (goal / maxBar) * 100, borderColor: ACCENT + '50' }]}>
            <Text style={[styles.goalLineLabel, { color: ACCENT }]}>{fmtMl(goal)}</Text>
          </View>
          <View style={styles.barRow}>
            {weekData.map(d => {
              const barH = maxBar > 0 ? Math.max(d.total > 0 ? 6 : 0, (d.total / maxBar) * 100) : 0;
              const isToday = d.key === today;
              const metGoal = d.total >= goal;
              return (
                <View key={d.key} style={styles.barCol}>
                  <Text style={[styles.barAmt, { color: isToday ? ACCENT : colors.textMuted }]} numberOfLines={1}>
                    {d.total > 0 ? fmtMl(d.total) : ''}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: colors.border + '40' }]}>
                    <View style={[styles.barFill, {
                      height: `${barH}%`,
                      backgroundColor: metGoal ? '#10B981' : isToday ? ACCENT : ACCENT + '70',
                      borderRadius: 4,
                    }]} />
                  </View>
                  <Text style={[styles.barDay, {
                    color: isToday ? ACCENT : colors.textMuted,
                    fontFamily: isToday ? Fonts.bold : Fonts.medium,
                  }]}>{shortDay(d.key)}</Text>
                  {metGoal && <Ionicons name="checkmark-circle" size={12} color="#10B981" />}
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {/* ── Weekly Stats ───────────────────────────────────── */}
      <View style={styles.statsRow}>
        {[
          { label: 'Avg/Day', val: fmtMl(weekStats.avg), icon: 'analytics-outline' as const, color: ACCENT },
          { label: 'Goal Met', val: `${weekStats.daysGoalMet}/7`, icon: 'checkmark-circle-outline' as const, color: '#10B981' },
          { label: 'Week Total', val: fmtMl(weekStats.weekTotal), icon: 'water-outline' as const, color: '#3B82F6' },
          { label: 'Best Day', val: fmtMl(weekStats.bestDay), icon: 'trophy-outline' as const, color: '#F59E0B' },
        ].map(s => (
          <View key={s.label} style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={s.icon} size={16} color={s.color} />
            <Text style={[styles.statVal, { color: colors.text }]}>{s.val}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Hourly Timeline ────────────────────────────────── */}
      {todayEntries.length > 0 && Object.keys(hourlyData).length > 1 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Today's Timeline</Text>
          <View style={styles.timelineRow}>
            {Array.from({ length: 24 }, (_, i) => i).filter(h => hourlyData[h]).map(h => (
              <View key={h} style={styles.timelineItem}>
                <Text style={[styles.timelineHour, { color: colors.textMuted }]}>
                  {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                </Text>
                <View style={[styles.timelineDot, { backgroundColor: ACCENT }]} />
                <Text style={[styles.timelineMl, { color: ACCENT }]}>{hourlyData[h]}ml</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Today's Log ────────────────────────────────────── */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>
          Today's Log
          {todayEntries.length > 0 && (
            <Text style={{ color: colors.textMuted, fontFamily: Fonts.regular, fontSize: 13 }}>
              {' '}({todayEntries.length})
            </Text>
          )}
        </Text>
        {todayEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="water-outline" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No water logged yet today.{'\n'}Tap a button above to start!
            </Text>
          </View>
        ) : (
          todayEntries.map((entry, i) => (
            <View key={entry.id} style={[styles.logItem, i < todayEntries.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}>
              <View style={[styles.logIcon, { backgroundColor: isDark ? '#0C4A6E' : '#E0F2FE' }]}>
                <Ionicons name="water" size={16} color={ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.logAmount, { color: colors.text }]}>{entry.amount} ml</Text>
                <Text style={[styles.logTime, { color: colors.textMuted }]}>{entry.time}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* ── Custom Amount Modal ────────────────────────────── */}
      <KeyboardAwareModal visible={customModalVisible} transparent animationType="fade" onRequestClose={() => setCustomModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Custom Amount</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>Enter amount in ml</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={customInput} onChangeText={setCustomInput}
              placeholder="e.g. 250" placeholderTextColor={colors.textMuted}
              keyboardType="number-pad" autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1.5 }]} onPress={() => setCustomModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={handleCustomAdd}>
                <Ionicons name="water" size={16} color="#fff" />
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>

      {/* ── Goal Modal ─────────────────────────────────────── */}
      <KeyboardAwareModal visible={goalModalVisible} transparent animationType="fade" onRequestClose={() => setGoalModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Daily Goal</Text>
            <Text style={[styles.modalSub, { color: colors.textMuted }]}>Set your target in ml</Text>
            {/* Preset goals */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md }}>
              {[1500, 2000, 2500, 3000, 3500, 4000].map(g => (
                <TouchableOpacity
                  key={g}
                  style={[styles.goalPreset, {
                    borderColor: goalInput === String(g) ? ACCENT : colors.border,
                    backgroundColor: goalInput === String(g) ? ACCENT + '18' : colors.inputBg,
                  }]}
                  onPress={() => setGoalInput(String(g))}
                >
                  <Text style={{ fontSize: 13, fontFamily: Fonts.semibold, color: goalInput === String(g) ? ACCENT : colors.text }}>
                    {fmtMl(g)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={goalInput} onChangeText={setGoalInput}
              placeholder="Or type custom" placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1.5 }]} onPress={() => setGoalModalVisible(false)}>
                <Text style={[styles.modalBtnText, { color: colors.textMuted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={handleSaveGoal}>
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    progressCard: {
      borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xl,
      alignItems: 'center', marginBottom: Spacing.md,
    },
    progressSubtitle: { fontSize: 14, fontFamily: Fonts.semibold, marginTop: Spacing.md, marginBottom: Spacing.md },
    statsChips: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill },
    chipText: { fontSize: 12, fontFamily: Fonts.semibold },
    goalBadge: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1,
    },
    goalBadgeText: { fontSize: 12, fontFamily: Fonts.medium },

    section: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    sectionTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },

    // Quick Add Grid
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    quickTile: {
      width: '31%', flexGrow: 1, alignItems: 'center', padding: Spacing.md,
      borderRadius: Radii.lg, borderWidth: 1, gap: 4,
    },
    quickLabel: { fontSize: 12, fontFamily: Fonts.semibold },
    quickMl: { fontSize: 11, fontFamily: Fonts.bold },
    customBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: Radii.md,
    },
    customBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },

    // Bar Chart
    chartArea: { height: 150, position: 'relative', marginBottom: Spacing.sm },
    goalLine: {
      position: 'absolute', left: 0, right: 0, borderTopWidth: 1.5,
      borderStyle: 'dashed', zIndex: 1,
    },
    goalLineLabel: { fontSize: 9, fontFamily: Fonts.medium, position: 'absolute', right: 0, top: -14 },
    barRow: { flexDirection: 'row', alignItems: 'flex-end', height: '100%', gap: 4, paddingTop: 16 },
    barCol: { flex: 1, alignItems: 'center', gap: 3 },
    barAmt: { fontSize: 9, fontFamily: Fonts.medium, height: 12 },
    barTrack: { width: '80%', height: 90, borderRadius: 4, justifyContent: 'flex-end', overflow: 'hidden' },
    barFill: { width: '100%' },
    barDay: { fontSize: 10 },

    // Weekly Stats
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    statTile: {
      flex: 1, minWidth: '46%', alignItems: 'center', padding: Spacing.md,
      borderRadius: Radii.lg, borderWidth: 1, gap: 3,
    },
    statVal: { fontSize: 16, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium },

    // Timeline
    timelineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    timelineItem: { alignItems: 'center', gap: 2 },
    timelineHour: { fontSize: 10, fontFamily: Fonts.medium },
    timelineDot: { width: 8, height: 8, borderRadius: 4 },
    timelineMl: { fontSize: 10, fontFamily: Fonts.bold },

    // Log Items
    logItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
    logIcon: { width: 32, height: 32, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    logAmount: { fontSize: 14, fontFamily: Fonts.semibold },
    logTime: { fontSize: 11, fontFamily: Fonts.regular },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    emptyText: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20 },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
    modalBox: { width: '100%', maxWidth: 340, borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: 2 },
    modalSub: { fontSize: 13, fontFamily: Fonts.regular, marginBottom: Spacing.lg },
    modalInput: {
      borderWidth: 1.5, borderRadius: Radii.md, paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm, fontSize: 20, fontFamily: Fonts.semibold,
      marginBottom: Spacing.lg, textAlign: 'center',
    },
    goalPreset: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1.5 },
    modalBtns: { flexDirection: 'row', gap: Spacing.sm },
    modalBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: Spacing.md, borderRadius: Radii.md,
    },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.semibold },
  });
