import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

type Priority = 'low' | 'medium' | 'high';
type Todo = { id: string; text: string; done: boolean; priority: Priority; dueDate?: string };
type Filter = 'all' | 'active' | 'done';

const PRI_COLORS: Record<Priority, { bg: string; text: string }> = {
  high: { bg: '#fee2e2', text: '#ef4444' },
  medium: { bg: '#fef3c7', text: '#f59e0b' },
  low: { bg: '#dcfce7', text: '#22c55e' },
};

const PRI_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export default function TodoManagerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadJSON<Todo[]>(KEYS.todos, []).then(setTodos);
  }, []);

  const persist = (updated: Todo[]) => {
    setTodos(updated);
    saveJSON(KEYS.todos, updated);
  };

  const add = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateInput.trim()) ? dueDateInput.trim() : undefined;
    persist([{ id: Date.now().toString(36), text, done: false, priority, dueDate }, ...todos]);
    setInput('');
    setDueDateInput('');
  }, [input, dueDateInput, priority, todos]);

  const toggle = (id: string) => persist(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const remove = (id: string) => persist(todos.filter(t => t.id !== id));
  const clearDone = () => persist(todos.filter(t => !t.done));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todos
      .filter(t => filter === 'all' ? true : filter === 'done' ? t.done : !t.done)
      .filter(t => !q || t.text.toLowerCase().includes(q))
      .sort((a, b) => PRI_ORDER[a.priority] - PRI_ORDER[b.priority]);
  }, [todos, filter, search]);

  const doneCount = todos.filter(t => t.done).length;
  const progress = todos.length > 0 ? doneCount / todos.length : 0;

  const isOverdue = (todo: Todo) =>
    !!todo.dueDate && !todo.done && todo.dueDate < todayStr();

  return (
    <ScreenShell title="Todo Manager" accentColor="#8B5CF6" scrollable={false}>
      {/* Input */}
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TextInput
          style={[styles.textInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={input}
          onChangeText={setInput}
          placeholder="Add a new task…"
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={add}
          returnKeyType="done"
        />
        <View style={styles.dueDateRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.dueDateInput, { color: colors.text }]}
            value={dueDateInput}
            onChangeText={setDueDateInput}
            placeholder="Due date (YYYY-MM-DD)"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            onSubmitEditing={add}
          />
        </View>
        <View style={styles.inputRow}>
          {/* Priority selector */}
          <View style={styles.priRow}>
            {(['low', 'medium', 'high'] as Priority[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.priBtn, priority === p && { backgroundColor: PRI_COLORS[p].bg, borderColor: PRI_COLORS[p].text }]}
                onPress={() => setPriority(p)}
              >
                <Text style={[styles.priBtnText, { color: priority === p ? PRI_COLORS[p].text : colors.textMuted }]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#8B5CF6' }]} onPress={add}>
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search tasks..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterRow}>
        {(['all', 'active', 'done'] as Filter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? '#fff' : colors.textMuted }]}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
        <View style={{ flex: 1 }} />
        {doneCount > 0 && (
          <TouchableOpacity onPress={clearDone}>
            <Text style={[styles.clearText, { color: colors.error }]}>Clear done</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {todos.length ? 'No tasks match this filter.' : 'Add your first task above!'}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={[styles.todoItem, item.done && styles.todoDone, { backgroundColor: colors.card, borderColor: item.done ? colors.border : '#8B5CF640' }]}>
            <TouchableOpacity
              style={[styles.checkbox, item.done && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }]}
              onPress={() => toggle(item.id)}
            >
              {item.done && <Ionicons name="checkmark" size={14} color="#fff" />}
            </TouchableOpacity>
            <View style={styles.todoContent}>
              <Text style={[styles.todoText, { color: item.done ? colors.textMuted : colors.text }, item.done && styles.strikeThrough]} numberOfLines={2}>
                {item.text}
              </Text>
              {item.dueDate && (
                <Text style={[styles.dueDateLabel, { color: isOverdue(item) ? colors.error : colors.textMuted }]}>
                  {item.dueDate}
                </Text>
              )}
            </View>
            <View style={[styles.priBadge, { backgroundColor: PRI_COLORS[item.priority].bg }]}>
              <Text style={[styles.priBadgeText, { color: PRI_COLORS[item.priority].text }]}>{item.priority}</Text>
            </View>
            <TouchableOpacity onPress={() => remove(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}
      />

      {/* Stats + Progress */}
      {todos.length > 0 && (
        <View style={[styles.statsBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.statsText, { color: colors.textMuted }]}>{doneCount}/{todos.length} completed</Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    inputCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginHorizontal: Spacing.lg, marginTop: Spacing.xs, marginBottom: Spacing.sm },
    textInput: { borderWidth: 1.5, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.sm },
    dueDateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
    dueDateInput: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, padding: 0 },
    inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    priRow: { flexDirection: 'row', gap: 6 },
    priBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: c.border },
    priBtnText: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'capitalize' },
    addBtn: { width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    searchRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radii.lg, paddingHorizontal: Spacing.md, height: 38 },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, padding: 0 },
    filterRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    filterBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: c.border },
    filterText: { fontSize: 12, fontFamily: Fonts.semibold },
    clearText: { fontSize: 12, fontFamily: Fonts.medium },
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
    todoItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1.5, marginBottom: Spacing.sm },
    todoDone: { opacity: 0.6 },
    checkbox: { width: 22, height: 22, borderRadius: 7, borderWidth: 2, borderColor: c.border, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg },
    todoContent: { flex: 1 },
    todoText: { fontSize: 14, fontFamily: Fonts.regular },
    dueDateLabel: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
    strikeThrough: { textDecorationLine: 'line-through' },
    priBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.pill },
    priBadgeText: { fontSize: 9, fontFamily: Fonts.bold, textTransform: 'uppercase' },
    empty: { paddingTop: 40, alignItems: 'center' },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular },
    statsBar: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.lg, borderTopWidth: 1, alignItems: 'center', gap: 6 },
    statsText: { fontSize: 12, fontFamily: Fonts.medium },
    progressTrack: { width: '100%', height: 4, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#8B5CF6', borderRadius: 2 },
  });
