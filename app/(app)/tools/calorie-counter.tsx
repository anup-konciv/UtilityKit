import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EF4444';

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

const MEAL_COLORS: Record<MealType, string> = {
  breakfast: '#F59E0B',
  lunch:     '#10B981',
  dinner:    '#6366F1',
  snacks:    '#EC4899',
};
const MEAL_ICONS: Record<MealType, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch:     'partly-sunny-outline',
  dinner:    'moon-outline',
  snacks:    'cafe-outline',
};
type FoodEntry = {
  id: string;
  name: string;
  calories: number;
  time: string;
  meal: MealType;
  protein?: number;
  carbs?: number;
  fat?: number;
};
type DayLog = { date: string; entries: FoodEntry[] };

type QuickFood = {
  name: string;
  cal: number;
  meals: MealType[];
  protein?: number;
  carbs?: number;
  fat?: number;
};

const QUICK_FOODS: QuickFood[] = [
  // General / anytime
  { name: 'Apple',          cal: 95,  meals: ['snacks', 'breakfast'],          protein: 0,  carbs: 25, fat: 0 },
  { name: 'Banana',         cal: 105, meals: ['snacks', 'breakfast'],          protein: 1,  carbs: 27, fat: 0 },
  { name: 'Egg',            cal: 78,  meals: ['breakfast', 'snacks'],          protein: 6,  carbs: 1,  fat: 5 },
  { name: 'Coffee',         cal: 2,   meals: ['breakfast', 'snacks'],          protein: 0,  carbs: 0,  fat: 0 },
  { name: 'Tea',            cal: 2,   meals: ['breakfast', 'snacks'],          protein: 0,  carbs: 0,  fat: 0 },
  { name: 'Milk (1 cup)',   cal: 149, meals: ['breakfast', 'snacks'],          protein: 8,  carbs: 12, fat: 8 },
  { name: 'Yogurt',         cal: 100, meals: ['breakfast', 'snacks'],          protein: 9,  carbs: 8,  fat: 4 },
  { name: 'Oatmeal',        cal: 150, meals: ['breakfast'],                    protein: 5,  carbs: 27, fat: 3 },
  { name: 'Bread (1 slice)',cal: 79,  meals: ['breakfast', 'snacks'],          protein: 3,  carbs: 15, fat: 1 },
  // Lunch / Dinner
  { name: 'Rice (1 cup)',   cal: 206, meals: ['lunch', 'dinner'],              protein: 4,  carbs: 45, fat: 0 },
  { name: 'Chicken Breast', cal: 165, meals: ['lunch', 'dinner'],              protein: 31, carbs: 0,  fat: 4 },
  { name: 'Pasta (1 cup)',  cal: 220, meals: ['lunch', 'dinner'],              protein: 8,  carbs: 43, fat: 1 },
  { name: 'Salad',          cal: 50,  meals: ['lunch', 'dinner', 'snacks'],    protein: 2,  carbs: 8,  fat: 1 },
  { name: 'Orange Juice',   cal: 112, meals: ['breakfast', 'snacks'],          protein: 2,  carbs: 26, fat: 0 },
  { name: 'Cheese (1 oz)',  cal: 113, meals: ['snacks', 'breakfast'],          protein: 7,  carbs: 0,  fat: 9 },
  // Indian foods
  { name: 'Roti',           cal: 120, meals: ['lunch', 'dinner', 'breakfast'], protein: 3,  carbs: 22, fat: 3 },
  { name: 'Dal (1 cup)',    cal: 180, meals: ['lunch', 'dinner'],              protein: 9,  carbs: 30, fat: 1 },
  { name: 'Paneer (100g)',  cal: 265, meals: ['lunch', 'dinner', 'snacks'],    protein: 18, carbs: 4,  fat: 20 },
  { name: 'Dosa',           cal: 168, meals: ['breakfast', 'lunch'],           protein: 4,  carbs: 30, fat: 4 },
  { name: 'Idli (2)',       cal: 78,  meals: ['breakfast', 'snacks'],          protein: 2,  carbs: 16, fat: 0 },
  { name: 'Biryani (1 cup)',cal: 290, meals: ['lunch', 'dinner'],              protein: 12, carbs: 40, fat: 9 },
  { name: 'Poha',           cal: 180, meals: ['breakfast', 'snacks'],          protein: 3,  carbs: 35, fat: 4 },
  { name: 'Upma',           cal: 200, meals: ['breakfast', 'snacks'],          protein: 4,  carbs: 36, fat: 5 },
  { name: 'Samosa',         cal: 262, meals: ['snacks'],                       protein: 4,  carbs: 30, fat: 14 },
  { name: 'Curd (1 cup)',   cal: 98,  meals: ['lunch', 'dinner', 'snacks'],    protein: 11, carbs: 7,  fat: 5 },
];

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function timeNow() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

