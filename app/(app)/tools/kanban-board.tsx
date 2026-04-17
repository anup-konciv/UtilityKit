import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, TextInput, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#6366F1';
const STORAGE_KEY = 'uk_kanban';

// ─── Types ────────────────────────────────────────────────────────────────────

type Subtask = { id: string; text: string; done: boolean };

type KanbanCard = {
  id: string;
  title: string;
  description: string;
  color: string;
  column: number;
  priority: number;       // 0=none, 1=low, 2=medium, 3=high, 4=urgent
  dueDate: string;        // YYYY-MM-DD or ''
  labels: string[];
  subtasks: Subtask[];
  archived: boolean;
  createdAt: string;
  movedAt: string;        // last column-move timestamp
  order: number;          // sort order within column
};

type Board = { id: string; name: string; color: string };

type KanbanData = {
  boards: Board[];
  cards: KanbanCard[];
  activeBoardId: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const COLUMNS = ['To Do', 'In Progress', 'Done'];
const COLUMN_COLORS = ['#3B82F6', '#F59E0B', '#10B981'];
const COLUMN_ICONS: ('list-outline' | 'play-outline' | 'checkmark-circle-outline')[] = ['list-outline', 'play-outline', 'checkmark-circle-outline'];

const PRIORITIES = [
  { label: 'None', color: '#9CA3AF', icon: 'remove-outline' as const },
  { label: 'Low', color: '#10B981', icon: 'arrow-down-outline' as const },
  { label: 'Medium', color: '#F59E0B', icon: 'remove-outline' as const },
  { label: 'High', color: '#F97316', icon: 'arrow-up-outline' as const },
  { label: 'Urgent', color: '#EF4444', icon: 'flame-outline' as const },
];

const CARD_COLORS = ['#6366F1', '#3B82F6', '#8B5CF6', '#EC4899', '#F97316', '#10B981', '#06B6D4', '#EF4444', '#64748B'];

const LABEL_OPTIONS = ['Bug', 'Feature', 'Design', 'Research', 'Testing', 'Docs', 'Refactor', 'Infra'];
const LABEL_COLORS: Record<string, string> = {
  Bug: '#EF4444', Feature: '#10B981', Design: '#EC4899', Research: '#8B5CF6',
  Testing: '#F59E0B', Docs: '#3B82F6', Refactor: '#F97316', Infra: '#64748B',
};

const BOARD_COLORS = ['#6366F1', '#3B82F6', '#10B981', '#F97316', '#EC4899', '#EF4444', '#8B5CF6'];

const DEFAULT_BOARD: Board = { id: 'default', name: 'My Board', color: '#6366F1' };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b + 'T00:00:00').getTime() - new Date(a + 'T00:00:00').getTime()) / 86400000);
}

