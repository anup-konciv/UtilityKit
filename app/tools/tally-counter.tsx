import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Modal, Alert, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#0891B2';
const COUNTER_COLORS = ['#0891B2', '#3B82F6', '#10B981', '#F97316', '#EF4444', '#8B5CF6', '#EC4899', '#F59E0B'];

type Counter = { id: string; label: string; count: number; color: string };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function TallyCounterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [counters, setCounters] = useState<Counter[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(COUNTER_COLORS[0]);

  useEffect(() => {
    loadJSON<Counter[]>(KEYS.tallyCounters, [
      { id: uid(), label: 'Counter', count: 0, color: ACCENT },
    ]).then(setCounters);
  }, []);

  const persist = useCallback((c: Counter[]) => {
    setCounters(c);
    saveJSON(KEYS.tallyCounters, c);
  }, []);

  const increment = (id: string) => {
    Vibration.vibrate(10);
    persist(counters.map(c => c.id === id ? { ...c, count: c.count + 1 } : c));
  };

  const decrement = (id: string) => {
    persist(counters.map(c => c.id === id ? { ...c, count: Math.max(0, c.count - 1) } : c));
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

  const addCounter = () => {
    if (!newLabel.trim()) return;
    persist([...counters, { id: uid(), label: newLabel.trim(), count: 0, color: newColor }]);
    setNewLabel('');
    setShowAdd(false);
  };

  return (
    <ScreenShell
      title="Tally Counter"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => { setNewLabel(''); setNewColor(COUNTER_COLORS[0]); setShowAdd(true); }}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {counters.map(counter => (
        <View key={counter.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: counter.color }]}>
          <Text style={[styles.label, { color: colors.text }]}>{counter.label}</Text>
          <Text style={[styles.count, { color: counter.color }]}>{counter.count}</Text>

          <View style={styles.btnRow}>
            <TouchableOpacity style={[styles.btn, { backgroundColor: '#EF444420' }]} onPress={() => decrement(counter.id)}>
              <Ionicons name="remove" size={28} color="#EF4444" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.mainBtn, { backgroundColor: counter.color }]}
              onPress={() => increment(counter.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={36} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btn, { backgroundColor: counter.color + '20' }]} onPress={() => reset(counter.id)}>
              <Ionicons name="refresh" size={22} color={counter.color} />
            </TouchableOpacity>
          </View>

          {counters.length > 1 && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => remove(counter.id)}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      ))}

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Counter</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newLabel}
              onChangeText={setNewLabel}
              placeholder="Counter name..."
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
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
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addCounter}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Add</Text>
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
    card: { borderRadius: Radii.xl, borderWidth: 1, borderLeftWidth: 4, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg, position: 'relative' },
    label: { fontSize: 14, fontFamily: Fonts.semibold, marginBottom: Spacing.sm },
    count: { fontSize: 64, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    btnRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    btn: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    mainBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
    deleteBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm },
    colorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.lg },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
