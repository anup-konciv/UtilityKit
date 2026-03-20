import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { loadJSON, saveJSON } from '@/lib/storage';

// ─── Constants ──────────────────────────────────────────────────────────────
const SETTINGS_KEY = 'uk_pomodoro_settings';
const TODAY_KEY = 'uk_pomodoro_today';

const WORK_COLOR = '#F97316';
const BREAK_COLOR = '#10B981';
const RING_SIZE = 240;
const RING_THICKNESS = 12;

type SessionType = 'work' | 'shortBreak' | 'longBreak';

interface PomodoroSettings {
  workMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  sessionsBeforeLong: number;
}

interface TodayData {
  date: string;
  completed: number;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  sessionsBeforeLong: 4,
};

// ─── Helpers ────────────────────────────────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function padZ(n: number): string {
  return String(n).padStart(2, '0');
}

function fmtTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${padZ(m)}:${padZ(s)}`;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function PomodoroScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Settings
  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [editingField, setEditingField] = useState<keyof PomodoroSettings | null>(null);

  // Timer state
  const [sessionType, setSessionType] = useState<SessionType>('work');
  const [currentSession, setCurrentSession] = useState(1); // 1-based
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_SETTINGS.workMin * 60);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SETTINGS.workMin * 60);
  const [running, setRunning] = useState(false);

  // Today's completed count
  const [todayCompleted, setTodayCompleted] = useState(0);
  const todayCompletedRef = useRef(0);

  // Refs
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimeRef = useRef(0);
  const settingsRef = useRef(settings);
  const currentSessionRef = useRef(currentSession);
  const sessionTypeRef = useRef(sessionType);

  // Keep refs in sync
  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { currentSessionRef.current = currentSession; }, [currentSession]);
  useEffect(() => { sessionTypeRef.current = sessionType; }, [sessionType]);
  useEffect(() => { todayCompletedRef.current = todayCompleted; }, [todayCompleted]);

  // Load persisted data
  useEffect(() => {
    (async () => {
      const saved = await loadJSON<PomodoroSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
      setSettings(saved);
      const dur = saved.workMin * 60;
      setSecondsLeft(dur);
      setTotalSeconds(dur);

      const today = await loadJSON<TodayData>(TODAY_KEY, { date: todayStr(), completed: 0 });
      if (today.date === todayStr()) {
        setTodayCompleted(today.completed);
      } else {
        await saveJSON(TODAY_KEY, { date: todayStr(), completed: 0 });
      }
    })();
  }, []);

  // Persist settings on change
  const updateSettings = useCallback(async (next: PomodoroSettings) => {
    setSettings(next);
    await saveJSON(SETTINGS_KEY, next);
  }, []);

  // Persist today's count
  const persistToday = useCallback(async (count: number) => {
    setTodayCompleted(count);
    await saveJSON(TODAY_KEY, { date: todayStr(), completed: count });
  }, []);

  // Clear interval helper
  const clearTick = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Transition to next session
  const goToNextSession = useCallback((completedType: SessionType) => {
    const s = settingsRef.current;
    const curSess = currentSessionRef.current;

    if (completedType === 'work') {
      // Increment today's completed pomodoros
      persistToday(todayCompletedRef.current + 1);

      // Decide break type
      if (curSess >= s.sessionsBeforeLong) {
        // Long break, then reset session counter
        const dur = s.longBreakMin * 60;
        setSessionType('longBreak');
        setSecondsLeft(dur);
        setTotalSeconds(dur);
        setCurrentSession(1);
      } else {
        const dur = s.shortBreakMin * 60;
        setSessionType('shortBreak');
        setSecondsLeft(dur);
        setTotalSeconds(dur);
      }
    } else {
      // Break finished, go to work
      const dur = s.workMin * 60;
      setSessionType('work');
      setSecondsLeft(dur);
      setTotalSeconds(dur);
      if (completedType === 'shortBreak') {
        setCurrentSession(curSess + 1);
      }
    }
  }, [persistToday]);

  // Timer complete
  const onTimerComplete = useCallback(() => {
    clearTick();
    setRunning(false);
    Vibration.vibrate([0, 400, 200, 400]);
    goToNextSession(sessionTypeRef.current);
  }, [clearTick, goToNextSession]);

  // Start
  const start = useCallback(() => {
    setRunning(true);
    endTimeRef.current = Date.now() + secondsLeft * 1000;
    intervalRef.current = setInterval(() => {
      const left = Math.round((endTimeRef.current - Date.now()) / 1000);
      if (left <= 0) {
        setSecondsLeft(0);
        onTimerComplete();
      } else {
        setSecondsLeft(left);
      }
    }, 250);
  }, [secondsLeft, onTimerComplete]);

  // Pause
  const pause = useCallback(() => {
    clearTick();
    setRunning(false);
  }, [clearTick]);

  // Reset current session
  const reset = useCallback(() => {
    clearTick();
    setRunning(false);
    const dur = sessionType === 'work'
      ? settings.workMin * 60
      : sessionType === 'shortBreak'
        ? settings.shortBreakMin * 60
        : settings.longBreakMin * 60;
    setSecondsLeft(dur);
    setTotalSeconds(dur);
  }, [clearTick, sessionType, settings]);

  // Cleanup
  useEffect(() => () => clearTick(), [clearTick]);

  // Progress (0 to 1)
  const progress = totalSeconds > 0 ? 1 - secondsLeft / totalSeconds : 0;
  const activeColor = sessionType === 'work' ? WORK_COLOR : BREAK_COLOR;

  const sessionLabel = sessionType === 'work'
    ? 'Focus Time'
    : sessionType === 'shortBreak'
      ? 'Short Break'
      : 'Long Break';

  // Tap-to-edit handler
  const handleSettingTap = useCallback((field: keyof PomodoroSettings) => {
    if (running) return;
    setEditingField((prev) => (prev === field ? null : field));
  }, [running]);

  const adjustSetting = useCallback((field: keyof PomodoroSettings, delta: number) => {
    const min = field === 'sessionsBeforeLong' ? 1 : 1;
    const max = field === 'sessionsBeforeLong' ? 10 : 120;
    const next = { ...settings, [field]: Math.max(min, Math.min(max, settings[field] + delta)) };
    updateSettings(next);

    // Update timer if not running and field matches current session type
    if (!running) {
      if (field === 'workMin' && sessionType === 'work') {
        const dur = next.workMin * 60;
        setSecondsLeft(dur);
        setTotalSeconds(dur);
      } else if (field === 'shortBreakMin' && sessionType === 'shortBreak') {
        const dur = next.shortBreakMin * 60;
        setSecondsLeft(dur);
        setTotalSeconds(dur);
      } else if (field === 'longBreakMin' && sessionType === 'longBreak') {
        const dur = next.longBreakMin * 60;
        setSecondsLeft(dur);
        setTotalSeconds(dur);
      }
    }
  }, [settings, running, sessionType, updateSettings]);

  // Rotation degrees for progress ring halves
  const leftDeg = progress <= 0.5 ? 0 : (progress - 0.5) * 360;
  const rightDeg = progress <= 0.5 ? progress * 360 : 180;

  return (
    <ScreenShell title="Pomodoro" accentColor="#EF4444">
      <View style={styles.container}>
        {/* Session Label */}
        <Text style={[styles.sessionLabel, { color: activeColor }]}>{sessionLabel}</Text>
        <Text style={[styles.sessionCounter, { color: colors.textMuted }]}>
          Session {currentSession} of {settings.sessionsBeforeLong}
        </Text>

        {/* Circular Progress Ring */}
        <View style={styles.ringContainer}>
          <View style={[styles.ringOuter, { borderColor: colors.border }]}>
            {/* Right half (first 50%) */}
            <View style={styles.halfClip}>
              <View
                style={[
                  styles.halfCircle,
                  styles.rightHalf,
                  {
                    borderColor: activeColor,
                    transform: [{ rotate: `${rightDeg}deg` }],
                  },
                ]}
              />
            </View>
            {/* Left half (second 50%) */}
            <View style={[styles.halfClip, styles.leftClip]}>
              <View
                style={[
                  styles.halfCircle,
                  styles.leftHalf,
                  {
                    borderColor: activeColor,
                    transform: [{ rotate: `${leftDeg}deg` }],
                  },
                ]}
              />
            </View>
            {/* Inner circle */}
            <View style={[styles.ringInner, { backgroundColor: colors.bg }]}>
              <Text style={[styles.timeDisplay, { color: activeColor }]}>{fmtTime(secondsLeft)}</Text>
              <Text style={[styles.progressPct, { color: colors.textMuted }]}>
                {Math.round(progress * 100)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controlRow}>
          <TouchableOpacity
            style={[styles.ctrlBtn, { backgroundColor: activeColor }]}
            onPress={running ? pause : start}
            activeOpacity={0.7}
          >
            <Text style={styles.ctrlBtnText}>
              {running ? 'Pause' : secondsLeft < totalSeconds && secondsLeft > 0 ? 'Resume' : 'Start'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctrlBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
            onPress={reset}
            activeOpacity={0.7}
          >
            <Text style={[styles.ctrlBtnText, { color: colors.text }]}>Reset</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Completed */}
        <View style={[styles.todayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.todayLabel, { color: colors.textMuted }]}>Completed Today</Text>
          <Text style={[styles.todayCount, { color: WORK_COLOR }]}>{todayCompleted}</Text>
          <Text style={[styles.todayUnit, { color: colors.textMuted }]}>
            pomodoro{todayCompleted !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Settings */}
        <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.settingsTitle, { color: colors.text }]}>Settings</Text>
          {([
            { field: 'workMin' as const, label: 'Work', unit: 'min' },
            { field: 'shortBreakMin' as const, label: 'Short Break', unit: 'min' },
            { field: 'longBreakMin' as const, label: 'Long Break', unit: 'min' },
            { field: 'sessionsBeforeLong' as const, label: 'Sessions', unit: '' },
          ]).map(({ field, label, unit }) => (
            <View key={field}>
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => handleSettingTap(field)}
                activeOpacity={0.6}
              >
                <Text style={[styles.settingLabel, { color: colors.textSub }]}>{label}</Text>
                <Text style={[styles.settingValue, { color: colors.text }]}>
                  {settings[field]}{unit ? ` ${unit}` : ''}
                </Text>
              </TouchableOpacity>
              {editingField === field && (
                <View style={styles.adjustRow}>
                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
                    onPress={() => adjustSetting(field, -1)}
                  >
                    <Text style={[styles.adjustBtnText, { color: colors.text }]}>-</Text>
                  </TouchableOpacity>
                  <Text style={[styles.adjustValue, { color: activeColor }]}>
                    {settings[field]}{unit ? ` ${unit}` : ''}
                  </Text>
                  <TouchableOpacity
                    style={[styles.adjustBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
                    onPress={() => adjustSetting(field, 1)}
                  >
                    <Text style={[styles.adjustBtnText, { color: colors.text }]}>+</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingTop: Spacing.lg,
    },
    sessionLabel: {
      fontSize: 20,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.xs,
    },
    sessionCounter: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      marginBottom: Spacing.lg,
    },

    // ── Ring ──
    ringContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: Spacing.xl,
    },
    ringOuter: {
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_SIZE / 2,
      borderWidth: RING_THICKNESS,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    halfClip: {
      position: 'absolute',
      top: -RING_THICKNESS,
      right: -RING_THICKNESS,
      width: RING_SIZE / 2,
      height: RING_SIZE,
      overflow: 'hidden',
    },
    leftClip: {
      right: undefined,
      left: -RING_THICKNESS,
    },
    halfCircle: {
      width: RING_SIZE,
      height: RING_SIZE,
      borderRadius: RING_SIZE / 2,
      borderWidth: RING_THICKNESS,
      borderColor: 'transparent',
      position: 'absolute',
    },
    rightHalf: {
      left: -RING_SIZE / 2,
      borderLeftColor: 'transparent',
      borderBottomColor: 'transparent',
      transformOrigin: 'center',
    },
    leftHalf: {
      left: 0,
      borderRightColor: 'transparent',
      borderTopColor: 'transparent',
      transformOrigin: 'center',
    },
    ringInner: {
      width: RING_SIZE - RING_THICKNESS * 2 - 4,
      height: RING_SIZE - RING_THICKNESS * 2 - 4,
      borderRadius: (RING_SIZE - RING_THICKNESS * 2 - 4) / 2,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    timeDisplay: {
      fontSize: 48,
      fontFamily: Fonts.bold,
      fontVariant: ['tabular-nums'],
      letterSpacing: -1,
    },
    progressPct: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      marginTop: Spacing.xs,
    },

    // ── Controls ──
    controlRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.xl,
    },
    ctrlBtn: {
      paddingHorizontal: 32,
      paddingVertical: 14,
      borderRadius: Radii.pill,
    },
    ctrlBtnText: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
      color: '#fff',
    },

    // ── Today card ──
    todayCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginBottom: Spacing.lg,
      width: '100%',
    },
    todayLabel: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.medium,
    },
    todayCount: {
      fontSize: 28,
      fontFamily: Fonts.bold,
    },
    todayUnit: {
      fontSize: 13,
      fontFamily: Fonts.regular,
    },

    // ── Settings ──
    settingsCard: {
      width: '100%',
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
    },
    settingsTitle: {
      fontSize: 15,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.md,
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: Spacing.sm,
    },
    settingLabel: {
      fontSize: 14,
      fontFamily: Fonts.medium,
    },
    settingValue: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    adjustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.lg,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    adjustBtn: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    adjustBtnText: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    adjustValue: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      minWidth: 70,
      textAlign: 'center',
    },
  });
