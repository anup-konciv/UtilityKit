import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Modal, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import DateField from '@/components/DateField';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#6366F1';
const RECOMMENDED = 8;

// ─── Types ────────────────────────────────────────────────────────────────────
type SleepEntry = {
  id: string;
  date: string;       // YYYY-MM-DD
  bedTime: string;    // HH:MM
  wakeTime: string;   // HH:MM
  quality: number;    // 0-4
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function dateLabel(iso: string): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[isoToDate(iso).getDay()];
}

/** Returns hours slept (decimal). Handles crossing midnight. */
function calcDuration(bed: string, wake: string): number {
  const [bh, bm] = bed.split(':').map(Number);
  const [wh, wm] = wake.split(':').map(Number);
  let bedMins = bh * 60 + bm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= bedMins) wakeMins += 24 * 60;
  return (wakeMins - bedMins) / 60;
}

function formatDuration(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Convert HH:MM to minutes-since-midnight, wrapping PM bedtimes to next day */
function bedToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h >= 12 ? h * 60 + m : (h + 24) * 60 + m; // treat 0–11 as "after midnight"
}

function wakeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minsToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = Math.round(mins % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// ─── Quality levels ────────────────────────────────────────────────────────────
const QUALITY = [
  { emoji: '😩', label: 'Terrible', color: '#EF4444' },
  { emoji: '😴', label: 'Poor',     color: '#F97316' },
  { emoji: '😐', label: 'Fair',     color: '#F59E0B' },
  { emoji: '😊', label: 'Good',     color: '#3B82F6' },
  { emoji: '🌟', label: 'Great',    color: '#10B981' },
];

function getDurationColor(h: number) {
  if (h >= 7 && h <= 9) return '#10B981';
  if (h >= 6) return '#F59E0B';
  return '#EF4444';
}

// ─── Quick-pick time pills ─────────────────────────────────────────────────────
const BED_PILLS   = ['20:00','21:00','22:00','22:30','23:00','23:30','00:00','00:30','01:00','02:00'];
const WAKE_PILLS  = ['04:00','05:00','05:30','06:00','06:30','07:00','07:30','08:00','09:00','10:00','11:00'];

// ─── Stats computation ────────────────────────────────────────────────────────
function computeStats(entries: SleepEntry[]) {
  if (entries.length === 0) return null;
  const last7 = entries.slice(0, 7);
  const durations = last7.map(e => calcDuration(e.bedTime, e.wakeTime));
  const avgDuration = durations.reduce((s, d) => s + d, 0) / durations.length;
  const avgQuality = last7.reduce((s, e) => s + e.quality, 0) / last7.length;

  // longest sleep (all time)
  const allDurs = entries.map(e => calcDuration(e.bedTime, e.wakeTime));
  const longestSleep = Math.max(...allDurs);

  // weekly sleep debt (vs 8h/night recommended)
  const weeklyActual = durations.reduce((s, d) => s + d, 0);
  const weeklyTarget = last7.length * RECOMMENDED;
  const sleepDebt = weeklyActual - weeklyTarget; // positive = surplus, negative = debt

  // best streak of 7+ hour nights
  let bestStreak = 0;
  let curStreak = 0;
  for (let i = entries.length - 1; i >= 0; i--) {
    const dur = calcDuration(entries[i].bedTime, entries[i].wakeTime);
    if (dur >= 7) {
      curStreak++;
      bestStreak = Math.max(bestStreak, curStreak);
    } else {
      curStreak = 0;
    }
  }

  // avg bed/wake
  const bedMinsArr = last7.map(e => bedToMins(e.bedTime));
  const avgBedMin  = bedMinsArr.reduce((s, t) => s + t, 0) / bedMinsArr.length;
  const avgBed = minsToTime(avgBedMin);

  const wakeMinsArr = last7.map(e => wakeToMins(e.wakeTime));
  const avgWakeMin  = wakeMinsArr.reduce((s, t) => s + t, 0) / wakeMinsArr.length;
  const avgWake = minsToTime(avgWakeMin);

  return { avgDuration, avgQuality, longestSleep, sleepDebt, bestStreak, avgBed, avgWake };
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SleepTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<SleepEntry[]>([]);

  // Modal state — shared for add + edit
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [bedTime, setBedTime] = useState('23:00');
  const [wakeTime, setWakeTime] = useState('07:00');
  const [quality, setQuality] = useState(3);
  const [date, setDate] = useState(todayISO());
  const [bedManual, setBedManual] = useState(false);
  const [wakeManual, setWakeManual] = useState(false);

  useEffect(() => {
    loadJSON<SleepEntry[]>(KEYS.sleepLog, []).then(setEntries);
  }, []);

  const persist = useCallback((e: SleepEntry[]) => {
    setEntries(e);
    saveJSON(KEYS.sleepLog, e);
  }, []);

  const openAdd = () => {
    setEditId(null);
    setBedTime('23:00');
    setWakeTime('07:00');
    setQuality(3);
    setDate(todayISO());
    setBedManual(false);
    setWakeManual(false);
    setShowModal(true);
  };

  const openEdit = (entry: SleepEntry) => {
    setEditId(entry.id);
    setBedTime(entry.bedTime);
    setWakeTime(entry.wakeTime);
    setQuality(entry.quality);
    setDate(entry.date);
    setBedManual(false);
    setWakeManual(false);
    setShowModal(true);
  };

  const saveEntry = () => {
    if (!/^\d{2}:\d{2}$/.test(bedTime) || !/^\d{2}:\d{2}$/.test(wakeTime)) {
      Alert.alert('Invalid Time', 'Please use HH:MM format (e.g. 23:00).');
      return;
    }
    if (editId) {
      persist(entries.map(e => e.id === editId ? { ...e, bedTime, wakeTime, quality, date } : e));
    } else {
      const withoutSameDate = entries.filter(e => e.date !== date);
      persist([{ id: uid(), date, bedTime, wakeTime, quality }, ...withoutSameDate]);
    }
    setShowModal(false);
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Delete Entry', 'Remove this sleep log?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(entries.filter(e => e.id !== id)) },
    ]);
  };

  const stats = useMemo(() => computeStats(entries), [entries]);

  // Last 7 entries sorted oldest→newest for chart display
  const last7Asc = useMemo(() => entries.slice(0, 7).reverse(), [entries]);

  // Duration preview in modal
  const durationPreview = useMemo(() => {
    if (/^\d{2}:\d{2}$/.test(bedTime) && /^\d{2}:\d{2}$/.test(wakeTime))
      return formatDuration(calcDuration(bedTime, wakeTime));
    return null;
  }, [bedTime, wakeTime]);

  // ── Sleep pattern timeline: map bed→wake on a common timeline scale
  // The visible window is 20:00 (1200 mins from midnight-prev-day perspective) to 14:00 next day
  // We'll express everything in "offset from 20:00" = mins - 1200 (bed context)
  // wakeTime in same frame: wake is always after bed
  const TIMELINE_START = 20 * 60; // 20:00 in mins
  const TIMELINE_END   = (14 + 24) * 60; // 14:00 next day  = 38 * 60 = 2280
  const TIMELINE_SPAN  = TIMELINE_END - TIMELINE_START; // 18 hours = 1080 mins

  return (
    <ScreenShell
      title="Sleep Tracker"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={openAdd}>
          <Ionicons name="add-circle" size={28} color={ACCENT} />
        </TouchableOpacity>
      }
    >
      {/* ── Stats Dashboard ─────────────────────────────────────────────── */}
      {stats ? (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>7-Day Overview</Text>
          <View style={styles.statsGrid}>
            {/* Avg Duration */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: ACCENT + '20' }]}>
                <Ionicons name="time-outline" size={18} color={ACCENT} />
              </View>
              <Text style={[styles.statVal, { color: getDurationColor(stats.avgDuration) }]}>
                {formatDuration(stats.avgDuration)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Sleep</Text>
            </View>

            {/* Avg Quality */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: QUALITY[Math.round(stats.avgQuality)].color + '20' }]}>
                <Text style={{ fontSize: 18 }}>{QUALITY[Math.round(stats.avgQuality)].emoji}</Text>
              </View>
              <Text style={[styles.statVal, { color: QUALITY[Math.round(stats.avgQuality)].color }]}>
                {QUALITY[Math.round(stats.avgQuality)].label}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Quality</Text>
            </View>

            {/* Longest Sleep */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: '#10B98120' }]}>
                <Ionicons name="trending-up-outline" size={18} color="#10B981" />
              </View>
              <Text style={[styles.statVal, { color: '#10B981' }]}>
                {formatDuration(stats.longestSleep)}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best Night</Text>
            </View>

            {/* Best Streak */}
            <View style={styles.statBox}>
              <View style={[styles.statIconWrap, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="flame-outline" size={18} color="#F59E0B" />
              </View>
              <Text style={[styles.statVal, { color: '#F59E0B' }]}>
                {stats.bestStreak}d
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>7h+ Streak</Text>
            </View>
          </View>

          {/* Sleep Debt Banner */}
          <View style={[
            styles.debtBanner,
            {
              backgroundColor: stats.sleepDebt >= 0 ? '#10B98115' : '#EF444415',
              borderColor: stats.sleepDebt >= 0 ? '#10B98140' : '#EF444440',
            },
          ]}>
            <Ionicons
              name={stats.sleepDebt >= 0 ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={16}
              color={stats.sleepDebt >= 0 ? '#10B981' : '#EF4444'}
            />
            <Text style={[styles.debtText, { color: stats.sleepDebt >= 0 ? '#10B981' : '#EF4444' }]}>
              Weekly sleep {stats.sleepDebt >= 0 ? 'surplus' : 'debt'}:{' '}
              <Text style={{ fontFamily: Fonts.bold }}>
                {stats.sleepDebt >= 0 ? '+' : ''}{formatDuration(stats.sleepDebt)}
              </Text>
              {' '}vs {RECOMMENDED}h/night goal
            </Text>
          </View>
        </View>
      ) : null}

      {/* ── 7-Day Bar Chart ─────────────────────────────────────────────── */}
      {last7Asc.length > 1 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Sleep Duration (7 Days)</Text>

          {/* Y-axis labels + bars */}
          <View style={styles.chartOuter}>
            {/* Y labels */}
            <View style={styles.yAxis}>
              {[9, 7, 5, 3].map(h => (
                <Text key={h} style={[styles.yLabel, { color: colors.textMuted }]}>{h}h</Text>
              ))}
            </View>

            {/* Bars area */}
            <View style={{ flex: 1 }}>
              {/* Horizontal grid lines */}
              <View style={styles.gridLines} pointerEvents="none">
                {[9, 7, 5, 3].map(h => (
                  <View
                    key={h}
                    style={[
                      styles.gridLine,
                      {
                        borderColor: h === 7 ? '#10B98140' : colors.border,
                        borderStyle: h === 7 ? 'dashed' : 'solid',
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Bars */}
              <View style={styles.barsRow}>
                {last7Asc.map(e => {
                  const dur = calcDuration(e.bedTime, e.wakeTime);
                  const maxH = 10; // chart top = 10h → chart height 100
                  const barH = Math.max(4, (dur / maxH) * 100);
                  const col  = QUALITY[e.quality].color;
                  return (
                    <View key={e.id} style={styles.barWrap}>
                      <Text style={[styles.barVal, { color: colors.textMuted }]}>{dur.toFixed(1)}</Text>
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: barH,
                              backgroundColor: col,
                              shadowColor: col,
                              shadowOpacity: 0.5,
                              shadowRadius: 4,
                              shadowOffset: { width: 0, height: 2 },
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.barDate, { color: colors.textMuted }]}>{dateLabel(e.date)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Legend */}
          <View style={styles.chartLegend}>
            {QUALITY.map((q, i) => (
              <View key={i} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: q.color }]} />
                <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{q.emoji}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Weekly Sleep Pattern ─────────────────────────────────────────── */}
      {last7Asc.length > 1 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Weekly Sleep Pattern</Text>
          <Text style={[styles.patternSubtitle, { color: colors.textMuted }]}>
            Bars show bed → wake time window
          </Text>

          {/* Time axis labels */}
          <View style={styles.timeAxis}>
            {['8PM','10PM','12AM','2AM','4AM','6AM','8AM','10AM','12PM','2PM'].map(t => (
              <Text key={t} style={[styles.timeAxisLabel, { color: colors.textMuted }]}>{t}</Text>
            ))}
          </View>

          {/* Pattern rows */}
          {last7Asc.map(e => {
            const bedMins = bedToMins(e.bedTime); // in 24h-extended space (1200–2880)

            // normalize into TIMELINE_START..TIMELINE_END
            const bedAdj  = bedMins < TIMELINE_START ? bedMins + 24 * 60 : bedMins;
            const wakeAdj = wakeToMins(e.wakeTime) + 24 * 60;

            const leftFrac  = Math.max(0, (bedAdj - TIMELINE_START) / TIMELINE_SPAN);
            const rightFrac = Math.min(1, (wakeAdj - TIMELINE_START) / TIMELINE_SPAN);
            const widthFrac = Math.max(0.01, rightFrac - leftFrac);

            const barColor = getDurationColor(calcDuration(e.bedTime, e.wakeTime));

            return (
              <View key={e.id} style={styles.patternRow}>
                <Text style={[styles.patternDay, { color: colors.text }]}>{dateLabel(e.date)}</Text>
                <View style={styles.patternTrack}>
                  {/* Ideal zone: 10PM–6AM = (22*60–20*60)/(18*60) to (6*60+24*60-20*60)/(18*60) */}
                  <View
                    style={[
                      styles.idealZone,
                      {
                        left: `${((22 * 60 - TIMELINE_START) / TIMELINE_SPAN) * 100}%`,
                        width: `${((6 + 24) * 60 - 22 * 60) / TIMELINE_SPAN * 100}%`,
                        backgroundColor: '#10B98108',
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.sleepBar,
                      {
                        left: `${leftFrac * 100}%`,
                        width: `${widthFrac * 100}%`,
                        backgroundColor: barColor + 'CC',
                        borderColor: barColor,
                      },
                    ]}
                  />
                  {/* Bed marker */}
                  <View style={[styles.timeMarker, { left: `${leftFrac * 100}%`, backgroundColor: ACCENT }]} />
                  {/* Wake marker */}
                  <View style={[styles.timeMarker, { left: `${rightFrac * 100}%`, backgroundColor: '#F59E0B' }]} />
                </View>
                <Text style={[styles.patternTimes, { color: colors.textMuted }]}>
                  {e.bedTime}–{e.wakeTime}
                </Text>
              </View>
            );
          })}

          {/* Axis foot legend */}
          <View style={styles.patternLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Bedtime</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#F59E0B' }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Wake time</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#10B98130', width: 14, borderRadius: 2 }]} />
              <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Ideal window</Text>
            </View>
          </View>
        </View>
      )}

      {/* ── History ─────────────────────────────────────────────────────── */}
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="moon-outline" size={52} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No sleep logs yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Tap the + button to log your first night's sleep.
          </Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>History</Text>
          {entries.slice(0, 20).map((entry, idx) => {
            const dur = calcDuration(entry.bedTime, entry.wakeTime);
            const isLast = idx === Math.min(entries.length, 20) - 1;
            return (
              <TouchableOpacity
                key={entry.id}
                style={[styles.entryRow, !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}
                onPress={() => openEdit(entry)}
                activeOpacity={0.7}
              >
                {/* Quality color stripe */}
                <View style={[styles.qualityStripe, { backgroundColor: QUALITY[entry.quality].color }]} />

                <View style={styles.entryLeft}>
                  <Text style={[styles.entryDate, { color: colors.text }]}>
                    {dateLabel(entry.date)}{' '}
                    <Text style={{ fontFamily: Fonts.regular, fontSize: 12, color: colors.textMuted }}>
                      {entry.date}
                    </Text>
                  </Text>
                  <View style={styles.entryTimes}>
                    <Ionicons name="moon" size={11} color={ACCENT} />
                    <Text style={[styles.entryTime, { color: colors.textMuted }]}>{entry.bedTime}</Text>
                    <Ionicons name="arrow-forward" size={10} color={colors.textMuted} />
                    <Ionicons name="sunny" size={11} color="#F59E0B" />
                    <Text style={[styles.entryTime, { color: colors.textMuted }]}>{entry.wakeTime}</Text>
                  </View>
                </View>

                <View style={styles.entryMid}>
                  <Text style={[styles.entryDuration, { color: getDurationColor(dur) }]}>
                    {formatDuration(dur)}
                  </Text>
                  <Text style={{ fontSize: 15 }}>{QUALITY[entry.quality].emoji}</Text>
                </View>

                <View style={styles.entryActions}>
                  <TouchableOpacity
                    onPress={() => openEdit(entry)}
                    style={[styles.actionBtn, { backgroundColor: ACCENT + '15' }]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                  >
                    <Ionicons name="pencil-outline" size={14} color={ACCENT} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => deleteEntry(entry.id)}
                    style={[styles.actionBtn, { backgroundColor: colors.error + '15' }]}
                    hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* ── Add / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editId ? 'Edit Sleep Log' : 'Log Sleep'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close-circle" size={26} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Date */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Date</Text>
              <DateField
                value={date}
                onChange={setDate}
                accent={ACCENT}
                placeholder="Pick a date"
              />

              {/* Bedtime Picker */}
              <View style={styles.timeSectionHeader}>
                <Ionicons name="moon" size={14} color={ACCENT} />
                <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: 0 }]}>Bedtime</Text>
                <TouchableOpacity
                  onPress={() => setBedManual(v => !v)}
                  style={[styles.manualToggle, { borderColor: ACCENT + '60', backgroundColor: bedManual ? ACCENT + '20' : 'transparent' }]}
                >
                  <Text style={[styles.manualToggleText, { color: ACCENT }]}>
                    {bedManual ? 'Pills' : 'Manual'}
                  </Text>
                </TouchableOpacity>
              </View>

              {bedManual ? (
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={bedTime}
                  onChangeText={v => {
                    // Auto-insert colon after 2 digits: "23" → "23:"
                    const digits = v.replace(/[^0-9]/g, '');
                    if (digits.length <= 2) setBedTime(digits);
                    else setBedTime(`${digits.slice(0, 2)}:${digits.slice(2, 4)}`);
                  }}
                  placeholder="HH:MM (e.g. 23:00)"
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                  keyboardType="number-pad"
                />
              ) : (
                <View style={styles.pillsRow}>
                  {BED_PILLS.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.timePill,
                        {
                          backgroundColor: bedTime === t ? ACCENT : colors.inputBg,
                          borderColor: bedTime === t ? ACCENT : colors.border,
                        },
                      ]}
                      onPress={() => setBedTime(t)}
                    >
                      <Text style={[styles.timePillText, { color: bedTime === t ? '#fff' : colors.textMuted }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Wake Time Picker */}
              <View style={[styles.timeSectionHeader, { marginTop: Spacing.sm }]}>
                <Ionicons name="sunny" size={14} color="#F59E0B" />
                <Text style={[styles.fieldLabel, { color: colors.textMuted, marginBottom: 0 }]}>Wake Time</Text>
                <TouchableOpacity
                  onPress={() => setWakeManual(v => !v)}
                  style={[styles.manualToggle, { borderColor: '#F59E0B60', backgroundColor: wakeManual ? '#F59E0B20' : 'transparent' }]}
                >
                  <Text style={[styles.manualToggleText, { color: '#F59E0B' }]}>
                    {wakeManual ? 'Pills' : 'Manual'}
                  </Text>
                </TouchableOpacity>
              </View>

              {wakeManual ? (
                <TextInput
                  style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={wakeTime}
                  onChangeText={v => {
                    const digits = v.replace(/[^0-9]/g, '');
                    if (digits.length <= 2) setWakeTime(digits);
                    else setWakeTime(`${digits.slice(0, 2)}:${digits.slice(2, 4)}`);
                  }}
                  placeholder="HH:MM (e.g. 07:00)"
                  placeholderTextColor={colors.textMuted}
                  maxLength={5}
                  keyboardType="number-pad"
                />
              ) : (
                <View style={styles.pillsRow}>
                  {WAKE_PILLS.map(t => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.timePill,
                        {
                          backgroundColor: wakeTime === t ? '#F59E0B' : colors.inputBg,
                          borderColor: wakeTime === t ? '#F59E0B' : colors.border,
                        },
                      ]}
                      onPress={() => setWakeTime(t)}
                    >
                      <Text style={[styles.timePillText, { color: wakeTime === t ? '#fff' : colors.textMuted }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Duration Preview */}
              {durationPreview && (
                <View style={[styles.durationPreview, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]}>
                  <Ionicons name="time-outline" size={16} color={ACCENT} />
                  <Text style={[styles.durationPreviewText, { color: ACCENT }]}>
                    Sleep duration: <Text style={{ fontFamily: Fonts.bold }}>{durationPreview}</Text>
                  </Text>
                </View>
              )}

              {/* Quality */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: Spacing.md }]}>Sleep Quality</Text>
              <View style={styles.qualityRow}>
                {QUALITY.map((q, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.qualityBtn,
                      {
                        borderColor: quality === i ? q.color : colors.border,
                        backgroundColor: quality === i ? q.color + '20' : colors.inputBg,
                      },
                    ]}
                    onPress={() => setQuality(i)}
                  >
                    <Text style={{ fontSize: 22 }}>{q.emoji}</Text>
                    <Text style={[styles.qualityLabel, { color: quality === i ? q.color : colors.textMuted }]}>
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                  onPress={() => setShowModal(false)}
                >
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: ACCENT }]}
                  onPress={saveEntry}
                >
                  <Ionicons name={editId ? 'checkmark' : 'add'} size={16} color="#fff" />
                  <Text style={[styles.modalBtnText, { color: '#fff' }]}>
                    {editId ? 'Update' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenShell>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.md,
    },

    // ── Stats dashboard
    statsGrid: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
    },
    statIconWrap: {
      width: 36,
      height: 36,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 2,
    },
    statVal: {
      fontSize: 13,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    statLabel: {
      fontSize: 9,
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },
    debtBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderRadius: Radii.md,
      borderWidth: 1,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginTop: 2,
    },
    debtText: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      flex: 1,
    },

    // ── Bar chart
    chartOuter: {
      flexDirection: 'row',
      height: 130,
      marginBottom: Spacing.sm,
    },
    yAxis: {
      width: 28,
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      paddingRight: 4,
      paddingBottom: 18,
    },
    yLabel: {
      fontSize: 9,
      fontFamily: Fonts.medium,
    },
    gridLines: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'space-between',
      paddingBottom: 18,
    },
    gridLine: {
      borderTopWidth: 0.5,
      width: '100%',
    },
    barsRow: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      paddingBottom: 18,
    },
    barWrap: {
      alignItems: 'center',
      flex: 1,
      gap: 2,
    },
    barVal: {
      fontSize: 8,
      fontFamily: Fonts.medium,
    },
    barTrack: {
      flex: 1,
      justifyContent: 'flex-end',
      width: '100%',
      alignItems: 'center',
    },
    bar: {
      width: 18,
      borderRadius: 5,
      borderTopLeftRadius: 5,
      borderTopRightRadius: 5,
    },
    barDate: {
      fontSize: 9,
      fontFamily: Fonts.medium,
      position: 'absolute',
      bottom: 0,
    },
    chartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.sm,
      flexWrap: 'wrap',
      marginTop: Spacing.xs,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 999,
    },
    legendLabel: {
      fontSize: 10,
      fontFamily: Fonts.regular,
    },

    // ── Sleep pattern
    patternSubtitle: {
      fontSize: 11,
      fontFamily: Fonts.regular,
      marginTop: -Spacing.sm,
      marginBottom: Spacing.md,
    },
    timeAxis: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
    },
    timeAxisLabel: {
      fontSize: 8,
      fontFamily: Fonts.medium,
    },
    patternRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    patternDay: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      width: 28,
    },
    patternTrack: {
      flex: 1,
      height: 12,
      backgroundColor: c.inputBg,
      borderRadius: Radii.sm,
      overflow: 'hidden',
      position: 'relative',
    },
    idealZone: {
      position: 'absolute',
      top: 0,
      bottom: 0,
    },
    sleepBar: {
      position: 'absolute',
      top: 2,
      bottom: 2,
      borderRadius: 3,
      borderWidth: 1,
    },
    timeMarker: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      borderRadius: 1,
    },
    patternTimes: {
      fontSize: 9,
      fontFamily: Fonts.regular,
      width: 70,
      textAlign: 'right',
    },
    patternLegend: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.sm,
      flexWrap: 'wrap',
    },

    // ── History
    empty: {
      alignItems: 'center',
      paddingVertical: 60,
      gap: Spacing.md,
    },
    emptyTitle: {
      fontSize: 17,
      fontFamily: Fonts.bold,
    },
    emptyText: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      maxWidth: 260,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      gap: Spacing.sm,
    },
    qualityStripe: {
      width: 3,
      height: 36,
      borderRadius: 2,
    },
    entryLeft: {
      flex: 1,
    },
    entryDate: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    entryTimes: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: 2,
    },
    entryTime: {
      fontSize: 11,
      fontFamily: Fonts.regular,
    },
    entryMid: {
      alignItems: 'center',
      gap: 2,
    },
    entryDuration: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    entryActions: {
      flexDirection: 'row',
      gap: Spacing.xs,
    },
    actionBtn: {
      width: 28,
      height: 28,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Modal
    modalBg: {
      flex: 1,
      backgroundColor: '#00000070',
      justifyContent: 'flex-end',
    },
    modalCard: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.xl,
      maxHeight: '92%',
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
    modalInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 15,
      fontFamily: Fonts.regular,
      marginBottom: Spacing.md,
    },
    timeSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    manualToggle: {
      marginLeft: 'auto',
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
    },
    manualToggleText: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    pillsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    timePill: {
      borderWidth: 1.5,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 5,
    },
    timePillText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },
    durationPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    durationPreviewText: {
      fontSize: 13,
      fontFamily: Fonts.regular,
    },
    qualityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: Spacing.xs,
      marginBottom: Spacing.lg,
    },
    qualityBtn: {
      alignItems: 'center',
      padding: 6,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      flex: 1,
    },
    qualityLabel: {
      fontSize: 9,
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    modalBtns: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginTop: Spacing.sm,
    },
    modalBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      borderRadius: Radii.md,
      gap: Spacing.xs,
    },
    modalBtnText: {
      fontSize: 15,
      fontFamily: Fonts.bold,
    },
  });
