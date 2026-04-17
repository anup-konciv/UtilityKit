import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert, ScrollView, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';

// ─── Constants ──────────────────────────────────────────────────────────────
const ACCENT = '#06B6D4';
const STORAGE_KEY = 'uk_medications';
const LOG_KEY = 'uk_medication_logs';

type Frequency = 'daily' | 'twice_daily' | 'weekly' | 'as_needed';
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'twice_daily', label: 'Twice Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'as_needed', label: 'As Needed' },
];

const TIMES_OF_DAY: { value: TimeOfDay; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'morning', label: 'Morning', icon: 'sunny-outline' },
  { value: 'afternoon', label: 'Afternoon', icon: 'partly-sunny-outline' },
  { value: 'evening', label: 'Evening', icon: 'cloudy-night-outline' },
  { value: 'night', label: 'Night', icon: 'moon-outline' },
];

const FREQ_COLORS: Record<Frequency, string> = {
  daily: '#10B981',
  twice_daily: '#3B82F6',
  weekly: '#8B5CF6',
  as_needed: '#F59E0B',
};

const FREQ_ICONS: Record<Frequency, keyof typeof Ionicons.glyphMap> = {
  daily: 'medical-outline',
  twice_daily: 'medkit-outline',
  weekly: 'calendar-outline',
  as_needed: 'hand-left-outline',
};

// ─── Types ──────────────────────────────────────────────────────────────────
type Medication = {
  id: string;
  name: string;
  dosage: string;
  frequency: Frequency;
  timeOfDay: TimeOfDay[];
  active: boolean;
  createdAt: string;
};

// "YYYY-MM-DD" -> array of { medId, timeOfDay, takenAt }
type MedLog = Record<string, { medId: string; timeOfDay: TimeOfDay; takenAt: string }[]>;

// ─── Helpers ────────────────────────────────────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function last7Keys(): string[] {
  const keys: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

function last30Keys(): string[] {
  const keys: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    keys.push(dateKey(d));
  }
  return keys;
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** How many doses a medication requires per day based on frequency + time slots */
function dosesPerDay(med: Medication): number {
  if (med.frequency === 'as_needed') return 0;
  if (med.frequency === 'weekly') return med.timeOfDay.length; // only on the scheduled day
  if (med.frequency === 'twice_daily') return Math.max(2, med.timeOfDay.length);
  return med.timeOfDay.length; // daily
}

/** All scheduled dose slots for today (med + timeOfDay combos) */
function getTodaySlots(meds: Medication[]): { med: Medication; time: TimeOfDay }[] {
  const slots: { med: Medication; time: TimeOfDay }[] = [];
  const today = new Date();
  for (const med of meds) {
    if (!med.active) continue;
    if (med.frequency === 'as_needed') continue;
    if (med.frequency === 'weekly') {
      // Show weekly meds only on the day they were created
      const created = new Date(med.createdAt);
      if (created.getDay() !== today.getDay()) continue;
    }
    for (const t of med.timeOfDay) {
      slots.push({ med, time: t });
    }
  }
  // Sort by time of day order
  const timeOrder: Record<TimeOfDay, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 };
  slots.sort((a, b) => timeOrder[a.time] - timeOrder[b.time]);
  return slots;
}

function isTaken(log: MedLog, day: string, medId: string, time: TimeOfDay): boolean {
  const entries = log[day] ?? [];
  return entries.some(e => e.medId === medId && e.timeOfDay === time);
}

function withAlpha(hex: string, alpha: string): string {
  return hex + alpha;
}

