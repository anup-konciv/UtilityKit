import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F59E0B';

// ─── Types ────────────────────────────────────────────────────────────────────

type MoodEntry = {
  id: string;
  date: string;        // YYYY-MM-DD
  mood: number;        // 0–4
  note: string;
  tags: string[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const MOODS = [
  { emoji: '😢', label: 'Awful', color: '#EF4444' },
  { emoji: '😟', label: 'Bad',   color: '#F97316' },
  { emoji: '😐', label: 'Meh',   color: '#F59E0B' },
  { emoji: '🙂', label: 'Good',  color: '#3B82F6' },
  { emoji: '😄', label: 'Great', color: '#10B981' },
];

const TAGS = ['work', 'family', 'health', 'social', 'weather', 'exercise', 'sleep', 'food'];

const NOTE_MAX = 500;

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

function weekLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}

// ─── Sub-component: Calendar Heatmap ──────────────────────────────────────────

function CalendarHeatmap({
  entries,
  colors,
  styles,
  onDayPress,
}: {
  entries: MoodEntry[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
  onDayPress: (iso: string) => void;
}) {
  const today = todayISO();
  const entryMap = useMemo(() => {
    const m: Record<string, MoodEntry> = {};
    for (const e of entries) m[e.date] = e;
    return m;
  }, [entries]);

  // Build 35-cell (5-week) grid anchored to today
  const cells = useMemo(() => {
    const result: { iso: string; isCurrentMonth: boolean }[] = [];
    const anchor = new Date();
    // Go back 34 days so today is the last cell
    const start = new Date(anchor);
    start.setDate(start.getDate() - 34);
    for (let i = 0; i < 35; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      result.push({ iso: isoFromDate(d), isCurrentMonth: d.getMonth() === anchor.getMonth() });
    }
    return result;
  }, []);

  const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View>
      <View style={styles.heatmapDayRow}>
        {dayLabels.map((l, i) => (
          <Text key={i} style={[styles.heatmapDayLabel, { color: colors.textMuted }]}>{l}</Text>
        ))}
      </View>
      <View style={styles.heatmapGrid}>
        {cells.map(({ iso, isCurrentMonth }) => {
          const entry = entryMap[iso];
          const isToday = iso === today;
          const bg = entry
            ? MOODS[entry.mood].color
            : isCurrentMonth
              ? colors.glass
              : 'transparent';
          return (
            <TouchableOpacity
              key={iso}
              onPress={() => onDayPress(iso)}
              style={[
                styles.heatmapCell,
                { backgroundColor: bg, opacity: entry ? 1 : isCurrentMonth ? 0.6 : 0.2 },
                isToday && { borderWidth: 2, borderColor: ACCENT },
              ]}
            >
              <Text style={[styles.heatmapCellText, { color: entry ? '#fff' : colors.textMuted }]}>
                {Number(iso.slice(8))}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {/* Legend */}
      <View style={styles.heatmapLegend}>
        {MOODS.map((m, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: m.color }]} />
            <Text style={[styles.legendLabel, { color: colors.textMuted }]}>{m.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Sub-component: Mood Distribution Bar ─────────────────────────────────────

function MoodDistributionBar({
  entries,
  styles,
  colors,
}: {
  entries: MoodEntry[];
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const counts = useMemo(() => {
    const c = [0, 0, 0, 0, 0];
    for (const e of entries) c[e.mood]++;
    return c;
  }, [entries]);

  const total = entries.length;
  if (total === 0) return null;

  return (
    <View>
      {/* Stacked horizontal bar */}
      <View style={styles.distBar}>
        {counts.map((count, i) => {
          const pct = (count / total) * 100;
          if (pct === 0) return null;
          return (
            <View
              key={i}
              style={[styles.distSegment, { flex: count, backgroundColor: MOODS[i].color }]}
            />
          );
        })}
      </View>
      {/* Labels */}
      <View style={styles.distLabels}>
        {counts.map((count, i) => {
          const pct = Math.round((count / total) * 100);
          if (pct === 0) return null;
          return (
            <View key={i} style={styles.distLabelItem}>
              <Text style={{ fontSize: 14 }}>{MOODS[i].emoji}</Text>
              <Text style={[styles.distPct, { color: MOODS[i].color }]}>{pct}%</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function MoodJournalScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Which day was tapped in the calendar (null = today)
  const [focusedDate, setFocusedDate] = useState<string | null>(null);

  // Tab: 'log' | 'calendar' | 'stats'
  const [tab, setTab] = useState<'log' | 'calendar' | 'stats'>('log');

  useEffect(() => {
    loadJSON<MoodEntry[]>(KEYS.moodJournal, []).then(data => {
      // Migrate old entries that may lack tags
      setEntries(data.map(e => ({ ...e, tags: e.tags ?? [] })));
    });
  }, []);

  const persist = useCallback((e: MoodEntry[]) => {
    setEntries(e);
    saveJSON(KEYS.moodJournal, e);
  }, []);

  const today = todayISO();
  const todayEntry = entries.find(e => e.date === today);

  // When a calendar day is tapped, load that entry into the log form
  const handleDayPress = (iso: string) => {
    setFocusedDate(iso);
    const entry = entries.find(e => e.date === iso);
    if (entry) {
      setSelectedMood(entry.mood);
      setNote(entry.note);
      setSelectedTags(entry.tags ?? []);
    } else {
      setSelectedMood(null);
      setNote('');
      setSelectedTags([]);
    }
    setTab('log');
  };

  const logMood = () => {
    if (selectedMood === null) return;
    const date = focusedDate ?? today;
    const existing = entries.find(e => e.date === date);
    const entry: MoodEntry = {
      id: existing?.id ?? uid(),
      date,
      mood: selectedMood,
      note: note.trim(),
      tags: selectedTags,
    };
    persist([entry, ...entries.filter(e => e.date !== date)].sort((a, b) => b.date.localeCompare(a.date)));
    setSelectedMood(null);
    setNote('');
    setSelectedTags([]);
    setFocusedDate(null);
  };

  const deleteEntry = (id: string) => {
    persist(entries.filter(e => e.id !== id));
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  // ── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (entries.length === 0) return null;

    // Streak (consecutive days including today)
    const streak = (() => {
      let count = 0;
      const d = new Date();
      for (let i = 0; i < 365; i++) {
        const iso = isoFromDate(d);
        if (entries.some(e => e.date === iso)) count++;
        else break;
        d.setDate(d.getDate() - 1);
      }
      return count;
    })();

    // Week helpers
    const getWeekEntries = (weeksAgo: number) => {
      const result: MoodEntry[] = [];
      const d = new Date();
      d.setDate(d.getDate() - weeksAgo * 7);
      for (let i = 0; i < 7; i++) {
        const iso = isoFromDate(d);
        const entry = entries.find(e => e.date === iso);
        if (entry) result.push(entry);
        d.setDate(d.getDate() - 1);
      }
      return result;
    };

    const thisWeek = getWeekEntries(0);
    const lastWeek = getWeekEntries(1);
    const avgThis = thisWeek.length ? thisWeek.reduce((s, e) => s + e.mood, 0) / thisWeek.length : null;
    const avgLast = lastWeek.length ? lastWeek.reduce((s, e) => s + e.mood, 0) / lastWeek.length : null;
    const weekDelta = avgThis !== null && avgLast !== null ? avgThis - avgLast : null;

    // 7-day / 30-day avg
    const recent7 = entries.slice(0, 7);
    const recent30 = entries.slice(0, 30);
    const avg7 = recent7.reduce((s, e) => s + e.mood, 0) / recent7.length;
    const avg30 = recent30.reduce((s, e) => s + e.mood, 0) / recent30.length;

    // Most common
    const moodCounts = [0, 0, 0, 0, 0];
    for (const e of entries) moodCounts[e.mood]++;
    const mostCommon = moodCounts.indexOf(Math.max(...moodCounts));

    // Tag correlations: for each tag, compute avg mood when tagged
    const tagStats: { tag: string; avg: number; count: number }[] = TAGS.map(tag => {
      const tagged = entries.filter(e => e.tags?.includes(tag));
      const avg = tagged.length ? tagged.reduce((s, e) => s + e.mood, 0) / tagged.length : -1;
      return { tag, avg, count: tagged.length };
    }).filter(t => t.count >= 2).sort((a, b) => b.avg - a.avg);

    return {
      streak,
      total: entries.length,
      avg7,
      avg30,
      mostCommon,
      weekDelta,
      avgThis,
      avgLast,
      tagStats,
    };
  }, [entries]);

  // ── Insights ───────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const list: string[] = [];
    if (entries.length < 3) return list;

    // 1. Streak
    if (stats && stats.streak >= 3) {
      if (stats.streak >= 7) {
        list.push(`You've logged your mood every day this week — great consistency!`);
      } else {
        list.push(`${stats.streak}-day streak! Keep it going.`);
      }
    }

    // 2. Weekend vs weekday mood
    const weekendEntries = entries.filter(e => {
      const day = new Date(e.date + 'T00:00:00').getDay();
      return day === 0 || day === 6;
    });
    const weekdayEntries = entries.filter(e => {
      const day = new Date(e.date + 'T00:00:00').getDay();
      return day > 0 && day < 6;
    });
    if (weekendEntries.length >= 2 && weekdayEntries.length >= 2) {
      const wkendAvg = weekendEntries.reduce((s, e) => s + e.mood, 0) / weekendEntries.length;
      const wkdayAvg = weekdayEntries.reduce((s, e) => s + e.mood, 0) / weekdayEntries.length;
      const diff = wkendAvg - wkdayAvg;
      if (diff >= 0.5) list.push(`Your mood tends to be better on weekends 🎉`);
      else if (diff <= -0.5) list.push(`You tend to feel better on weekdays — work must be fulfilling!`);
    }

    // 3. Recent trend (last 3 entries)
    const recent3 = entries.slice(0, 3);
    if (recent3.length === 3) {
      if (recent3.every(e => e.mood >= 3)) {
        list.push(`You've been feeling good the last 3 days in a row!`);
      } else if (recent3.every(e => e.mood <= 1)) {
        list.push(`Rough patch lately — remember, every day is a fresh start.`);
      }
    }

    // 4. Week-over-week
    if (stats && stats.weekDelta !== null) {
      if (stats.weekDelta >= 0.5) {
        list.push(`This week's average mood is better than last week. You're on an upward trend!`);
      } else if (stats.weekDelta <= -0.5) {
        list.push(`This week has been tougher than last week. Try to carve out some time for yourself.`);
      }
    }

    // 5. Best tag
    if (stats && stats.tagStats.length > 0) {
      const best = stats.tagStats[0];
      if (best.avg >= 3) {
        list.push(`"${best.tag}" days tend to lift your mood — try to do more of it!`);
      }
    }

    return list.slice(0, 2);
  }, [entries, stats]);

  // ── Chart data (last 7 in chronological order) ─────────────────────────────

  const last7 = useMemo(() => entries.slice(0, 7).reverse(), [entries]);

  // ── Focused date display label ─────────────────────────────────────────────

  const editingDate = focusedDate ?? today;
  const editingEntry = entries.find(e => e.date === editingDate);
  const isEditingPast = editingDate !== today;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenShell title="Mood Journal" accentColor={ACCENT}>

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
          {/* Log card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* Header */}
            <View style={styles.logHeader}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {isEditingPast ? `Edit: ${fmtDate(editingDate)}` : editingEntry ? "Today's Mood" : "How are you feeling?"}
              </Text>
              {isEditingPast && (
                <TouchableOpacity onPress={() => { setFocusedDate(null); setSelectedMood(null); setNote(''); setSelectedTags([]); }}>
                  <Text style={[styles.clearBtn, { color: ACCENT }]}>Today</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Current entry display */}
            {editingEntry && selectedMood === null && (
              <View style={styles.currentEntry}>
                <Text style={{ fontSize: 44 }}>{MOODS[editingEntry.mood].emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.currentLabel, { color: MOODS[editingEntry.mood].color }]}>{MOODS[editingEntry.mood].label}</Text>
                  {editingEntry.note ? <Text style={[styles.currentNote, { color: colors.textMuted }]} numberOfLines={2}>{editingEntry.note}</Text> : null}
                  {editingEntry.tags?.length > 0 && (
                    <View style={styles.tagRow}>
                      {editingEntry.tags.map(t => (
                        <View key={t} style={[styles.tagPill, { backgroundColor: ACCENT + '22', borderColor: ACCENT + '55' }]}>
                          <Text style={[styles.tagPillText, { color: ACCENT }]}>{t}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* Mood selector */}
            <View style={styles.moodRow}>
              {MOODS.map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.moodBtn,
                    selectedMood === i && { backgroundColor: m.color + '20', borderColor: m.color },
                  ]}
                  onPress={() => setSelectedMood(i)}
                >
                  <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, { color: selectedMood === i ? m.color : colors.textMuted }]}>{m.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Tags */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>What's influencing your mood?</Text>
            <View style={styles.tagSelector}>
              {TAGS.map(tag => {
                const active = selectedTags.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.tagChip,
                      { backgroundColor: active ? ACCENT + '22' : colors.glass, borderColor: active ? ACCENT : colors.border },
                    ]}
                  >
                    <Text style={[styles.tagChipText, { color: active ? ACCENT : colors.textMuted }]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Note */}
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>What made you feel this way?</Text>
            <View style={[styles.noteWrap, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <TextInput
                style={[styles.noteInput, { color: colors.text }]}
                value={note}
                onChangeText={t => setNote(t.slice(0, NOTE_MAX))}
                placeholder="Write freely... (optional)"
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={NOTE_MAX}
              />
              <Text style={[styles.charCount, { color: colors.textMuted }]}>{note.length}/{NOTE_MAX}</Text>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[styles.logBtn, { backgroundColor: selectedMood !== null ? ACCENT : colors.surface }]}
              onPress={logMood}
              disabled={selectedMood === null}
            >
              <Text style={[styles.logBtnText, { color: selectedMood !== null ? '#fff' : colors.textMuted }]}>
                {editingEntry ? 'Update Entry' : 'Log Mood'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* 7-day bar chart */}
          {last7.length > 1 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Last 7 Days</Text>
              <View style={styles.chart}>
                {last7.map((e) => {
                  const barH = ((e.mood + 1) / 5) * 80;
                  return (
                    <View key={e.id} style={styles.barWrap}>
                      <Text style={{ fontSize: 11 }}>{MOODS[e.mood].emoji}</Text>
                      <View style={[styles.bar, { height: barH, backgroundColor: MOODS[e.mood].color }]} />
                      <Text style={[styles.barDate, { color: colors.textMuted }]}>{weekLabel(e.date)}</Text>
                      <Text style={[styles.barDate, { color: colors.textMuted }]}>{e.date.slice(5)}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* History */}
          {entries.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>History</Text>
              {entries.slice(0, 20).map(entry => (
                <View key={entry.id} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
                  <Text style={{ fontSize: 22 }}>{MOODS[entry.mood].emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <View style={styles.historyTop}>
                      <Text style={[styles.historyDate, { color: colors.text }]}>{fmtDate(entry.date)}</Text>
                      <Text style={[styles.historyMoodLabel, { color: MOODS[entry.mood].color }]}>{MOODS[entry.mood].label}</Text>
                    </View>
                    {entry.tags?.length > 0 && (
                      <View style={styles.tagRow}>
                        {entry.tags.map(t => (
                          <View key={t} style={[styles.tagPill, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]}>
                            <Text style={[styles.tagPillText, { color: ACCENT }]}>{t}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {entry.note ? <Text style={[styles.historyNote, { color: colors.textMuted }]} numberOfLines={2}>{entry.note}</Text> : null}
                  </View>
                  <TouchableOpacity onPress={() => deleteEntry(entry.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </>
      )}

      {/* ── CALENDAR TAB ── */}
      {tab === 'calendar' && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>30-Day Overview</Text>
          <CalendarHeatmap
            entries={entries}
            colors={colors}
            styles={styles}
            onDayPress={handleDayPress}
          />
          <Text style={[styles.heatmapHint, { color: colors.textMuted }]}>
            Tap any day to view or edit that entry.
          </Text>
        </View>
      )}

      {/* ── STATS TAB ── */}
      {tab === 'stats' && stats && (
        <>
          {/* Key metrics */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Overview</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{stats.streak}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Day Streak</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statVal, { color: ACCENT }]}>{stats.total}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Entries</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={{ fontSize: 26 }}>{MOODS[Math.round(stats.avg7)].emoji}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>7-Day Avg</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={{ fontSize: 26 }}>{MOODS[stats.mostCommon].emoji}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Most Common</Text>
              </View>
            </View>
          </View>

          {/* Week-over-week */}
          {stats.weekDelta !== null && stats.avgThis !== null && stats.avgLast !== null && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Week vs Last Week</Text>
              <View style={styles.wowRow}>
                <View style={styles.wowCol}>
                  <Text style={[styles.wowWeekLabel, { color: colors.textMuted }]}>Last Week</Text>
                  <Text style={{ fontSize: 32 }}>{MOODS[Math.round(stats.avgLast)].emoji}</Text>
                  <Text style={[styles.wowAvg, { color: MOODS[Math.round(stats.avgLast)].color }]}>
                    {stats.avgLast.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.wowArrowCol}>
                  <Ionicons
                    name={stats.weekDelta > 0 ? 'arrow-up' : stats.weekDelta < 0 ? 'arrow-down' : 'remove'}
                    size={28}
                    color={stats.weekDelta > 0 ? '#10B981' : stats.weekDelta < 0 ? '#EF4444' : colors.textMuted}
                  />
                  <Text style={[
                    styles.wowDelta,
                    { color: stats.weekDelta > 0 ? '#10B981' : stats.weekDelta < 0 ? '#EF4444' : colors.textMuted },
                  ]}>
                    {stats.weekDelta > 0 ? '+' : ''}{stats.weekDelta.toFixed(1)}
                  </Text>
                </View>
                <View style={styles.wowCol}>
                  <Text style={[styles.wowWeekLabel, { color: colors.textMuted }]}>This Week</Text>
                  <Text style={{ fontSize: 32 }}>{MOODS[Math.round(stats.avgThis)].emoji}</Text>
                  <Text style={[styles.wowAvg, { color: MOODS[Math.round(stats.avgThis)].color }]}>
                    {stats.avgThis.toFixed(1)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Mood distribution */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Mood Distribution</Text>
            <MoodDistributionBar entries={entries} styles={styles} colors={colors} />
          </View>

          {/* Tag correlations */}
          {stats.tagStats.length > 0 && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Tag Insights</Text>
              <Text style={[styles.tagInsightHint, { color: colors.textMuted }]}>
                Average mood when each tag is logged (min. 2 entries)
              </Text>
              {stats.tagStats.map(({ tag, avg, count }) => {
                const barW = ((avg + 0.5) / 5) * 100;
                const moodIdx = Math.min(4, Math.round(avg));
                return (
                  <View key={tag} style={styles.tagInsightRow}>
                    <Text style={[styles.tagInsightName, { color: colors.text }]}>{tag}</Text>
                    <View style={[styles.tagInsightBarBg, { backgroundColor: colors.glass }]}>
                      <View style={[styles.tagInsightBarFill, { width: `${barW}%` as any, backgroundColor: MOODS[moodIdx].color }]} />
                    </View>
                    <Text style={[styles.tagInsightEmoji]}>{MOODS[moodIdx].emoji}</Text>
                    <Text style={[styles.tagInsightCount, { color: colors.textMuted }]}>×{count}</Text>
                  </View>
                );
              })}
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
          <Text style={{ fontSize: 48 }}>📓</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Log a few moods to see stats</Text>
        </View>
      )}

    </ScreenShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
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

    currentEntry: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.md, padding: Spacing.sm, borderRadius: Radii.md, backgroundColor: 'rgba(245,158,11,0.06)' },
    currentLabel: { fontSize: 15, fontFamily: Fonts.bold },
    currentNote: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 2 },

    moodRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: Spacing.lg },
    moodBtn: {
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 6,
      borderRadius: Radii.lg,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    moodLabel: { fontSize: 9, fontFamily: Fonts.medium, marginTop: 2 },

    fieldLabel: { fontSize: 11, fontFamily: Fonts.semibold, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.8 },

    tagSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
    tagChip: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 5,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    tagChipText: { fontSize: 12, fontFamily: Fonts.medium },

    noteWrap: { borderWidth: 1, borderRadius: Radii.md, marginBottom: Spacing.md, overflow: 'hidden' },
    noteInput: { padding: Spacing.md, fontSize: 14, fontFamily: Fonts.regular, minHeight: 90, textAlignVertical: 'top' },
    charCount: { fontSize: 10, fontFamily: Fonts.regular, textAlign: 'right', paddingRight: Spacing.sm, paddingBottom: Spacing.xs },

    logBtn: { paddingVertical: 14, borderRadius: Radii.xl, alignItems: 'center' },
    logBtnText: { fontSize: 16, fontFamily: Fonts.bold },

    // Chart
    chart: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 120 },
    barWrap: { alignItems: 'center', gap: 2 },
    bar: { width: 28, borderRadius: 5 },
    barDate: { fontSize: 9, fontFamily: Fonts.regular },

    // History
    historyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 0.5 },
    historyTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    historyDate: { fontSize: 13, fontFamily: Fonts.semibold },
    historyMoodLabel: { fontSize: 11, fontFamily: Fonts.medium },
    historyNote: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 2 },

    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
    tagPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.pill, borderWidth: 1 },
    tagPillText: { fontSize: 10, fontFamily: Fonts.medium },

    // Calendar heatmap
    heatmapDayRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 4 },
    heatmapDayLabel: { width: 36, textAlign: 'center', fontSize: 10, fontFamily: Fonts.bold },
    heatmapGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
    heatmapCell: {
      width: 36,
      height: 36,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heatmapCellText: { fontSize: 10, fontFamily: Fonts.medium },
    heatmapLegend: { flexDirection: 'row', justifyContent: 'space-around', marginTop: Spacing.md },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 10, fontFamily: Fonts.regular },
    heatmapHint: { fontSize: 11, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.sm },

    // Stats
    statsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statVal: { fontSize: 26, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },

    // Week over week
    wowRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    wowCol: { alignItems: 'center', gap: 4 },
    wowWeekLabel: { fontSize: 11, fontFamily: Fonts.semibold },
    wowAvg: { fontSize: 15, fontFamily: Fonts.bold },
    wowArrowCol: { alignItems: 'center', gap: 2 },
    wowDelta: { fontSize: 16, fontFamily: Fonts.bold },

    // Distribution
    distBar: { flexDirection: 'row', height: 24, borderRadius: Radii.md, overflow: 'hidden', marginBottom: Spacing.sm },
    distSegment: { height: '100%' },
    distLabels: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    distLabelItem: { alignItems: 'center', gap: 2 },
    distPct: { fontSize: 12, fontFamily: Fonts.bold },

    // Tag insights
    tagInsightHint: { fontSize: 11, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    tagInsightRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    tagInsightName: { width: 70, fontSize: 12, fontFamily: Fonts.medium },
    tagInsightBarBg: { flex: 1, height: 8, borderRadius: Radii.pill, overflow: 'hidden' },
    tagInsightBarFill: { height: '100%', borderRadius: Radii.pill },
    tagInsightEmoji: { fontSize: 16, width: 22 },
    tagInsightCount: { fontSize: 11, fontFamily: Fonts.regular, width: 28, textAlign: 'right' },

    // Insights
    insightRow: { flexDirection: 'row', gap: Spacing.sm, paddingLeft: Spacing.sm, borderLeftWidth: 3, marginBottom: Spacing.sm },
    insightText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, lineHeight: 20 },

    // Empty
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium },
  });
