import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#E11D48';
const EVENT_COLORS = ['#E11D48', '#3B82F6', '#10B981', '#F97316', '#8B5CF6', '#EC4899', '#0EA5E9', '#F59E0B'];

type CountdownEvent = { id: string; title: string; date: string; color: string };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function getRemaining(dateStr: string) {
  const target = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, passed: true, total: 0 };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  return { days, hours, mins, secs, passed: false, total: diff };
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function EventCountdownScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [events, setEvents] = useState<CountdownEvent[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [color, setColor] = useState(EVENT_COLORS[0]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    loadJSON<CountdownEvent[]>(KEYS.countdownEvents, []).then(setEvents);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const persist = useCallback((e: CountdownEvent[]) => {
    setEvents(e);
    saveJSON(KEYS.countdownEvents, e);
  }, []);

  const addEvent = () => {
    if (!title.trim() || !date.trim()) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { Alert.alert('Invalid Date', 'Use YYYY-MM-DD format.'); return; }
    persist([...events, { id: uid(), title: title.trim(), date, color }]);
    setTitle(''); setDate(''); setShowAdd(false);
  };

  const removeEvent = (id: string) => {
    Alert.alert('Delete Event', 'Remove this countdown?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(events.filter(e => e.id !== id)) },
    ]);
  };

  const sorted = useMemo(() =>
    [...events].sort((a, b) => {
      const ra = getRemaining(a.date);
      const rb = getRemaining(b.date);
      if (ra.passed !== rb.passed) return ra.passed ? 1 : -1;
      return ra.total - rb.total;
    }),
    [events, tick],
  );

  return (
    <ScreenShell
      title="Event Countdown"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => { setTitle(''); setDate(''); setColor(EVENT_COLORS[0]); setShowAdd(true); }}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="hourglass-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No countdowns yet. Tap + to add one!</Text>
        </View>
      ) : (
        sorted.map(event => {
          const rem = getRemaining(event.date);
          const progress = rem.passed ? 1 : Math.max(0, 1 - (rem.total / (365 * 86400000)));
          return (
            <View key={event.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: event.color }]}>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => removeEvent(event.id)}>
                <Ionicons name="close-circle" size={20} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
              <Text style={[styles.eventDate, { color: colors.textMuted }]}>{event.date}</Text>

              {rem.passed ? (
                <View style={[styles.passedBadge, { backgroundColor: event.color + '20' }]}>
                  <Ionicons name="checkmark-circle" size={16} color={event.color} />
                  <Text style={[styles.passedText, { color: event.color }]}>Event has passed</Text>
                </View>
              ) : (
                <>
                  <View style={styles.timeRow}>
                    {[
                      { val: rem.days, label: 'Days' },
                      { val: rem.hours, label: 'Hrs' },
                      { val: rem.mins, label: 'Min' },
                      { val: rem.secs, label: 'Sec' },
                    ].map(t => (
                      <View key={t.label} style={[styles.timeBox, { backgroundColor: event.color + '15' }]}>
                        <Text style={[styles.timeVal, { color: event.color }]}>{t.val}</Text>
                        <Text style={[styles.timeLabel, { color: colors.textMuted }]}>{t.label}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: event.color }]} />
                  </View>
                </>
              )}
            </View>
          );
        })
      )}

      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Countdown</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Event name..."
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <View style={styles.colorRow}>
              {EVENT_COLORS.map(clr => (
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
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addEvent}>
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
    empty: { alignItems: 'center', paddingVertical: 60, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center' },
    card: { borderRadius: Radii.xl, borderWidth: 1, borderLeftWidth: 4, padding: Spacing.lg, marginBottom: Spacing.md, position: 'relative' },
    deleteBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, zIndex: 1 },
    eventTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: 4 },
    eventDate: { fontSize: 12, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    timeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    timeBox: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md, borderRadius: Radii.md },
    timeVal: { fontSize: 24, fontFamily: Fonts.bold },
    timeLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    progressTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    passedBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: Radii.md },
    passedText: { fontSize: 13, fontFamily: Fonts.semibold },
    colorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    colorDot: { width: 32, height: 32, borderRadius: 16 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