// ─── Component ──────────────────────────────────────────────────────────────
export default function MedicationTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  // ── State ───────────────────────────────────────────────────────────────
  const [meds, setMeds] = useState<Medication[]>([]);
  const [logs, setLogs] = useState<MedLog>({});
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Medication | null>(null);
  const [tab, setTab] = useState<'today' | 'meds' | 'stats'>('today');

  // Form state
  const [formName, setFormName] = useState('');
  const [formDosage, setFormDosage] = useState('');
  const [formFreq, setFormFreq] = useState<Frequency>('daily');
  const [formTimes, setFormTimes] = useState<TimeOfDay[]>(['morning']);

  // ── Load ────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadJSON<Medication[]>(STORAGE_KEY, []).then(setMeds);
    loadJSON<MedLog>(LOG_KEY, {}).then(setLogs);
  }, []);

  const persistMeds = useCallback((updated: Medication[]) => {
    setMeds(updated);
    saveJSON(STORAGE_KEY, updated);
  }, []);

  const persistLogs = useCallback((updated: MedLog) => {
    setLogs(updated);
    saveJSON(LOG_KEY, updated);
  }, []);

  // ── Derived ─────────────────────────────────────────────────────────────
  const today = todayKey();
  const todaySlots = useMemo(() => getTodaySlots(meds), [meds]);
  const todayLog = useMemo(() => logs[today] ?? [], [logs, today]);

  const todayTakenCount = useMemo(() => {
    return todaySlots.filter(s => isTaken(logs, today, s.med.id, s.time)).length;
  }, [todaySlots, logs, today]);

  const todayProgress = todaySlots.length > 0
    ? Math.round((todayTakenCount / todaySlots.length) * 100)
    : 0;

  // Adherence stats
  const stats = useMemo(() => {
    const activeMeds = meds.filter(m => m.active);
    if (activeMeds.length === 0) return { weekPct: 0, monthPct: 0, streak: 0, bestMed: '--' };

    const week7 = last7Keys();
    const month30 = last30Keys();

    let weekTaken = 0;
    let weekExpected = 0;
    let monthTaken = 0;
    let monthExpected = 0;

    for (const med of activeMeds) {
      if (med.frequency === 'as_needed') continue;
      const expectedPerDay = med.timeOfDay.length;

      for (const day of week7) {
        if (med.frequency === 'weekly') {
          const [y, m, d] = day.split('-').map(Number);
          const dayDate = new Date(y, m - 1, d);
          const created = new Date(med.createdAt);
          if (dayDate.getDay() !== created.getDay()) continue;
        }
        weekExpected += expectedPerDay;
        const dayEntries = logs[day] ?? [];
        weekTaken += dayEntries.filter(e => e.medId === med.id).length;
      }

      for (const day of month30) {
        if (med.frequency === 'weekly') {
          const [y, m, d] = day.split('-').map(Number);
          const dayDate = new Date(y, m - 1, d);
          const created = new Date(med.createdAt);
          if (dayDate.getDay() !== created.getDay()) continue;
        }
        monthExpected += expectedPerDay;
        const dayEntries = logs[day] ?? [];
        monthTaken += dayEntries.filter(e => e.medId === med.id).length;
      }
    }

    const weekPct = weekExpected > 0 ? Math.round((weekTaken / weekExpected) * 100) : 0;
    const monthPct = monthExpected > 0 ? Math.round((monthTaken / monthExpected) * 100) : 0;

    // Current streak (consecutive days where all scheduled meds taken)
    let streak = 0;
    const cursor = new Date();
    while (true) {
      const key = dateKey(cursor);
      const daySlots = getTodaySlots(activeMeds).length; // approximate using current schedule
      if (daySlots === 0) break;
      const dayEntries = logs[key] ?? [];
      // Check if all active non-as-needed meds have entries for this day
      let allTaken = true;
      for (const med of activeMeds) {
        if (med.frequency === 'as_needed') continue;
        if (med.frequency === 'weekly') {
          const created = new Date(med.createdAt);
          if (cursor.getDay() !== created.getDay()) continue;
        }
        for (const t of med.timeOfDay) {
          if (!dayEntries.some(e => e.medId === med.id && e.timeOfDay === t)) {
            allTaken = false;
            break;
          }
        }
        if (!allTaken) break;
      }
      if (!allTaken) break;
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Best adherence medication
    let bestMed = '--';
    let bestRate = -1;
    for (const med of activeMeds) {
      if (med.frequency === 'as_needed') continue;
      let taken = 0;
      let expected = 0;
      for (const day of week7) {
        if (med.frequency === 'weekly') {
          const [y, m, d] = day.split('-').map(Number);
          const dayDate = new Date(y, m - 1, d);
          const created = new Date(med.createdAt);
          if (dayDate.getDay() !== created.getDay()) continue;
        }
        expected += med.timeOfDay.length;
        const dayEntries = logs[day] ?? [];
        taken += dayEntries.filter(e => e.medId === med.id).length;
      }
      const rate = expected > 0 ? taken / expected : 0;
      if (rate > bestRate) {
        bestRate = rate;
        bestMed = med.name;
      }
    }

    return { weekPct, monthPct, streak, bestMed };
  }, [meds, logs]);

  // ── Actions ─────────────────────────────────────────────────────────────
  const openAddForm = useCallback(() => {
    setEditTarget(null);
    setFormName('');
    setFormDosage('');
    setFormFreq('daily');
    setFormTimes(['morning']);
    setShowForm(true);
  }, []);

  const openEditForm = useCallback((med: Medication) => {
    setEditTarget(med);
    setFormName(med.name);
    setFormDosage(med.dosage);
    setFormFreq(med.frequency);
    setFormTimes([...med.timeOfDay]);
    setShowForm(true);
  }, []);

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditTarget(null);
  }, []);

  const toggleFormTime = useCallback((time: TimeOfDay) => {
    setFormTimes(prev =>
      prev.includes(time) ? prev.filter(t => t !== time) : [...prev, time]
    );
  }, []);

  const saveMed = useCallback(() => {
    const trimmedName = formName.trim();
    const trimmedDosage = formDosage.trim();
    if (!trimmedName) {
      Alert.alert('Missing Name', 'Please enter a medication name.');
      return;
    }
    if (formTimes.length === 0) {
      Alert.alert('Missing Time', 'Please select at least one time of day.');
      return;
    }

    if (editTarget) {
      const updated: Medication = {
        ...editTarget,
        name: trimmedName,
        dosage: trimmedDosage,
        frequency: formFreq,
        timeOfDay: formTimes,
      };
      persistMeds(meds.map(m => (m.id === editTarget.id ? updated : m)));
    } else {
      const med: Medication = {
        id: uid(),
        name: trimmedName,
        dosage: trimmedDosage,
        frequency: formFreq,
        timeOfDay: formTimes,
        active: true,
        createdAt: new Date().toISOString(),
      };
      persistMeds([...meds, med]);
    }
    closeForm();
  }, [formName, formDosage, formFreq, formTimes, editTarget, meds, persistMeds, closeForm]);

  const deleteMed = useCallback((id: string) => {
    Alert.alert('Delete Medication', 'Remove this medication and all its logs?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          persistMeds(meds.filter(m => m.id !== id));
          // Clean logs
          const cleaned: MedLog = {};
          for (const [key, entries] of Object.entries(logs)) {
            const filtered = entries.filter(e => e.medId !== id);
            if (filtered.length > 0) cleaned[key] = filtered;
          }
          persistLogs(cleaned);
        },
      },
    ]);
  }, [meds, logs, persistMeds, persistLogs]);

  const toggleActive = useCallback((id: string) => {
    persistMeds(meds.map(m => m.id === id ? { ...m, active: !m.active } : m));
  }, [meds, persistMeds]);

  const toggleTaken = useCallback((medId: string, time: TimeOfDay) => {
    const dayEntries = logs[today] ?? [];
    const alreadyTaken = dayEntries.some(e => e.medId === medId && e.timeOfDay === time);

    let updated: typeof dayEntries;
    if (alreadyTaken) {
      updated = dayEntries.filter(e => !(e.medId === medId && e.timeOfDay === time));
    } else {
      updated = [...dayEntries, { medId, timeOfDay: time, takenAt: new Date().toISOString() }];
    }
    persistLogs({ ...logs, [today]: updated });
  }, [logs, today, persistLogs]);

  // ── Render: Today Tab ───────────────────────────────────────────────────
  const renderTodayTab = () => {
    const timeGroups: Record<TimeOfDay, { med: Medication; time: TimeOfDay }[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      night: [],
    };
    for (const slot of todaySlots) {
      timeGroups[slot.time].push(slot);
    }

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        {/* Progress Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.progressHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.progressPct, { color: ACCENT }]}>{todayProgress}%</Text>
              <Text style={[styles.progressSub, { color: colors.textMuted }]}>
                {todayTakenCount}/{todaySlots.length} doses taken today
              </Text>
              {todayProgress === 100 && todaySlots.length > 0 && (
                <View style={[styles.allDoneBadge, { backgroundColor: withAlpha('#10B981', '20') }]}>
                  <Ionicons name="checkmark-done" size={14} color="#10B981" />
                  <Text style={[styles.allDoneText, { color: '#10B981' }]}>All medications taken!</Text>
                </View>
              )}
            </View>
            <View style={[styles.progressRingOuter, { borderColor: withAlpha(ACCENT, '30') }]}>
              <View style={[styles.progressRingInner, {
                backgroundColor: todayProgress === 100 ? '#10B981' : ACCENT,
              }]}>
                <Ionicons
                  name={todayProgress === 100 ? 'checkmark-done' : 'medical'}
                  size={22}
                  color="#fff"
                />
              </View>
            </View>
          </View>

          {/* Progress bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.glass }]}>
            <View style={[styles.progressBarFill, {
              width: `${todayProgress}%`,
              backgroundColor: todayProgress === 100 ? '#10B981' : ACCENT,
            }]} />
          </View>
        </View>

        {/* Time-grouped medication slots */}
        {todaySlots.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="medical-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No medications scheduled</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Add medications and they will appear here based on your schedule.
            </Text>
            <TouchableOpacity
              style={[styles.emptyBtn, { backgroundColor: ACCENT }]}
              onPress={openAddForm}
              activeOpacity={0.7}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={[styles.emptyBtnText, { color: '#fff' }]}>Add Medication</Text>
            </TouchableOpacity>
          </View>
        ) : (
          (['morning', 'afternoon', 'evening', 'night'] as TimeOfDay[]).map(time => {
            const group = timeGroups[time];
            if (group.length === 0) return null;
            const timeMeta = TIMES_OF_DAY.find(t => t.value === time)!;
            return (
              <View key={time} style={{ marginBottom: Spacing.md }}>
                <View style={styles.timeGroupHeader}>
                  <Ionicons name={timeMeta.icon} size={16} color={ACCENT} />
                  <Text style={[styles.timeGroupLabel, { color: colors.text }]}>{timeMeta.label}</Text>
                </View>
                {group.map(slot => {
                  const taken = isTaken(logs, today, slot.med.id, slot.time);
                  const freqColor = FREQ_COLORS[slot.med.frequency];
                  return (
                    <TouchableOpacity
                      key={`${slot.med.id}-${slot.time}`}
                      style={[styles.doseCard, {
                        backgroundColor: colors.card,
                        borderColor: taken ? withAlpha('#10B981', '40') : colors.border,
                      }]}
                      onPress={() => toggleTaken(slot.med.id, slot.time)}
                      activeOpacity={0.7}
                    >
                      {/* Checkbox */}
                      <View style={[styles.checkbox, {
                        backgroundColor: taken ? '#10B981' : 'transparent',
                        borderColor: taken ? '#10B981' : colors.textMuted,
                      }]}>
                        {taken && <Ionicons name="checkmark" size={14} color="#fff" />}
                      </View>

                      {/* Pill icon */}
                      <View style={[styles.pillIcon, { backgroundColor: withAlpha(freqColor, '18') }]}>
                        <Ionicons name={FREQ_ICONS[slot.med.frequency]} size={18} color={freqColor} />
                      </View>

                      {/* Info */}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.doseName, { color: colors.text }, taken && styles.doseNameDone]}>
                          {slot.med.name}
                        </Text>
                        {slot.med.dosage ? (
                          <Text style={[styles.doseDosage, { color: colors.textMuted }]}>{slot.med.dosage}</Text>
                        ) : null}
                      </View>

                      {/* Frequency badge */}
                      <View style={[styles.freqBadge, { backgroundColor: withAlpha(freqColor, '15') }]}>
                        <Text style={[styles.freqBadgeText, { color: freqColor }]}>
                          {FREQUENCIES.find(f => f.value === slot.med.frequency)?.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          })
        )}
      </ScrollView>
    );
  };

  // ── Render: Medications List Tab ────────────────────────────────────────
  const renderMedsTab = () => {
    const activeMeds = meds.filter(m => m.active);
    const inactiveMeds = meds.filter(m => !m.active);

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        {/* Add button */}
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={openAddForm}
          activeOpacity={0.7}
        >
          <Ionicons name="add-circle-outline" size={20} color={ACCENT} />
          <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Medication</Text>
        </TouchableOpacity>

        {meds.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="medkit-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No medications yet</Text>
            <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
              Add your medications to start tracking your adherence.
            </Text>
          </View>
        ) : (
          <>
            {/* Active medications */}
            {activeMeds.length > 0 && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  ACTIVE ({activeMeds.length})
                </Text>
                {activeMeds.map(med => renderMedCard(med))}
              </View>
            )}

            {/* Inactive medications */}
            {inactiveMeds.length > 0 && (
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                  INACTIVE ({inactiveMeds.length})
                </Text>
                {inactiveMeds.map(med => renderMedCard(med))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderMedCard = (med: Medication) => {
    const freqColor = FREQ_COLORS[med.frequency];
    const freqLabel = FREQUENCIES.find(f => f.value === med.frequency)?.label ?? '';
    const timeLabels = med.timeOfDay.map(t => TIMES_OF_DAY.find(td => td.value === t)?.label ?? t);

    return (
      <View
        key={med.id}
        style={[styles.medCard, {
          backgroundColor: colors.card,
          borderColor: med.active ? colors.border : withAlpha(colors.border, '60'),
          opacity: med.active ? 1 : 0.65,
        }]}
      >
        <View style={styles.medCardTop}>
          {/* Pill icon */}
          <View style={[styles.pillIcon, { backgroundColor: withAlpha(freqColor, '18') }]}>
            <Ionicons name={FREQ_ICONS[med.frequency]} size={20} color={freqColor} />
          </View>

          {/* Name + dosage */}
          <View style={{ flex: 1 }}>
            <Text style={[styles.medName, { color: colors.text }]}>{med.name}</Text>
            {med.dosage ? (
              <Text style={[styles.medDosage, { color: colors.textMuted }]}>{med.dosage}</Text>
            ) : null}
          </View>

          {/* Active toggle */}
          <TouchableOpacity
            onPress={() => toggleActive(med.id)}
            style={[styles.activeToggle, {
              backgroundColor: med.active ? withAlpha('#10B981', '18') : colors.glass,
              borderColor: med.active ? withAlpha('#10B981', '40') : colors.border,
            }]}
            activeOpacity={0.7}
          >
            <View style={[styles.toggleDot, {
              backgroundColor: med.active ? '#10B981' : colors.textMuted,
              alignSelf: med.active ? 'flex-end' : 'flex-start',
            }]} />
          </TouchableOpacity>
        </View>

        {/* Details row */}
        <View style={styles.medDetails}>
          <View style={[styles.freqBadge, { backgroundColor: withAlpha(freqColor, '15') }]}>
            <Ionicons name={FREQ_ICONS[med.frequency]} size={11} color={freqColor} />
            <Text style={[styles.freqBadgeText, { color: freqColor }]}>{freqLabel}</Text>
          </View>
          {timeLabels.map(label => (
            <View key={label} style={[styles.timeBadge, { backgroundColor: colors.glass }]}>
              <Text style={[styles.timeBadgeText, { color: colors.textMuted }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={[styles.medActions, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={styles.medActionBtn}
            onPress={() => openEditForm(med)}
            activeOpacity={0.7}
          >
            <Ionicons name="pencil-outline" size={15} color={ACCENT} />
            <Text style={[styles.medActionText, { color: ACCENT }]}>Edit</Text>
          </TouchableOpacity>
          <View style={[styles.medActionDivider, { backgroundColor: colors.border }]} />
          <TouchableOpacity
            style={styles.medActionBtn}
            onPress={() => deleteMed(med.id)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={15} color="#EF4444" />
            <Text style={[styles.medActionText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ── Render: Stats Tab ──────────────────────────────────────────────────
  const renderStatsTab = () => {
    const week7 = last7Keys();

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
        {/* Adherence overview card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Adherence Overview</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: withAlpha(ACCENT, '20') }]}>
                <Ionicons name="calendar-outline" size={18} color={ACCENT} />
              </View>
              <Text style={[styles.statVal, { color: getAdherenceColor(stats.weekPct) }]}>
                {stats.weekPct}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>This Week</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: withAlpha('#8B5CF6', '20') }]}>
                <Ionicons name="stats-chart-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={[styles.statVal, { color: getAdherenceColor(stats.monthPct) }]}>
                {stats.monthPct}%
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>This Month</Text>
            </View>
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: withAlpha('#F59E0B', '20') }]}>
                <Ionicons name="flame-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={[styles.statVal, { color: '#F59E0B' }]}>
                {stats.streak}d
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
            </View>
          </View>

          {stats.bestMed !== '--' && (
            <View style={[styles.bestMedRow, { borderTopColor: colors.border }]}>
              <Ionicons name="star-outline" size={13} color="#F59E0B" />
              <Text style={[styles.bestMedText, { color: colors.textMuted }]}>
                Best adherence:{' '}
                <Text style={{ color: colors.text, fontFamily: Fonts.semibold }}>{stats.bestMed}</Text>
              </Text>
            </View>
          )}
        </View>

        {/* Weekly chart */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>7-Day Adherence</Text>
          <View style={styles.weekChart}>
            {week7.map(day => {
              const daySlots = getTodaySlots(meds.filter(m => m.active));
              const dayEntries = logs[day] ?? [];
              const expectedCount = daySlots.length;
              const takenCount = expectedCount > 0
                ? daySlots.filter(s => dayEntries.some(e => e.medId === s.med.id && e.timeOfDay === s.time)).length
                : 0;
              const pct = expectedCount > 0 ? Math.round((takenCount / expectedCount) * 100) : 0;
              const isToday = day === today;
              const barColor = pct === 100 ? '#10B981' : pct > 0 ? ACCENT : colors.glass;

              const [, , dd] = day.split('-');
              const dayLabel = new Date(
                parseInt(day.split('-')[0]),
                parseInt(day.split('-')[1]) - 1,
                parseInt(day.split('-')[2])
              ).toLocaleDateString('en-GB', { weekday: 'narrow' });

              return (
                <View key={day} style={styles.weekBarCol}>
                  <Text style={[styles.weekBarPct, { color: colors.textMuted }]}>
                    {expectedCount > 0 ? `${pct}%` : '--'}
                  </Text>
                  <View style={[styles.weekBarTrack, { backgroundColor: colors.glass }]}>
                    <View style={[styles.weekBarFill, {
                      height: `${Math.max(pct, 4)}%`,
                      backgroundColor: barColor,
                    }]} />
                  </View>
                  <Text style={[styles.weekBarDay, {
                    color: isToday ? ACCENT : colors.textMuted,
                    fontFamily: isToday ? Fonts.bold : Fonts.medium,
                  }]}>
                    {dayLabel}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Per-medication adherence */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Per Medication (7d)</Text>
          {meds.filter(m => m.active && m.frequency !== 'as_needed').length === 0 ? (
            <Text style={[styles.emptyHint, { color: colors.textMuted, textAlign: 'center', paddingVertical: Spacing.lg }]}>
              No active scheduled medications to show stats for.
            </Text>
          ) : (
            meds.filter(m => m.active && m.frequency !== 'as_needed').map(med => {
              let taken = 0;
              let expected = 0;
              const week = last7Keys();
              for (const day of week) {
                if (med.frequency === 'weekly') {
                  const [y, m, d] = day.split('-').map(Number);
                  const dayDate = new Date(y, m - 1, d);
                  const created = new Date(med.createdAt);
                  if (dayDate.getDay() !== created.getDay()) continue;
                }
                expected += med.timeOfDay.length;
                const dayEntries = logs[day] ?? [];
                taken += dayEntries.filter(e => e.medId === med.id).length;
              }
              const pct = expected > 0 ? Math.round((taken / expected) * 100) : 0;
              const freqColor = FREQ_COLORS[med.frequency];

              return (
                <View key={med.id} style={[styles.perMedRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.pillIconSm, { backgroundColor: withAlpha(freqColor, '18') }]}>
                    <Ionicons name={FREQ_ICONS[med.frequency]} size={14} color={freqColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.perMedName, { color: colors.text }]}>{med.name}</Text>
                    <View style={[styles.perMedBar, { backgroundColor: colors.glass }]}>
                      <View style={[styles.perMedBarFill, {
                        width: `${pct}%`,
                        backgroundColor: getAdherenceColor(pct),
                      }]} />
                    </View>
                  </View>
                  <Text style={[styles.perMedPct, { color: getAdherenceColor(pct) }]}>{pct}%</Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    );
  };

  // ── Add/Edit Modal ─────────────────────────────────────────────────────
  const renderFormModal = () => (
    <KeyboardAwareModal
      visible={showForm}
      transparent
      animationType="slide"
      onRequestClose={closeForm}
    >
      <View style={styles.modalBg}>
        <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editTarget ? 'Edit Medication' : 'Add Medication'}
            </Text>
            <TouchableOpacity onPress={closeForm}>
              <Ionicons name="close-circle" size={26} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Medication Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={formName}
              onChangeText={setFormName}
              placeholder="e.g. Aspirin"
              placeholderTextColor={colors.textMuted}
              autoFocus
            />

            {/* Dosage */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Dosage</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={formDosage}
              onChangeText={setFormDosage}
              placeholder="e.g. 500mg, 1 tablet"
              placeholderTextColor={colors.textMuted}
            />

            {/* Frequency */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Frequency</Text>
            <View style={styles.chipRow}>
              {FREQUENCIES.map(f => {
                const active = formFreq === f.value;
                const color = FREQ_COLORS[f.value];
                return (
                  <TouchableOpacity
                    key={f.value}
                    style={[styles.chip, {
                      backgroundColor: active ? withAlpha(color, '20') : colors.inputBg,
                      borderColor: active ? color : colors.border,
                    }]}
                    onPress={() => setFormFreq(f.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={FREQ_ICONS[f.value]} size={14} color={active ? color : colors.textMuted} />
                    <Text style={[styles.chipText, { color: active ? color : colors.textMuted }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time of Day */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Time of Day</Text>
            <View style={styles.chipRow}>
              {TIMES_OF_DAY.map(t => {
                const active = formTimes.includes(t.value);
                return (
                  <TouchableOpacity
                    key={t.value}
                    style={[styles.chip, {
                      backgroundColor: active ? withAlpha(ACCENT, '20') : colors.inputBg,
                      borderColor: active ? ACCENT : colors.border,
                    }]}
                    onPress={() => toggleFormTime(t.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={t.icon} size={14} color={active ? ACCENT : colors.textMuted} />
                    <Text style={[styles.chipText, { color: active ? ACCENT : colors.textMuted }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Actions */}
            <View style={styles.formActions}>
              <TouchableOpacity
                style={[styles.formBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                onPress={closeForm}
              >
                <Text style={[styles.formBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, { backgroundColor: ACCENT }]}
                onPress={saveMed}
              >
                <Ionicons name={editTarget ? 'checkmark' : 'add'} size={16} color="#fff" />
                <Text style={[styles.formBtnText, { color: '#fff' }]}>
                  {editTarget ? 'Save' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </KeyboardAwareModal>
  );

  // ── Main Render ────────────────────────────────────────────────────────
  return (
    <ScreenShell
      title="Medications"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={
        <TouchableOpacity onPress={openAddForm}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {renderFormModal()}

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {([
          { key: 'today', label: 'Today', icon: 'today-outline' },
          { key: 'meds', label: 'Medications', icon: 'medkit-outline' },
          { key: 'stats', label: 'Stats', icon: 'stats-chart-outline' },
        ] as { key: typeof tab; label: string; icon: keyof typeof Ionicons.glyphMap }[]).map(t => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && { backgroundColor: ACCENT }]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={t.icon}
              size={16}
              color={tab === t.key ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.tabText, { color: tab === t.key ? '#fff' : colors.textMuted }]}>
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'today' && renderTodayTab()}
        {tab === 'meds' && renderMedsTab()}
        {tab === 'stats' && renderStatsTab()}
      </View>
    </ScreenShell>
  );
}

// ─── Helpers (style) ─────────────────────────────────────────────────────────
function getAdherenceColor(pct: number): string {
  if (pct >= 80) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // ── Card ──────────────────────────────────────────────────────────────
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },

    // ── Tab Bar ───────────────────────────────────────────────────────────
    tabBar: {
      flexDirection: 'row',
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: 3,
      marginBottom: Spacing.lg,
      gap: 3,
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.sm,
      borderRadius: Radii.md,
    },
    tabText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    // ── Progress Card ─────────────────────────────────────────────────────
    progressHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    progressPct: {
      fontSize: 38,
      fontFamily: Fonts.bold,
      lineHeight: 44,
    },
    progressSub: {
      fontSize: 13,
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    progressRingOuter: {
      width: 54,
      height: 54,
      borderRadius: 27,
      borderWidth: 3,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressRingInner: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    progressBarTrack: {
      height: 6,
      borderRadius: 3,
      overflow: 'hidden',
    },
    progressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    allDoneBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      marginTop: Spacing.sm,
      alignSelf: 'flex-start',
    },
    allDoneText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    // ── Today Dose Cards ──────────────────────────────────────────────────
    timeGroupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    timeGroupLabel: {
      fontSize: 14,
      fontFamily: Fonts.bold,
    },
    doseCard: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
      gap: Spacing.md,
    },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: Radii.sm,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pillIconSm: {
      width: 30,
      height: 30,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doseName: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    doseNameDone: {
      textDecorationLine: 'line-through',
      opacity: 0.5,
    },
    doseDosage: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      marginTop: 1,
    },
    freqBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
    },
    freqBadgeText: {
      fontSize: 10,
      fontFamily: Fonts.semibold,
    },
    timeBadge: {
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
    },
    timeBadgeText: {
      fontSize: 10,
      fontFamily: Fonts.medium,
    },

    // ── Medication List ───────────────────────────────────────────────────
    sectionLabel: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderRadius: Radii.lg,
      borderWidth: 1,
      borderStyle: 'dashed',
      paddingVertical: Spacing.md,
      marginBottom: Spacing.lg,
    },
    addBtnText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    medCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    medCardTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    medName: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
    },
    medDosage: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      marginTop: 1,
    },
    activeToggle: {
      width: 42,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      paddingHorizontal: 3,
      justifyContent: 'center',
    },
    toggleDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    medDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    medActions: {
      flexDirection: 'row',
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    medActionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      paddingVertical: Spacing.xs,
    },
    medActionText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    medActionDivider: {
      width: 1,
      height: 20,
      alignSelf: 'center',
    },

    // ── Stats ─────────────────────────────────────────────────────────────
    sectionTitle: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    statIconWrap: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    statVal: {
      fontSize: 15,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    statLabel: {
      fontSize: 10,
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
    bestMedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      marginTop: Spacing.md,
      paddingTop: Spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
    },
    bestMedText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },

    // ── Weekly Chart ──────────────────────────────────────────────────────
    weekChart: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.xs,
      height: 130,
    },
    weekBarCol: {
      flex: 1,
      alignItems: 'center',
      gap: 3,
    },
    weekBarPct: {
      fontSize: 9,
      fontFamily: Fonts.medium,
    },
    weekBarTrack: {
      flex: 1,
      width: 18,
      borderRadius: 5,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    weekBarFill: {
      width: '100%',
      borderRadius: 5,
    },
    weekBarDay: {
      fontSize: 11,
      fontFamily: Fonts.medium,
    },

    // ── Per Medication Row ────────────────────────────────────────────────
    perMedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    perMedName: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.xs,
    },
    perMedBar: {
      height: 5,
      borderRadius: 3,
      overflow: 'hidden',
    },
    perMedBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    perMedPct: {
      fontSize: 14,
      fontFamily: Fonts.bold,
      width: 40,
      textAlign: 'right',
    },

    // ── Empty State ───────────────────────────────────────────────────────
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.huge,
      gap: Spacing.md,
    },
    emptyTitle: {
      fontSize: 17,
      fontFamily: Fonts.bold,
    },
    emptyHint: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      maxWidth: 280,
    },
    emptyBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      marginTop: Spacing.sm,
    },
    emptyBtnText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },

    // ── Form Modal ────────────────────────────────────────────────────────
    modalBg: {
      flex: 1,
      backgroundColor: '#00000070',
      justifyContent: 'flex-end',
    },
    modalCard: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      maxHeight: '88%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.lg,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    fieldLabel: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.sm,
    },
    input: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      fontFamily: Fonts.medium,
      marginBottom: Spacing.lg,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.xs,
      borderRadius: Radii.pill,
      borderWidth: 1.5,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    chipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    formActions: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    formBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: Radii.md,
      gap: Spacing.xs,
    },
    formBtnText: {
      fontSize: 15,
      fontFamily: Fonts.bold,
    },
  });
