import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import EmptyState from '@/components/EmptyState';
import { haptics } from '@/lib/haptics';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#16A34A';
const COLORS = ['#16A34A', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#F97316'];

type Transaction = { id: string; amount: number; date: string; type: 'deposit' | 'withdraw' };
type SavingsGoal = {
  id: string; name: string; target: number; saved: number;
  deadline: string; color: string; icon: string;
  transactions?: Transaction[];
};

const GOAL_ICONS = [
  'trophy-outline', 'car-outline', 'airplane-outline', 'home-outline',
  'school-outline', 'gift-outline', 'phone-portrait-outline', 'laptop-outline',
  'heart-outline', 'diamond-outline', 'camera-outline', 'game-controller-outline',
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fmtAmt(n: number) {
  if (n >= 10_000_000) return `${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export default function SavingsGoalScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = colors.bg === '#0B1120';

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [showTransaction, setShowTransaction] = useState<{ goalId: string; type: 'deposit' | 'withdraw' } | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [txnAmt, setTxnAmt] = useState('');

  useEffect(() => { loadJSON<SavingsGoal[]>(KEYS.savingsGoals, []).then(setGoals); }, []);

  const persist = useCallback((g: SavingsGoal[]) => {
    setGoals(g); saveJSON(KEYS.savingsGoals, g);
  }, []);

  // Summary stats
  const summary = useMemo(() => {
    const totalSaved = goals.reduce((s, g) => s + g.saved, 0);
    const totalTarget = goals.reduce((s, g) => s + g.target, 0);
    const completed = goals.filter(g => g.saved >= g.target).length;
    const overallProgress = totalTarget > 0 ? totalSaved / totalTarget : 0;
    return { totalSaved, totalTarget, completed, active: goals.length - completed, overallProgress };
  }, [goals]);

  const addOrEditGoal = () => {
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) return;
    if (editingGoal) {
      persist(goals.map(g => g.id === editingGoal.id
        ? { ...g, name: name.trim(), target: t, deadline, color, icon }
        : g
      ));
    } else {
      persist([...goals, { id: uid(), name: name.trim(), target: t, saved: 0, deadline, color, icon, transactions: [] }]);
    }
    setName(''); setTarget(''); setDeadline(''); setEditingGoal(null); setShowAdd(false);
  };

  const openEdit = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setName(goal.name);
    setTarget(String(goal.target));
    setDeadline(goal.deadline);
    setColor(goal.color);
    setIcon(goal.icon || GOAL_ICONS[0]);
    setShowAdd(true);
  };

  const handleTransaction = () => {
    if (!showTransaction) return;
    const amt = parseFloat(txnAmt);
    if (!amt || amt <= 0) {
      haptics.error();
      return;
    }
    const { goalId, type } = showTransaction;
    let goalCompleted = false;
    persist(goals.map(g => {
      if (g.id !== goalId) return g;
      const newSaved = type === 'deposit' ? g.saved + amt : Math.max(0, g.saved - amt);
      if (type === 'deposit' && g.saved < g.target && newSaved >= g.target) {
        goalCompleted = true;
      }
      const txn: Transaction = { id: uid(), amount: amt, date: todayISO(), type };
      return { ...g, saved: newSaved, transactions: [txn, ...(g.transactions ?? [])] };
    }));
    // Distinct haptic when a deposit puts a goal over the finish line.
    if (goalCompleted) {
      haptics.success();
    } else {
      haptics.tap();
    }
    setTxnAmt(''); setShowTransaction(null);
  };

  const removeGoal = (id: string) => {
    Alert.alert('Delete Goal', 'Remove this savings goal and all its history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          persist(goals.filter(g => g.id !== id));
        },
      },
    ]);
  };

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  const historyGoal = showHistory ? goals.find(g => g.id === showHistory) : null;

  return (
    <ScreenShell
      title="Savings Goal"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => { setEditingGoal(null); setName(''); setTarget(''); setDeadline(''); setColor(COLORS[0]); setIcon(GOAL_ICONS[0]); setShowAdd(true); }}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Summary Dashboard */}
      {goals.length > 0 && (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.summaryTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Total Saved</Text>
              <Text style={[styles.summaryAmount, { color: ACCENT }]}>{fmtAmt(summary.totalSaved)}</Text>
              <Text style={[styles.summaryTarget, { color: colors.textMuted }]}>of {fmtAmt(summary.totalTarget)}</Text>
            </View>
            <View style={[styles.summaryRing, { borderColor: ACCENT + '25' }]}>
              <View style={[styles.summaryRingFill, {
                borderColor: ACCENT,
                borderTopColor: summary.overallProgress >= 0.25 ? ACCENT : ACCENT + '25',
                borderRightColor: summary.overallProgress >= 0.5 ? ACCENT : ACCENT + '25',
                borderBottomColor: summary.overallProgress >= 0.75 ? ACCENT : ACCENT + '25',
                borderLeftColor: summary.overallProgress >= 1.0 ? ACCENT : ACCENT + '25',
                transform: [{ rotate: '-90deg' }],
              }]} />
              <Text style={[styles.summaryPct, { color: ACCENT }]}>{Math.round(summary.overallProgress * 100)}%</Text>
            </View>
          </View>
          <View style={styles.summaryStats}>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatVal, { color: colors.text }]}>{goals.length}</Text>
              <Text style={[styles.summaryStatLabel, { color: colors.textMuted }]}>Goals</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatVal, { color: '#3B82F6' }]}>{summary.active}</Text>
              <Text style={[styles.summaryStatLabel, { color: colors.textMuted }]}>Active</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatVal, { color: ACCENT }]}>{summary.completed}</Text>
              <Text style={[styles.summaryStatLabel, { color: colors.textMuted }]}>Completed</Text>
            </View>
          </View>
        </View>
      )}

      {/* Goals */}
      {goals.length === 0 ? (
        <EmptyState
          icon="trophy-outline"
          title="No savings goals yet"
          hint="Set a target — emergency fund, vacation, gadget — and log deposits. The hero card shows your overall progress at a glance."
          accent={ACCENT}
          actionLabel="Create first goal"
          onAction={() => {
            setEditingGoal(null);
            setName('');
            setTarget('');
            setDeadline('');
            setShowAdd(true);
          }}
        />
      ) : (
        goals.map(goal => {
          const progress = Math.min(1, goal.saved / goal.target);
          const remaining = Math.max(0, goal.target - goal.saved);
          const days = daysUntil(goal.deadline);
          const dailyNeeded = days && days > 0 && remaining > 0 ? remaining / days : null;
          const completed = progress >= 1;
          const goalIcon = goal.icon || 'trophy-outline';

          return (
            <View key={goal.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {/* Header */}
              <View style={styles.cardHeader}>
                <View style={[styles.cardIcon, { backgroundColor: goal.color + '15' }]}>
                  <Ionicons name={goalIcon as any} size={22} color={goal.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
                  {goal.deadline ? (
                    <Text style={[styles.deadlineText, { color: colors.textMuted }]}>
                      {days !== null && days > 0 ? `${days} days left` : days === 0 ? 'Due today!' : 'Past deadline'}
                    </Text>
                  ) : null}
                </View>
                {completed && (
                  <View style={[styles.completedBadge, { backgroundColor: goal.color + '15' }]}>
                    <Ionicons name="checkmark-circle" size={14} color={goal.color} />
                    <Text style={[styles.completedText, { color: goal.color }]}>Done!</Text>
                  </View>
                )}
                <TouchableOpacity onPress={() => openEdit(goal)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>

              {/* Amount */}
              <View style={styles.amountRow}>
                <Text style={[styles.savedAmt, { color: goal.color }]}>{goal.saved.toLocaleString()}</Text>
                <Text style={[styles.targetAmt, { color: colors.textMuted }]}>/ {goal.target.toLocaleString()}</Text>
              </View>

              {/* Progress */}
              <View style={[styles.progressTrack, { backgroundColor: goal.color + '15' }]}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: goal.color }]} />
              </View>
              <View style={styles.progressRow}>
                <Text style={[styles.progressPct, { color: goal.color }]}>{(progress * 100).toFixed(1)}%</Text>
                {!completed && dailyNeeded && (
                  <Text style={[styles.dailyNeeded, { color: colors.textMuted }]}>
                    Save ~{fmtAmt(Math.ceil(dailyNeeded))}/day to reach goal
                  </Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: goal.color }]}
                  onPress={() => { setShowTransaction({ goalId: goal.id, type: 'deposit' }); setTxnAmt(''); }}
                >
                  <Ionicons name="add" size={16} color="#fff" />
                  <Text style={styles.actionBtnText}>Deposit</Text>
                </TouchableOpacity>
                {goal.saved > 0 && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }]}
                    onPress={() => { setShowTransaction({ goalId: goal.id, type: 'withdraw' }); setTxnAmt(''); }}
                  >
                    <Ionicons name="remove" size={16} color={colors.textMuted} />
                    <Text style={[styles.actionBtnText, { color: colors.text }]}>Withdraw</Text>
                  </TouchableOpacity>
                )}
                {(goal.transactions?.length ?? 0) > 0 && (
                  <TouchableOpacity
                    style={[styles.historyBtn, { borderColor: colors.border }]}
                    onPress={() => setShowHistory(goal.id)}
                  >
                    <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.historyBtn, { borderColor: '#EF4444' + '40' }]}
                  onPress={() => removeGoal(goal.id)}
                >
                  <Ionicons name="trash-outline" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      )}

      {/* Add/Edit Goal Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editingGoal ? 'Edit Goal' : 'New Savings Goal'}</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={name} onChangeText={setName}
              placeholder="Goal name (e.g. New Laptop)" placeholderTextColor={colors.textMuted} autoFocus
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={target} onChangeText={setTarget}
              placeholder="Target amount" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={deadline} onChangeText={setDeadline}
              placeholder="Deadline YYYY-MM-DD (optional)" placeholderTextColor={colors.textMuted} maxLength={10}
            />
            {/* Icon picker */}
            <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Icon</Text>
            <View style={styles.iconRow}>
              {GOAL_ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[styles.iconBtn, {
                    backgroundColor: icon === ic ? color + '20' : colors.inputBg,
                    borderColor: icon === ic ? color : colors.border,
                  }]}
                  onPress={() => setIcon(ic)}
                >
                  <Ionicons name={ic as any} size={18} color={icon === ic ? color : colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
            {/* Color picker */}
            <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Color</Text>
            <View style={styles.colorRow}>
              {COLORS.map(clr => (
                <TouchableOpacity
                  key={clr}
                  style={[styles.colorDot, { backgroundColor: clr }, color === clr && { borderWidth: 3, borderColor: colors.text }]}
                  onPress={() => setColor(clr)}
                />
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => { setShowAdd(false); setEditingGoal(null); }}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addOrEditGoal}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{editingGoal ? 'Save' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction Modal */}
      <Modal visible={showTransaction !== null} transparent animationType="fade" onRequestClose={() => setShowTransaction(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {showTransaction?.type === 'deposit' ? 'Add Deposit' : 'Withdraw'}
            </Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={txnAmt} onChangeText={setTxnAmt}
              placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="numeric" autoFocus
            />
            <View style={styles.quickRow}>
              {[100, 500, 1000, 5000, 10000].map(a => (
                <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '30' }]} onPress={() => setTxnAmt(String(a))}>
                  <Text style={[styles.quickBtnText, { color: ACCENT }]}>{fmtAmt(a)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowTransaction(null)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: showTransaction?.type === 'deposit' ? ACCENT : '#EF4444' }]}
                onPress={handleTransaction}
              >
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                  {showTransaction?.type === 'deposit' ? 'Deposit' : 'Withdraw'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Transaction History Modal */}
      <Modal visible={showHistory !== null} transparent animationType="fade" onRequestClose={() => setShowHistory(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg, maxHeight: '70%' }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Transaction History</Text>
            <Text style={[styles.histSubtitle, { color: colors.textMuted }]}>{historyGoal?.name}</Text>
            {(historyGoal?.transactions ?? []).length === 0 ? (
              <Text style={[styles.histEmpty, { color: colors.textMuted }]}>No transactions yet.</Text>
            ) : (
              (historyGoal?.transactions ?? []).slice(0, 20).map(txn => (
                <View key={txn.id} style={[styles.histRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.histIcon, { backgroundColor: txn.type === 'deposit' ? ACCENT + '15' : '#EF4444' + '15' }]}>
                    <Ionicons
                      name={txn.type === 'deposit' ? 'arrow-down' : 'arrow-up'}
                      size={14}
                      color={txn.type === 'deposit' ? ACCENT : '#EF4444'}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.histAmt, { color: txn.type === 'deposit' ? ACCENT : '#EF4444' }]}>
                      {txn.type === 'deposit' ? '+' : '-'}{txn.amount.toLocaleString()}
                    </Text>
                    <Text style={[styles.histDate, { color: colors.textMuted }]}>{txn.date}</Text>
                  </View>
                </View>
              ))
            )}
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface, marginTop: Spacing.md }]} onPress={() => setShowHistory(null)}>
              <Text style={[styles.modalBtnText, { color: colors.text }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Summary
    summaryCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    summaryTop: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
    summaryLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 2 },
    summaryAmount: { fontSize: 32, fontFamily: Fonts.bold },
    summaryTarget: { fontSize: 13, fontFamily: Fonts.regular },
    summaryRing: {
      width: 64, height: 64, borderRadius: 32, borderWidth: 6,
      alignItems: 'center', justifyContent: 'center',
    },
    summaryRingFill: {
      position: 'absolute', width: 64, height: 64, borderRadius: 32, borderWidth: 6,
    },
    summaryPct: { fontSize: 14, fontFamily: Fonts.bold },
    summaryStats: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryStat: { alignItems: 'center' },
    summaryStatVal: { fontSize: 20, fontFamily: Fonts.bold },
    summaryStatLabel: { fontSize: 11, fontFamily: Fonts.medium },

    // Empty
    empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.sm },
    emptyTitle: { fontSize: 18, fontFamily: Fonts.bold },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 22 },

    // Card
    card: {
      borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md,
      elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    cardIcon: { width: 42, height: 42, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
    goalName: { fontSize: 17, fontFamily: Fonts.bold },
    deadlineText: { fontSize: 11, fontFamily: Fonts.regular },
    completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill },
    completedText: { fontSize: 11, fontFamily: Fonts.bold },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: Spacing.sm },
    savedAmt: { fontSize: 26, fontFamily: Fonts.bold },
    targetAmt: { fontSize: 14, fontFamily: Fonts.medium },
    progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: '100%', borderRadius: 5 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    progressPct: { fontSize: 12, fontFamily: Fonts.bold },
    dailyNeeded: { fontSize: 11, fontFamily: Fonts.regular },

    // Actions
    actionRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: Radii.md },
    actionBtnText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
    historyBtn: { width: 38, height: 38, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },

    // Pickers
    pickerLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
    iconBtn: { width: 38, height: 38, borderRadius: Radii.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    colorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    colorDot: { width: 30, height: 30, borderRadius: 15 },

    // Quick deposit
    quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    quickBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1 },
    quickBtnText: { fontSize: 13, fontFamily: Fonts.bold },

    // Modal
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.sm },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },

    // History
    histSubtitle: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: Spacing.md },
    histEmpty: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.xl },
    histRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 0.5 },
    histIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    histAmt: { fontSize: 15, fontFamily: Fonts.bold },
    histDate: { fontSize: 11, fontFamily: Fonts.regular },
  });
