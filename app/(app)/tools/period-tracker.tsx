import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#E11D77';

// ─── Types ────────────────────────────────────────────────────────────────────

type PeriodEntry = {
  id: string;
  date: string;        // YYYY-MM-DD
  flow: number;        // 0–3
  symptoms: string[];
  note: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FLOWS = [
  { label: 'Spotting', color: '#FBBF24', icon: 'water-outline' as const },
  { label: 'Light',    color: '#F97316', icon: 'water-outline' as const },
  { label: 'Medium',   color: '#EF4444', icon: 'water'         as const },
  { label: 'Heavy',    color: '#B91C1C', icon: 'water'         as const },
];

const SYMPTOMS = [
  'Cramps', 'Headache', 'Bloating', 'Mood swings', 'Fatigue',
  'Back pain', 'Breast tenderness', 'Acne', 'Nausea', 'Insomnia',
  'Cravings', 'Dizziness',
];

const NOTE_MAX = 300;
const DEFAULT_CYCLE_LEN = 28;
const DEFAULT_PERIOD_LEN = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoFromDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pad(n: number) { return String(n).padStart(2, '0'); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return isoFromDate(dt);
}

function daysBetween(a: string, b: string) {
  const da = new Date(a + 'T00:00:00');
  const db = new Date(b + 'T00:00:00');
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

function monthName(m: number) {
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m];
}

function fullMonthName(m: number) {
  return ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m];
}

// ─── Cycle detection ──────────────────────────────────────────────────────────

type Cycle = {
  startDate: string;
  endDate: string;
  periodLength: number;
  cycleLength: number | null; // null if last cycle (no next start)
};

function detectCycles(entries: PeriodEntry[]): Cycle[] {
  if (entries.length === 0) return [];

  const dates = [...new Set(entries.map(e => e.date))].sort();
  const periods: { start: string; end: string }[] = [];

  let start = dates[0];
  let prev = dates[0];

  for (let i = 1; i < dates.length; i++) {
    const gap = daysBetween(prev, dates[i]);
    if (gap > 2) {
      periods.push({ start, end: prev });
      start = dates[i];
    }
    prev = dates[i];
  }
  periods.push({ start, end: prev });

  const cycles: Cycle[] = periods.map((p, i) => ({
    startDate: p.start,
    endDate: p.end,
    periodLength: daysBetween(p.start, p.end) + 1,
    cycleLength: i < periods.length - 1
      ? daysBetween(p.start, periods[i + 1].start)
      : null,
  }));

  return cycles;
}

// ─── Predictions ──────────────────────────────────────────────────────────────

function getPredictions(cycles: Cycle[]) {
  const completed = cycles.filter(c => c.cycleLength !== null);
  const avgCycle = completed.length > 0
    ? Math.round(completed.reduce((s, c) => s + c.cycleLength!, 0) / completed.length)
    : DEFAULT_CYCLE_LEN;
  const avgPeriod = cycles.length > 0
    ? Math.round(cycles.reduce((s, c) => s + c.periodLength, 0) / cycles.length)
    : DEFAULT_PERIOD_LEN;

  const lastCycle = cycles[cycles.length - 1];
  const nextPeriodStart = lastCycle
    ? addDays(lastCycle.startDate, avgCycle)
    : null;

  // Ovulation ~14 days before next period
  const ovulationDate = nextPeriodStart
    ? addDays(nextPeriodStart, -14)
    : null;

  // Fertile window: 5 days before ovulation to 1 day after
  const fertileStart = ovulationDate ? addDays(ovulationDate, -5) : null;
  const fertileEnd = ovulationDate ? addDays(ovulationDate, 1) : null;

  return { avgCycle, avgPeriod, nextPeriodStart, ovulationDate, fertileStart, fertileEnd };
}

// ─── Sub-component: Month Calendar ───────────────────────────────────────────