function relativeDate(iso: string): { text: string; color: string } {
  if (!iso) return { text: '', color: '' };
  const days = daysBetween(todayISO(), iso);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: '#EF4444' };
  if (days === 0) return { text: 'Due today', color: '#F59E0B' };
  if (days === 1) return { text: 'Tomorrow', color: '#F59E0B' };
  if (days <= 7) return { text: `${days}d left`, color: '#10B981' };
  return { text: fmtDate(iso), color: '#9CA3AF' };
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return fmtDate(iso.slice(0, 10));
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function KanbanBoardScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [data, setData] = useState<KanbanData>({
    boards: [DEFAULT_BOARD],
    cards: [],
    activeBoardId: 'default',
  });
  const [activeColumn, setActiveColumn] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState(-1); // -1 = all
  const [filterLabel, setFilterLabel] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [showBoardForm, setShowBoardForm] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cardColor, setCardColor] = useState(CARD_COLORS[0]);
  const [priority, setPriority] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  // Board form
  const [boardName, setBoardName] = useState('');
  const [boardColor, setBoardColor] = useState(BOARD_COLORS[0]);

  useEffect(() => {
    loadJSON<KanbanData>(STORAGE_KEY, { boards: [DEFAULT_BOARD], cards: [], activeBoardId: 'default' }).then(d => {
      // Migration from old format (array of cards)
      if (Array.isArray(d)) {
        setData({ boards: [DEFAULT_BOARD], cards: (d as KanbanCard[]).map(c => ({
          ...c, priority: c.priority ?? 0, dueDate: c.dueDate ?? '', labels: c.labels ?? [],
          subtasks: c.subtasks ?? [], archived: c.archived ?? false, movedAt: c.movedAt ?? c.createdAt,
          order: c.order ?? 0,
        })), activeBoardId: 'default' });
      } else {
        setData({
          ...d,
          boards: d.boards?.length ? d.boards : [DEFAULT_BOARD],
          cards: (d.cards ?? []).map(c => ({
            ...c, priority: c.priority ?? 0, dueDate: c.dueDate ?? '', labels: c.labels ?? [],
            subtasks: c.subtasks ?? [], archived: c.archived ?? false, movedAt: c.movedAt ?? c.createdAt,
            order: c.order ?? 0,
          })),
        });
      }
    });
  }, []);

  const persist = useCallback((d: KanbanData) => { setData(d); saveJSON(STORAGE_KEY, d); }, []);
  const updateCards = useCallback((fn: (cards: KanbanCard[]) => KanbanCard[]) => {
    persist({ ...data, cards: fn(data.cards) });
  }, [data, persist]);

  const activeBoard = data.boards.find(b => b.id === data.activeBoardId) ?? DEFAULT_BOARD;

  // Board-scoped cards
  const boardCards = useMemo(() => data.cards.filter(c => !c.archived), [data.cards]);
  const archivedCards = useMemo(() => data.cards.filter(c => c.archived), [data.cards]);

  const columnCards = useMemo(() => {
    return COLUMNS.map((_, i) => {
      let cards = boardCards.filter(c => c.column === i);
      if (search.trim()) {
        const q = search.toLowerCase();
        cards = cards.filter(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
      }
      if (filterPriority >= 0) cards = cards.filter(c => c.priority === filterPriority);
      if (filterLabel) cards = cards.filter(c => c.labels.includes(filterLabel));
      return cards.sort((a, b) => {
        // Urgent/high first, then by order
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.order - b.order;
      });
    });
  }, [boardCards, search, filterPriority, filterLabel]);

  // ── Form helpers ──

  const resetForm = () => {
    setTitle(''); setDescription(''); setCardColor(CARD_COLORS[0]); setPriority(0);
    setDueDate(''); setLabels([]); setSubtasks([]); setNewSubtask('');
    setEditId(null); setShowForm(false);
  };

  const saveCard = () => {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const existing = editId ? data.cards.find(c => c.id === editId) : null;
    const card: KanbanCard = {
      id: editId ?? uid(),
      title: title.trim(),
      description: description.trim(),
      color: cardColor,
      column: existing?.column ?? activeColumn,
      priority,
      dueDate,
      labels,
      subtasks,
      archived: false,
      createdAt: existing?.createdAt ?? now,
      movedAt: existing?.movedAt ?? now,
      order: existing?.order ?? columnCards[activeColumn].length,
    };
    if (editId) {
      updateCards(cards => cards.map(c => c.id === editId ? card : c));
    } else {
      persist({ ...data, cards: [...data.cards, card] });
    }
    resetForm();
  };

  const editCard = (card: KanbanCard) => {
    setEditId(card.id); setTitle(card.title); setDescription(card.description);
    setCardColor(card.color); setPriority(card.priority); setDueDate(card.dueDate);
    setLabels([...card.labels]); setSubtasks(card.subtasks.map(s => ({ ...s })));
    setActiveColumn(card.column); setShowForm(true);
  };

  const moveCard = (id: string, direction: 1 | -1) => {
    updateCards(cards => cards.map(c => {
      if (c.id !== id) return c;
      const newCol = Math.max(0, Math.min(COLUMNS.length - 1, c.column + direction));
      return { ...c, column: newCol, movedAt: new Date().toISOString() };
    }));
  };

  const reorderCard = (id: string, direction: 1 | -1) => {
    const col = data.cards.find(c => c.id === id)?.column;
    if (col === undefined) return;
    const colCards = columnCards[col];
    const idx = colCards.findIndex(c => c.id === id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= colCards.length) return;
    // Swap orders
    const a = colCards[idx];
    const b = colCards[newIdx];
    updateCards(cards => cards.map(c => {
      if (c.id === a.id) return { ...c, order: b.order };
      if (c.id === b.id) return { ...c, order: a.order };
      return c;
    }));
  };

  const archiveCard = (id: string) => updateCards(cards => cards.map(c => c.id === id ? { ...c, archived: true } : c));
  const unarchiveCard = (id: string) => updateCards(cards => cards.map(c => c.id === id ? { ...c, archived: false } : c));
  const deleteCard = (id: string) => updateCards(cards => cards.filter(c => c.id !== id));
  const clearDone = () => updateCards(cards => cards.map(c => c.column === 2 ? { ...c, archived: true } : c));

  const toggleSubtaskDone = (cardId: string, subtaskId: string) => {
    updateCards(cards => cards.map(c =>
      c.id === cardId ? { ...c, subtasks: c.subtasks.map(s => s.id === subtaskId ? { ...s, done: !s.done } : s) } : c
    ));
  };

  const toggleLabel = (label: string) => {
    setLabels(prev => prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]);
  };

  const addSubtaskToForm = () => {
    if (!newSubtask.trim()) return;
    setSubtasks([...subtasks, { id: uid(), text: newSubtask.trim(), done: false }]);
    setNewSubtask('');
  };

  const removeSubtaskFromForm = (id: string) => setSubtasks(subtasks.filter(s => s.id !== id));

  // ── Board management ──

  const addBoard = () => {
    if (!boardName.trim()) return;
    const board: Board = { id: uid(), name: boardName.trim(), color: boardColor };
    persist({ ...data, boards: [...data.boards, board], activeBoardId: board.id });
    setBoardName(''); setShowBoardForm(false);
  };

  const switchBoard = (id: string) => persist({ ...data, activeBoardId: id });

  const deleteBoard = (id: string) => {
    if (data.boards.length <= 1) return;
    const newBoards = data.boards.filter(b => b.id !== id);
    const newCards = data.cards.filter(c => true); // keep all cards for now
    persist({ boards: newBoards, cards: newCards, activeBoardId: newBoards[0].id });
  };

  // ── Stats ──

  const totalSubtasks = useMemo(() => boardCards.reduce((s, c) => s + c.subtasks.length, 0), [boardCards]);
  const doneSubtasks = useMemo(() => boardCards.reduce((s, c) => s + c.subtasks.filter(t => t.done).length, 0), [boardCards]);
  const overdueCount = useMemo(() => boardCards.filter(c => c.dueDate && daysBetween(todayISO(), c.dueDate) < 0 && c.column !== 2).length, [boardCards]);

  const completionPct = useMemo(() => {
    const total = boardCards.length;
    if (total === 0) return 0;
    return Math.round((columnCards[2].length / total) * 100);
  }, [boardCards, columnCards]);

  const hasFilters = search.trim() || filterPriority >= 0 || filterLabel;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenShell title="Kanban Board" accentColor={activeBoard.color}>

      {/* Board selector */}
      <View style={styles.boardSelector}>
        {data.boards.map(b => (
          <TouchableOpacity
            key={b.id}
            style={[styles.boardChip, {
              backgroundColor: data.activeBoardId === b.id ? b.color + '22' : colors.glass,
              borderColor: data.activeBoardId === b.id ? b.color : colors.border,
            }]}
            onPress={() => switchBoard(b.id)}
            onLongPress={() => {
              if (data.boards.length > 1) {
                Alert.alert('Delete Board', `Delete "${b.name}"?`, [
                  { text: 'Cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => deleteBoard(b.id) },
                ]);
              }
            }}
          >
            <View style={[styles.boardDot, { backgroundColor: b.color }]} />
            <Text style={[styles.boardChipText, { color: data.activeBoardId === b.id ? b.color : colors.textMuted }]}>{b.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.boardAddBtn, { backgroundColor: activeBoard.color + '18' }]} onPress={() => setShowBoardForm(!showBoardForm)}>
          <Ionicons name="add" size={14} color={activeBoard.color} />
        </TouchableOpacity>
      </View>

      {/* Board form */}
      {showBoardForm && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>New Board</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={boardName} onChangeText={setBoardName} placeholder="Board name" placeholderTextColor={colors.textMuted} />
          <View style={[styles.colorRow, { marginTop: Spacing.md }]}>
            {BOARD_COLORS.map(c => (
              <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderColor: boardColor === c ? colors.text : 'transparent' }]} onPress={() => setBoardColor(c)}>
                {boardColor === c && <Ionicons name="checkmark" size={12} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowBoardForm(false)}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: boardColor }]} onPress={addBoard}>
              <Text style={styles.saveText}>Create</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Progress bar + stats */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressPct, { color: activeBoard.color }]}>{completionPct}%</Text>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Complete</Text>
          {overdueCount > 0 && (
            <View style={[styles.overdueBadge, { backgroundColor: '#EF4444' + '18' }]}>
              <Ionicons name="alert-circle" size={12} color="#EF4444" />
              <Text style={[styles.overdueText, { color: '#EF4444' }]}>{overdueCount} overdue</Text>
            </View>
          )}
        </View>
        <View style={[styles.progressBg, { backgroundColor: colors.glass }]}>
          <View style={[styles.progressFill, { width: `${completionPct}%` as any, backgroundColor: activeBoard.color }]} />
        </View>
        <View style={styles.statsRow}>
          {COLUMNS.map((col, i) => (
            <TouchableOpacity key={col} style={styles.statItem} onPress={() => setActiveColumn(i)}>
              <Ionicons name={COLUMN_ICONS[i]} size={14} color={COLUMN_COLORS[i]} />
              <Text style={[styles.statVal, { color: COLUMN_COLORS[i] }]}>{columnCards[i].length}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{col}</Text>
            </TouchableOpacity>
          ))}
          {totalSubtasks > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="checkbox-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.statVal, { color: colors.text }]}>{doneSubtasks}/{totalSubtasks}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Subtasks</Text>
            </View>
          )}
        </View>
      </View>

      {/* Search + Filters */}
      <View style={[styles.searchRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder="Search cards..."
          placeholderTextColor={colors.textMuted}
        />
        {hasFilters && (
          <TouchableOpacity onPress={() => { setSearch(''); setFilterPriority(-1); setFilterLabel(''); }}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {/* Priority filter */}
        {PRIORITIES.slice(1).map((p, i) => {
          const pi = i + 1;
          const active = filterPriority === pi;
          return (
            <TouchableOpacity
              key={p.label}
              style={[styles.filterChip, { backgroundColor: active ? p.color + '22' : colors.glass, borderColor: active ? p.color : colors.border }]}
              onPress={() => setFilterPriority(active ? -1 : pi)}
            >
              <Ionicons name={p.icon} size={10} color={active ? p.color : colors.textMuted} />
              <Text style={[styles.filterChipText, { color: active ? p.color : colors.textMuted }]}>{p.label}</Text>
            </TouchableOpacity>
          );
        })}
        {/* Archive toggle */}
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: showArchive ? '#64748B' + '22' : colors.glass, borderColor: showArchive ? '#64748B' : colors.border, marginLeft: 'auto' }]}
          onPress={() => setShowArchive(!showArchive)}
        >
          <Ionicons name="archive-outline" size={10} color={showArchive ? '#64748B' : colors.textMuted} />
          <Text style={[styles.filterChipText, { color: showArchive ? '#64748B' : colors.textMuted }]}>
            Archive{archivedCards.length > 0 ? ` (${archivedCards.length})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Column tabs */}
      {!showArchive && (
        <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {COLUMNS.map((col, i) => (
            <TouchableOpacity
              key={col}
              style={[styles.tabBtn, activeColumn === i && { backgroundColor: COLUMN_COLORS[i] + '22', borderColor: COLUMN_COLORS[i] }]}
              onPress={() => setActiveColumn(i)}
            >
              <Ionicons name={COLUMN_ICONS[i]} size={13} color={activeColumn === i ? COLUMN_COLORS[i] : colors.textMuted} />
              <Text style={[styles.tabLabel, { color: activeColumn === i ? COLUMN_COLORS[i] : colors.textMuted }]}>{col}</Text>
              <View style={[styles.tabBadge, { backgroundColor: COLUMN_COLORS[i] + '25' }]}>
                <Text style={[styles.tabBadgeText, { color: COLUMN_COLORS[i] }]}>{columnCards[i].length}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Add button */}
      {!showArchive && (
        <TouchableOpacity style={[styles.addRow, { backgroundColor: COLUMN_COLORS[activeColumn] }]} onPress={() => { resetForm(); setShowForm(true); }}>
          <Ionicons name="add" size={16} color="#fff" />
          <Text style={styles.addRowText}>Add Card</Text>
        </TouchableOpacity>
      )}

      {/* Clear done */}
      {!showArchive && activeColumn === 2 && columnCards[2].length > 0 && (
        <TouchableOpacity style={[styles.clearDoneBtn, { borderColor: colors.border }]} onPress={clearDone}>
          <Ionicons name="archive-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.clearDoneText, { color: colors.textMuted }]}>Archive all done</Text>
        </TouchableOpacity>
      )}

      {/* ── Card Form ── */}
      {showForm && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{editId ? 'Edit Card' : 'New Card'}</Text>

          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={title} onChangeText={setTitle} placeholder="Card title" placeholderTextColor={colors.textMuted} />

          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm, minHeight: 60, textAlignVertical: 'top' }]} value={description} onChangeText={setDescription} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} multiline />

          {/* Priority */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p, i) => (
              <TouchableOpacity
                key={p.label}
                style={[styles.priorityChip, { backgroundColor: priority === i ? p.color + '22' : colors.glass, borderColor: priority === i ? p.color : colors.border }]}
                onPress={() => setPriority(i)}
              >
                <Ionicons name={p.icon} size={12} color={priority === i ? p.color : colors.textMuted} />
                <Text style={[styles.priorityText, { color: priority === i ? p.color : colors.textMuted }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Due date */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Due Date</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD (optional)" placeholderTextColor={colors.textMuted} />

          {/* Labels */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Labels</Text>
          <View style={styles.labelRow}>
            {LABEL_OPTIONS.map(l => {
              const active = labels.includes(l);
              const lc = LABEL_COLORS[l] ?? ACCENT;
              return (
                <TouchableOpacity key={l} style={[styles.labelChip, { backgroundColor: active ? lc + '22' : colors.glass, borderColor: active ? lc : colors.border }]} onPress={() => toggleLabel(l)}>
                  <Text style={[styles.labelChipText, { color: active ? lc : colors.textMuted }]}>{l}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Color */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Color</Text>
          <View style={styles.colorRow}>
            {CARD_COLORS.map(c => (
              <TouchableOpacity key={c} style={[styles.colorDot, { backgroundColor: c, borderColor: cardColor === c ? colors.text : 'transparent' }]} onPress={() => setCardColor(c)}>
                {cardColor === c && <Ionicons name="checkmark" size={12} color="#fff" />}
              </TouchableOpacity>
            ))}
          </View>

          {/* Subtasks */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Subtasks</Text>
          {subtasks.map(s => (
            <View key={s.id} style={styles.subtaskFormRow}>
              <TouchableOpacity onPress={() => setSubtasks(subtasks.map(st => st.id === s.id ? { ...st, done: !st.done } : st))}>
                <Ionicons name={s.done ? 'checkbox' : 'square-outline'} size={18} color={s.done ? '#10B981' : colors.textMuted} />
              </TouchableOpacity>
              <Text style={[styles.subtaskFormText, { color: colors.text, textDecorationLine: s.done ? 'line-through' : 'none' }]}>{s.text}</Text>
              <TouchableOpacity onPress={() => removeSubtaskFromForm(s.id)}><Ionicons name="close" size={16} color={colors.textMuted} /></TouchableOpacity>
            </View>
          ))}
          <View style={styles.subtaskAddRow}>
            <TextInput
              style={[styles.input, { flex: 1, color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={newSubtask}
              onChangeText={setNewSubtask}
              placeholder="Add subtask..."
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={addSubtaskToForm}
            />
            <TouchableOpacity style={[styles.subtaskAddBtn, { backgroundColor: ACCENT + '18' }]} onPress={addSubtaskToForm}>
              <Ionicons name="add" size={18} color={ACCENT} />
            </TouchableOpacity>
          </View>

          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLUMN_COLORS[activeColumn] }]} onPress={saveCard}>
              <Text style={styles.saveText}>{editId ? 'Update' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Cards ── */}
      {!showArchive && columnCards[activeColumn].map((card, idx) => {
        const due = relativeDate(card.dueDate);
        const stDone = card.subtasks.filter(s => s.done).length;
        const stTotal = card.subtasks.length;
        const stPct = stTotal > 0 ? Math.round((stDone / stTotal) * 100) : -1;
        const isExpanded = expandedCard === card.id;
        const pri = PRIORITIES[card.priority];

        return (
          <TouchableOpacity
            key={card.id}
            activeOpacity={0.8}
            onPress={() => setExpandedCard(isExpanded ? null : card.id)}
            style={[styles.kanbanCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: card.color, borderLeftWidth: 4 }]}
          >
            {/* Header row */}
            <View style={styles.cardHeader}>
              {card.priority > 0 && (
                <View style={[styles.priBadge, { backgroundColor: pri.color + '18' }]}>
                  <Ionicons name={pri.icon} size={10} color={pri.color} />
                </View>
              )}
              <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
              {card.column === 2 && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
            </View>

            {/* Meta row: labels + due date */}
            {(card.labels.length > 0 || card.dueDate) && (
              <View style={styles.cardMetaRow}>
                {card.labels.map(l => (
                  <View key={l} style={[styles.cardLabel, { backgroundColor: (LABEL_COLORS[l] ?? ACCENT) + '18' }]}>
                    <Text style={[styles.cardLabelText, { color: LABEL_COLORS[l] ?? ACCENT }]}>{l}</Text>
                  </View>
                ))}
                {card.dueDate !== '' && (
                  <View style={[styles.dueBadge, { backgroundColor: due.color + '15' }]}>
                    <Ionicons name="calendar-outline" size={10} color={due.color} />
                    <Text style={[styles.dueText, { color: due.color }]}>{due.text}</Text>
                  </View>
                )}
              </View>
            )}

            {/* Subtask progress */}
            {stTotal > 0 && (
              <View style={styles.stProgressRow}>
                <View style={[styles.stProgressBg, { backgroundColor: colors.glass }]}>
                  <View style={[styles.stProgressFill, { width: `${stPct}%` as any, backgroundColor: stPct === 100 ? '#10B981' : ACCENT }]} />
                </View>
                <Text style={[styles.stProgressText, { color: colors.textMuted }]}>{stDone}/{stTotal}</Text>
              </View>
            )}

            {/* Description (collapsed) */}
            {!isExpanded && card.description ? (
              <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={1}>{card.description}</Text>
            ) : null}

            {/* Expanded details */}
            {isExpanded && (
              <View style={styles.expandedSection}>
                {card.description ? <Text style={[styles.cardDescFull, { color: colors.textMuted }]}>{card.description}</Text> : null}

                {/* Subtask checklist */}
                {card.subtasks.length > 0 && (
                  <View style={styles.subtaskList}>
                    {card.subtasks.map(s => (
                      <TouchableOpacity key={s.id} style={styles.subtaskRow} onPress={() => toggleSubtaskDone(card.id, s.id)}>
                        <Ionicons name={s.done ? 'checkbox' : 'square-outline'} size={18} color={s.done ? '#10B981' : colors.textMuted} />
                        <Text style={[styles.subtaskText, { color: s.done ? colors.textMuted : colors.text, textDecorationLine: s.done ? 'line-through' : 'none' }]}>{s.text}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Timestamps */}
                <Text style={[styles.timestamp, { color: colors.textMuted }]}>Created {timeAgo(card.createdAt)} · Moved {timeAgo(card.movedAt)}</Text>

                {/* Actions */}
                <View style={styles.cardActions}>
                  {/* Reorder */}
                  {idx > 0 && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.glass }]} onPress={() => reorderCard(card.id, -1)}>
                      <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                  {idx < columnCards[activeColumn].length - 1 && (
                    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.glass }]} onPress={() => reorderCard(card.id, 1)}>
                      <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                  )}
                  {/* Move column */}
                  {card.column > 0 && (
                    <TouchableOpacity style={[styles.moveBtn, { backgroundColor: COLUMN_COLORS[card.column - 1] + '15', borderColor: COLUMN_COLORS[card.column - 1] + '30' }]} onPress={() => moveCard(card.id, -1)}>
                      <Ionicons name="arrow-back" size={11} color={COLUMN_COLORS[card.column - 1]} />
                      <Text style={[styles.moveBtnText, { color: COLUMN_COLORS[card.column - 1] }]}>{COLUMNS[card.column - 1]}</Text>
                    </TouchableOpacity>
                  )}
                  {card.column < COLUMNS.length - 1 && (
                    <TouchableOpacity style={[styles.moveBtn, { backgroundColor: COLUMN_COLORS[card.column + 1] + '15', borderColor: COLUMN_COLORS[card.column + 1] + '30' }]} onPress={() => moveCard(card.id, 1)}>
                      <Text style={[styles.moveBtnText, { color: COLUMN_COLORS[card.column + 1] }]}>{COLUMNS[card.column + 1]}</Text>
                      <Ionicons name="arrow-forward" size={11} color={COLUMN_COLORS[card.column + 1]} />
                    </TouchableOpacity>
                  )}
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.glass }]} onPress={() => editCard(card)}>
                    <Ionicons name="create-outline" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.glass }]} onPress={() => archiveCard(card.id)}>
                    <Ionicons name="archive-outline" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF4444' + '12' }]} onPress={() => deleteCard(card.id)}>
                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      {/* Archive view */}
      {showArchive && (
        <>
          <Text style={[styles.archiveTitle, { color: colors.textMuted }]}>Archived Cards ({archivedCards.length})</Text>
          {archivedCards.map(card => (
            <View key={card.id} style={[styles.kanbanCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: card.color, borderLeftWidth: 4, opacity: 0.7 }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{card.title}</Text>
              <View style={styles.archiveActions}>
                <TouchableOpacity style={[styles.moveBtn, { backgroundColor: '#10B981' + '15', borderColor: '#10B981' + '30' }]} onPress={() => unarchiveCard(card.id)}>
                  <Ionicons name="arrow-undo" size={11} color="#10B981" />
                  <Text style={[styles.moveBtnText, { color: '#10B981' }]}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteCard(card.id)}>
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
          {archivedCards.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="archive-outline" size={40} color={colors.textMuted + '40'} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No archived cards</Text>
            </View>
          )}
        </>
      )}

      {/* Empty state */}
      {!showArchive && columnCards[activeColumn].length === 0 && !showForm && (
        <View style={styles.emptyState}>
          <Ionicons name={COLUMN_ICONS[activeColumn]} size={40} color={COLUMN_COLORS[activeColumn] + '40'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {hasFilters ? 'No cards match your filters' : `No cards in ${COLUMNS[activeColumn]}`}
          </Text>
        </View>
      )}
    </ScreenShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Board selector
    boardSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg, alignItems: 'center' },
    boardChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    boardDot: { width: 8, height: 8, borderRadius: 4 },
    boardChipText: { fontSize: 12, fontFamily: Fonts.semibold },
    boardAddBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

    // Card/section
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    fieldLabel: { fontSize: 10, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm },

    // Progress
    progressHeader: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, marginBottom: Spacing.sm },
    progressPct: { fontSize: 22, fontFamily: Fonts.bold },
    progressLabel: { fontSize: 12, fontFamily: Fonts.medium },
    overdueBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.pill, marginLeft: 'auto' },
    overdueText: { fontSize: 10, fontFamily: Fonts.semibold },
    progressBg: { height: 6, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.lg },
    progressFill: { height: '100%', borderRadius: 3 },

    statsRow: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center', gap: 2 },
    statVal: { fontSize: 18, fontFamily: Fonts.bold },
    statLabel: { fontSize: 9, fontFamily: Fonts.medium },

    // Search
    searchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.md },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, paddingVertical: 10 },

    // Filters
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.lg, alignItems: 'center' },
    filterChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill, borderWidth: 1 },
    filterChipText: { fontSize: 10, fontFamily: Fonts.medium },

    // Tabs
    tabBar: { flexDirection: 'row', borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden' },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: Radii.xl, borderWidth: 1.5, borderColor: 'transparent', margin: 3 },
    tabLabel: { fontSize: 10, fontFamily: Fonts.semibold },
    tabBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: Radii.pill },
    tabBadgeText: { fontSize: 9, fontFamily: Fonts.bold },

    // Add row
    addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 10, borderRadius: Radii.xl, marginBottom: Spacing.sm },
    addRowText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
    clearDoneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, marginBottom: Spacing.lg },
    clearDoneText: { fontSize: 11, fontFamily: Fonts.medium },

    // Form
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    priorityChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    priorityText: { fontSize: 10, fontFamily: Fonts.medium },
    labelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    labelChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill, borderWidth: 1 },
    labelChipText: { fontSize: 10, fontFamily: Fonts.medium },
    colorRow: { flexDirection: 'row', gap: Spacing.sm },
    colorDot: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    subtaskFormRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 6 },
    subtaskFormText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular },
    subtaskAddRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    subtaskAddBtn: { width: 36, height: 36, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    formBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, borderWidth: 1, alignItems: 'center' },
    cancelText: { fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, alignItems: 'center' },
    saveText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },

    // Kanban card
    kanbanCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    priBadge: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 14, fontFamily: Fonts.bold, flex: 1 },
    cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
    cardLabel: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radii.sm },
    cardLabelText: { fontSize: 9, fontFamily: Fonts.bold },
    dueBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radii.sm },
    dueText: { fontSize: 9, fontFamily: Fonts.bold },
    stProgressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 6 },
    stProgressBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
    stProgressFill: { height: '100%', borderRadius: 2 },
    stProgressText: { fontSize: 10, fontFamily: Fonts.medium, width: 30 },
    cardDesc: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 4 },
    cardDescFull: { fontSize: 13, fontFamily: Fonts.regular, lineHeight: 20, marginBottom: Spacing.sm },

    // Expanded
    expandedSection: { marginTop: Spacing.sm },
    subtaskList: { marginBottom: Spacing.sm },
    subtaskRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
    subtaskText: { fontSize: 13, fontFamily: Fonts.regular, flex: 1 },
    timestamp: { fontSize: 10, fontFamily: Fonts.regular, marginBottom: Spacing.sm },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
    actionBtn: { width: 28, height: 28, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center' },
    moveBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radii.sm, borderWidth: 1 },
    moveBtnText: { fontSize: 10, fontFamily: Fonts.semibold },

    // Archive
    archiveTitle: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    archiveActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
