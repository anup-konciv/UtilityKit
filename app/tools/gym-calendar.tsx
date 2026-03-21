import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F97316';
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = Math.floor((SCREEN_WIDTH - Spacing.md * 2 - Spacing.xs * 6) / 7);
const DEFAULT_WEEKLY_GOAL = 4;

/* ───── Types ───── */
type WorkoutLog = {
  muscles: string[];
  exercises: string[];
  note: string;
};

type GymData = {
  dates: string[];
  workouts: Record<string, WorkoutLog>;
};

/* ───── Muscle groups & exercises ───── */
const MUSCLE_GROUPS: { name: string; icon: string; color: string }[] = [
  { name: 'Chest', icon: 'fitness', color: '#EF4444' },
  { name: 'Back', icon: 'body', color: '#3B82F6' },
  { name: 'Shoulders', icon: 'arrow-up-circle', color: '#8B5CF6' },
  { name: 'Biceps', icon: 'flash', color: '#F59E0B' },
  { name: 'Triceps', icon: 'flash-outline', color: '#EC4899' },
  { name: 'Legs', icon: 'walk', color: '#10B981' },
  { name: 'Core', icon: 'ellipse', color: '#06B6D4' },
  { name: 'Cardio', icon: 'heart', color: '#F43F5E' },
  { name: 'Full Body', icon: 'barbell', color: '#6366F1' },
  { name: 'Glutes', icon: 'trending-up', color: '#D946EF' },
  { name: 'Forearms', icon: 'hand-left', color: '#0891B2' },
  { name: 'Stretching', icon: 'leaf', color: '#84CC16' },
];

const EXERCISE_PRESETS: Record<string, string[]> = {
  Chest: ['Bench Press', 'Incline Press', 'Dumbbell Fly', 'Push-ups', 'Cable Crossover', 'Chest Dips'],
  Back: ['Pull-ups', 'Lat Pulldown', 'Barbell Row', 'Dumbbell Row', 'Deadlift', 'Cable Row'],
  Shoulders: ['Overhead Press', 'Lateral Raise', 'Front Raise', 'Face Pull', 'Shrugs', 'Arnold Press'],
  Biceps: ['Barbell Curl', 'Dumbbell Curl', 'Hammer Curl', 'Preacher Curl', 'Concentration Curl'],
  Triceps: ['Tricep Pushdown', 'Skull Crushers', 'Overhead Extension', 'Close-grip Bench', 'Dips'],
  Legs: ['Squats', 'Leg Press', 'Lunges', 'Leg Curl', 'Leg Extension', 'Calf Raises'],
  Core: ['Crunches', 'Planks', 'Russian Twist', 'Leg Raises', 'Mountain Climbers', 'Ab Wheel'],
  Cardio: ['Running', 'Cycling', 'Jump Rope', 'Rowing', 'Stair Climber', 'HIIT', 'Swimming'],
  'Full Body': ['Burpees', 'Clean & Press', 'Turkish Get-up', 'Kettlebell Swing', 'Thrusters'],
  Glutes: ['Hip Thrust', 'Glute Bridge', 'Cable Kickback', 'Sumo Squat', 'Step-ups'],
  Forearms: ['Wrist Curl', 'Reverse Curl', 'Farmer Walk', 'Dead Hang'],
  Stretching: ['Hamstring Stretch', 'Quad Stretch', 'Hip Flexor', 'Shoulder Stretch', 'Yoga Flow'],
};

