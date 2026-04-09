import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, Alert, ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import DateField from '@/components/DateField';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { schedule, cancel, ensureNotificationPermission } from '@/lib/notifications';
import EmptyState from '@/components/EmptyState';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#0891B2';

type TripStatus = 'planning' | 'ongoing' | 'completed';
type Trip = {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  spent: number;
  status: TripStatus;
  notes: string;
  expenses: TripExpense[];
};
type TripExpense = { id: string; label: string; amount: number; date: string };

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const STATUS_CONFIG: Record<TripStatus, { label: string; icon: string; color: string }> = {
  planning: { label: 'Planning', icon: 'map-outline', color: '#F59E0B' },
  ongoing: { label: 'Ongoing', icon: 'airplane-outline', color: '#3B82F6' },
  completed: { label: 'Completed', icon: 'checkmark-circle-outline', color: '#10B981' },
};

function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.ceil((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d} ${months[m - 1]} ${y}`;
}

export default function TravelTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [trips, setTrips] = useState<Trip[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [filter, setFilter] = useState<TripStatus | 'all'>('all');

  // Form
  const [dest, setDest] = useState('');
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(todayISO());
  const [budget, setBudget] = useState('');
  const [notes, setNotes] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  // Expense form
  const [expLabel, setExpLabel] = useState('');
  const [expAmount, setExpAmount] = useState('');

  useEffect(() => {
    loadJSON<Trip[]>(KEYS.travelTracker, []).then(setTrips);
  }, []);

  const persist = useCallback((t: Trip[]) => {
    setTrips(t);
    saveJSON(KEYS.travelTracker, t);
  }, []);

  const openAdd = (trip?: Trip) => {
    if (trip) {
      setEditId(trip.id);
      setDest(trip.destination);
      setStartDate(trip.startDate);
      setEndDate(trip.endDate);
      setBudget(trip.budget > 0 ? String(trip.budget) : '');
      setNotes(trip.notes);
    } else {
      setEditId(null);
      setDest('');
      setStartDate(todayISO());
      setEndDate(todayISO());
      setBudget('');
      setNotes('');
    }
    setShowAdd(true);
  };

  // Schedule a "trip starts tomorrow" reminder for the day before the trip
  // start date, fired at 09:00. No-op for trips already underway / past.
  const scheduleTrip = useCallback(async (t: Trip) => {
    const start = new Date(t.startDate + 'T00:00:00');
    start.setDate(start.getDate() - 1);
    start.setHours(9, 0, 0, 0);
    if (start.getTime() <= Date.now()) return;
    await ensureNotificationPermission();
    await schedule({
      id: t.id,
      namespace: 'travel',
      title: `Trip to ${t.destination} tomorrow`,
      body: `Pack your bags — leaving ${t.startDate}`,
      date: start,
      repeat: 'none',
    });
  }, []);

  const saveTrip = () => {
    if (!dest.trim()) return;
    if (editId) {
      const updated = trips.map(t => t.id === editId ? {
        ...t, destination: dest.trim(), startDate, endDate,
        budget: parseFloat(budget) || 0, notes: notes.trim(),
      } : t);
      persist(updated);
      const next = updated.find(t => t.id === editId);
      if (next) void scheduleTrip(next);
    } else {
      const trip: Trip = {
        id: uid(), destination: dest.trim(), startDate, endDate,
        budget: parseFloat(budget) || 0, spent: 0,
        status: 'planning', notes: notes.trim(), expenses: [],
      };
      persist([trip, ...trips]);
      void scheduleTrip(trip);
    }
    setShowAdd(false);
  };

  const deleteTrip = (id: string) => {
    Alert.alert('Delete Trip', 'Remove this trip?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        persist(trips.filter(t => t.id !== id));
        void cancel('travel', id);
        if (selectedTrip?.id === id) setSelectedTrip(null);
      }},
    ]);
  };

  const cycleStatus = (id: string) => {
    const order: TripStatus[] = ['planning', 'ongoing', 'completed'];
    persist(trips.map(t => {
      if (t.id !== id) return t;
      const idx = order.indexOf(t.status);
      return { ...t, status: order[(idx + 1) % order.length] };
    }));
  };

  const addExpense = () => {
    if (!selectedTrip || !expLabel.trim() || !expAmount.trim()) return;
    const amt = parseFloat(expAmount);
    if (!amt || amt <= 0) return;
    const expense: TripExpense = { id: uid(), label: expLabel.trim(), amount: amt, date: todayISO() };
    persist(trips.map(t => {
      if (t.id !== selectedTrip.id) return t;
      const newExpenses = [expense, ...t.expenses];
      return { ...t, expenses: newExpenses, spent: newExpenses.reduce((s, e) => s + e.amount, 0) };
    }));
    setExpLabel('');
    setExpAmount('');
    setShowExpense(false);
    setSelectedTrip(null);
  };

  const deleteExpense = (tripId: string, expId: string) => {
    persist(trips.map(t => {
      if (t.id !== tripId) return t;
      const newExpenses = t.expenses.filter(e => e.id !== expId);
      return { ...t, expenses: newExpenses, spent: newExpenses.reduce((s, e) => s + e.amount, 0) };
    }));
  };

  const filtered = filter === 'all' ? trips : trips.filter(t => t.status === filter);

  const totalBudget = trips.reduce((s, t) => s + t.budget, 0);
  const totalSpent = trips.reduce((s, t) => s + t.spent, 0);

  return (
    <ScreenShell
      title="Travel Tracker"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={() => openAdd()}>
          <Ionicons name="add-circle-outline" size={24} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* Hero Card */}
      <LinearGradient
        colors={['#164E63', '#0891B2', '#22D3EE']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroLabel}>TRAVEL OVERVIEW</Text>
        <Text style={styles.heroTitle}>{trips.length} Trip{trips.length !== 1 ? 's' : ''} Planned</Text>
        <Text style={styles.heroSub}>
          {trips.filter(t => t.status === 'ongoing').length} ongoing · {trips.filter(t => t.status === 'completed').length} completed
        </Text>
        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{totalBudget > 0 ? totalBudget.toLocaleString() : '—'}</Text>
            <Text style={styles.heroStatLabel}>TOTAL BUDGET</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{totalSpent.toLocaleString()}</Text>
            <Text style={styles.heroStatLabel}>TOTAL SPENT</Text>
          </View>
          <View style={[styles.heroDivider, { backgroundColor: 'rgba(255,255,255,0.25)' }]} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatVal}>{totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%</Text>
            <Text style={styles.heroStatLabel}>USED</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {(['all', 'planning', 'ongoing', 'completed'] as const).map(f => (
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

      {/* Trips */}
      {filtered.length === 0 ? (
        <EmptyState
          icon="airplane-outline"
          title="No trips yet"
          hint="Plan your next trip with a destination, dates and budget. Log expenses while you travel and watch the budget bar update."
          accent={ACCENT}
          actionLabel="Plan a trip"
          onAction={() => setShowAdd(true)}
        />
      ) : filtered.map(trip => {
        const cfg = STATUS_CONFIG[trip.status];
        const duration = daysBetween(trip.startDate, trip.endDate);
        const pct = trip.budget > 0 ? Math.min((trip.spent / trip.budget) * 100, 100) : 0;
        return (
          <View key={trip.id} style={[styles.tripCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.tripHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.tripDest, { color: colors.text }]}>{trip.destination}</Text>
                <Text style={[styles.tripDates, { color: colors.textMuted }]}>
                  {formatDate(trip.startDate)} — {formatDate(trip.endDate)} ({duration > 0 ? duration : 1}d)
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.statusBadge, { backgroundColor: cfg.color + '20' }]}
                onPress={() => cycleStatus(trip.id)}
              >
                <Ionicons name={cfg.icon as any} size={14} color={cfg.color} />
                <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
              </TouchableOpacity>
            </View>

            {trip.budget > 0 && (
              <View style={styles.budgetWrap}>
                <View style={styles.budgetLabels}>
                  <Text style={[styles.budgetText, { color: colors.textMuted }]}>
                    Spent: {trip.spent.toLocaleString()}
                  </Text>
                  <Text style={[styles.budgetText, { color: colors.textMuted }]}>
                    Budget: {trip.budget.toLocaleString()}
                  </Text>
                </View>
                <View style={[styles.budgetBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.budgetFill, { width: `${pct}%`, backgroundColor: pct > 90 ? '#EF4444' : ACCENT }]} />
                </View>
              </View>
            )}

            {trip.notes ? (
              <Text style={[styles.tripNotes, { color: colors.textSub }]} numberOfLines={2}>{trip.notes}</Text>
            ) : null}

            {trip.expenses.length > 0 && (
              <View style={styles.expList}>
                {trip.expenses.slice(0, 3).map(e => (
                  <View key={e.id} style={[styles.expRow, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.expLabel, { color: colors.text }]}>{e.label}</Text>
                    <Text style={[styles.expAmt, { color: ACCENT }]}>{e.amount.toLocaleString()}</Text>
                    <TouchableOpacity onPress={() => deleteExpense(trip.id, e.id)} style={{ marginLeft: 6 }}>
                      <Ionicons name="close-circle-outline" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}
                {trip.expenses.length > 3 && (
                  <Text style={[styles.moreText, { color: colors.textMuted }]}>+{trip.expenses.length - 3} more</Text>
                )}
              </View>
            )}

            <View style={styles.tripActions}>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT + '15' }]} onPress={() => { setSelectedTrip(trip); setExpLabel(''); setExpAmount(''); setShowExpense(true); }}>
                <Ionicons name="add-outline" size={16} color={ACCENT} />
                <Text style={[styles.actionText, { color: ACCENT }]}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface }]} onPress={() => openAdd(trip)}>
                <Ionicons name="create-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.surface }]} onPress={() => deleteTrip(trip.id)}>
                <Ionicons name="trash-outline" size={16} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {/* Add/Edit Trip Modal */}
      <Modal visible={showAdd} transparent animationType="fade" onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{editId ? 'Edit Trip' : 'New Trip'}</Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Destination</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={dest} onChangeText={setDest} placeholder="Where to?" placeholderTextColor={colors.textMuted} autoFocus
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Start Date</Text>
            <DateField
              value={startDate}
              onChange={setStartDate}
              accent={ACCENT}
              placeholder="When does the trip begin?"
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>End Date</Text>
            <DateField
              value={endDate}
              onChange={setEndDate}
              accent={ACCENT}
              placeholder="When does it end?"
              minDate={startDate || undefined}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Budget</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={budget} onChangeText={setBudget} placeholder="Total budget" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Notes</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, height: 70, textAlignVertical: 'top' }]}
              value={notes} onChangeText={setNotes} placeholder="Trip notes..." placeholderTextColor={colors.textMuted} multiline
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowAdd(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={saveTrip}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>{editId ? 'Update' : 'Add Trip'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Expense Modal */}
      <Modal visible={showExpense} transparent animationType="fade" onRequestClose={() => setShowExpense(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Expense</Text>
            {selectedTrip && <Text style={[styles.fieldLabel, { color: ACCENT, marginBottom: Spacing.md }]}>{selectedTrip.destination}</Text>}

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Label</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={expLabel} onChangeText={setExpLabel} placeholder="e.g. Hotel, Food, Transport" placeholderTextColor={colors.textMuted} autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Amount</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={expAmount} onChangeText={setExpAmount} placeholder="Amount" placeholderTextColor={colors.textMuted} keyboardType="numeric"
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowExpense(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={addExpense}>
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
    tripCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    tripHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: Spacing.sm },
    tripDest: { fontSize: 17, fontFamily: Fonts.bold },
    tripDates: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
    statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: Radii.pill },
    statusText: { fontSize: 11, fontFamily: Fonts.bold },
    budgetWrap: { marginBottom: Spacing.sm },
    budgetLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    budgetText: { fontSize: 11, fontFamily: Fonts.medium },
    budgetBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
    budgetFill: { height: '100%', borderRadius: 3 },
    tripNotes: { fontSize: 12, fontFamily: Fonts.regular, marginBottom: Spacing.sm },
    expList: { marginBottom: Spacing.sm },
    expRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 0.5 },
    expLabel: { flex: 1, fontSize: 13, fontFamily: Fonts.medium },
    expAmt: { fontSize: 13, fontFamily: Fonts.bold },
    moreText: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 4, textAlign: 'center' },
    tripActions: { flexDirection: 'row', gap: 8, marginTop: Spacing.sm },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.md },
    actionText: { fontSize: 12, fontFamily: Fonts.semibold },
    rowInputs: { flexDirection: 'row', gap: Spacing.md },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.sm },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
  });