function MonthCalendar({
  year,
  month,
  entries,
  predictions,
  colors,
  styles,
  onDayPress,
}: {
  year: number;
  month: number; // 0-indexed
  entries: PeriodEntry[];
  predictions: ReturnType<typeof getPredictions>;
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
  onDayPress: (iso: string) => void;
}) {
  const today = todayISO();

  const entryMap = useMemo(() => {
    const m: Record<string, PeriodEntry> = {};
    for (const e of entries) m[e.date] = e;
    return m;
  }, [entries]);

  const cells = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result: (string | null)[] = [];

    for (let i = 0; i < firstDay; i++) result.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(`${year}-${pad(month + 1)}-${pad(d)}`);
    }
    return result;
  }, [year, month]);

  // Build predicted period dates set
  const predictedDates = useMemo(() => {
    const s = new Set<string>();
    if (predictions.nextPeriodStart) {
      for (let i = 0; i < predictions.avgPeriod; i++) {
        s.add(addDays(predictions.nextPeriodStart, i));
      }
    }
    return s;
  }, [predictions]);

  // Build fertile window dates set
  const fertileDates = useMemo(() => {
    const s = new Set<string>();
    if (predictions.fertileStart && predictions.fertileEnd) {
      const len = daysBetween(predictions.fertileStart, predictions.fertileEnd);
      for (let i = 0; i <= len; i++) {
        s.add(addDays(predictions.fertileStart, i));
      }
    }
    return s;
  }, [predictions]);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View>
      <View style={styles.calDayRow}>
        {dayLabels.map((l, i) => (
          <View key={i} style={styles.calDayLabelWrap}>
            <Text style={[styles.calDayLabel, { color: colors.textMuted }]}>{l}</Text>
          </View>
        ))}
      </View>
      <View style={styles.calGrid}>
        {cells.map((iso, i) => {
          if (!iso) return <View key={`e-${i}`} style={styles.calCell} />;
          const entry = entryMap[iso];
          const isToday = iso === today;
          const isPredicted = predictedDates.has(iso);
          const isFertile = fertileDates.has(iso);
          const isOvulation = iso === predictions.ovulationDate;

          let bg = 'transparent';
          let textColor = colors.text;

          if (entry) {
            bg = FLOWS[entry.flow].color;
            textColor = '#fff';
          } else if (isPredicted) {
            bg = ACCENT + '30';
            textColor = ACCENT;
          } else if (isOvulation) {
            bg = '#8B5CF6' + '40';
            textColor = '#8B5CF6';
          } else if (isFertile) {
            bg = '#10B981' + '30';
            textColor = '#10B981';
          }

          return (
            <TouchableOpacity
              key={iso}
              onPress={() => onDayPress(iso)}
              style={[
                styles.calCell,
                { backgroundColor: bg },
                isToday && { borderWidth: 2, borderColor: ACCENT },
              ]}
            >
              <Text style={[styles.calCellText, { color: textColor, fontFamily: entry ? Fonts.bold : Fonts.medium }]}>
                {Number(iso.slice(8))}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.calLegend}>
        {[
          { color: FLOWS[2].color, label: 'Period' },
          { color: ACCENT + '50', label: 'Predicted' },
          { color: '#10B981' + '60', label: 'Fertile' },
          { color: '#8B5CF6' + '70', label: 'Ovulation' },
        ].map((item, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function PeriodTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<PeriodEntry[]>([]);
  const [selectedFlow, setSelectedFlow] = useState<number | null>(null);
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [focusedDate, setFocusedDate] = useState<string | null>(null);
  const [tab, setTab] = useState<'log' | 'calendar' | 'stats'>('log');

  // Calendar month navigation
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());

  useEffect(() => {
    loadJSON<PeriodEntry[]>(KEYS.periodEntries, []).then(data => {
      setEntries(data.map(e => ({ ...e, symptoms: e.symptoms ?? [], note: e.note ?? '' })));
    });
  }, []);

  const persist = useCallback((e: PeriodEntry[]) => {
    setEntries(e);
    saveJSON(KEYS.periodEntries, e);
  }, []);

  const today = todayISO();
  const editingDate = focusedDate ?? today;
  const editingEntry = entries.find(e => e.date === editingDate);
  const isEditingPast = editingDate !== today;

  const cycles = useMemo(() => detectCycles(entries), [entries]);
  const predictions = useMemo(() => getPredictions(cycles), [cycles]);

  const todayEntry = entries.find(e => e.date === today);

  // Is today a period day?
  const isPeriodDay = !!todayEntry;

  // Days until next period
  const daysUntilNext = useMemo(() => {
    if (!predictions.nextPeriodStart) return null;
    const diff = daysBetween(today, predictions.nextPeriodStart);
    return diff >= 0 ? diff : null;
  }, [predictions, today]);

  // Current cycle day
  const currentCycleDay = useMemo(() => {
    if (cycles.length === 0) return null;
    const lastStart = cycles[cycles.length - 1].startDate;
    return daysBetween(lastStart, today) + 1;
  }, [cycles, today]);

  const handleDayPress = (iso: string) => {
    setFocusedDate(iso);
    const entry = entries.find(e => e.date === iso);
    if (entry) {
      setSelectedFlow(entry.flow);
      setSelectedSymptoms(entry.symptoms ?? []);
      setNote(entry.note ?? '');
    } else {
      setSelectedFlow(null);
      setSelectedSymptoms([]);
      setNote('');
    }
    setTab('log');
  };

  const logEntry = () => {
    if (selectedFlow === null) return;
    const date = editingDate;
    const existing = entries.find(e => e.date === date);
    const entry: PeriodEntry = {
      id: existing?.id ?? uid(),
      date,
      flow: selectedFlow,
      symptoms: selectedSymptoms,
      note: note.trim(),
    };
    persist(
      [entry, ...entries.filter(e => e.date !== date)]
        .sort((a, b) => b.date.localeCompare(a.date))
    );
    setSelectedFlow(null);
    setSelectedSymptoms([]);
    setNote('');
    setFocusedDate(null);
  };

  const removeDay = (date: string) => {
    persist(entries.filter(e => e.date !== date));
  };

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(s) ? prev.filter(t => t !== s) : [...prev, s]
    );
  };

  const goToPrevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };

  const goToNextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const goToToday = () => {
    const now = new Date();
    setCalYear(now.getFullYear());
    setCalMonth(now.getMonth());
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (cycles.length === 0) return null;

    const completedCycles = cycles.filter(c => c.cycleLength !== null);
    const shortestCycle = completedCycles.length > 0
      ? Math.min(...completedCycles.map(c => c.cycleLength!))
      : null;
    const longestCycle = completedCycles.length > 0
      ? Math.max(...completedCycles.map(c => c.cycleLength!))
      : null;

    // Symptom frequency
    const symptomCounts: Record<string, number> = {};
    for (const e of entries) {
      for (const s of e.symptoms) {
        symptomCounts[s] = (symptomCounts[s] || 0) + 1;
      }
    }
    const topSymptoms = Object.entries(symptomCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Flow distribution
    const flowCounts = [0, 0, 0, 0];
    for (const e of entries) flowCounts[e.flow]++;

    return {
      totalCycles: cycles.length,
      completedCycles: completedCycles.length,
      avgCycle: predictions.avgCycle,
      avgPeriod: predictions.avgPeriod,
      shortestCycle,
      longestCycle,
      totalPeriodDays: entries.length,
      topSymptoms,
      flowCounts,
    };
  }, [cycles, entries, predictions]);

  // ── Insights ───────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const list: string[] = [];
    if (cycles.length < 2) return list;

    if (daysUntilNext !== null) {
      if (daysUntilNext === 0) {
        list.push('Your period is expected to start today.');
      } else if (daysUntilNext <= 3) {
        list.push(`Your period is expected in ${daysUntilNext} day${daysUntilNext > 1 ? 's' : ''}. Stay prepared!`);
      }
    }

    if (predictions.fertileStart && predictions.fertileEnd) {
      const fertileIn = daysBetween(today, predictions.fertileStart);
      if (fertileIn >= 0 && fertileIn <= 3) {
        list.push(`Your fertile window starts in ${fertileIn} day${fertileIn !== 1 ? 's' : ''}.`);
      }
      const inFertile = daysBetween(predictions.fertileStart, today) >= 0 &&
        daysBetween(today, predictions.fertileEnd) >= 0;
      if (inFertile) {
        list.push('You are currently in your fertile window.');
      }
    }

    if (stats && stats.shortestCycle !== null && stats.longestCycle !== null) {
      const variance = stats.longestCycle - stats.shortestCycle;
      if (variance <= 3) {
        list.push('Your cycle is very regular. Great for reliable predictions!');
      } else if (variance >= 8) {
        list.push('Your cycle length varies quite a bit. Predictions may be less precise.');
      }
    }

    if (currentCycleDay !== null && currentCycleDay > 0) {
      list.push(`You are on day ${currentCycleDay} of your current cycle.`);
    }

    return list.slice(0, 3);
  }, [cycles, predictions, stats, daysUntilNext, currentCycleDay, today]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenShell title="Period Tracker" accentColor={ACCENT}>

      {/* Quick status card */}
      <View style={[styles.statusCard, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '30' }]}>
        <View style={styles.statusRow}>
          <View style={styles.statusItem}>
            <Text style={[styles.statusVal, { color: ACCENT }]}>
              {isPeriodDay ? 'On Period' : daysUntilNext !== null ? `${daysUntilNext}` : '--'}
            </Text>
            <Text style={[styles.statusLabel, { color: colors.textMuted }]}>
              {isPeriodDay ? 'Today' : 'Days Until Next'}
            </Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: ACCENT + '25' }]} />
          <View style={styles.statusItem}>
            <Text style={[styles.statusVal, { color: ACCENT }]}>
              {currentCycleDay ?? '--'}
            </Text>
            <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Cycle Day</Text>
          </View>
          <View style={[styles.statusDivider, { backgroundColor: ACCENT + '25' }]} />
          <View style={styles.statusItem}>
            <Text style={[styles.statusVal, { color: ACCENT }]}>
              {predictions.avgCycle}
            </Text>
            <Text style={[styles.statusLabel, { color: colors.textMuted }]}>Avg Cycle</Text>
          </View>
        </View>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(['log', 'calendar', 'stats'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabBtn, tab === t && { backgroundColor: ACCENT + '22', borderColor: ACCENT }]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={t === 'log' ? 'create-outline' : t === 'calendar' ? 'calendar-outline' : 'bar-chart-outline'}
              size={15}
              color={tab === t ? ACCENT : colors.textMuted}
            />
            <Text style={[styles.tabLabel, { color: tab === t ? ACCENT : colors.textMuted }]}>
              {t === 'log' ? 'Log' : t === 'calendar' ? 'Calendar' : 'Stats'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── LOG TAB ── */}
      {tab === 'log' && (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.logHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {isEditingPast ? `Log: ${fmtDate(editingDate)}` : editingEntry ? "Today's Log" : 'Log Period Day'}
              </Text>
              {isEditingPast && (
                <TouchableOpacity onPress={() => { setFocusedDate(null); setSelectedFlow(null); setNote(''); setSelectedSymptoms([]); }}>
                  <Text style={[styles.clearBtn, { color: ACCENT }]}>Today</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Current entry summary */}
            {editingEntry && selectedFlow === null && (
              <View style={[styles.currentEntry, { backgroundColor: ACCENT + '08' }]}>
                <Ionicons name={FLOWS[editingEntry.flow].icon} size={32} color={FLOWS[editingEntry.flow].color} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.currentLabel, { color: FLOWS[editingEntry.flow].color }]}>
                    {FLOWS[editingEntry.flow].label} Flow
                  </Text>
                  {editingEntry.symptoms.length > 0 && (
                    <View style={styles.tagRow}>
                      {editingEntry.symptoms.map(s => (
                        <View key={s} style={[styles.tagPill, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]}>
                          <Text style={[styles.tagPillText, { color: ACCENT }]}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {editingEntry.note ? (
                    <Text style={[styles.currentNote, { color: colors.textMuted }]} numberOfLines={2}>
                      {editingEntry.note}
                    </Text>
                  ) : null}
                </View>
              </View>
            )}

            {/* Flow selector */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Flow Intensity</Text>
            <View style={styles.flowRow}>
              {FLOWS.map((f, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.flowBtn,
                    { borderColor: selectedFlow === i ? f.color : colors.border,
                      backgroundColor: selectedFlow === i ? f.color + '18' : 'transparent' },
                  ]}
                  onPress={() => setSelectedFlow(i)}
                >
                  <Ionicons name={f.icon} size={22} color={selectedFlow === i ? f.color : colors.textMuted} />
                  <Text style={[styles.flowLabel, { color: selectedFlow === i ? f.color : colors.textMuted }]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Symptoms */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Symptoms</Text>
            <View style={styles.symptomGrid}>
              {SYMPTOMS.map(s => {
                const active = selectedSymptoms.includes(s);
                return (
                  <TouchableOpacity
                    key={s}
                    onPress={() => toggleSymptom(s)}
                    style={[
                      styles.symptomChip,
                      { backgroundColor: active ? ACCENT + '22' : colors.glass,
                        borderColor: active ? ACCENT : colors.border },
                    ]}
                  >
                    <Text style={[styles.symptomText, { color: active ? ACCENT : colors.textMuted }]}>{s}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Notes</Text>
            <View style={[styles.noteWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <TextInput
                style={[styles.noteInput, { color: colors.text }]}
                value={note}
                onChangeText={t => setNote(t.slice(0, NOTE_MAX))}
                placeholder="Any additional notes... (optional)"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={NOTE_MAX}
              />
              <Text style={[styles.charCount, { color: colors.textMuted }]}>{note.length}/{NOTE_MAX}</Text>
            </View>

            {/* Save */}
            <TouchableOpacity
              style={[styles.logBtn, { backgroundColor: selectedFlow !== null ? ACCENT : colors.surface }]}
              onPress={logEntry}
              disabled={selectedFlow === null}
            >
              <Text style={[styles.logBtnText, { color: selectedFlow !== null ? '#fff' : colors.textMuted }]}>
                {editingEntry ? 'Update Entry' : 'Log Period Day'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Recent history */}
          {entries.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Recent Logs</Text>
              {entries.slice(0, 15).map(entry => (
                <View key={entry.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                  <Ionicons name={FLOWS[entry.flow].icon} size={20} color={FLOWS[entry.flow].color} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.historyTop}>
                      <Text style={[styles.historyDate, { color: colors.text }]}>{fmtDate(entry.date)}</Text>
                      <Text style={[styles.historyFlowLabel, { color: FLOWS[entry.flow].color }]}>
                        {FLOWS[entry.flow].label}
                      </Text>
                    </View>
                    {entry.symptoms.length > 0 && (
                      <View style={styles.tagRow}>
                        {entry.symptoms.map(s => (
                          <View key={s} style={[styles.tagPill, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '30' }]}>
                            <Text style={[styles.tagPillText, { color: ACCENT }]}>{s}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {entry.note ? (
                      <Text style={[styles.historyNote, { color: colors.textMuted }]} numberOfLines={1}>
                        {entry.note}
                      </Text>
                    ) : null}
                  </View>
                  <TouchableOpacity onPress={() => removeDay(entry.date)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Insights</Text>
              {insights.map((insight, i) => (
                <View key={i} style={[styles.insightRow, { borderLeftColor: ACCENT }]}>
                  <Ionicons name="bulb-outline" size={16} color={ACCENT} style={{ marginTop: 1 }} />
                  <Text style={[styles.insightText, { color: colors.text }]}>{insight}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* ── CALENDAR TAB ── */}
      {tab === 'calendar' && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {/* Month navigation */}
          <View style={styles.monthNav}>
            <TouchableOpacity onPress={goToPrevMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity onPress={goToToday}>
              <Text style={[styles.monthTitle, { color: colors.text }]}>
                {fullMonthName(calMonth)} {calYear}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={goToNextMonth} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="chevron-forward" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <MonthCalendar
            year={calYear}
            month={calMonth}
            entries={entries}
            predictions={predictions}
            colors={colors}
            styles={styles}
            onDayPress={handleDayPress}
          />

          {/* Next period info */}
          {predictions.nextPeriodStart && (
            <View style={[styles.predictionCard, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '25' }]}>
              <Ionicons name="calendar" size={18} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.predLabel, { color: colors.text }]}>Next Period Expected</Text>
                <Text style={[styles.predDate, { color: ACCENT }]}>{fmtDate(predictions.nextPeriodStart)}</Text>
              </View>
            </View>
          )}

          {predictions.ovulationDate && (
            <View style={[styles.predictionCard, { backgroundColor: '#8B5CF6' + '10', borderColor: '#8B5CF6' + '25' }]}>
              <Ionicons name="sparkles" size={18} color="#8B5CF6" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.predLabel, { color: colors.text }]}>Estimated Ovulation</Text>
                <Text style={[styles.predDate, { color: '#8B5CF6' }]}>{fmtDate(predictions.ovulationDate)}</Text>
              </View>
            </View>
          )}

          <Text style={[styles.calHint, { color: colors.textMuted }]}>
            Tap any day to log or edit that entry.
          </Text>
        </View>
      )}

      {/* ── STATS TAB ── */}
      {tab === 'stats' && stats && (
        <>
          {/* Key metrics */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Cycle Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{stats.avgCycle}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Cycle</Text>
                <Text style={[styles.statUnit, { color: colors.textMuted }]}>days</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{stats.avgPeriod}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Period</Text>
                <Text style={[styles.statUnit, { color: colors.textMuted }]}>days</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{stats.totalCycles}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Cycles</Text>
                <Text style={[styles.statUnit, { color: colors.textMuted }]}>logged</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{stats.totalPeriodDays}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Period</Text>
                <Text style={[styles.statUnit, { color: colors.textMuted }]}>days</Text>
              </View>
            </View>
          </View>

          {/* Cycle range */}
          {stats.shortestCycle !== null && stats.longestCycle !== null && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Cycle Range</Text>
              <View style={styles.rangeRow}>
                <View style={styles.rangeItem}>
                  <Text style={[styles.rangeVal, { color: '#10B981' }]}>{stats.shortestCycle}</Text>
                  <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>Shortest</Text>
                </View>
                <View style={[styles.rangeDivider, { backgroundColor: colors.border }]} />
                <View style={styles.rangeItem}>
                  <Text style={[styles.rangeVal, { color: ACCENT }]}>{stats.avgCycle}</Text>
                  <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>Average</Text>
                </View>
                <View style={[styles.rangeDivider, { backgroundColor: colors.border }]} />
                <View style={styles.rangeItem}>
                  <Text style={[styles.rangeVal, { color: '#EF4444' }]}>{stats.longestCycle}</Text>
                  <Text style={[styles.rangeLabel, { color: colors.textMuted }]}>Longest</Text>
                </View>
              </View>
            </View>
          )}

          {/* Flow distribution */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Flow Distribution</Text>
            <View style={styles.flowDist}>
              {stats.flowCounts.map((count, i) => {
                const pct = stats.totalPeriodDays > 0
                  ? Math.round((count / stats.totalPeriodDays) * 100)
                  : 0;
                return (
                  <View key={i} style={styles.flowDistItem}>
                    <View style={styles.flowDistBarBg}>
                      <View
                        style={[
                          styles.flowDistBarFill,
                          { height: `${Math.max(pct, 4)}%` as any, backgroundColor: FLOWS[i].color },
                        ]}
                      />
                    </View>
                    <Text style={[styles.flowDistPct, { color: FLOWS[i].color }]}>{pct}%</Text>
                    <Text style={[styles.flowDistLabel, { color: colors.textMuted }]}>{FLOWS[i].label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Top symptoms */}
          {stats.topSymptoms.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Top Symptoms</Text>
              {stats.topSymptoms.map(([symptom, count], i) => {
                const maxCount = stats.topSymptoms[0][1] as number;
                const barW = (count / maxCount) * 100;
                return (
                  <View key={symptom} style={styles.symptomStatRow}>
                    <Text style={[styles.symptomStatName, { color: colors.text }]}>{symptom}</Text>
                    <View style={[styles.symptomBarBg, { backgroundColor: colors.glass }]}>
                      <View style={[styles.symptomBarFill, { width: `${barW}%` as any, backgroundColor: ACCENT }]} />
                    </View>
                    <Text style={[styles.symptomStatCount, { color: colors.textMuted }]}>{count}x</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Cycle history */}
          {cycles.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Cycle History</Text>
              {[...cycles].reverse().slice(0, 12).map((cycle, i) => (
                <View key={cycle.startDate} style={[styles.cycleRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.cycleNum, { backgroundColor: ACCENT + '18' }]}>
                    <Text style={[styles.cycleNumText, { color: ACCENT }]}>
                      {cycles.length - i}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cycleDates, { color: colors.text }]}>
                      {fmtDate(cycle.startDate)} — {fmtDate(cycle.endDate)}
                    </Text>
                    <View style={styles.cycleDetailRow}>
                      <Text style={[styles.cycleDetail, { color: colors.textMuted }]}>
                        Period: {cycle.periodLength} day{cycle.periodLength !== 1 ? 's' : ''}
                      </Text>
                      {cycle.cycleLength !== null && (
                        <Text style={[styles.cycleDetail, { color: colors.textMuted }]}>
                          Cycle: {cycle.cycleLength} days
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Insights */}
          {insights.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Insights</Text>
              {insights.map((insight, i) => (
                <View key={i} style={[styles.insightRow, { borderLeftColor: ACCENT }]}>
                  <Ionicons name="bulb-outline" size={16} color={ACCENT} style={{ marginTop: 1 }} />
                  <Text style={[styles.insightText, { color: colors.text }]}>{insight}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* Empty state for stats */}
      {tab === 'stats' && !stats && (
        <View style={styles.emptyState}>
          <Ionicons name="flower-outline" size={48} color={ACCENT + '60'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Log your period days to see stats and predictions
          </Text>
        </View>
      )}

    </ScreenShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Status card
    statusCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    statusRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    statusItem: { alignItems: 'center' },
    statusVal: { fontSize: 24, fontFamily: Fonts.bold },
    statusLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    statusDivider: { width: 1, height: 36 },

    // Tab bar
    tabBar: {
      flexDirection: 'row',
      borderRadius: Radii.xl,
      borderWidth: 1,
      marginBottom: Spacing.lg,
      overflow: 'hidden',
    },
    tabBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 5,
      paddingVertical: 10,
      borderRadius: Radii.xl,
      borderWidth: 1.5,
      borderColor: 'transparent',
      margin: 3,
    },
    tabLabel: { fontSize: 12, fontFamily: Fonts.semibold },

    // Card shell
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    cardTitle: { fontSize: 17, fontFamily: Fonts.bold },
    sectionLabel: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.md,
    },

    // Log form
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    clearBtn: { fontSize: 13, fontFamily: Fonts.semibold },

    currentEntry: {
      flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md,
      marginBottom: Spacing.md, padding: Spacing.sm, borderRadius: Radii.md,
    },
    currentLabel: { fontSize: 15, fontFamily: Fonts.bold },
    currentNote: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 4 },

    fieldLabel: {
      fontSize: 11, fontFamily: Fonts.semibold, marginBottom: Spacing.sm,
      textTransform: 'uppercase', letterSpacing: 0.8,
    },

    flowRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.sm, marginBottom: Spacing.lg },
    flowBtn: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: Radii.lg,
      borderWidth: 1.5,
      gap: 3,
    },
    flowLabel: { fontSize: 10, fontFamily: Fonts.medium },

    symptomGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    symptomChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 5,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    symptomText: { fontSize: 12, fontFamily: Fonts.medium },

    noteWrap: { borderWidth: 1, borderRadius: Radii.md, marginBottom: Spacing.md, overflow: 'hidden' },
    noteInput: { padding: Spacing.md, fontSize: 14, fontFamily: Fonts.regular, minHeight: 70, textAlignVertical: 'top' },
    charCount: { fontSize: 10, fontFamily: Fonts.regular, textAlign: 'right', paddingRight: Spacing.sm, paddingBottom: Spacing.xs },

    logBtn: { paddingVertical: 14, borderRadius: Radii.xl, alignItems: 'center' },
    logBtnText: { fontSize: 16, fontFamily: Fonts.bold },

    // History
    historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 0.5 },
    historyTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    historyDate: { fontSize: 13, fontFamily: Fonts.semibold },
    historyFlowLabel: { fontSize: 11, fontFamily: Fonts.medium },
    historyNote: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 2 },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
    tagPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.pill, borderWidth: 1 },
    tagPillText: { fontSize: 10, fontFamily: Fonts.medium },

    // Calendar
    calDayRow: { flexDirection: 'row', marginBottom: 4 },
    calDayLabelWrap: { flex: 1, alignItems: 'center' },
    calDayLabel: { fontSize: 10, fontFamily: Fonts.bold },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCell: {
      width: `${100 / 7}%` as any,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radii.sm,
    },
    calCellText: { fontSize: 13 },
    calLegend: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 10, fontFamily: Fonts.regular },
    calHint: { fontSize: 11, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.sm },

    monthNav: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    monthTitle: { fontSize: 16, fontFamily: Fonts.bold },

    // Predictions
    predictionCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1,
      marginTop: Spacing.md,
    },
    predLabel: { fontSize: 12, fontFamily: Fonts.medium },
    predDate: { fontSize: 14, fontFamily: Fonts.bold, marginTop: 2 },

    // Stats
    statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 26, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    statUnit: { fontSize: 9, fontFamily: Fonts.regular },

    // Range
    rangeRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    rangeItem: { alignItems: 'center' },
    rangeVal: { fontSize: 22, fontFamily: Fonts.bold },
    rangeLabel: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
    rangeDivider: { width: 1, height: 30 },

    // Flow distribution
    flowDist: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 },
    flowDistItem: { alignItems: 'center', gap: 4 },
    flowDistBarBg: { width: 32, height: 80, borderRadius: Radii.sm, backgroundColor: c.glass, justifyContent: 'flex-end', overflow: 'hidden' },
    flowDistBarFill: { width: '100%', borderRadius: Radii.sm },
    flowDistPct: { fontSize: 12, fontFamily: Fonts.bold },
    flowDistLabel: { fontSize: 10, fontFamily: Fonts.medium },

    // Symptom stats
    symptomStatRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    symptomStatName: { width: 110, fontSize: 12, fontFamily: Fonts.medium },
    symptomBarBg: { flex: 1, height: 8, borderRadius: Radii.pill, overflow: 'hidden' },
    symptomBarFill: { height: '100%', borderRadius: Radii.pill },
    symptomStatCount: { fontSize: 11, fontFamily: Fonts.regular, width: 28, textAlign: 'right' },

    // Cycle history
    cycleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 0.5 },
    cycleNum: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    cycleNumText: { fontSize: 13, fontFamily: Fonts.bold },
    cycleDates: { fontSize: 13, fontFamily: Fonts.semibold },
    cycleDetailRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: 2 },
    cycleDetail: { fontSize: 11, fontFamily: Fonts.regular },

    // Insights
    insightRow: { flexDirection: 'row', gap: Spacing.sm, paddingLeft: Spacing.sm, borderLeftWidth: 3, marginBottom: Spacing.sm },
    insightText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, lineHeight: 20 },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
