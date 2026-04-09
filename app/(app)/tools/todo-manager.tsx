import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import DateField from '@/components/DateField';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { hexToRgb } from '@/lib/color-utils';
import { startOfDay } from '@/lib/date-utils';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';
import { haptics } from '@/lib/haptics';

type Priority = 'low' | 'medium' | 'high';
type Filter = 'all' | 'active' | 'done';
type SectionKey = 'overdue' | 'today' | 'upcoming' | 'later' | 'undated' | 'done';

type Todo = {
  id: string;
  text: string;
  done: boolean;
  priority: Priority;
  dueDate?: string;
  createdAt?: string;
};

type DecoratedTodo = Todo & {
  dueDateObject: Date | null;
  dueInDays: number | null;
  dueLabel: string;
  dueSubLabel: string;
  searchBlob: string;
  sectionKey: SectionKey;
  sortStamp: number;
  createdStamp: number;
};

type ListItem =
  | { type: 'header'; label: string }
  | { type: 'todo'; data: DecoratedTodo }
  | { type: 'empty'; title: string; message: string };

const ACCENT = '#F97360';
const ACCENT_DEEP = '#C2410C';
const ACCENT_SOFT = 'rgba(249, 115, 96, 0.08)';

const PRIORITY_META: Record<
  Priority,
  {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
    tone: string;
    bg: string;
  }
> = {
  high: {
    label: 'High',
    icon: 'flame-outline',
    color: '#FB7185',
    tone: '#9F1239',
    bg: 'rgba(251, 113, 133, 0.12)',
  },
  medium: {
    label: 'Medium',
    icon: 'flash-outline',
    color: '#F59E0B',
    tone: '#92400E',
    bg: 'rgba(245, 158, 11, 0.12)',
  },
  low: {
    label: 'Low',
    icon: 'leaf-outline',
    color: '#14B8A6',
    tone: '#0F766E',
    bg: 'rgba(20, 184, 166, 0.12)',
  },
};

const FILTER_META: Record<
  Filter,
  { label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  all: { label: 'All', icon: 'apps-outline' },
  active: { label: 'Active', icon: 'sparkles-outline' },
  done: { label: 'Done', icon: 'checkmark-done-outline' },
};

const PRIORITY_ORDER: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const SECTION_ORDER: Record<SectionKey, number> = {
  overdue: 0,
  today: 1,
  upcoming: 2,
  later: 3,
  undated: 4,
  done: 5,
};

const SECTION_LABELS: Record<SectionKey, string> = {
  overdue: 'Overdue',
  today: 'Due Today',
  upcoming: 'Next 7 Days',
  later: 'Later',
  undated: 'No Date',
  done: 'Completed',
};

