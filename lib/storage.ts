import AsyncStorage from '@react-native-async-storage/async-storage';

export const KEYS = {
  todos: 'uk_todos',
  markdownNote: 'uk_markdown_note',
  notes: 'uk_notes',
  weatherLocation: 'uk_weather_location',
  mdFiles: 'uk_md_files',
  birthdays: 'uk_birthdays',
  gymLogs: 'uk_gym_logs',
  waterLogs: 'uk_water_logs',
  waterGoal: 'uk_water_goal',
  customHolidays: 'uk_custom_holidays',
  expenses: 'uk_expenses',
  expenseBudget: 'uk_expense_budget',
  reminders: 'uk_reminders',
  toolOrder: 'uk_tool_order',
  favorites: 'uk_favorites',
  gymWeeklyGoal: 'uk_gym_weekly_goal',
  pomodoroSettings: 'uk_pomodoro_settings',
  pomodoroToday: 'uk_pomodoro_today',
  habits: 'uk_habits',
  habitLogs: 'uk_habit_logs',
  worldClocks: 'uk_world_clocks',
  flashcards: 'uk_flashcards',
  passwordHistory: 'uk_password_history',
  savedPasswords: 'uk_saved_passwords',
  currencyFavorites: 'uk_currency_favorites',
  expenseCurrency: 'uk_expense_currency',
  hapticsEnabled: 'uk_haptics_enabled',
  defaultUnits: 'uk_default_units',
  tallyCounters: 'uk_tally_counters',
  countdownEvents: 'uk_countdown_events',
  savingsGoals: 'uk_savings_goals',
  moodJournal: 'uk_mood_journal',
  calorieLog: 'uk_calorie_log',
  calorieGoal: 'uk_calorie_goal',
  sleepLog: 'uk_sleep_log',
  cookTracker: 'uk_cook_tracker',
  maidTracker: 'uk_maid_tracker',
  milkTracker: 'uk_milk_tracker',
  maintenanceTracker: 'uk_maintenance_tracker',
  waterCanTracker: 'uk_water_can_tracker',
  flowerTracker: 'uk_flower_tracker',
  driverTracker: 'uk_driver_tracker',
  newspaperTracker: 'uk_newspaper_tracker',
  officeBoyTracker: 'uk_office_boy_tracker',
  travelTracker: 'uk_travel_tracker',
  routines: 'uk_routines',
  routineLogs: 'uk_routine_logs',
  assignments: 'uk_assignments',
  babyCare: 'uk_baby_care',
  babyProfile: 'uk_baby_profile',
  houseBills: 'uk_house_bills',
  electricityBills: 'uk_electricity_bills',
} as const;

export async function loadJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
