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
