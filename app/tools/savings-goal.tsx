import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#16A34A';

type SavingsGoal = {
  id: string;
  name: string;
  target: number;
  saved: number;
  deadline: string;
  color: string;
};

const COLORS = ['#16A34A', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0EA5E9', '#F97316'];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function SavingsGoalScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showDeposit, setShowDeposit] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [depositAmt, setDepositAmt] = useState('');

  useEffect(() => {
    loadJSON<SavingsGoal[]>(KEYS.savingsGoals, []).then(setGoals);
  }, []);

  const persist = useCallback((g: SavingsGoal[]) => {
    setGoals(g);
    saveJSON(KEYS.savingsGoals, g);
  }, []);

  const addGoal = () => {
    const t = parseFloat(target);
    if (!name.trim() || !t || t <= 0) return;
    persist([...goals, { id: uid(), name: name.trim(), target: t, saved: 0, deadline, color }]);
    setName(''); setTarget(''); setDeadline(''); setShowAdd(false);
  };

  const deposit = () => {
    const amt = parseFloat(depositAmt);
    if (!amt || amt <= 0 || !showDeposit) return;
    persist(goals.map(g => g.id === showDeposit ? { ...g, saved: g.saved + amt } : g));
    setDepositAmt(''); setShowDeposit(null);
  };

  const removeGoal = (id: string) => {
    Alert.alert('Delete Goal', 'Remove this savings goal?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(goals.filter(g => g.id !== id)) },
    ]);
  };

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return null;
    const diff = new Date(dateStr + 'T00:00:00').getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / 86400000));
  };

  return (
    <ScreenShell
      title="Savings Goal"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => { setName(''); setTarget(''); setDeadline(''); setColor(COLORS[0]); setShowAdd(true); }}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {goals.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="trophy-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No savings goals yet. Tap + to create one!</Text>
        </View>
      ) : (
        goals.map(goal => {
          const progress = Math.min(1, goal.saved / goal.target);
          const remaining = Math.max(0, goal.target - goal.saved);
          const days = daysUntil(goal.deadline);
          const dailyNeeded = days && days > 0 ? remaining / days : null;
          const completed = progress >= 1;

          return (
            <View key={goal.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: goal.color }]}>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeGoal(goal.id)}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.cardHeader}>
                <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
                {completed && <Ionicons name="checkmark-circle" size={20} color={goal.color} />}
              </View>

              <View style={styles.amountRow}>
                <Text style={[styles.savedAmt, { color: goal.color }]}>{goal.saved.toLocaleString()}</Text>
                <Text style={[styles.targetAmt, { color: colors.textMuted }]}>/ {goal.target.toLocaleString()}</Text>
              </View>

              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: goal.color }]} />
              </View>
              <Text style={[styles.progressText, { color: colors.textMuted }]}>{(progress * 100).toFixed(1)}%</Text>

              {!completed && (
                <View style={styles.infoRow}>
                  <Text style={[styles.infoText, { color: colors.textMuted }]}>
                    {remaining.toLocaleString()} remaining
                  </Text>
                  {days !== null && (
                    <Text style={[styles.infoText, { color: colors.textMuted }]}>
                      {days}d left {dailyNeeded ? `(${dailyNeeded.toFixed(0)}/day)` : ''}
                    </Text>
                  )}
                </View>
              )}

              {!completed && (
                <TouchableOpacity
                  style={[styles.depositBtn, { backgroundColor: goal.color }]}
                  onPress={() => { setShowDeposit(goal.id); setDepositAmt(''); }}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={styles.depositBtnText}>Add Deposit</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })
      )}

      {/* Add Goal Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Savings Goal</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={name} onChangeText={setName}
              placeholder="Goal name..." placeholderTextColor={colors.textMuted} autoFocus
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={target} onChangeText={setTarget}
              placeholder="Target amount" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={deadline} onChangeText={setDeadline}
              placeholder="Deadline (YYYY-MM-DD, optional)" placeholderTextColor={colors.textMuted} maxLength={10}
            />
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
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addGoal}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Deposit Modal */}
      <Modal visible={showDeposit !== null} transparent animationType="fade" onRequestClose={() => setShowDeposit(null)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Deposit</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={depositAmt} onChangeText={setDepositAmt}
              placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="numeric" autoFocus
            />
            <View style={styles.quickRow}>
              {[100, 500, 1000, 5000].map(a => (
                <TouchableOpacity key={a} style={[styles.quickBtn, { backgroundColor: ACCENT + '15' }]} onPress={() => setDepositAmt(String(a))}>
                  <Text style={[styles.quickBtnText, { color: ACCENT }]}>{a}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowDeposit(null)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={deposit}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Deposit</Text>
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
    empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center' },
    card: { borderRadius: Radii.xl, borderWidth: 1, borderLeftWidth: 4, padding: Spacing.lg, marginBottom: Spacing.md, position: 'relative' },
    deleteBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 1 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    goalName: { fontSize: 18, fontFamily: Fonts.bold, flex: 1 },
    amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4, marginBottom: Spacing.md },
    savedAmt: { fontSize: 28, fontFamily: Fonts.bold },
    targetAmt: { fontSize: 14, fontFamily: Fonts.medium },
    progressTrack: { height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: '100%', borderRadius: 5 },
    progressText: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'right' },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
    infoText: { fontSize: 12, fontFamily: Fonts.regular },
    depositBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radii.md, marginTop: Spacing.md },
    depositBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    colorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    quickRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    quickBtn: { flex: 1, paddingVertical: 8, borderRadius: Radii.md, alignItems: 'center' },
    quickBtnText: { fontSize: 14, fontFamily: Fonts.bold },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
