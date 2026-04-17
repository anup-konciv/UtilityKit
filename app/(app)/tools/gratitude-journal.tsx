import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#F59E0B';
const STORAGE_KEY = 'uk_gratitude';

const MOOD_EMOJIS = ['😔', '😐', '🙂', '😊', '🤩'] as const;

const PROMPTS = [
  'What made you smile today?',
  'Who are you thankful for?',
  'What is something beautiful you noticed today?',
  'What is a skill or ability you are grateful to have?',
  'What is a simple pleasure you enjoyed today?',
  'What challenge helped you grow recently?',
  'What is something in nature you appreciate?',
  'What is a memory that always makes you happy?',
  'Who made a positive difference in your life recently?',
  'What is something you love about your home?',
  'What is a book, song, or movie that touched your heart?',
  'What act of kindness did you witness or experience today?',
  'What is something about your health you are grateful for?',
  'What technology are you thankful for?',
  'What is a lesson you learned that you are grateful for?',
  'What is something you are looking forward to?',
  'What is a comfort you often take for granted?',
  'Who is someone that always makes you laugh?',
  'What is a place that brings you peace?',
  'What opportunity are you grateful for right now?',
  'What tradition or ritual do you cherish?',
  'What is something your body lets you do that you appreciate?',
  'What is a mistake that taught you something valuable?',
  'What is a small win you had today?',
  'What is something about this season you enjoy?',
  'Who believed in you when you needed it most?',
  'What hobby or interest enriches your life?',
  'What meal or food are you grateful for today?',
  'What is something about your work or studies you appreciate?',
  'What is a freedom you are thankful to have?',
  'What is a sound that brings you comfort?',
  'What childhood memory fills you with warmth?',
  'What is something you accomplished that you are proud of?',
  'What part of your morning routine do you enjoy?',
  'What is a quality in yourself you are grateful for?',
  'Who has been a mentor or guide in your life?',
  'What is something new you learned recently?',
  'What made today different from yesterday in a good way?',
];

// ─── Types ────────────────────────────────────────────────────────────────────

type GratitudeEntry = {
  id: string;
  date: string;         // YYYY-MM-DD
  items: [string, string, string];
  mood: number;         // 1-5
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function isoFromDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function fmtWeekday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' });
}

function getDailyPrompt(): string {
  // Deterministic per day using the day-of-year
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
  return PROMPTS[dayOfYear % PROMPTS.length];
}

