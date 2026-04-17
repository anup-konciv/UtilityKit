import { TOOLS, type ToolMeta } from '@/constants/tools-meta';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';

export type Folder = {
  id: string;
  name: string;
  icon: string;
  accent: string;
  toolIds: string[];
};

export const VIRTUAL_FOLDER_IDS = {
  favorites: '__favorites',
  all: '__all',
} as const;

export function isVirtualFolder(id: string): boolean {
  return id === VIRTUAL_FOLDER_IDS.favorites || id === VIRTUAL_FOLDER_IDS.all;
}

export const DEFAULT_FOLDERS: Folder[] = [
  {
    id: 'money',
    name: 'Money & Bills',
    icon: 'wallet-outline',
    accent: '#10B981',
    toolIds: [
      'expense',
      'house-bill-tracker',
      'electricity-bill',
      'subscription-manager',
      'emi-calc',
      'investment',
      'savings-goal',
      'loan-book',
      'loan-comparison',
      'currency-converter',
      'fuel-cost',
      'unit-price',
      'tip-calc',
      'discount-calculator',
    ],
  },
  {
    id: 'health',
    name: 'Health & Body',
    icon: 'heart-outline',
    accent: '#EF4444',
    toolIds: [
      'water',
      'calorie-counter',
      'sleep-tracker',
      'gym',
      'mood-journal',
      'breathing',
      'bmi-calc',
      'period-tracker',
      'bp-log',
      'medication-tracker',
      'gratitude-journal',
      'step-counter',
    ],
  },
  {
    id: 'home',
    name: 'Home & Family',
    icon: 'home-outline',
    accent: '#F97316',
    toolIds: [
      'maid-tracker',
      'cook-tracker',
      'milk-tracker',
      'driver-tracker',
      'newspaper-tracker',
      'office-boy-tracker',
      'water-can-tracker',
      'flower-tracker',
      'maintenance-tracker',
      'baby-care',
      'pet-care',
      'plant-care',
      'birthday',
      'grocery-list',
    ],
  },
  {
    id: 'productivity',
    name: 'Productivity',
    icon: 'briefcase-outline',
    accent: '#6366F1',
    toolIds: [
      'todo',
      'reminder',
      'pomodoro',
      'routine-tracker',
      'habit-tracker',
      'meeting-planner',
      'kanban-board',
      'stopwatch',
      'world-clock',
      'event-countdown',
    ],
  },
  {
    id: 'notes-docs',
    name: 'Notes & Docs',
    icon: 'document-text-outline',
    accent: '#F59E0B',
    toolIds: [
      'notes',
      'markdown',
      'doc-vault',
      'document-expiry',
      'vehicle-service',
      'book-tracker',
      'wish-list',
      'recipe-book',
      'daily-quote',
      'parking-saver',
      'travel-tracker',
    ],
  },
  {
    id: 'tools',
    name: 'Tools & Convert',
    icon: 'construct-outline',
    accent: '#14B8A6',
    toolIds: [
      'basic-calc',
      'sci-calc',
      'percentage-calc',
      'matrix-calc',
      'unit-conv',
      'text-tools',
      'roman-numeral',
      'aspect-ratio',
      'morse-code',
      'qr-generator',
      'password',
      'compass',
      'ruler',
      'tally-counter',
      'date-calculator',
      'age-calc',
      'metronome',
    ],
  },
  {
    id: 'learn-live',
    name: 'Learn & Live',
    icon: 'school-outline',
    accent: '#A855F7',
    toolIds: [
      'flashcards',
      'assignment-tracker',
      'gpa-calc',
      'translate',
      'news-reader',
      'weather',
      'holiday',
      'wallpaper-browse',
    ],
  },
  {
    id: 'fun',
    name: 'Fun & Games',
    icon: 'game-controller-outline',
    accent: '#EC4899',
    toolIds: [
      'dice-coin',
      'random-picker',
      'tic-tac-toe',
      'memory-match',
      'game-2048',
      'snake-game',
      'word-scramble',
      'sudoku',
      'minesweeper',
      'quiz-trivia',
    ],
  },
  {
    id: 'dev',
    name: 'Dev & Design',
    icon: 'code-slash-outline',
    accent: '#0EA5E9',
    toolIds: ['json-formatter', 'base-converter', 'color-tools'],
  },
];

export async function loadFolders(): Promise<Folder[]> {
  const seeded = await loadJSON<boolean>(KEYS.foldersSeeded, false);
  if (!seeded) {
    await saveJSON(KEYS.folders, DEFAULT_FOLDERS);
    await saveJSON(KEYS.foldersSeeded, true);
    return DEFAULT_FOLDERS;
  }
  return loadJSON<Folder[]>(KEYS.folders, DEFAULT_FOLDERS);
}

export async function saveFolders(folders: Folder[]): Promise<void> {
  await saveJSON(KEYS.folders, folders);
}

export function resolveFolderTools(
  folder: Folder | { id: string; toolIds?: string[] },
  favorites: string[],
): ToolMeta[] {
  if (folder.id === VIRTUAL_FOLDER_IDS.favorites) {
    return favorites
      .map(id => TOOLS.find(t => t.id === id))
      .filter((t): t is ToolMeta => !!t);
  }
  if (folder.id === VIRTUAL_FOLDER_IDS.all) return TOOLS;
  const ids = folder.toolIds ?? [];
  return ids.map(id => TOOLS.find(t => t.id === id)).filter((t): t is ToolMeta => !!t);
}

export function getFolderById(folders: Folder[], id: string): Folder | null {
  if (id === VIRTUAL_FOLDER_IDS.favorites) {
    return { id, name: 'Favorites', icon: 'star', accent: '#F59E0B', toolIds: [] };
  }
  if (id === VIRTUAL_FOLDER_IDS.all) {
    return {
      id,
      name: 'All Tools',
      icon: 'apps-outline',
      accent: '#6366F1',
      toolIds: TOOLS.map(t => t.id),
    };
  }
  return folders.find(f => f.id === id) ?? null;
}