// Circular progress ring component
function CircularProgress({ progress, calories, goal, over }: {
  progress: number; calories: number; goal: number; over: boolean;
}) {
  const { colors } = useAppTheme();
  const SIZE = 160;
  const STROKE = 12;
  const INNER = SIZE - STROKE * 2;
  const clampedP = Math.min(1, progress);
  const arcColor = over ? '#EF4444' : ACCENT;
  const trackColor = over ? '#EF444420' : ACCENT + '20';

  // Build 4 quarter arcs using View borders to simulate a ring fill
  // We split the ring into segments: use 4 quarter-circle views clipped.
  // Simple approach: rotate a border view
  const deg = clampedP * 360;
  const firstHalf = Math.min(deg, 180);
  const secondHalf = Math.max(0, deg - 180);

  return (
    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
      {/* Track ring */}
      <View style={{
        position: 'absolute', width: SIZE, height: SIZE,
        borderRadius: SIZE / 2, borderWidth: STROKE,
        borderColor: trackColor,
      }} />
      {/* Progress — left half */}
      <View style={{
        position: 'absolute', width: SIZE, height: SIZE,
        overflow: 'hidden',
      }}>
        <View style={{
          position: 'absolute', left: SIZE / 2, width: SIZE / 2, height: SIZE,
          overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', left: -(SIZE / 2),
            width: SIZE, height: SIZE,
            borderRadius: SIZE / 2, borderWidth: STROKE,
            borderColor: firstHalf > 0 ? arcColor : 'transparent',
            transform: [{ rotate: `${firstHalf - 180}deg` }],
          }} />
        </View>
      </View>
      {/* Progress — right half (only when > 180deg) */}
      {secondHalf > 0 && (
        <View style={{
          position: 'absolute', width: SIZE, height: SIZE,
          overflow: 'hidden',
        }}>
          <View style={{
            position: 'absolute', right: SIZE / 2, width: SIZE / 2, height: SIZE,
            overflow: 'hidden',
          }}>
            <View style={{
              position: 'absolute', right: -(SIZE / 2),
              width: SIZE, height: SIZE,
              borderRadius: SIZE / 2, borderWidth: STROKE,
              borderColor: arcColor,
              transform: [{ rotate: `${secondHalf}deg` }],
            }} />
          </View>
        </View>
      )}
      {/* Inner content */}
      <View style={{
        width: INNER, height: INNER, borderRadius: INNER / 2,
        alignItems: 'center', justifyContent: 'center',
      }}>
        <Text style={{ fontSize: 36, fontFamily: Fonts.bold, color: arcColor }}>{calories}</Text>
        <Text style={{ fontSize: 11, fontFamily: Fonts.medium, color: colors.textMuted }}>kcal eaten</Text>
        <Text style={{ fontSize: 12, fontFamily: Fonts.semibold, color: over ? '#EF4444' : '#10B981', marginTop: 2 }}>
          {over ? `+${calories - goal} over` : `${goal - calories} left`}
        </Text>
      </View>
    </View>
  );
}