function computeStreak(entries: GratitudeEntry[]): number {
  if (entries.length === 0) return 0;
  const dateSet = new Set(entries.map(e => e.date));
  let count = 0;
  const d = new Date();
  // Check today first; if not logged, start from yesterday
  const todayStr = isoFromDate(d);
  if (!dateSet.has(todayStr)) {
    d.setDate(d.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const iso = isoFromDate(d);
    if (dateSet.has(iso)) {
      count++;
    } else {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return count;
}

function computeLongestStreak(entries: GratitudeEntry[]): number {
  if (entries.length === 0) return 0;
  const dates = [...new Set(entries.map(e => e.date))].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + 'T00:00:00');
    const curr = new Date(dates[i] + 'T00:00:00');
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

// ─── Sub-component: Calendar Heatmap ──────────────────────────────────────────

function CalendarHeatmap({
  entries,
  colors,
  styles,
}: {
  entries: GratitudeEntry[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const today = todayISO();
  const dateSet = useMemo(() => new Set(entries.map(e => e.date)), [entries]);

  const cells = useMemo(() => {
    const result: { iso: string; inRange: boolean }[] = [];
    const anchor = new Date();
    const start = new Date(anchor);
    // 30 days: go back 29 days so today is the last cell
    start.setDate(start.getDate() - 29);
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      result.push({ iso: isoFromDate(d), inRange: true });
    }
    return result;
  }, []);

  return (
    <View>
      <View style={styles.heatmapGrid}>
        {cells.map(({ iso }) => {
          const logged = dateSet.has(iso);
          const isToday = iso === today;
          return (
            <View
              key={iso}
              style={[
                styles.heatmapCell,
                {
                  backgroundColor: logged ? ACCENT : colors.glass,
                  opacity: logged ? 1 : 0.5,
                },
                isToday && { borderWidth: 2, borderColor: '#fff' },
              ]}
            >
              <Text
                style={[
                  styles.heatmapCellText,
                  { color: logged ? '#fff' : colors.textMuted },
                ]}
              >
                {Number(iso.slice(8))}
              </Text>
            </View>
          );
        })}
      </View>
      <View style={styles.heatmapLegendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.glass }]} />
          <Text style={[styles.legendLabel, { color: colors.textMuted }]}>No entry</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
          <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Logged</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function GratitudeJournalScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<GratitudeEntry[]>([]);
  const [item1, setItem1] = useState('');
  const [item2, setItem2] = useState('');
  const [item3, setItem3] = useState('');
  const [mood, setMood] = useState(3);
  const [isEditing, setIsEditing] = useState(false);
  const [tab, setTab] = useState<'today' | 'history' | 'stats'>('today');
  const [expandedHistory, setExpandedHistory] = useState(10);

  useEffect(() => {
    loadJSON<GratitudeEntry[]>(STORAGE_KEY, []).then(setEntries);
  }, []);

  const persist = useCallback((updated: GratitudeEntry[]) => {
    setEntries(updated);
    saveJSON(STORAGE_KEY, updated);
  }, []);

  const today = todayISO();
  const todayEntry = entries.find(e => e.date === today);
  const dailyPrompt = useMemo(getDailyPrompt, []);

  const streak = useMemo(() => computeStreak(entries), [entries]);
  const longestStreak = useMemo(() => computeLongestStreak(entries), [entries]);

  const saveEntry = () => {
    const trimmed: [string, string, string] = [
      item1.trim(),
      item2.trim(),
      item3.trim(),
    ];
    // At least one item must be filled
    if (!trimmed[0] && !trimmed[1] && !trimmed[2]) return;

    const entry: GratitudeEntry = {
      id: todayEntry?.id ?? uid(),
      date: today,
      items: trimmed,
      mood,
    };
    persist(
      [entry, ...entries.filter(e => e.date !== today)].sort((a, b) =>
        b.date.localeCompare(a.date),
      ),
    );
    setIsEditing(false);
  };

  const startEditing = () => {
    if (todayEntry) {
      setItem1(todayEntry.items[0]);
      setItem2(todayEntry.items[1]);
      setItem3(todayEntry.items[2]);
      setMood(todayEntry.mood);
    } else {
      setItem1('');
      setItem2('');
      setItem3('');
      setMood(3);
    }
    setIsEditing(true);
  };

  const deleteEntry = (id: string) => {
    persist(entries.filter(e => e.id !== id));
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setItem1('');
    setItem2('');
    setItem3('');
    setMood(3);
  };

  // Group history by month
  const historyGrouped = useMemo(() => {
    const groups: { label: string; entries: GratitudeEntry[] }[] = [];
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    let currentLabel = '';
    for (const e of sorted) {
      const [y, m] = e.date.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, entries: [] });
      }
      groups[groups.length - 1].entries.push(e);
    }
    return groups;
  }, [entries]);

  // Flatten for slicing
  const allEntriesSorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  // Average mood
  const avgMood = useMemo(() => {
    if (entries.length === 0) return 0;
    return entries.reduce((s, e) => s + e.mood, 0) / entries.length;
  }, [entries]);

  const canSave = item1.trim() || item2.trim() || item3.trim();

  return (
    <ScreenShell title="Gratitude Journal" accentColor={ACCENT}>
      {/* Tab bar */}
      <View
        style={[
          styles.tabBar,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        {(['today', 'history', 'stats'] as const).map(t => (
          <TouchableOpacity
            key={t}
            style={[
              styles.tabBtn,
              tab === t && {
                backgroundColor: ACCENT + '22',
                borderColor: ACCENT,
              },
            ]}
            onPress={() => setTab(t)}
          >
            <Ionicons
              name={
                t === 'today'
                  ? 'sunny-outline'
                  : t === 'history'
                    ? 'time-outline'
                    : 'stats-chart-outline'
              }
              size={15}
              color={tab === t ? ACCENT : colors.textMuted}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: tab === t ? ACCENT : colors.textMuted },
              ]}
            >
              {t === 'today' ? 'Today' : t === 'history' ? 'History' : 'Stats'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ─── TODAY TAB ─── */}
      {tab === 'today' && (
        <>
          {/* Streak & quick stats banner */}
          <View
            style={[
              styles.streakBanner,
              { backgroundColor: ACCENT + '14', borderColor: ACCENT + '30' },
            ]}
          >
            <View style={styles.streakItem}>
              <Ionicons name="flame-outline" size={22} color={ACCENT} />
              <Text style={[styles.streakValue, { color: ACCENT }]}>
                {streak}
              </Text>
              <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
                day streak
              </Text>
            </View>
            <View
              style={[styles.streakDivider, { backgroundColor: ACCENT + '30' }]}
            />
            <View style={styles.streakItem}>
              <Ionicons name="journal-outline" size={20} color={ACCENT} />
              <Text style={[styles.streakValue, { color: ACCENT }]}>
                {entries.length}
              </Text>
              <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
                entries
              </Text>
            </View>
          </View>

          {/* Daily prompt */}
          <View
            style={[
              styles.promptCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.promptHeader}>
              <Ionicons name="bulb-outline" size={18} color={ACCENT} />
              <Text style={[styles.promptTitle, { color: ACCENT }]}>
                Today's Reflection
              </Text>
            </View>
            <Text style={[styles.promptText, { color: colors.text }]}>
              "{dailyPrompt}"
            </Text>
          </View>

          {/* Today's entry display (if logged and not editing) */}
          {todayEntry && !isEditing && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.todayHeader}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Today's Gratitude
                  </Text>
                  <Text
                    style={[styles.todaySubtitle, { color: colors.textMuted }]}
                  >
                    {fmtWeekday(today)}, {fmtDate(today)}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={startEditing}
                  style={[
                    styles.editBtn,
                    { backgroundColor: ACCENT + '18', borderColor: ACCENT + '40' },
                  ]}
                >
                  <Ionicons name="pencil-outline" size={14} color={ACCENT} />
                  <Text style={[styles.editBtnText, { color: ACCENT }]}>
                    Edit
                  </Text>
                </TouchableOpacity>
              </View>

              {todayEntry.items.map((item, i) =>
                item ? (
                  <View key={i} style={styles.gratitudeItemRow}>
                    <View
                      style={[styles.itemBullet, { backgroundColor: ACCENT }]}
                    >
                      <Text style={styles.itemBulletText}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.gratitudeItemText, { color: colors.text }]}>
                      {item}
                    </Text>
                  </View>
                ) : null,
              )}

              <View style={styles.moodDisplayRow}>
                <Text style={[styles.moodDisplayLabel, { color: colors.textMuted }]}>
                  Mood:
                </Text>
                {MOOD_EMOJIS.map((emoji, i) => (
                  <Text
                    key={i}
                    style={{
                      fontSize: 18,
                      opacity: i + 1 === todayEntry.mood ? 1 : 0.2,
                    }}
                  >
                    {emoji}
                  </Text>
                ))}
              </View>
            </View>
          )}

          {/* Entry form (new or editing) */}
          {(!todayEntry || isEditing) && (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                {isEditing
                  ? 'Edit Today\'s Entry'
                  : '3 Things I\'m Grateful For'}
              </Text>
              <Text
                style={[styles.formSubtitle, { color: colors.textMuted }]}
              >
                Take a moment to appreciate the good in your life.
              </Text>

              {[
                { val: item1, set: setItem1, num: 1, placeholder: 'I am grateful for...' },
                { val: item2, set: setItem2, num: 2, placeholder: 'I appreciate...' },
                { val: item3, set: setItem3, num: 3, placeholder: 'I am thankful for...' },
              ].map(({ val, set, num, placeholder }) => (
                <View key={num} style={styles.inputRow}>
                  <View
                    style={[styles.inputNum, { backgroundColor: ACCENT + '20' }]}
                  >
                    <Text style={[styles.inputNumText, { color: ACCENT }]}>
                      {num}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        backgroundColor: colors.inputBg,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.textInput, { color: colors.text }]}
                      value={val}
                      onChangeText={set}
                      placeholder={placeholder}
                      placeholderTextColor={colors.textMuted}
                      multiline
                      maxLength={200}
                    />
                  </View>
                </View>
              ))}

              {/* Mood selector */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                How are you feeling?
              </Text>
              <View style={styles.moodRow}>
                {MOOD_EMOJIS.map((emoji, i) => {
                  const moodVal = i + 1;
                  const active = mood === moodVal;
                  return (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setMood(moodVal)}
                      style={[
                        styles.moodBtn,
                        active && {
                          backgroundColor: ACCENT + '20',
                          borderColor: ACCENT,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 26 }}>{emoji}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Buttons */}
              <View style={styles.formActions}>
                {isEditing && (
                  <TouchableOpacity
                    onPress={cancelEditing}
                    style={[
                      styles.cancelBtn,
                      { borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.cancelBtnText,
                        { color: colors.textMuted },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={saveEntry}
                  disabled={!canSave}
                  style={[
                    styles.saveBtn,
                    {
                      backgroundColor: canSave ? ACCENT : colors.surface,
                      flex: isEditing ? 1 : undefined,
                    },
                  ]}
                >
                  <Ionicons
                    name="heart"
                    size={18}
                    color={canSave ? '#fff' : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.saveBtnText,
                      { color: canSave ? '#fff' : colors.textMuted },
                    ]}
                  >
                    {isEditing ? 'Update Entry' : 'Save Gratitude'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 30-day calendar heatmap */}
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
              30-Day Overview
            </Text>
            <CalendarHeatmap
              entries={entries}
              colors={colors}
              styles={styles}
            />
          </View>
        </>
      )}

      {/* ─── HISTORY TAB ─── */}
      {tab === 'history' && (
        <>
          {entries.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                No entries yet. Start your gratitude journey today!
              </Text>
            </View>
          )}

          {historyGrouped.map(group => (
            <View key={group.label}>
              <Text
                style={[styles.monthHeader, { color: colors.textMuted }]}
              >
                {group.label}
              </Text>
              {group.entries.slice(0, expandedHistory).map(entry => (
                <View
                  key={entry.id}
                  style={[
                    styles.historyCard,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.historyCardHeader}>
                    <View style={styles.historyDateRow}>
                      <Text
                        style={[
                          styles.historyDate,
                          { color: colors.text },
                        ]}
                      >
                        {fmtDate(entry.date)}
                      </Text>
                      <Text
                        style={[
                          styles.historyWeekday,
                          { color: colors.textMuted },
                        ]}
                      >
                        {fmtWeekday(entry.date)}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={{ fontSize: 16 }}>
                        {MOOD_EMOJIS[entry.mood - 1]}
                      </Text>
                      <TouchableOpacity
                        onPress={() => deleteEntry(entry.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={16}
                          color={colors.textMuted}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {entry.items.map((item, i) =>
                    item ? (
                      <View key={i} style={styles.historyItemRow}>
                        <View
                          style={[
                            styles.historyBullet,
                            { backgroundColor: ACCENT + '30' },
                          ]}
                        />
                        <Text
                          style={[
                            styles.historyItemText,
                            { color: colors.text },
                          ]}
                        >
                          {item}
                        </Text>
                      </View>
                    ) : null,
                  )}
                </View>
              ))}
            </View>
          ))}

          {allEntriesSorted.length > expandedHistory && (
            <TouchableOpacity
              onPress={() => setExpandedHistory(prev => prev + 10)}
              style={[
                styles.loadMoreBtn,
                { borderColor: colors.border },
              ]}
            >
              <Text
                style={[styles.loadMoreText, { color: ACCENT }]}
              >
                Show More
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}

      {/* ─── STATS TAB ─── */}
      {tab === 'stats' && (
        <>
          {entries.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="analytics-outline"
                size={48}
                color={colors.textMuted}
              />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Log some entries to see your stats
              </Text>
            </View>
          ) : (
            <>
              {/* Key metrics */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionLabel, { color: colors.textMuted }]}
                >
                  Your Journey
                </Text>
                <View style={styles.statsGrid}>
                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: ACCENT + '12',
                        borderColor: ACCENT + '30',
                      },
                    ]}
                  >
                    <Ionicons name="flame" size={22} color={ACCENT} />
                    <Text style={[styles.statVal, { color: ACCENT }]}>
                      {streak}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      Current Streak
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: '#EF444412',
                        borderColor: '#EF444430',
                      },
                    ]}
                  >
                    <Ionicons name="trophy" size={22} color="#EF4444" />
                    <Text style={[styles.statVal, { color: '#EF4444' }]}>
                      {longestStreak}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      Longest Streak
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: '#3B82F612',
                        borderColor: '#3B82F630',
                      },
                    ]}
                  >
                    <Ionicons name="journal" size={22} color="#3B82F6" />
                    <Text style={[styles.statVal, { color: '#3B82F6' }]}>
                      {entries.length}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      Total Entries
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statCard,
                      {
                        backgroundColor: '#10B98112',
                        borderColor: '#10B98130',
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 22 }}>
                      {MOOD_EMOJIS[Math.round(avgMood) - 1] ?? MOOD_EMOJIS[2]}
                    </Text>
                    <Text style={[styles.statVal, { color: '#10B981' }]}>
                      {avgMood.toFixed(1)}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        { color: colors.textMuted },
                      ]}
                    >
                      Avg Mood
                    </Text>
                  </View>
                </View>
              </View>

              {/* Mood distribution */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionLabel, { color: colors.textMuted }]}
                >
                  Mood Distribution
                </Text>
                {MOOD_EMOJIS.map((emoji, i) => {
                  const moodVal = i + 1;
                  const count = entries.filter(e => e.mood === moodVal).length;
                  const pct =
                    entries.length > 0
                      ? Math.round((count / entries.length) * 100)
                      : 0;
                  return (
                    <View key={i} style={styles.moodDistRow}>
                      <Text style={{ fontSize: 20, width: 30 }}>{emoji}</Text>
                      <View
                        style={[
                          styles.moodDistBarBg,
                          { backgroundColor: colors.glass },
                        ]}
                      >
                        <View
                          style={[
                            styles.moodDistBarFill,
                            {
                              width: `${pct}%` as any,
                              backgroundColor: ACCENT,
                              opacity: 0.4 + (i / 4) * 0.6,
                            },
                          ]}
                        />
                      </View>
                      <Text
                        style={[
                          styles.moodDistPct,
                          { color: colors.textMuted },
                        ]}
                      >
                        {pct}%
                      </Text>
                    </View>
                  );
                })}
              </View>

              {/* 30-day heatmap */}
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.sectionLabel, { color: colors.textMuted }]}
                >
                  30-Day Heatmap
                </Text>
                <CalendarHeatmap
                  entries={entries}
                  colors={colors}
                  styles={styles}
                />
              </View>

              {/* Encouragement */}
              <View
                style={[
                  styles.encourageCard,
                  {
                    backgroundColor: ACCENT + '10',
                    borderColor: ACCENT + '25',
                  },
                ]}
              >
                <Ionicons name="sparkles" size={20} color={ACCENT} />
                <Text
                  style={[styles.encourageText, { color: colors.text }]}
                >
                  {streak >= 7
                    ? 'Amazing! A whole week of gratitude. You are building a beautiful habit.'
                    : streak >= 3
                      ? 'Great momentum! Keep your gratitude streak alive.'
                      : entries.length >= 5
                        ? 'You have logged ' +
                          entries.length +
                          ' entries. Consistency is the key to a grateful heart.'
                        : 'Every entry is a step toward a more grateful life. Keep going!'}
                </Text>
              </View>
            </>
          )}
        </>
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
    tabLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },

    // Card
    card: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    cardTitle: {
      fontSize: 17,
      fontFamily: Fonts.bold,
    },
    sectionLabel: {
      fontSize: 10,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.md,
    },

    // Streak banner
    streakBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radii.xl,
      borderWidth: 1,
      paddingVertical: Spacing.md,
      marginBottom: Spacing.lg,
    },
    streakItem: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    streakValue: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    streakLabel: {
      fontSize: 10,
      fontFamily: Fonts.medium,
    },
    streakDivider: {
      width: 1,
      height: 40,
    },

    // Daily prompt
    promptCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    promptHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    promptTitle: {
      fontSize: 12,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    promptText: {
      fontSize: 16,
      fontFamily: Fonts.medium,
      fontStyle: 'italic',
      lineHeight: 24,
    },

    // Today's entry display
    todayHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: Spacing.lg,
    },
    todaySubtitle: {
      fontSize: 12,
      fontFamily: Fonts.regular,
      marginTop: 2,
    },
    editBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    editBtnText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    gratitudeItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    itemBullet: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    itemBulletText: {
      fontSize: 12,
      fontFamily: Fonts.bold,
      color: '#fff',
    },
    gratitudeItemText: {
      flex: 1,
      fontSize: 15,
      fontFamily: Fonts.regular,
      lineHeight: 22,
    },
    moodDisplayRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      paddingTop: Spacing.md,
      borderTopWidth: 0.5,
      borderTopColor: c.border,
    },
    moodDisplayLabel: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      marginRight: Spacing.xs,
    },

    // Entry form
    formSubtitle: {
      fontSize: 13,
      fontFamily: Fonts.regular,
      marginTop: 4,
      marginBottom: Spacing.lg,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      marginBottom: Spacing.md,
    },
    inputNum: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
    },
    inputNumText: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    inputWrap: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.md,
      overflow: 'hidden',
    },
    textInput: {
      padding: Spacing.md,
      fontSize: 14,
      fontFamily: Fonts.regular,
      minHeight: 48,
      textAlignVertical: 'top',
    },
    fieldLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      marginBottom: Spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    moodRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: Spacing.lg,
    },
    moodBtn: {
      alignItems: 'center',
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: Radii.lg,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    formActions: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    cancelBtn: {
      paddingVertical: 14,
      paddingHorizontal: Spacing.xl,
      borderRadius: Radii.xl,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelBtnText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    saveBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 14,
      borderRadius: Radii.xl,
    },
    saveBtnText: {
      fontSize: 16,
      fontFamily: Fonts.bold,
    },

    // Calendar heatmap
    heatmapGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    heatmapCell: {
      width: 38,
      height: 38,
      borderRadius: Radii.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heatmapCellText: {
      fontSize: 10,
      fontFamily: Fonts.medium,
    },
    heatmapLegendRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.xl,
      marginTop: Spacing.md,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendLabel: {
      fontSize: 10,
      fontFamily: Fonts.regular,
    },

    // History
    monthHeader: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.sm,
      marginTop: Spacing.sm,
    },
    historyCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    historyCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    historyDateRow: {
      gap: 2,
    },
    historyDate: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    historyWeekday: {
      fontSize: 11,
      fontFamily: Fonts.regular,
    },
    historyRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    historyItemRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginBottom: 6,
    },
    historyBullet: {
      width: 6,
      height: 6,
      borderRadius: 3,
      marginTop: 6,
    },
    historyItemText: {
      flex: 1,
      fontSize: 13,
      fontFamily: Fonts.regular,
      lineHeight: 19,
    },
    loadMoreBtn: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radii.xl,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    loadMoreText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },

    // Stats
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    statCard: {
      flex: 1,
      minWidth: '42%' as any,
      alignItems: 'center',
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      gap: 4,
    },
    statVal: {
      fontSize: 24,
      fontFamily: Fonts.bold,
    },
    statLabel: {
      fontSize: 10,
      fontFamily: Fonts.medium,
      textAlign: 'center',
    },

    // Mood distribution
    moodDistRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    moodDistBarBg: {
      flex: 1,
      height: 12,
      borderRadius: Radii.pill,
      overflow: 'hidden',
    },
    moodDistBarFill: {
      height: '100%',
      borderRadius: Radii.pill,
    },
    moodDistPct: {
      width: 36,
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textAlign: 'right',
    },

    // Encouragement
    encourageCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    encourageText: {
      flex: 1,
      fontSize: 13,
      fontFamily: Fonts.regular,
      lineHeight: 20,
    },

    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.huge,
      gap: Spacing.md,
    },
    emptyText: {
      fontSize: 14,
      fontFamily: Fonts.medium,
      textAlign: 'center',
      paddingHorizontal: Spacing.xxl,
    },
  });
