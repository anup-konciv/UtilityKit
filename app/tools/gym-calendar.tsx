import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
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

// ─── Helpers ────────────────────────────────────────────────────────────────

function toISODate(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, '0');
  const dd = String(d).padStart(2, '0');
  return `${y}-${mm}-${dd}`;
}

function todayISO(): string {
  const now = new Date();
  return toISODate(now.getFullYear(), now.getMonth(), now.getDate());
}

interface CalendarDay {
  day: number | null;
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: CalendarDay[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push({ day: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d });
  }
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

  // Start from today if logged, otherwise yesterday
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function GymCalendarScreen() {
  const { colors } = useAppTheme();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [gymDates, setGymDates] = useState<Set<string>>(new Set());
  const [weeklyGoal, setWeeklyGoal] = useState<number>(DEFAULT_WEEKLY_GOAL);

  // Load on mount
  useEffect(() => {
    (async () => {
      const stored = await loadJSON<string[]>(KEYS.gymLogs, []);
      setGymDates(new Set(stored));
      const storedGoal = await loadJSON<number>(KEYS.gymWeeklyGoal, DEFAULT_WEEKLY_GOAL);
      setWeeklyGoal(storedGoal);
    })();
  }, []);

  // Save on change (skip initial empty load)
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveJSON<string[]>(KEYS.gymLogs, Array.from(gymDates));
  }, [gymDates]);

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
  }, [year, month]);

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

  // Weekly goal progress (Mon-based week)
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

  // Styles dependent on theme
  const s = makeStyles(colors);

  return (
    <ScreenShell title="Gym Calendar" accentColor={ACCENT} scrollable={false}>
      <ScrollView
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Month Navigator */}
        <View style={s.monthNav}>
          <TouchableOpacity onPress={goToPrevMonth} style={s.navButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </TouchableOpacity>
          <Text style={s.monthLabel}>{MONTH_NAMES[month]} {year}</Text>
          <TouchableOpacity onPress={goToNextMonth} style={s.navButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={s.statsRow}>
          <View style={[s.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="barbell-outline" size={20} color={ACCENT} />
            <Text style={[s.statValue, { color: colors.text }]}>{thisMonthCount}</Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>This Month</Text>
          </View>
          <View style={[s.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="flame-outline" size={20} color={ACCENT} />
            <Text style={[s.statValue, { color: colors.text }]}>{currentStreak}</Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>Streak</Text>
          </View>
          <View style={[s.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="trophy-outline" size={20} color={ACCENT} />
            <Text style={[s.statValue, { color: colors.text }]}>{bestStreak}</Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>Best</Text>
          </View>
          <View style={[s.statTile, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={20} color={ACCENT} />
            <Text style={[s.statValue, { color: colors.text }]}>{gymDates.size}</Text>
            <Text style={[s.statLabel, { color: colors.textMuted }]}>Total</Text>
          </View>
        </View>

        {/* Weekly Goal */}
        <View style={[s.weeklyGoalRow, { backgroundColor: colors.card }]}>
          <View style={s.weeklyGoalHeader}>
            <Ionicons name="flag-outline" size={16} color={ACCENT} />
            <Text style={[s.weeklyGoalText, { color: colors.text }]}>
              Weekly Goal:{' '}
              <Text style={{ color: ACCENT, fontFamily: Fonts.bold }}>
                {currentWeekDays}/{weeklyGoal} days
              </Text>
            </Text>
            <TouchableOpacity
              onPress={cycleWeeklyGoal}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[s.weeklyEditBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Ionicons name="pencil" size={12} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={[s.weeklyBarTrack, { backgroundColor: colors.surface }]}>
            <View
              style={[
                s.weeklyBarFill,
                {
                  width: `${Math.max(weeklyProgress * 100, weeklyProgress > 0 ? 4 : 0)}%`,
                  backgroundColor: currentWeekDays >= weeklyGoal ? '#10B981' : ACCENT,
                },
              ]}
            />
          </View>
        </View>

        {/* Weekday Header */}
        <View style={s.weekdayRow}>
          {WEEKDAYS.map(wd => (
            <View key={wd} style={s.weekdayCell}>
              <Text style={[s.weekdayText, { color: colors.textMuted }]}>{wd}</Text>
            </View>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={s.grid}>
          {calendarDays.map((cell, idx) => {
            if (cell.day === null) {
              return <View key={`blank-${idx}`} style={s.cellWrapper} />;
            }
            const iso = toISODate(year, month, cell.day);
            const isToday = iso === today;
            const isGymDay = gymDates.has(iso);
            const isFuture = iso > today;

            return (
              <TouchableOpacity
                key={iso}
                style={s.cellWrapper}
                onPress={() => toggleDay(cell.day!)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    s.cell,
                    isGymDay && s.cellGym,
                    isToday && !isGymDay && s.cellToday,
                    isFuture && !isGymDay && s.cellFuture,
                  ]}
                >
                  <Text
                    style={[
                      s.cellText,
                      { color: colors.text },
                      isGymDay && s.cellTextGym,
                      isToday && !isGymDay && s.cellTextToday,
                      isFuture && !isGymDay && { color: colors.textMuted },
                    ]}
                  >
                    {cell.day}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Legend */}
        <View style={s.legendRow}>
          <View style={s.legendItem}>
            <View style={[s.legendDot, s.legendDotGym]} />
            <Text style={[s.legendText, { color: colors.textMuted }]}>Gym Day</Text>
          </View>
          <View style={s.legendItem}>
            <View style={[s.legendDot, s.legendDotToday]} />
            <Text style={[s.legendText, { color: colors.textMuted }]}>Today</Text>
          </View>
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

function makeStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    scrollContent: {
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
    },

    // Month Navigator
    monthNav: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    navButton: {
      padding: Spacing.xs,
    },
    monthLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 18,
      color: colors.text,
    },

    // Stats Row
    statsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    statTile: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: Spacing.sm,
      borderRadius: Radii.md,
      gap: 4,
    },
    statValue: {
      fontFamily: Fonts.bold,
      fontSize: 22,
    },
    statLabel: {
      fontFamily: Fonts.regular,
      fontSize: 11,
    },

    // Weekly Goal
    weeklyGoalRow: {
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.md,
      gap: Spacing.xs,
    },
    weeklyGoalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    weeklyGoalText: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: 13,
    },
    weeklyEditBtn: {
      width: 24,
      height: 24,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    weeklyBarTrack: {
      width: '100%',
      height: 8,
      borderRadius: 4,
      overflow: 'hidden',
    },
    weeklyBarFill: {
      height: '100%',
      borderRadius: 4,
    },

    // Weekday Header
    weekdayRow: {
      flexDirection: 'row',
      marginBottom: Spacing.xs,
    },
    weekdayCell: {
      width: CELL_SIZE,
      alignItems: 'center',
      marginHorizontal: Spacing.xs / 2,
    },
    weekdayText: {
      fontFamily: Fonts.medium,
      fontSize: 11,
    },

    // Calendar Grid
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cellWrapper: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      marginHorizontal: Spacing.xs / 2,
      marginVertical: Spacing.xs / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cell: {
      width: CELL_SIZE,
      height: CELL_SIZE,
      borderRadius: CELL_SIZE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cellGym: {
      backgroundColor: ACCENT,
    },
    cellToday: {
      borderWidth: 2,
      borderColor: ACCENT,
    },
    cellFuture: {
      opacity: 0.45,
    },
    cellText: {
      fontFamily: Fonts.medium,
      fontSize: 14,
    },
    cellTextGym: {
      color: '#FFFFFF',
      fontFamily: Fonts.semibold,
    },
    cellTextToday: {
      color: ACCENT,
      fontFamily: Fonts.semibold,
    },

    // Legend
    legendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.lg,
      marginTop: Spacing.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
    },
    legendDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
    legendDotGym: {
      backgroundColor: ACCENT,
    },
    legendDotToday: {
      borderWidth: 2,
      borderColor: ACCENT,
      backgroundColor: 'transparent',
    },
    legendText: {
      fontFamily: Fonts.regular,
      fontSize: 12,
    },
  });
}