export default function CalorieCounterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [logs, setLogs] = useState<DayLog[]>([]);
  const [goal, setGoal] = useState(2000);
  const [showAdd, setShowAdd] = useState(false);
  const [showGoal, setShowGoal] = useState(false);

  // Add modal fields
  const [selectedMeal, setSelectedMeal] = useState<MealType>('breakfast');
  const [foodName, setFoodName] = useState('');
  const [foodCal, setFoodCal] = useState('');
  const [foodProtein, setFoodProtein] = useState('');
  const [foodCarbs, setFoodCarbs] = useState('');
  const [foodFat, setFoodFat] = useState('');
  const [goalInput, setGoalInput] = useState('2000');

  useEffect(() => {
    Promise.all([
      loadJSON<DayLog[]>(KEYS.calorieLog, []),
      loadJSON<number>(KEYS.calorieGoal, 2000),
    ]).then(([l, g]) => {
      // Migrate old entries that may lack `meal`
      const migrated = l.map(day => ({
        ...day,
        entries: day.entries.map(e => ({ ...e, meal: e.meal ?? ('snacks' as MealType) })),
      }));
      setLogs(migrated);
      setGoal(g);
      setGoalInput(String(g));
    });
  }, []);

  const persist = useCallback((l: DayLog[]) => {
    setLogs(l);
    saveJSON(KEYS.calorieLog, l);
  }, []);

  const today = todayISO();
  const todayLog = logs.find(l => l.date === today);
  const todayEntries = todayLog?.entries || [];
  const totalCal = todayEntries.reduce((s, e) => s + e.calories, 0);
  const progress = totalCal / goal;
  const over = totalCal > goal;

  // Macro totals
  const macros = useMemo(() => todayEntries.reduce(
    (acc, e) => ({
      protein: acc.protein + (e.protein || 0),
      carbs:   acc.carbs   + (e.carbs   || 0),
      fat:     acc.fat     + (e.fat     || 0),
    }),
    { protein: 0, carbs: 0, fat: 0 }
  ), [todayEntries]);
  const hasMacros = macros.protein + macros.carbs + macros.fat > 0;

  // Entries grouped by meal
  const entriesByMeal = useMemo(() => {
    const map: Record<MealType, FoodEntry[]> = { breakfast: [], lunch: [], dinner: [], snacks: [] };
    todayEntries.forEach(e => { map[e.meal].push(e); });
    return map;
  }, [todayEntries]);

  // Quick foods filtered by meal
  const filteredQuick = useMemo(
    () => QUICK_FOODS.filter(f => f.meals.includes(selectedMeal)),
    [selectedMeal]
  );

  const openAdd = () => {
    // Auto-select meal based on time
    const h = new Date().getHours();
    if (h < 11)      setSelectedMeal('breakfast');
    else if (h < 15) setSelectedMeal('lunch');
    else if (h < 20) setSelectedMeal('dinner');
    else             setSelectedMeal('snacks');
    setFoodName(''); setFoodCal('');
    setFoodProtein(''); setFoodCarbs(''); setFoodFat('');
    setShowAdd(true);
  };

  const addFood = (
    name: string, cal: number, meal: MealType,
    protein?: number, carbs?: number, fat?: number
  ) => {
    const entry: FoodEntry = {
      id: uid(), name, calories: cal, time: timeNow(), meal,
      ...(protein !== undefined ? { protein } : {}),
      ...(carbs   !== undefined ? { carbs   } : {}),
      ...(fat     !== undefined ? { fat     } : {}),
    };
    const updated = logs.map(l =>
      l.date === today ? { ...l, entries: [...l.entries, entry] } : l
    );
    if (!todayLog) updated.unshift({ date: today, entries: [entry] });
    persist(updated);
    setFoodName(''); setFoodCal('');
    setFoodProtein(''); setFoodCarbs(''); setFoodFat('');
    setShowAdd(false);
  };

  const addQuick = (f: QuickFood) => {
    addFood(f.name, f.cal, selectedMeal, f.protein, f.carbs, f.fat);
  };

  const removeEntry = (id: string) => {
    persist(logs.map(l =>
      l.date === today ? { ...l, entries: l.entries.filter(e => e.id !== id) } : l
    ));
  };

  const saveGoal = () => {
    const g = parseInt(goalInput);
    if (g && g > 0) { setGoal(g); saveJSON(KEYS.calorieGoal, g); }
    setShowGoal(false);
  };

  // 7-day data
  const weekData = useMemo(() => {
    const data: { date: string; total: number; label: string }[] = [];
    const d = new Date();
    const days = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      const iso = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, '0')}-${String(dd.getDate()).padStart(2, '0')}`;
      const log = logs.find(l => l.date === iso);
      const total = log?.entries.reduce((s, e) => s + e.calories, 0) || 0;
      data.push({ date: iso, total, label: i === 0 ? 'Today' : days[dd.getDay()] });
    }
    return data;
  }, [logs]);

  const maxWeek = Math.max(goal, ...weekData.map(d => d.total));

  // Weekly stats
  const weekStats = useMemo(() => {
    const activeDays = weekData.filter(d => d.total > 0);
    const totalWeek = activeDays.reduce((s, d) => s + d.total, 0);
    const avgCal = activeDays.length > 0 ? Math.round(totalWeek / activeDays.length) : 0;
    const daysMetGoal = weekData.filter(d => d.total > 0 && d.total <= goal).length;
    const bestDay = activeDays.length > 0
      ? activeDays.reduce((best, d) => d.total < best.total ? d : best)
      : null;
    return { avgCal, daysMetGoal, totalWeek, bestDay };
  }, [weekData, goal]);

  const showWeekStats = weekData.some(d => d.total > 0);

  return (
    <ScreenShell title="Calorie Counter" accentColor={ACCENT}>
      {/* Today Summary with circular progress */}
      <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity
          style={styles.goalBtn}
          onPress={() => { setGoalInput(String(goal)); setShowGoal(true); }}
        >
          <Ionicons name="settings-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <Text style={[styles.dateText, { color: colors.textMuted }]}>Today</Text>

        <CircularProgress progress={progress} calories={totalCal} goal={goal} over={over} />

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.text }]}>{goal}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Goal</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.text }]}>{todayEntries.length}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Items</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.stat}>
            <Text style={[styles.statVal, { color: colors.text }]}>
              {MEALS.filter(m => entriesByMeal[m].length > 0).length}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Meals</Text>
          </View>
        </View>

        {/* Macro summary */}
        {hasMacros && (
          <View style={[styles.macroRow, { borderTopColor: colors.border }]}>
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: '#3B82F6' }]}>{macros.protein}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textMuted }]}>Protein</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: '#F59E0B' }]}>{macros.carbs}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textMuted }]}>Carbs</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.macroItem}>
              <Text style={[styles.macroVal, { color: '#EC4899' }]}>{macros.fat}g</Text>
              <Text style={[styles.macroLabel, { color: colors.textMuted }]}>Fat</Text>
            </View>
          </View>
        )}
      </View>

      {/* Quick Add with meal filter */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Quick Add</Text>

        {/* Meal picker pills */}
        <View style={styles.mealPills}>
          {MEALS.map(m => {
            const active = selectedMeal === m;
            const mc = MEAL_COLORS[m];
            return (
              <TouchableOpacity
                key={m}
                style={[
                  styles.mealPill,
                  {
                    backgroundColor: active ? mc : mc + '18',
                    borderColor: active ? mc : mc + '40',
                  },
                ]}
                onPress={() => setSelectedMeal(m)}
              >
                <Ionicons name={MEAL_ICONS[m]} size={12} color={active ? '#fff' : mc} />
                <Text style={[styles.mealPillText, { color: active ? '#fff' : mc }]}>{cap(m)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.quickGrid}>
          {filteredQuick.map(f => (
            <TouchableOpacity
              key={f.name}
              style={[styles.quickBtn, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30' }]}
              onPress={() => addQuick(f)}
            >
              <Text style={[styles.quickName, { color: colors.text }]}>{f.name}</Text>
              <Text style={[styles.quickCal, { color: ACCENT }]}>{f.cal}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.customBtn, { backgroundColor: ACCENT }]}
          onPress={openAdd}
        >
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.customBtnText}>Custom Entry</Text>
        </TouchableOpacity>
      </View>

      {/* 7-Day Chart */}
      {showWeekStats && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>This Week</Text>
          <View style={styles.chart}>
            {weekData.map(d => {
              const h = maxWeek > 0 ? (d.total / maxWeek) * 80 : 0;
              const overG = d.total > goal;
              const isToday = d.date === today;
              return (
                <View key={d.date} style={styles.barWrap}>
                  <Text style={[styles.barVal, { color: colors.textMuted }]}>
                    {d.total > 0 ? d.total : ''}
                  </Text>
                  <View style={[
                    styles.bar,
                    {
                      height: Math.max(4, h),
                      backgroundColor: overG ? '#EF4444' : isToday ? ACCENT : ACCENT + '80',
                    },
                  ]} />
                  <Text style={[
                    styles.barLabel,
                    { color: isToday ? ACCENT : colors.textMuted, fontFamily: isToday ? Fonts.bold : Fonts.medium },
                  ]}>
                    {d.label}
                  </Text>
                </View>
              );
            })}
          </View>
          <View style={[styles.goalLine, { borderColor: ACCENT + '40' }]}>
            <Text style={[styles.goalLineText, { color: ACCENT }]}>Goal: {goal}</Text>
          </View>

          {/* Weekly stats */}
          <View style={[styles.weekStatsGrid, { borderTopColor: colors.border }]}>
            <View style={styles.weekStat}>
              <Text style={[styles.weekStatVal, { color: colors.text }]}>{weekStats.avgCal}</Text>
              <Text style={[styles.weekStatLabel, { color: colors.textMuted }]}>Avg / day</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.weekStat}>
              <Text style={[styles.weekStatVal, { color: '#10B981' }]}>{weekStats.daysMetGoal}/7</Text>
              <Text style={[styles.weekStatLabel, { color: colors.textMuted }]}>Goal met</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.weekStat}>
              <Text style={[styles.weekStatVal, { color: colors.text }]}>{weekStats.totalWeek}</Text>
              <Text style={[styles.weekStatLabel, { color: colors.textMuted }]}>Total kcal</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.weekStat}>
              <Text style={[styles.weekStatVal, { color: '#F59E0B' }]}>
                {weekStats.bestDay ? weekStats.bestDay.total : '-'}
              </Text>
              <Text style={[styles.weekStatLabel, { color: colors.textMuted }]}>Best day</Text>
            </View>
          </View>
        </View>
      )}

      {/* Today's log grouped by meal */}
      {todayEntries.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>Today's Log</Text>
          {MEALS.map(meal => {
            const entries = entriesByMeal[meal];
            if (entries.length === 0) return null;
            const mealTotal = entries.reduce((s, e) => s + e.calories, 0);
            const mc = MEAL_COLORS[meal];
            return (
              <View key={meal} style={styles.mealGroup}>
                {/* Meal section header */}
                <View style={[styles.mealHeader, { backgroundColor: mc + '15' }]}>
                  <Ionicons name={MEAL_ICONS[meal]} size={13} color={mc} />
                  <Text style={[styles.mealHeaderText, { color: mc }]}>{cap(meal)}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={[styles.mealHeaderCal, { color: mc }]}>{mealTotal} kcal</Text>
                </View>
                {entries.map(entry => (
                  <View key={entry.id} style={[styles.entryRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.entryName, { color: colors.text }]}>{entry.name}</Text>
                      <Text style={[styles.entryTime, { color: colors.textMuted }]}>
                        {entry.time}
                        {(entry.protein || entry.carbs || entry.fat)
                          ? `  •  P:${entry.protein || 0}g  C:${entry.carbs || 0}g  F:${entry.fat || 0}g`
                          : ''}
                      </Text>
                    </View>
                    <Text style={[styles.entryCal, { color: ACCENT }]}>{entry.calories} kcal</Text>
                    <TouchableOpacity onPress={() => removeEntry(entry.id)}>
                      <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {/* Custom Add Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Food</Text>

            {/* Meal picker */}
            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Meal</Text>
            <View style={[styles.mealPills, { marginBottom: Spacing.md }]}>
              {MEALS.map(m => {
                const active = selectedMeal === m;
                const mc = MEAL_COLORS[m];
                return (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.mealPill,
                      {
                        backgroundColor: active ? mc : mc + '18',
                        borderColor: active ? mc : mc + '40',
                      },
                    ]}
                    onPress={() => setSelectedMeal(m)}
                  >
                    <Ionicons name={MEAL_ICONS[m]} size={12} color={active ? '#fff' : mc} />
                    <Text style={[styles.mealPillText, { color: active ? '#fff' : mc }]}>{cap(m)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={foodName} onChangeText={setFoodName}
              placeholder="Food name" placeholderTextColor={colors.textMuted} autoFocus
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={foodCal} onChangeText={setFoodCal}
              placeholder="Calories (kcal) *" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>
              Macros (optional)
            </Text>
            <View style={styles.macroInputRow}>
              <TextInput
                style={[styles.macroInput, { backgroundColor: colors.inputBg, borderColor: '#3B82F640', color: colors.text }]}
                value={foodProtein} onChangeText={setFoodProtein}
                placeholder="Protein g" placeholderTextColor={colors.textMuted} keyboardType="numeric"
              />
              <TextInput
                style={[styles.macroInput, { backgroundColor: colors.inputBg, borderColor: '#F59E0B40', color: colors.text }]}
                value={foodCarbs} onChangeText={setFoodCarbs}
                placeholder="Carbs g" placeholderTextColor={colors.textMuted} keyboardType="numeric"
              />
              <TextInput
                style={[styles.macroInput, { backgroundColor: colors.inputBg, borderColor: '#EC4899' + '40', color: colors.text }]}
                value={foodFat} onChangeText={setFoodFat}
                placeholder="Fat g" placeholderTextColor={colors.textMuted} keyboardType="numeric"
              />
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowAdd(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: ACCENT }]}
                onPress={() => {
                  const cal = parseInt(foodCal);
                  if (foodName.trim() && cal > 0) {
                    const p = foodProtein ? parseInt(foodProtein) : undefined;
                    const c = foodCarbs   ? parseInt(foodCarbs)   : undefined;
                    const f = foodFat     ? parseInt(foodFat)     : undefined;
                    addFood(foodName.trim(), cal, selectedMeal, p, c, f);
                  }
                }}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Goal Modal */}
      <Modal visible={showGoal} transparent animationType="fade" onRequestClose={() => setShowGoal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Daily Calorie Goal</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={goalInput} onChangeText={setGoalInput}
              keyboardType="numeric" autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.surface }]}
                onPress={() => setShowGoal(false)}
              >
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveGoal}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    summaryCard: {
      borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xl,
      alignItems: 'center', marginBottom: Spacing.lg, position: 'relative',
    },
    goalBtn: { position: 'absolute', top: Spacing.md, right: Spacing.md },
    dateText: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: Spacing.md },
    statsRow: {
      flexDirection: 'row', alignItems: 'center', gap: 0,
      marginTop: Spacing.lg, width: '100%', justifyContent: 'center',
    },
    stat: { alignItems: 'center', flex: 1 },
    statVal: { fontSize: 20, fontFamily: Fonts.bold },
    statLabel: { fontSize: 11, fontFamily: Fonts.medium },
    statDivider: { width: 1, height: 32 },
    macroRow: {
      flexDirection: 'row', alignItems: 'center', marginTop: Spacing.lg,
      paddingTop: Spacing.md, borderTopWidth: 1, width: '100%', justifyContent: 'center',
    },
    macroItem: { alignItems: 'center', flex: 1 },
    macroVal: { fontSize: 16, fontFamily: Fonts.bold },
    macroLabel: { fontSize: 10, fontFamily: Fonts.medium },
    section: {
      borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted,
      textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md,
    },
    mealPills: { flexDirection: 'row', gap: 6, marginBottom: Spacing.md, flexWrap: 'wrap' },
    mealPill: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingHorizontal: 10, paddingVertical: 6,
      borderRadius: Radii.pill, borderWidth: 1,
    },
    mealPillText: { fontSize: 11, fontFamily: Fonts.bold },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.md },
    quickBtn: {
      paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.md,
      borderWidth: 1, flexDirection: 'row', gap: 4, alignItems: 'center',
    },
    quickName: { fontSize: 11, fontFamily: Fonts.medium },
    quickCal: { fontSize: 11, fontFamily: Fonts.bold },
    customBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 12, borderRadius: Radii.md,
    },
    customBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    chart: {
      flexDirection: 'row', justifyContent: 'space-around',
      alignItems: 'flex-end', height: 110, marginBottom: Spacing.sm,
    },
    barWrap: { alignItems: 'center', gap: 2, flex: 1 },
    barVal: { fontSize: 9, fontFamily: Fonts.medium },
    bar: { width: 20, borderRadius: 4 },
    barLabel: { fontSize: 10 },
    goalLine: { borderTopWidth: 1, borderStyle: 'dashed', paddingTop: 4, marginBottom: Spacing.md },
    goalLineText: { fontSize: 10, fontFamily: Fonts.medium, textAlign: 'right' },
    weekStatsGrid: {
      flexDirection: 'row', alignItems: 'center',
      borderTopWidth: 1, paddingTop: Spacing.md,
    },
    weekStat: { alignItems: 'center', flex: 1 },
    weekStatVal: { fontSize: 15, fontFamily: Fonts.bold },
    weekStatLabel: { fontSize: 9, fontFamily: Fonts.medium, textAlign: 'center' },
    mealGroup: { marginBottom: Spacing.sm },
    mealHeader: {
      flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: Spacing.sm, paddingVertical: 5,
      borderRadius: Radii.sm, marginBottom: 2,
    },
    mealHeaderText: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    mealHeaderCal: { fontSize: 11, fontFamily: Fonts.bold },
    entryRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      paddingVertical: 10, borderBottomWidth: 0.5, paddingLeft: Spacing.sm,
    },
    entryName: { fontSize: 14, fontFamily: Fonts.semibold },
    entryTime: { fontSize: 11, fontFamily: Fonts.regular },
    entryCal: { fontSize: 14, fontFamily: Fonts.bold, marginRight: 8 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
    modalInput: {
      borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md,
      fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md,
    },
    macroInputRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    macroInput: {
      flex: 1, borderWidth: 1.5, borderRadius: Radii.md,
      padding: Spacing.sm, fontSize: 12, fontFamily: Fonts.regular,
      textAlign: 'center',
    },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
