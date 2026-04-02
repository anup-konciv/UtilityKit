import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#2563EB';

type Priority = 'high' | 'medium' | 'low';
type Status = 'pending' | 'in-progress' | 'completed';

type Assignment = {
  id: string;
  title: string;
  subject: string;
  description: string;
  dueDate: string;
  priority: Priority;
  status: Status;
  createdAt: string;
};

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

function daysUntil(iso: string): number {
  const now = new Date(todayISO() + 'T00:00:00');
  const due = new Date(iso + 'T00:00:00');
  return Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

const PRIORITY_CONFIG: Record<Priority, { label: string; icon: string; color: string }> = {
  high: { label: 'High', icon: 'flame-outline', color: '#EF4444' },
  medium: { label: 'Medium', icon: 'flash-outline', color: '#F59E0B' },
  low: { label: 'Low', icon: 'leaf-outline', color: '#10B981' },
};

const STATUS_CONFIG: Record<Status, { label: string; icon: string; color: string }> = {
  pending: { label: 'Pending', icon: 'time-outline', color: '#F59E0B' },
  'in-progress': { label: 'In Progress', icon: 'sync-outline', color: '#3B82F6' },
  completed: { label: 'Done', icon: 'checkmark-circle-outline', color: '#10B981' },
};

const SUBJECTS = [
  { id: 'math', label: 'Math', icon: 'calculator-outline', color: '#3B82F6' },
  { id: 'science', label: 'Science', icon: 'flask-outline', color: '#10B981' },
  { id: 'english', label: 'English', icon: 'book-outline', color: '#F59E0B' },
  { id: 'history', label: 'History', icon: 'time-outline', color: '#8B5CF6' },
  { id: 'cs', label: 'CS', icon: 'code-slash-outline', color: '#06B6D4' },
  { id: 'art', label: 'Art', icon: 'color-palette-outline', color: '#EC4899' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline', color: '#64748B' },
];

function getSubject(id: string) {
  return SUBJECTS.find(s => s.id === id) ?? SUBJECTS[SUBJECTS.length - 1];
}

export default function AssignmentTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | 'all'>('all');

  // Form
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('other');
  const [desc, setDesc] = useState('');
  const [dueDate, setDueDate] = useState(todayISO());
  const [priority, setPriority] = useState<Priority>('medium');

  useEffect(() => {
    loadJSON<Assignment[]>(KEYS.assignments, []).then(setAssignments);
  }, []);

  const persist = useCallback((a: Assignment[]) => {
    setAssignments(a);
    saveJSON(KEYS.assignments, a);
  }, []);

  const openAdd = (a?: Assignment) => {
    if (a) {
      setEditId(a.id);
      setTitle(a.title);
      setSubject(a.subject);
      setDesc(a.description);
      setDueDate(a.dueDate);
      setPriority(a.priority);
    } else {
      setEditId(null);
      setTitle('');
      setSubject('other');
      setDesc('');
      setDueDate(todayISO());
      setPriority('medium');
    }
    setShowAdd(true);
  };

  const saveAssignment = () => {
    if (!title.trim()) return;
    if (editId) {
      persist(assignments.map(a => a.id === editId ? {
        ...a, title: title.trim(), subject, description: desc.trim(), dueDate, priority,
      } : a));
    } else {
      persist([{
        id: uid(), title: title.trim(), subject, description: desc.trim(),
        dueDate, priority, status: 'pending' as Status, createdAt: todayISO(),
      }, ...assignments]);
    }
    setShowAdd(false);
  };

  const cycleStatus = (id: string) => {
    const order: Status[] = ['pending', 'in-progress', 'completed'];
    persist(assignments.map(a => {
      if (a.id !== id) return a;
      const idx = order.indexOf(a.status);
      return { ...a, status: order[(idx + 1) % order.length] };
    }));
  };

  const deleteAssignment = (id: string) => {
    Alert.alert('Delete Assignment', 'Remove this assignment?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(assignments.filter(a => a.id !== id)) },
    ]);
  };

  const filtered = filter === 'all' ? assignments : assignments.filter(a => a.status === filter);
  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'completed' && b.status !== 'completed') return 1;
    if (b.status === 'completed' && a.status !== 'completed') return -1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const pending = assignments.filter(a => a.status !== 'completed').length;
  const overdue = assignments.filter(a => a.status !== 'completed' && daysUntil(a.dueDate) < 0).length;
  const completed = assignments.filter(a => a.status === 'completed').length;

  return (
    <ScreenShell
      title="Assignments"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => openAdd()}>
          <Ionicons name="add-circle-outline" size={24} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Hero Card */}
      <LinearGradient
        colors={['#1E3A5F', '#2563EB', '#60A5FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>ASSIGNMENTS</Text>
        <Text style={styles.heroTitle}>{assignments.length} Total</Text>
        <Text style={styles.heroSub}>
          {overdue > 0 ? `${overdue} overdue · ` : ''}{pending} pending · {completed} done
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{pending}</Text>
            <Text style={styles.heroStatLabel}>PENDING</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={[styles.heroStatVal, { color: overdue > 0 ? '#FEE2E2' : '#fff' }]}>{overdue}</Text>
            <Text style={styles.heroStatLabel}>OVERDUE</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{completed}</Text>
            <Text style={styles.heroStatLabel}>COMPLETED</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'pending', 'in-progress', 'completed'] as const).map(f => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && { backgroundColor: ACCENT + '20', borderColor: ACCENT }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, { color: filter === f ? ACCENT : colors.textMuted }]}>
              {f === 'all' ? 'All' : STATUS_CONFIG[f].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Assignments */}
      {sorted.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Ionicons name="school-outline" size={48} color={colors.border} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No assignments yet</Text>
        </View>
      ) : sorted.map(a => {
        const sub = getSubject(a.subject);
        const pri = PRIORITY_CONFIG[a.priority];
        const sta = STATUS_CONFIG[a.status];
        const days = daysUntil(a.dueDate);
        const isOverdue = days < 0 && a.status !== 'completed';
        const isDone = a.status === 'completed';

        return (
          <View key={a.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }, isDone && { opacity: 0.6 }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.subjectBadge, { backgroundColor: sub.color + '20' }]}>
                <Ionicons name={sub.icon as any} size={14} color={sub.color} />
                <Text style={[styles.subjectText, { color: sub.color }]}>{sub.label}</Text>
              </View>
              <View style={[styles.priBadge, { backgroundColor: pri.color + '20' }]}>
                <Ionicons name={pri.icon as any} size={12} color={pri.color} />
              </View>
            </View>

            <Text style={[styles.cardTitle, { color: colors.text, textDecorationLine: isDone ? 'line-through' : 'none' }]}>{a.title}</Text>
            {a.description ? <Text style={[styles.cardDesc, { color: colors.textMuted }]} numberOfLines={2}>{a.description}</Text> : null}

            <View style={styles.cardFooter}>
              <View style={styles.dueDateWrap}>
                <Ionicons name="calendar-outline" size={14} color={isOverdue ? '#EF4444' : colors.textMuted} />
                <Text style={[styles.dueText, { color: isOverdue ? '#EF4444' : colors.textMuted }]}>
                  {formatDate(a.dueDate)}
                  {isOverdue ? ` (${Math.abs(days)}d overdue)` : days === 0 ? ' (Today)' : days > 0 && !isDone ? ` (${days}d left)` : ''}
                </Text>
              </View>
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.statusBtn, { backgroundColor: sta.color + '20' }]}
                  onPress={() => cycleStatus(a.id)}
                >
                  <Ionicons name={sta.icon as any} size={14} color={sta.color} />
                  <Text style={[styles.statusBtnText, { color: sta.color }]}>{sta.label}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => openAdd(a)} style={{ padding: 4 }}>
                  <Ionicons name="create-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteAssignment(a.id)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editId ? 'Edit Assignment' : 'New Assignment'}</Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Title</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={title} onChangeText={setTitle} placeholder="Assignment title" placeholderTextColor={colors.textMuted} autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
              {SUBJECTS.map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.subjectOption, subject === s.id && { backgroundColor: s.color + '20', borderColor: s.color }]}
                  onPress={() => setSubject(s.id)}
                >
                  <Ionicons name={s.icon as any} size={14} color={subject === s.id ? s.color : colors.textMuted} />
                  <Text style={[styles.subjectOptionText, { color: subject === s.id ? s.color : colors.textMuted }]}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Due Date</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Priority</Text>
            <View style={styles.priRow}>
              {(['low', 'medium', 'high'] as Priority[]).map(p => {
                const cfg = PRIORITY_CONFIG[p];
                return (
                  <TouchableOpacity
                    key={p}
                    style={[styles.priOption, priority === p && { backgroundColor: cfg.color + '20', borderColor: cfg.color }]}
                    onPress={() => setPriority(p)}
                  >
                    <Ionicons name={cfg.icon as any} size={14} color={priority === p ? cfg.color : colors.textMuted} />
                    <Text style={[styles.priOptionText, { color: priority === p ? cfg.color : colors.textMuted }]}>{cfg.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Description</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, height: 70, textAlignVertical: 'top' }]}
              value={desc} onChangeText={setDesc} placeholder="Details (optional)" placeholderTextColor={colors.textMuted} multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveAssignment}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{editId ? 'Update' : 'Add'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.lg },
    heroLabel: { fontSize: 10, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 1.5, marginBottom: 4 },
    heroTitle: { fontSize: 26, fontFamily: Fonts.bold, color: '#fff', marginBottom: 2 },
    heroSub: { fontSize: 13, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.8)', marginBottom: Spacing.lg },
    heroStatsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    heroStat: { alignItems: 'center' },
    heroStatVal: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff' },
    heroStatLabel: { fontSize: 9, fontFamily: Fonts.bold, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.8, marginTop: 2 },
    heroDivider: { width: 1, height: 30 },
    filterScroll: { marginBottom: Spacing.lg, flexGrow: 0 },
    filterBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, borderColor: c.border, marginRight: 8 },
    filterText: { fontSize: 12, fontFamily: Fonts.semibold },
    emptyWrap: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium },
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.sm },
    subjectBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radii.pill },
    subjectText: { fontSize: 11, fontFamily: Fonts.bold },
    priBadge: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    cardTitle: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 2 },
    cardDesc: { fontSize: 12, fontFamily: Fonts.regular, marginBottom: Spacing.sm },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.sm },
    dueDateWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    dueText: { fontSize: 11, fontFamily: Fonts.medium },
    cardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill },
    statusBtnText: { fontSize: 11, fontFamily: Fonts.bold },
    priRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    priOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: Radii.md, borderWidth: 1, borderColor: c.border },
    priOptionText: { fontSize: 12, fontFamily: Fonts.semibold },
    subjectOption: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1, borderColor: c.border, marginRight: 8 },
    subjectOptionText: { fontSize: 12, fontFamily: Fonts.semibold },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