/* ───── Helpers ───── */
function toISODate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function todayISO(): string {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function buildCalendarDays(year: number, month: number) {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

function calcStreak(dates: Set<string>): number {
  const today = todayISO();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return toISODate(d.getFullYear(), d.getMonth(), d.getDate());
  })();

  let streak = 0;
  let cursor = new Date();

  if (!dates.has(today)) {
    if (!dates.has(yesterday)) return 0;
    cursor.setDate(cursor.getDate() - 1);
  }

  while (true) {
    const iso = toISODate(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    if (!dates.has(iso)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calcBestStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0;
  const sorted = Array.from(dates).sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays === 1) {
      current++;
      if (current > best) best = current;
    } else {
      current = 1;
    }
  }
  return best;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/* ───── Component ───── */
export default function GymCalendarScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [gymDates, setGymDates] = useState<Set<string>>(new Set());
  const [workouts, setWorkouts] = useState<Record<string, WorkoutLog>>({});
  const [weeklyGoal, setWeeklyGoal] = useState<number>(DEFAULT_WEEKLY_GOAL);

  // Workout modal state
  const [showWorkout, setShowWorkout] = useState(false);
  const [workoutDate, setWorkoutDate] = useState('');
  const [selMuscles, setSelMuscles] = useState<string[]>([]);
  const [selExercises, setSelExercises] = useState<string[]>([]);
  const [workoutNote, setWorkoutNote] = useState('');
  const [customExercise, setCustomExercise] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Load on mount
  useEffect(() => {
    (async () => {
      // Support migration from old format (string[]) to new format
      const raw = await loadJSON<any>(KEYS.gymLogs, null);
      if (Array.isArray(raw)) {
        // Old format: string[]
        setGymDates(new Set(raw));
        setWorkouts({});
      } else if (raw && typeof raw === 'object' && raw.dates) {
        // New format: GymData
        setGymDates(new Set(raw.dates));
        setWorkouts(raw.workouts || {});
      } else {
        setGymDates(new Set());
        setWorkouts({});
      }
      const storedGoal = await loadJSON<number>(KEYS.gymWeeklyGoal, DEFAULT_WEEKLY_GOAL);
      setWeeklyGoal(storedGoal);
    })();
  }, []);

  // Save on change
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const data: GymData = { dates: Array.from(gymDates), workouts };
    saveJSON(KEYS.gymLogs, data);
  }, [gymDates, workouts]);

  const goToPrevMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 0) { setYear(y => y - 1); return 11; }
      return prev - 1;
    });
  }, []);

  const goToNextMonth = useCallback(() => {
    setMonth(prev => {
      if (prev === 11) { setYear(y => y + 1); return 0; }
      return prev + 1;
    });
  }, []);

  const toggleDay = useCallback((day: number) => {
    const iso = toISODate(year, month, day);
    setGymDates(prev => {
      const next = new Set(prev);
      if (next.has(iso)) {
        next.delete(iso);
      } else {
        next.add(iso);
      }
      return next;
    });
    setSelectedDate(iso);
  }, [year, month]);

  const openWorkoutModal = useCallback((day: number) => {
    const iso = toISODate(year, month, day);
    // Auto-mark as gym day
    setGymDates(prev => {
      const next = new Set(prev);
      next.add(iso);
      return next;
    });
    // Load existing workout data
    const existing = workouts[iso];
    setWorkoutDate(iso);
    setSelMuscles(existing?.muscles || []);
    setSelExercises(existing?.exercises || []);
    setWorkoutNote(existing?.note || '');
    setCustomExercise('');
    setShowWorkout(true);
  }, [year, month, workouts]);

  const saveWorkout = useCallback(() => {
    if (selMuscles.length === 0 && selExercises.length === 0 && !workoutNote.trim()) {
      setShowWorkout(false);
      return;
    }
    setWorkouts(prev => ({
      ...prev,
      [workoutDate]: { muscles: selMuscles, exercises: selExercises, note: workoutNote.trim() },
    }));
    setShowWorkout(false);
    setSelectedDate(workoutDate);
  }, [workoutDate, selMuscles, selExercises, workoutNote]);

  const clearWorkout = useCallback(() => {
    setWorkouts(prev => {
      const next = { ...prev };
      delete next[workoutDate];
      return next;
    });
    setShowWorkout(false);
  }, [workoutDate]);

  const toggleMuscle = (name: string) => {
    setSelMuscles(prev => prev.includes(name) ? prev.filter(m => m !== name) : [...prev, name]);
  };

  const toggleExercise = (name: string) => {
    setSelExercises(prev => prev.includes(name) ? prev.filter(e => e !== name) : [...prev, name]);
  };

  const addCustomExercise = () => {
    const val = customExercise.trim();
    if (val && !selExercises.includes(val)) {
      setSelExercises(prev => [...prev, val]);
      setCustomExercise('');
    }
  };

  const cycleWeeklyGoal = useCallback(() => {
    setWeeklyGoal(prev => {
      const next = prev >= 7 ? 1 : prev + 1;
      saveJSON<number>(KEYS.gymWeeklyGoal, next);
      return next;
    });
  }, []);

  // Derived values
  const calendarDays = buildCalendarDays(year, month);
  const today = todayISO();

  const thisMonthCount = (() => {
    let count = 0;
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    gymDates.forEach(d => { if (d.startsWith(prefix)) count++; });
    return count;
  })();

  const currentStreak = calcStreak(gymDates);
  const bestStreak = calcBestStreak(gymDates);

  const currentWeekDays = (() => {
    const now2 = new Date();
    const dayOfWeek = now2.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(now2);
    monday.setDate(now2.getDate() - mondayOffset);
    let count = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toISODate(d.getFullYear(), d.getMonth(), d.getDate());
      if (iso > today) break;
      if (gymDates.has(iso)) count++;
    }
    return count;
  })();
  const weeklyProgress = Math.min(currentWeekDays / Math.max(weeklyGoal, 1), 1.0);

  // Suggested exercises based on selected muscles
  const suggestedExercises = useMemo(() => {
    const exercises: string[] = [];
    selMuscles.forEach(m => {
      (EXERCISE_PRESETS[m] || []).forEach(e => {
        if (!exercises.includes(e)) exercises.push(e);
      });
    });
    return exercises;
  }, [selMuscles]);

  // Selected date workout info
  const selectedWorkout = selectedDate ? workouts[selectedDate] : null;

  // Muscle frequency for current month
  const monthMuscleFreq = useMemo(() => {
    const freq: Record<string, number> = {};
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    Object.entries(workouts).forEach(([date, log]) => {
      if (date.startsWith(prefix)) {
        log.muscles.forEach(m => { freq[m] = (freq[m] || 0) + 1; });
      }
    });
    return Object.entries(freq).sort((a, b) => b[1] - a[1]);
  }, [workouts, year, month]);

  return (
    <ScreenShell title="Gym Calendar" accentColor={ACCENT} scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Navigator */}
        <View style={styles.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={styles.navButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={goToNextMonth} style={styles.navButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="barbell-outline" size={20} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>{thisMonthCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>This Month</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="flame-outline" size={20} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>{currentStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="trophy-outline" size={20} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>{bestStreak}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best</Text>
          </View>
          <View style={[styles.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={20} color={ACCENT} />
            <Text style={[styles.statValue, { color: colors.text }]}>{gymDates.size}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
          </View>
        </View>

        {/* Weekly Goal */}
        <View style={[styles.weeklyGoalRow, { backgroundColor: colors.card }]}>
          <View style={styles.weeklyGoalHeader}>
            <Ionicons name="flag-outline" size={16} color={ACCENT} />
            <Text style={[styles.weeklyGoalText, { color: colors.text }]}>
              Weekly Goal:{' '}
              <Text style={{ color: ACCENT, fontFamily: Fonts.bold }}>
                {currentWeekDays}/{weeklyGoal} days
              </Text>
            </Text>
            <TouchableOpacity
              onPress={cycleWeeklyGoal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.weeklyEditBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="pencil" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={[styles.weeklyBarTrack, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.weeklyBarFill,
                {
                  width: `${Math.max(weeklyProgress * 100, weeklyProgress > 0 ? 4 : 0)}%`,
                  backgroundColor: currentWeekDays >= weeklyGoal ? '#10B981' : ACCENT,
                },
              ]}
            />
          </View>
        </View>

        {/* Weekday Header */}
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map(wd => (
            <View key={wd} style={styles.weekdayCell}>
              <Text style={[styles.weekdayText, { color: colors.textMuted }]}>{wd}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.grid}>
          {calendarDays.map((day, idx) => {
            if (day === null) {
              return <View key={`blank-${idx}`} style={styles.cellWrapper} />;
            }
            const iso = toISODate(year, month, day);
            const isToday = iso === today;
            const isGymDay = gymDates.has(iso);
            const isFuture = iso > today;
            const hasWorkout = !!workouts[iso];
            const isSelected = iso === selectedDate;

            return (
              <TouchableOpacity
                key={iso}
                style={styles.cellWrapper}
                onPress={() => { toggleDay(day); }}
                onLongPress={() => openWorkoutModal(day)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.cell,
                    isGymDay && styles.cellGym,
                    isToday && !isGymDay && styles.cellToday,
                    isFuture && !isGymDay && styles.cellFuture,
                    isSelected && { borderWidth: 2, borderColor: '#fff' },
                  ]}
                >
                  <Text
                    style={[
                      styles.cellText,
                      { color: colors.text },
                      isGymDay && styles.cellTextGym,
                      isToday && !isGymDay && styles.cellTextToday,
                      isFuture && !isGymDay && { color: colors.textMuted },
                    ]}
                  >
                    {day}
                  </Text>
                  {/* Workout detail indicator */}
                  {isGymDay && hasWorkout && (
                    <View style={styles.detailDot} />
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotGym]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Gym Day</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotToday]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Today</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, styles.legendDotGym, { justifyContent: 'center', alignItems: 'center' }]}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' }} />
            </View>
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Has Workout</Text>
          </View>
        </View>

        {/* Hint */}
        <Text style={[styles.hintText, { color: colors.textMuted }]}>
          Tap to toggle  {'\u2022'}  Long press to log workout
        </Text>

        {/* Selected date workout info */}
        {selectedDate && gymDates.has(selectedDate) && (
          <View style={[styles.workoutInfoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.workoutInfoHeader}>
              <Ionicons name="barbell" size={18} color={ACCENT} />
              <Text style={[styles.workoutInfoTitle, { color: colors.text }]}>{formatDate(selectedDate)}</Text>
              <TouchableOpacity
                onPress={() => openWorkoutModal(new Date(selectedDate + 'T00:00:00').getDate())}
                style={[styles.editWorkoutBtn, { backgroundColor: ACCENT + '15' }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name={selectedWorkout ? 'create-outline' : 'add'} size={16} color={ACCENT} />
                <Text style={[styles.editWorkoutText, { color: ACCENT }]}>
                  {selectedWorkout ? 'Edit' : 'Log Workout'}
                </Text>
              </TouchableOpacity>
            </View>

            {selectedWorkout ? (
              <>
                {selectedWorkout.muscles.length > 0 && (
                  <View style={styles.workoutSection}>
                    <Text style={[styles.workoutSectionLabel, { color: colors.textMuted }]}>Muscles</Text>
                    <View style={styles.chipRow}>
                      {selectedWorkout.muscles.map(m => {
                        const mg = MUSCLE_GROUPS.find(g => g.name === m);
                        return (
                          <View key={m} style={[styles.infoChip, { backgroundColor: (mg?.color || ACCENT) + '18', borderColor: (mg?.color || ACCENT) + '30' }]}>
                            <Ionicons name={(mg?.icon || 'fitness') as any} size={12} color={mg?.color || ACCENT} />
                            <Text style={[styles.infoChipText, { color: mg?.color || ACCENT }]}>{m}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
                {selectedWorkout.exercises.length > 0 && (
                  <View style={styles.workoutSection}>
                    <Text style={[styles.workoutSectionLabel, { color: colors.textMuted }]}>Exercises</Text>
                    <View style={styles.chipRow}>
                      {selectedWorkout.exercises.map(e => (
                        <View key={e} style={[styles.infoChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                          <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                          <Text style={[styles.infoChipText, { color: colors.text }]}>{e}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {selectedWorkout.note ? (
                  <View style={styles.workoutSection}>
                    <Text style={[styles.workoutSectionLabel, { color: colors.textMuted }]}>Notes</Text>
                    <Text style={[styles.workoutNoteText, { color: colors.textSub }]}>{selectedWorkout.note}</Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={[styles.noWorkoutText, { color: colors.textMuted }]}>No workout details logged</Text>
            )}
          </View>
        )}

        {/* Monthly muscle frequency */}
        {monthMuscleFreq.length > 0 && (
          <View style={[styles.freqCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.freqTitle, { color: colors.text }]}>Muscle Split This Month</Text>
            {monthMuscleFreq.map(([muscle, count]) => {
              const mg = MUSCLE_GROUPS.find(g => g.name === muscle);
              const maxCount = monthMuscleFreq[0][1];
              const pct = count / maxCount;
              return (
                <View key={muscle} style={styles.freqRow}>
                  <View style={styles.freqLabelWrap}>
                    <Ionicons name={(mg?.icon || 'fitness') as any} size={14} color={mg?.color || ACCENT} />
                    <Text style={[styles.freqLabel, { color: colors.text }]}>{muscle}</Text>
                  </View>
                  <View style={[styles.freqBarTrack, { backgroundColor: colors.surface }]}>
                    <View style={[styles.freqBarFill, { width: `${pct * 100}%`, backgroundColor: mg?.color || ACCENT }]} />
                  </View>
                  <Text style={[styles.freqCount, { color: mg?.color || ACCENT }]}>{count}</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* ───── Workout Detail Modal ───── */}
      <Modal visible={showWorkout} transparent animationType="slide" onRequestClose={() => setShowWorkout(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <Ionicons name="barbell" size={22} color={ACCENT} />
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  {workoutDate ? formatDate(workoutDate) : 'Workout'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowWorkout(false)}>
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 500 }}>
              {/* Muscle groups */}
              <Text style={[styles.sectionLabel, { color: colors.textSub }]}>Muscles Trained</Text>
              <View style={styles.muscleGrid}>
                {MUSCLE_GROUPS.map(mg => {
                  const selected = selMuscles.includes(mg.name);
                  return (
                    <TouchableOpacity
                      key={mg.name}
                      style={[
                        styles.muscleChip,
                        { backgroundColor: selected ? mg.color + '20' : colors.card, borderColor: selected ? mg.color : colors.border },
                      ]}
                      onPress={() => toggleMuscle(mg.name)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name={mg.icon as any} size={16} color={selected ? mg.color : colors.textMuted} />
                      <Text style={[styles.muscleChipText, { color: selected ? mg.color : colors.textSub }]}>{mg.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Exercises (shown when muscles selected) */}
              {suggestedExercises.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>Exercises</Text>
                  <View style={styles.exerciseGrid}>
                    {suggestedExercises.map(ex => {
                      const selected = selExercises.includes(ex);
                      return (
                        <TouchableOpacity
                          key={ex}
                          style={[
                            styles.exerciseChip,
                            { backgroundColor: selected ? ACCENT + '18' : colors.card, borderColor: selected ? ACCENT : colors.border },
                          ]}
                          onPress={() => toggleExercise(ex)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={14} color={selected ? ACCENT : colors.textMuted} />
                          <Text style={[styles.exerciseChipText, { color: selected ? ACCENT : colors.textSub }]}>{ex}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}

              {/* Custom exercise input */}
              <Text style={[styles.sectionLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>Custom Exercise</Text>
              <View style={styles.customRow}>
                <TextInput
                  style={[styles.customInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={customExercise}
                  onChangeText={setCustomExercise}
                  placeholder="Add custom exercise..."
                  placeholderTextColor={colors.textMuted}
                  onSubmitEditing={addCustomExercise}
                />
                <TouchableOpacity
                  style={[styles.customAddBtn, { backgroundColor: ACCENT, opacity: customExercise.trim() ? 1 : 0.4 }]}
                  onPress={addCustomExercise}
                  disabled={!customExercise.trim()}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>

              {/* Selected exercises summary */}
              {selExercises.length > 0 && (
                <View style={styles.selectedSummary}>
                  <Text style={[styles.selectedSummaryLabel, { color: colors.textMuted }]}>
                    {selExercises.length} exercise{selExercises.length > 1 ? 's' : ''} selected
                  </Text>
                  <View style={styles.chipRow}>
                    {selExercises.map(e => (
                      <TouchableOpacity
                        key={e}
                        style={[styles.selectedChip, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30' }]}
                        onPress={() => toggleExercise(e)}
                      >
                        <Text style={[styles.selectedChipText, { color: ACCENT }]}>{e}</Text>
                        <Ionicons name="close-circle" size={14} color={ACCENT} />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              <Text style={[styles.sectionLabel, { color: colors.textSub, marginTop: Spacing.lg }]}>Notes</Text>
              <TextInput
                style={[styles.noteInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={workoutNote}
                onChangeText={setWorkoutNote}
                placeholder="How was the workout?"
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            {/* Action buttons */}
            <View style={styles.modalActions}>
              {workouts[workoutDate] && (
                <TouchableOpacity style={[styles.clearBtn, { borderColor: '#DC262640' }]} onPress={clearWorkout}>
                  <Ionicons name="trash-outline" size={16} color="#DC2626" />
                  <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT, flex: 1 }]} onPress={saveWorkout}>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={styles.saveBtnText}>Save Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

/* ───── Styles ───── */
function makeStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: 100,
    },

    // Month Navigator
    monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    navButton: { padding: Spacing.xs },
    monthLabel: { fontFamily: Fonts.semibold, fontSize: 18, color: colors.text },

    // Stats Row
    statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    statTile: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radii.md, gap: 4 },
    statValue: { fontFamily: Fonts.bold, fontSize: 22 },
    statLabel: { fontFamily: Fonts.regular, fontSize: 11 },

    // Weekly Goal
    weeklyGoalRow: { borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, marginBottom: Spacing.md, gap: Spacing.xs },
    weeklyGoalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    weeklyGoalText: { flex: 1, fontFamily: Fonts.medium, fontSize: 13 },
    weeklyEditBtn: { width: 24, height: 24, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    weeklyBarTrack: { width: '100%', height: 8, borderRadius: 4, overflow: 'hidden' },
    weeklyBarFill: { height: '100%', borderRadius: 4 },

    // Calendar
    weekdayRow: { flexDirection: 'row', marginBottom: Spacing.xs },
    weekdayCell: { width: CELL_SIZE, alignItems: 'center', marginHorizontal: Spacing.xs / 2 },
    weekdayText: { fontFamily: Fonts.medium, fontSize: 11 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cellWrapper: { width: CELL_SIZE, height: CELL_SIZE, marginHorizontal: Spacing.xs / 2, marginVertical: Spacing.xs / 2, alignItems: 'center', justifyContent: 'center' },
    cell: { width: CELL_SIZE, height: CELL_SIZE, borderRadius: CELL_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
    cellGym: { backgroundColor: ACCENT },
    cellToday: { borderWidth: 2, borderColor: ACCENT },
    cellFuture: { opacity: 0.45 },
    cellText: { fontFamily: Fonts.medium, fontSize: 14 },
    cellTextGym: { color: '#FFFFFF', fontFamily: Fonts.semibold },
    cellTextToday: { color: ACCENT, fontFamily: Fonts.semibold },
    detailDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff', position: 'absolute', bottom: 6 },

    // Legend
    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.lg, marginTop: Spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
    legendDot: { width: 14, height: 14, borderRadius: 7 },
    legendDotGym: { backgroundColor: ACCENT },
    legendDotToday: { borderWidth: 2, borderColor: ACCENT, backgroundColor: 'transparent' },
    legendText: { fontFamily: Fonts.regular, fontSize: 12 },

    hintText: { textAlign: 'center', fontSize: 11, fontFamily: Fonts.regular, marginTop: Spacing.sm, marginBottom: Spacing.lg },

    // Workout info card
    workoutInfoCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    workoutInfoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
    workoutInfoTitle: { fontSize: 15, fontFamily: Fonts.bold, flex: 1 },
    editWorkoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill },
    editWorkoutText: { fontSize: 12, fontFamily: Fonts.semibold },
    workoutSection: { marginBottom: Spacing.md },
    workoutSectionLabel: { fontSize: 11, fontFamily: Fonts.semibold, marginBottom: 6 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    infoChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill, borderWidth: 1 },
    infoChipText: { fontSize: 12, fontFamily: Fonts.medium },
    workoutNoteText: { fontSize: 13, fontFamily: Fonts.regular, lineHeight: 18 },
    noWorkoutText: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.sm },

    // Monthly muscle frequency
    freqCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    freqTitle: { fontSize: 15, fontFamily: Fonts.bold, marginBottom: Spacing.md },
    freqRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    freqLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 100 },
    freqLabel: { fontSize: 12, fontFamily: Fonts.medium },
    freqBarTrack: { flex: 1, height: 8, borderRadius: 4, overflow: 'hidden' },
    freqBarFill: { height: '100%', borderRadius: 4 },
    freqCount: { fontSize: 13, fontFamily: Fonts.bold, width: 20, textAlign: 'right' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold },
    sectionLabel: { fontSize: 13, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },

    // Muscle chips
    muscleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    muscleChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.pill, borderWidth: 1.5 },
    muscleChipText: { fontSize: 13, fontFamily: Fonts.semibold },

    // Exercise chips
    exerciseGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    exerciseChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.md, borderWidth: 1 },
    exerciseChipText: { fontSize: 12, fontFamily: Fonts.medium },

    // Custom exercise
    customRow: { flexDirection: 'row', gap: Spacing.sm },
    customInput: { flex: 1, borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Platform.OS === 'ios' ? 10 : 8, fontSize: 14, fontFamily: Fonts.regular },
    customAddBtn: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },

    // Selected summary
    selectedSummary: { marginTop: Spacing.md },
    selectedSummaryLabel: { fontSize: 11, fontFamily: Fonts.medium, marginBottom: 6 },
    selectedChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill, borderWidth: 1 },
    selectedChipText: { fontSize: 12, fontFamily: Fonts.medium },

    // Notes input
    noteInput: { borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: 10, fontSize: 14, fontFamily: Fonts.regular, minHeight: 64, textAlignVertical: 'top' },

    // Modal actions
    modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
    clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: Spacing.lg, paddingVertical: 12, borderRadius: Radii.lg, borderWidth: 1 },
    clearBtnText: { color: '#DC2626', fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 14, borderRadius: Radii.lg },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: Fonts.semibold },
  });
}
