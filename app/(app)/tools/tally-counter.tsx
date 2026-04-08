import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { haptics } from '@/lib/haptics';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#0891B2';
const COUNTER_COLORS = ['#0891B2', '#3B82F6', '#10B981', '#F97316', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B'];
const STEP_OPTIONS = [1, 2, 5, 10, 25, 50, 100];

type Counter = { id: string; label: string; count: number; color: string; step: number; target: number };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function TallyCounterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDark = colors.bg === '#0B1120';

  const [counters, setCounters] = useState<Counter[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Counter | null>(null);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(COUNTER_COLORS[0]);
  const [newStep, setNewStep] = useState(1);
  const [newTarget, setNewTarget] = useState('');

  useEffect(() => {
    loadJSON<Counter[]>(KEYS.tallyCounters, [
      { id: uid(), label: 'Counter', count: 0, color: ACCENT, step: 1, target: 0 },
    ]).then(loaded => {
      // Migrate old counters missing step/target
      setCounters(loaded.map(c => ({ ...c, step: c.step ?? 1, target: c.target ?? 0 })));
    });
  }, []);

  const persist = useCallback((c: Counter[]) => {
    setCounters(c);
    saveJSON(KEYS.tallyCounters, c);
  }, []);

  const increment = (id: string) => {
    haptics.tap();
    persist(counters.map(c => c.id === id ? { ...c, count: c.count + c.step } : c));
  };

  const decrement = (id: string) => {
    persist(counters.map(c => c.id === id ? { ...c, count: Math.max(0, c.count - c.step) } : c));
  };

  const reset = (id: string) => {
    Alert.alert('Reset Counter', 'Set count back to 0?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', onPress: () => persist(counters.map(c => c.id === id ? { ...c, count: 0 } : c)) },
    ]);
  };

  const remove = (id: string) => {
    if (counters.length <= 1) return;
    Alert.alert('Delete Counter', 'Remove this counter?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(counters.filter(c => c.id !== id)) },
    ]);
  };

  const openEdit = (counter: Counter) => {
    setEditing(counter);
    setNewLabel(counter.label);
    setNewColor(counter.color);
    setNewStep(counter.step);
    setNewTarget(counter.target > 0 ? String(counter.target) : '');
    setShowAdd(true);
  };

  const saveCounter = () => {
    if (!newLabel.trim()) return;
    const target = parseInt(newTarget) || 0;
    if (editing) {
      persist(counters.map(c => c.id === editing.id
        ? { ...c, label: newLabel.trim(), color: newColor, step: newStep, target }
        : c
      ));
    } else {
      persist([...counters, { id: uid(), label: newLabel.trim(), count: 0, color: newColor, step: newStep, target }]);
    }
    setNewLabel(''); setEditing(null); setShowAdd(false);
  };

  const totalCount = counters.reduce((s, c) => s + c.count, 0);

  return (
    <ScreenShell
      title="Tally Counter"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => { setEditing(null); setNewLabel(''); setNewColor(COUNTER_COLORS[0]); setNewStep(1); setNewTarget(''); setShowAdd(true); }}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Summary */}
      {counters.length > 1 && (
        <View style={[styles.summaryRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="stats-chart-outline" size={16} color={ACCENT} />
          <Text style={[styles.summaryText, { color: colors.text }]}>
            Total: <Text style={{ color: ACCENT, fontFamily: Fonts.bold }}>{totalCount}</Text>
          </Text>
          <Text style={[styles.summaryText, { color: colors.textMuted }]}>
            {counters.length} counters
          </Text>
        </View>
      )}

      {counters.map(counter => {
        const hasTarget = counter.target > 0;
        const progress = hasTarget ? Math.min(1, counter.count / counter.target) : 0;
        const targetReached = hasTarget && counter.count >= counter.target;

        return (
          <View key={counter.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.cardHeader}>
              <TouchableOpacity onPress={() => openEdit(counter)} style={{ flex: 1 }}>
                <Text style={[styles.label, { color: colors.text }]}>{counter.label}</Text>
                {counter.step > 1 && (
                  <Text style={[styles.stepBadge, { color: colors.textMuted }]}>Step: {counter.step}</Text>
                )}
              </TouchableOpacity>
              {counters.length > 1 && (
                <TouchableOpacity onPress={() => remove(counter.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Count */}
            <Text style={[styles.count, { color: counter.color }]}>{counter.count}</Text>

            {/* Target progress */}
            {hasTarget && (
              <View style={{ width: '100%', marginBottom: Spacing.md }}>
                <View style={[styles.progressTrack, { backgroundColor: counter.color + '15' }]}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: counter.color }]} />
                </View>
                <Text style={[styles.targetText, { color: targetReached ? counter.color : colors.textMuted }]}>
                  {targetReached ? 'Target reached!' : `${counter.count} / ${counter.target}`}
                </Text>
              </View>
            )}

            {/* Controls */}
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: isDark ? '#3B1111' : '#FEE2E2' }]}
                onPress={() => decrement(counter.id)}
              >
                <Ionicons name="remove" size={26} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.mainBtn, { backgroundColor: counter.color }]}
                onPress={() => increment(counter.id)}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={36} color="#fff" />
                <Text style={styles.mainBtnLabel}>+{counter.step}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.sideBtn, { backgroundColor: counter.color + '15' }]}
                onPress={() => reset(counter.id)}
              >
                <Ionicons name="refresh" size={22} color={counter.color} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Add/Edit Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => { setShowAdd(false); setEditing(null); }}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editing ? 'Edit Counter' : 'New Counter'}</Text>

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newLabel} onChangeText={setNewLabel}
              placeholder="Counter name..." placeholderTextColor={colors.textMuted} autoFocus
            />

            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newTarget} onChangeText={setNewTarget}
              placeholder="Target (optional)" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />

            {/* Step size */}
            <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Step Size</Text>
            <View style={styles.stepRow}>
              {STEP_OPTIONS.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.stepBtn, {
                    backgroundColor: newStep === s ? ACCENT + '20' : colors.inputBg,
                    borderColor: newStep === s ? ACCENT : colors.border,
                  }]}
                  onPress={() => setNewStep(s)}
                >
                  <Text style={[styles.stepBtnText, { color: newStep === s ? ACCENT : colors.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Color */}
            <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Color</Text>
            <View style={styles.colorRow}>
              {COUNTER_COLORS.map(clr => (
                <TouchableOpacity
                  key={clr}
                  style={[styles.colorDot, { backgroundColor: clr }, newColor === clr && { borderWidth: 3, borderColor: colors.text }]}
                  onPress={() => setNewColor(clr)}
                />
              ))}
            </View>

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => { setShowAdd(false); setEditing(null); }}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveCounter}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{editing ? 'Save' : 'Add'}</Text>
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
    summaryRow: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radii.lg,
      borderWidth: 1, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginBottom: Spacing.md,
    },
    summaryText: { fontSize: 13, fontFamily: Fonts.medium },

    card: {
      borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.xl, alignItems: 'center',
      marginBottom: Spacing.lg, elevation: 2, shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: Spacing.sm },
    label: { fontSize: 16, fontFamily: Fonts.semibold },
    stepBadge: { fontSize: 11, fontFamily: Fonts.medium },
    count: { fontSize: 72, fontFamily: Fonts.bold, marginBottom: Spacing.md },
    progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
    progressFill: { height: '100%', borderRadius: 4 },
    targetText: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'center' },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    sideBtn: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
    mainBtn: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
    mainBtnLabel: { fontSize: 10, fontFamily: Fonts.bold, color: '#fff', marginTop: -2 },

    pickerLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
    stepRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
    stepBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5 },
    stepBtnText: { fontSize: 14, fontFamily: Fonts.bold },
    colorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    colorDot: { width: 30, height: 30, borderRadius: 15 },

    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