function todayISO() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function addDaysISO(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

function parseISODate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return startOfDay(date);
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function dayDiff(from: Date, to: Date) {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function rgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function sanitizeDateInput(value: string) {
  return value.replace(/[^\d-]/g, '').slice(0, 10);
}

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export default function TodoManagerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const todayKey = todayISO();
  const today = useMemo(() => parseISODate(todayKey) ?? startOfDay(new Date()), [todayKey]);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadJSON<Todo[]>(KEYS.todos, []).then((saved) => {
      setTodos(Array.isArray(saved) ? saved : []);
    });
  }, []);

  function persist(next: Todo[]) {
    setTodos(next);
    saveJSON(KEYS.todos, next);
  }

  function addTodo() {
    const text = input.trim();
    const dueDate = dueDateInput.trim();

    if (!text) return;

    if (dueDate && !parseISODate(dueDate)) {
      Alert.alert('Validation', 'Enter a valid due date in YYYY-MM-DD format.');
      return;
    }

    persist([
      {
        id: generateId(),
        text,
        done: false,
        priority,
        dueDate: dueDate || undefined,
        createdAt: new Date().toISOString(),
      },
      ...todos,
    ]);
    setInput('');
    setDueDateInput('');
  }

  function toggleTodo(id: string) {
    const target = todos.find((t) => t.id === id);
    if (target?.done) {
      haptics.tap();
    } else {
      haptics.success();
    }
    persist(
      todos.map((todo) => (todo.id === id ? { ...todo, done: !todo.done } : todo)),
    );
  }

  function removeTodo(id: string) {
    haptics.warning();
    persist(todos.filter((todo) => todo.id !== id));
  }

  function clearCompleted() {
    haptics.warning();
    persist(todos.filter((todo) => !todo.done));
  }

  const decoratedTodos = useMemo(() => {
    return todos
      .map((todo) => {
        const dueDateObject = parseISODate(todo.dueDate);
        const dueInDays = dueDateObject ? dayDiff(today, dueDateObject) : null;

        let dueLabel = 'No deadline';
        let dueSubLabel = 'Add a due date to keep it anchored';
        let sectionKey: SectionKey = todo.done ? 'done' : 'undated';

        if (todo.done) {
          dueLabel = 'Completed';
          dueSubLabel = dueDateObject ? `Had deadline ${formatShortDate(dueDateObject)}` : 'Done and archived';
          sectionKey = 'done';
        } else if (dueDateObject && dueInDays != null) {
          dueSubLabel = formatLongDate(dueDateObject);

          if (dueInDays < 0) {
            sectionKey = 'overdue';
            dueLabel = `Overdue by ${Math.abs(dueInDays)} day${Math.abs(dueInDays) === 1 ? '' : 's'}`;
          } else if (dueInDays === 0) {
            sectionKey = 'today';
            dueLabel = 'Due today';
          } else if (dueInDays === 1) {
            sectionKey = 'upcoming';
            dueLabel = 'Due tomorrow';
          } else if (dueInDays <= 7) {
            sectionKey = 'upcoming';
            dueLabel = `Due in ${dueInDays} days`;
          } else {
            sectionKey = 'later';
            dueLabel = `Due in ${dueInDays} days`;
          }
        }

        const createdStamp = todo.createdAt ? Date.parse(todo.createdAt) : 0;

        return {
          ...todo,
          dueDateObject,
          dueInDays,
          dueLabel,
          dueSubLabel,
          sectionKey,
          sortStamp: dueDateObject ? dueDateObject.getTime() : Number.MAX_SAFE_INTEGER,
          searchBlob: `${todo.text} ${todo.priority} ${todo.dueDate ?? ''}`.toLowerCase(),
          createdStamp,
        };
      })
      .sort((a, b) => {
        if (SECTION_ORDER[a.sectionKey] !== SECTION_ORDER[b.sectionKey]) {
          return SECTION_ORDER[a.sectionKey] - SECTION_ORDER[b.sectionKey];
        }
        if (a.sortStamp !== b.sortStamp) {
          return a.sortStamp - b.sortStamp;
        }
        if (PRIORITY_ORDER[a.priority] !== PRIORITY_ORDER[b.priority]) {
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        }
        return b.createdStamp - a.createdStamp;
      });
  }, [todos, today]);

  const counts = useMemo(() => {
    const total = todos.length;
    const done = todos.filter((todo) => todo.done).length;
    const active = total - done;
    const dueToday = decoratedTodos.filter(
      (todo) => !todo.done && todo.sectionKey === 'today',
    ).length;
    const overdue = decoratedTodos.filter(
      (todo) => !todo.done && todo.sectionKey === 'overdue',
    ).length;

    return { total, active, done, dueToday, overdue };
  }, [decoratedTodos, todos]);

  const filterCounts = useMemo(
    () => ({
      all: counts.total,
      active: counts.active,
      done: counts.done,
    }),
    [counts.active, counts.done, counts.total],
  );

  const visibleTodos = useMemo(() => {
    const query = search.trim().toLowerCase();

    return decoratedTodos.filter((todo) => {
      const matchesFilter =
        filter === 'all' ? true : filter === 'active' ? !todo.done : todo.done;
      const matchesSearch = query.length === 0 || todo.searchBlob.includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [decoratedTodos, filter, search]);

  const listData = useMemo(() => {
    if (visibleTodos.length === 0) {
      return [
        {
          type: 'empty',
          title: todos.length === 0 ? 'Nothing planned yet' : 'No tasks in this view',
          message:
            todos.length === 0
              ? 'Capture your first task, pick a priority, and build a calmer day.'
              : search.trim()
                ? 'Try another search term or switch filters.'
                : 'Move to another filter to see more tasks.',
        } satisfies ListItem,
      ];
    }

    const grouped = new Map<SectionKey, DecoratedTodo[]>();
    visibleTodos.forEach((todo) => {
      const bucket = grouped.get(todo.sectionKey) ?? [];
      bucket.push(todo);
      grouped.set(todo.sectionKey, bucket);
    });

    const items: ListItem[] = [];
    (
      ['overdue', 'today', 'upcoming', 'later', 'undated', 'done'] as SectionKey[]
    ).forEach((sectionKey) => {
      const bucket = grouped.get(sectionKey);
      if (!bucket || bucket.length === 0) return;
      items.push({ type: 'header', label: SECTION_LABELS[sectionKey] });
      bucket.forEach((todo) => items.push({ type: 'todo', data: todo }));
    });

    return items;
  }, [search, todos.length, visibleTodos]);

  const progress = counts.total > 0 ? counts.done / counts.total : 0;
  const focusTask = decoratedTodos.find((todo) => !todo.done) ?? null;

  const heroTitle =
    counts.total === 0
      ? 'Bring some color to the work ahead'
      : counts.active === 0
        ? 'Everything is wrapped for now'
        : `${counts.active} active task${counts.active === 1 ? '' : 's'} in motion`;

  const heroSubtitle =
    counts.total === 0
      ? 'Plan the next step with warm color cues, quick priorities, and a calmer layout.'
      : counts.active === 0
        ? 'You cleared the board. Add the next priority when you are ready.'
        : focusTask?.sectionKey === 'overdue'
          ? `Top rescue: ${focusTask.text}`
          : focusTask
            ? `Next focus: ${focusTask.text}`
            : 'Keep the momentum going.';

  const quickDateChips = [
    { label: 'Today', value: todayKey },
    { label: 'Tomorrow', value: addDaysISO(1) },
    { label: 'Next 7 Days', value: addDaysISO(7) },
    { label: 'Clear', value: '' },
  ];

  const header = (
    <View style={styles.headerStack}>
      <LinearGradient
        colors={['#1C1917', '#C2410C', '#FB923C']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Color Focus Planner</Text>
        <Text style={styles.heroTitle}>{heroTitle}</Text>
        <Text style={styles.heroSubtitle}>{heroSubtitle}</Text>

        <View style={styles.heroStatsRow}>
          {[
            { label: 'Active', value: counts.active },
            { label: 'Due Today', value: counts.dueToday },
            { label: 'Done', value: counts.done },
          ].map((item) => (
            <View key={item.label} style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>{item.value}</Text>
              <Text style={styles.heroStatLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress * 100)}% complete
          </Text>
        </View>
      </LinearGradient>

      <View style={[styles.composerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.cardEyebrow, { color: colors.textMuted }]}>Add Next Task</Text>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Build your next move</Text>

        <TextInput
          style={[
            styles.taskInput,
            { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
          ]}
          value={input}
          onChangeText={setInput}
          placeholder="Capture the next thing to do"
          placeholderTextColor={colors.textMuted}
          multiline
          onSubmitEditing={addTodo}
          selectionColor={ACCENT}
        />

        <DateField
          value={dueDateInput}
          onChange={setDueDateInput}
          accent={ACCENT}
          placeholder="Optional due date"
        />

        <View style={styles.quickDateRow}>
          {quickDateChips.map((chip) => {
            const active = dueDateInput === chip.value && chip.value !== '';
            const isClear = chip.value === '';
            return (
              <TouchableOpacity
                key={chip.label}
                onPress={() => setDueDateInput(chip.value)}
                style={[
                  styles.quickDateChip,
                  active
                    ? { backgroundColor: ACCENT, borderColor: ACCENT }
                    : {
                        backgroundColor: isClear ? colors.surface : ACCENT_SOFT,
                        borderColor: isClear ? colors.border : rgba(ACCENT, 0.25),
                      },
                ]}
              >
                <Text
                  style={[
                    styles.quickDateChipText,
                    { color: active ? '#FFFFFF' : isClear ? colors.textMuted : ACCENT },
                  ]}
                >
                  {chip.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.priorityRow}>
          {(['high', 'medium', 'low'] as Priority[]).map((value) => {
            const meta = PRIORITY_META[value];
            const active = priority === value;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setPriority(value)}
                style={[
                  styles.priorityCard,
                  active
                    ? { backgroundColor: meta.bg, borderColor: meta.color }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.priorityIconWrap,
                    { backgroundColor: active ? rgba(meta.color, 0.16) : colors.inputBg },
                  ]}
                >
                  <Ionicons name={meta.icon} size={16} color={meta.tone} />
                </View>
                <Text style={[styles.priorityLabel, { color: active ? meta.tone : colors.text }]}>
                  {meta.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          onPress={addTodo}
          style={[
            styles.addButton,
            { backgroundColor: ACCENT, opacity: input.trim().length === 0 ? 0.5 : 1 },
          ]}
          disabled={input.trim().length === 0}
        >
          <Ionicons name="add-circle-outline" size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add task</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.controlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={search}
            onChangeText={setSearch}
            placeholder="Search tasks, priorities, or dates"
            placeholderTextColor={colors.textMuted}
            selectionColor={ACCENT}
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {(['all', 'active', 'done'] as Filter[]).map((value) => {
            const meta = FILTER_META[value];
            const active = filter === value;
            return (
              <TouchableOpacity
                key={value}
                onPress={() => setFilter(value)}
                style={[
                  styles.filterChip,
                  active
                    ? { backgroundColor: ACCENT_DEEP, borderColor: ACCENT_DEEP }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons
                  name={meta.icon}
                  size={14}
                  color={active ? '#FFFFFF' : colors.textMuted}
                />
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  {meta.label} {filterCounts[value]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.summaryRow}>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {counts.overdue > 0
              ? `${counts.overdue} overdue task${counts.overdue === 1 ? '' : 's'} need attention.`
              : `${visibleTodos.filter((todo) => !todo.done).length} active task${visibleTodos.filter((todo) => !todo.done).length === 1 ? '' : 's'} in this view.`}
          </Text>
          {counts.done > 0 ? (
            <TouchableOpacity onPress={clearCompleted}>
              <Text style={[styles.clearText, { color: ACCENT }]}>Clear done</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    </View>
  );

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>
            {item.label}
          </Text>
        </View>
      );
    }

    if (item.type === 'empty') {
      return (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: ACCENT_SOFT }]}>
            <Ionicons name="sparkles-outline" size={22} color={ACCENT} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{item.message}</Text>
        </View>
      );
    }

    const todo = item.data;
    const priorityMeta = PRIORITY_META[todo.priority];
    const isDone = todo.done;
    const overdue = todo.sectionKey === 'overdue';
    const dueToday = todo.sectionKey === 'today';

    const borderColor = isDone
      ? rgba(ACCENT_DEEP, 0.2)
      : overdue
        ? rgba(priorityMeta.color, 0.4)
        : dueToday
          ? rgba(ACCENT, 0.35)
          : rgba(priorityMeta.color, 0.26);

    const cardBackground = isDone
      ? colors.card
      : overdue
        ? rgba(priorityMeta.color, 0.08)
        : dueToday
          ? rgba(ACCENT, 0.08)
          : rgba(priorityMeta.color, 0.05);

    return (
      <View style={[styles.todoCard, { backgroundColor: cardBackground, borderColor }]}>
        <TouchableOpacity
          onPress={() => toggleTodo(todo.id)}
          style={[
            styles.checkbox,
            isDone
              ? { backgroundColor: ACCENT_DEEP, borderColor: ACCENT_DEEP }
              : { backgroundColor: colors.surface, borderColor: borderColor },
          ]}
        >
          {isDone ? <Ionicons name="checkmark" size={14} color="#FFFFFF" /> : null}
        </TouchableOpacity>

        <View style={styles.todoBody}>
          <Text
            style={[
              styles.todoText,
              { color: isDone ? colors.textMuted : colors.text },
              isDone ? styles.todoTextDone : null,
            ]}
          >
            {todo.text}
          </Text>

          <View style={styles.metaRow}>
            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor: isDone
                    ? rgba(ACCENT_DEEP, 0.12)
                    : overdue
                      ? rgba('#FB7185', 0.14)
                      : dueToday
                        ? rgba(ACCENT, 0.14)
                        : colors.surface,
                  borderColor: isDone
                    ? rgba(ACCENT_DEEP, 0.2)
                    : overdue
                      ? rgba('#FB7185', 0.22)
                      : dueToday
                        ? rgba(ACCENT, 0.22)
                        : colors.border,
                },
              ]}
            >
              <Ionicons
                name={
                  isDone
                    ? 'checkmark-done-outline'
                    : overdue
                      ? 'alert-circle-outline'
                      : 'calendar-outline'
                }
                size={13}
                color={
                  isDone
                    ? ACCENT_DEEP
                    : overdue
                      ? '#BE123C'
                      : dueToday
                        ? ACCENT
                        : colors.textMuted
                }
              />
              <Text
                style={[
                  styles.metaChipText,
                  {
                    color: isDone
                      ? ACCENT_DEEP
                      : overdue
                        ? '#BE123C'
                        : dueToday
                          ? ACCENT
                          : colors.textMuted,
                  },
                ]}
              >
                {todo.dueLabel}
              </Text>
            </View>

            <View
              style={[
                styles.metaChip,
                {
                  backgroundColor: priorityMeta.bg,
                  borderColor: rgba(priorityMeta.color, 0.18),
                },
              ]}
            >
              <Ionicons name={priorityMeta.icon} size={13} color={priorityMeta.tone} />
              <Text style={[styles.metaChipText, { color: priorityMeta.tone }]}>
                {priorityMeta.label}
              </Text>
            </View>
          </View>

          <Text style={[styles.todoSubtext, { color: colors.textMuted }]}>
            {todo.dueSubLabel}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => removeTodo(todo.id)}
          style={[styles.deleteButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScreenShell title="Todo Manager" accentColor={ACCENT} scrollable={false}>
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.type === 'todo' ? item.data.id : `${item.type}-${index}`
        }
        renderItem={renderItem}
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: Spacing.huge,
    },
    headerStack: {
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#FED7AA',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#FFEDD5',
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    heroStatCard: {
      flex: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      alignItems: 'center',
      gap: 2,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    heroStatValue: {
      fontSize: 24,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroStatLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: '#FFEDD5',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    progressWrap: {
      gap: 6,
    },
    progressTrack: {
      height: 7,
      borderRadius: Radii.pill,
      overflow: 'hidden',
      backgroundColor: 'rgba(255,255,255,0.16)',
    },
    progressFill: {
      height: '100%',
      borderRadius: Radii.pill,
      backgroundColor: '#FDE68A',
    },
    progressText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      color: '#F8FAFC',
    },
    composerCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    cardEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
    },
    cardTitle: {
      fontSize: 20,
      fontFamily: Fonts.bold,
      marginTop: -4,
    },
    taskInput: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 14,
      minHeight: 74,
      textAlignVertical: 'top',
      fontSize: 16,
      lineHeight: 22,
      fontFamily: Fonts.regular,
    },
    dateInputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      minHeight: 48,
    },
    dateInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.regular,
      paddingVertical: 10,
    },
    quickDateRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    quickDateChip: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    quickDateChipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    priorityRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    priorityCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      gap: 8,
    },
    priorityIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priorityLabel: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: Radii.lg,
      paddingVertical: 14,
    },
    addButtonText: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
      color: '#FFFFFF',
    },
    controlCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    searchBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      minHeight: 46,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.regular,
      paddingVertical: 10,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    filterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    filterChipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    summaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    summaryText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: Fonts.regular,
    },
    clearText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    sectionHeader: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    sectionHeaderText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    todoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 8,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 2,
    },
    todoBody: {
      flex: 1,
      gap: 8,
    },
    todoText: {
      fontSize: 15,
      lineHeight: 21,
      fontFamily: Fonts.semibold,
    },
    todoTextDone: {
      textDecorationLine: 'line-through',
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    metaChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
    },
    metaChipText: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
    },
    todoSubtext: {
      fontSize: 12,
      lineHeight: 17,
      fontFamily: Fonts.regular,
    },
    deleteButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    emptyIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },
  });
