import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EF4444';
const STORAGE_KEY = 'uk_bp_log';

// ─── Types ────────────────────────────────────────────────────────────────────

type BPEntry = {
  id: string;
  systolic: number;
  diastolic: number;
  pulse: number;
  date: string; // ISO YYYY-MM-DD
  time: string; // HH:MM
  notes: string;
};

type BPCategory = {
  label: string;
  color: string;
  bgColor: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: Record<string, BPCategory> = {
  normal:    { label: 'Normal',       color: '#10B981', bgColor: '#10B98118' },
  elevated:  { label: 'Elevated',     color: '#F59E0B', bgColor: '#F59E0B18' },
  high1:     { label: 'High Stage 1', color: '#F97316', bgColor: '#F9731618' },
  high2:     { label: 'High Stage 2', color: '#EF4444', bgColor: '#EF444418' },
  crisis:    { label: 'Crisis',       color: '#991B1B', bgColor: '#991B1B18' },
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

function timeNow() {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function weekLabel(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short' });
}

function classifyBP(systolic: number, diastolic: number): string {
  if (systolic >= 180 || diastolic >= 120) return 'crisis';
  if (systolic >= 140 || diastolic >= 90) return 'high2';
  if ((systolic >= 130 && systolic <= 139) || (diastolic >= 80 && diastolic <= 89)) return 'high1';
  if (systolic >= 120 && systolic <= 129 && diastolic < 80) return 'elevated';
  if (systolic < 120 && diastolic < 80) return 'normal';
  return 'normal';
}

function getCategoryInfo(key: string): BPCategory {
  return CATEGORIES[key] ?? CATEGORIES.normal;
}

// ─── 7-Day Trend Chart ───────────────────────────────────────────────────────

function TrendChart({
  entries,
  colors,
  styles,
}: {
  entries: BPEntry[];
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
}) {
  const chartData = useMemo(() => {
    const data: { date: string; label: string; systolic: number; diastolic: number; dayLabel: string }[] = [];
    const d = new Date();
    for (let i = 6; i >= 0; i--) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - i);
      const iso = `${dd.getFullYear()}-${pad(dd.getMonth() + 1)}-${pad(dd.getDate())}`;
      // Find entries for this day, use latest if multiple
      const dayEntries = entries.filter(e => e.date === iso);
      const latest = dayEntries.length > 0
        ? dayEntries.reduce((a, b) => (a.time > b.time ? a : b))
        : null;
      data.push({
        date: iso,
        label: i === 0 ? 'Today' : weekLabel(iso),
        systolic: latest?.systolic ?? 0,
        diastolic: latest?.diastolic ?? 0,
        dayLabel: `${pad(dd.getMonth() + 1)}/${pad(dd.getDate())}`,
      });
    }
    return data;
  }, [entries]);

  const hasData = chartData.some(d => d.systolic > 0);
  if (!hasData) return null;

  const maxVal = Math.max(180, ...chartData.map(d => d.systolic));
  const CHART_HEIGHT = 120;

  return (
    <View>
      {/* Reference lines */}
      <View style={styles.chartRefLines}>
        <View style={styles.chartRefLine}>
          <Text style={[styles.chartRefLabel, { color: '#EF444480' }]}>140</Text>
          <View style={[styles.chartRefDash, { borderColor: '#EF444430' }]} />
        </View>
        <View style={styles.chartRefLine}>
          <Text style={[styles.chartRefLabel, { color: '#10B98180' }]}>120</Text>
          <View style={[styles.chartRefDash, { borderColor: '#10B98130' }]} />
        </View>
        <View style={styles.chartRefLine}>
          <Text style={[styles.chartRefLabel, { color: '#3B82F680' }]}>80</Text>
          <View style={[styles.chartRefDash, { borderColor: '#3B82F630' }]} />
        </View>
      </View>

      {/* Bars */}
      <View style={styles.chart}>
        {chartData.map((d, i) => {
          if (d.systolic === 0) {
            return (
              <View key={d.date} style={styles.barCol}>
                <View style={{ height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' }}>
                  <View style={[styles.emptyBar, { backgroundColor: colors.glass }]} />
                </View>
                <Text style={[styles.barDayLabel, { color: colors.textMuted }]}>{d.label}</Text>
              </View>
            );
          }

          const cat = classifyBP(d.systolic, d.diastolic);
          const catInfo = getCategoryInfo(cat);
          const sysH = Math.max(8, (d.systolic / maxVal) * CHART_HEIGHT);
          const diaH = Math.max(8, (d.diastolic / maxVal) * CHART_HEIGHT);
          const isToday = i === chartData.length - 1;

          return (
            <View key={d.date} style={styles.barCol}>
              <View style={{ height: CHART_HEIGHT, justifyContent: 'flex-end', alignItems: 'center' }}>
                <Text style={[styles.barTopVal, { color: catInfo.color }]}>{d.systolic}</Text>
                <View style={styles.barPair}>
                  <View
                    style={[
                      styles.sysBar,
                      {
                        height: sysH,
                        backgroundColor: catInfo.color,
                        opacity: isToday ? 1 : 0.7,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.diaBar,
                      {
                        height: diaH,
                        backgroundColor: catInfo.color,
                        opacity: isToday ? 0.5 : 0.35,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barBottomVal, { color: colors.textMuted }]}>{d.diastolic}</Text>
              </View>
              <Text
                style={[
                  styles.barDayLabel,
                  {
                    color: isToday ? ACCENT : colors.textMuted,
                    fontFamily: isToday ? Fonts.bold : Fonts.medium,
                  },
                ]}
              >
                {d.label}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Legend */}
      <View style={styles.chartLegend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACCENT }]} />
          <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Systolic</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: ACCENT, opacity: 0.4 }]} />
          <Text style={[styles.legendLabel, { color: colors.textMuted }]}>Diastolic</Text>
        </View>
      </View>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function BPLogScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [entries, setEntries] = useState<BPEntry[]>([]);
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [pulse, setPulse] = useState('');
  const [notes, setNotes] = useState('');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    loadJSON<BPEntry[]>(STORAGE_KEY, []).then(setEntries);
  }, []);

  const persist = useCallback((e: BPEntry[]) => {
    setEntries(e);
    saveJSON(STORAGE_KEY, e);
  }, []);

  // ── Log a reading ─────────────────────────────────────────────────────────

  const logReading = () => {
    const sys = parseInt(systolic);
    const dia = parseInt(diastolic);
    const pul = parseInt(pulse);

    if (!sys || sys < 50 || sys > 300) {
      Alert.alert('Invalid Input', 'Systolic must be between 50 and 300 mmHg.');
      return;
    }
    if (!dia || dia < 30 || dia > 200) {
      Alert.alert('Invalid Input', 'Diastolic must be between 30 and 200 mmHg.');
      return;
    }
    if (!pul || pul < 30 || pul > 250) {
      Alert.alert('Invalid Input', 'Pulse must be between 30 and 250 bpm.');
      return;
    }
    if (dia >= sys) {
      Alert.alert('Invalid Input', 'Diastolic should be less than systolic.');
      return;
    }

    const entry: BPEntry = {
      id: uid(),
      systolic: sys,
      diastolic: dia,
      pulse: pul,
      date: todayISO(),
      time: timeNow(),
      notes: notes.trim(),
    };

    const cat = classifyBP(sys, dia);
    if (cat === 'crisis') {
      Alert.alert(
        'Hypertensive Crisis',
        'Your reading indicates a hypertensive crisis (180+/120+). Please seek immediate medical attention.',
        [{ text: 'I Understand' }],
      );
    }

    persist([entry, ...entries]);
    setSystolic('');
    setDiastolic('');
    setPulse('');
    setNotes('');
    setShowForm(false);
  };

  const deleteEntry = (id: string) => {
    Alert.alert('Delete Reading', 'Are you sure you want to delete this reading?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => persist(entries.filter(e => e.id !== id)) },
    ]);
  };

  // ── Derived data ──────────────────────────────────────────────────────────

  const latest = entries.length > 0 ? entries[0] : null;
  const latestCat = latest ? classifyBP(latest.systolic, latest.diastolic) : null;
  const latestCatInfo = latestCat ? getCategoryInfo(latestCat) : null;

  const stats = useMemo(() => {
    if (entries.length === 0) return null;

    const avgSys = Math.round(entries.reduce((s, e) => s + e.systolic, 0) / entries.length);
    const avgDia = Math.round(entries.reduce((s, e) => s + e.diastolic, 0) / entries.length);
    const avgPulse = Math.round(entries.reduce((s, e) => s + e.pulse, 0) / entries.length);

    // Most common category
    const catCounts: Record<string, number> = {};
    entries.forEach(e => {
      const cat = classifyBP(e.systolic, e.diastolic);
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
    const mostCommonCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0][0];

    return {
      avgSys,
      avgDia,
      avgPulse,
      total: entries.length,
      mostCommonCat,
    };
  }, [entries]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <ScreenShell title="Blood Pressure" accentColor={ACCENT}>

      {/* Latest Reading */}
      {latest && latestCatInfo && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.latestHeader}>
            <Ionicons name="heart" size={20} color={ACCENT} />
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>
              Latest Reading
            </Text>
          </View>

          <View style={styles.latestBody}>
            <View style={styles.latestValues}>
              <View style={styles.latestBPRow}>
                <Text style={[styles.latestSystolic, { color: colors.text }]}>{latest.systolic}</Text>
                <Text style={[styles.latestSlash, { color: colors.textMuted }]}>/</Text>
                <Text style={[styles.latestDiastolic, { color: colors.text }]}>{latest.diastolic}</Text>
              </View>
              <Text style={[styles.latestUnit, { color: colors.textMuted }]}>mmHg</Text>
            </View>

            <View style={styles.latestMeta}>
              {/* Category Badge */}
              <View style={[styles.categoryBadge, { backgroundColor: latestCatInfo.bgColor }]}>
                <View style={[styles.categoryDot, { backgroundColor: latestCatInfo.color }]} />
                <Text style={[styles.categoryLabel, { color: latestCatInfo.color }]}>
                  {latestCatInfo.label}
                </Text>
              </View>

              {/* Pulse */}
              <View style={styles.latestPulseRow}>
                <Ionicons name="pulse" size={14} color={ACCENT} />
                <Text style={[styles.latestPulseVal, { color: colors.text }]}>{latest.pulse}</Text>
                <Text style={[styles.latestPulseUnit, { color: colors.textMuted }]}>bpm</Text>
              </View>
            </View>
          </View>

          <View style={styles.latestFooter}>
            <Ionicons name="time-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.latestDate, { color: colors.textMuted }]}>
              {fmtDate(latest.date)} at {latest.time}
            </Text>
            {latest.notes ? (
              <>
                <Text style={[styles.latestNoteSep, { color: colors.textMuted }]}>|</Text>
                <Ionicons name="document-text-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.latestNote, { color: colors.textMuted }]} numberOfLines={1}>
                  {latest.notes}
                </Text>
              </>
            ) : null}
          </View>
        </View>
      )}

      {/* Log Reading Form / Toggle */}
      {!showForm ? (
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: ACCENT }]}
          onPress={() => setShowForm(true)}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Log Reading</Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.formHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>New Reading</Text>
            <TouchableOpacity onPress={() => setShowForm(false)}>
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* BP Inputs */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Blood Pressure (mmHg)</Text>
          <View style={styles.bpInputRow}>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={systolic}
                onChangeText={setSystolic}
                placeholder="Systolic"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={[styles.inputHint, { color: colors.textMuted }]}>Upper</Text>
            </View>
            <Text style={[styles.bpSlash, { color: colors.textMuted }]}>/</Text>
            <View style={{ flex: 1 }}>
              <TextInput
                style={[styles.numInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={diastolic}
                onChangeText={setDiastolic}
                placeholder="Diastolic"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={[styles.inputHint, { color: colors.textMuted }]}>Lower</Text>
            </View>
          </View>

          {/* Pulse Input */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Pulse (bpm)</Text>
          <TextInput
            style={[styles.numInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, marginBottom: Spacing.md }]}
            value={pulse}
            onChangeText={setPulse}
            placeholder="Heart rate"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            maxLength={3}
          />

          {/* Notes */}
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Notes (optional)</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={notes}
            onChangeText={t => setNotes(t.slice(0, 200))}
            placeholder="e.g. after exercise, before medication..."
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={200}
          />

          {/* BP Preview */}
          {systolic && diastolic && parseInt(systolic) > 0 && parseInt(diastolic) > 0 && (
            <View style={styles.previewRow}>
              {(() => {
                const cat = classifyBP(parseInt(systolic), parseInt(diastolic));
                const info = getCategoryInfo(cat);
                return (
                  <View style={[styles.previewBadge, { backgroundColor: info.bgColor }]}>
                    <View style={[styles.categoryDot, { backgroundColor: info.color }]} />
                    <Text style={[styles.previewLabel, { color: info.color }]}>{info.label}</Text>
                  </View>
                );
              })()}
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: ACCENT }]}
            onPress={logReading}
          >
            <Ionicons name="checkmark-circle" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>Log Reading</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats */}
      {stats && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: ACCENT }]}>
                {stats.avgSys}/{stats.avgDia}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg BP</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: ACCENT }]}>{stats.avgPulse}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Pulse</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statVal, { color: ACCENT }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Readings</Text>
            </View>
            <View style={styles.statItem}>
              <View style={[styles.miniCatBadge, { backgroundColor: getCategoryInfo(stats.mostCommonCat).bgColor }]}>
                <Text style={[styles.miniCatLabel, { color: getCategoryInfo(stats.mostCommonCat).color }]}>
                  {getCategoryInfo(stats.mostCommonCat).label}
                </Text>
              </View>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Most Common</Text>
            </View>
          </View>

          {/* Category guide */}
          <View style={[styles.categoryGuide, { borderTopColor: colors.border }]}>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <View key={key} style={styles.categoryGuideRow}>
                <View style={[styles.categoryGuideDot, { backgroundColor: cat.color }]} />
                <Text style={[styles.categoryGuideLabel, { color: colors.textMuted }]}>{cat.label}</Text>
                <Text style={[styles.categoryGuideRange, { color: colors.textMuted }]}>
                  {key === 'normal' && '<120/80'}
                  {key === 'elevated' && '120-129/<80'}
                  {key === 'high1' && '130-139/80-89'}
                  {key === 'high2' && '140+/90+'}
                  {key === 'crisis' && '180+/120+'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 7-Day Trend */}
      {entries.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>7-Day Trend</Text>
          <TrendChart entries={entries} colors={colors} styles={styles} />
        </View>
      )}

      {/* History */}
      {entries.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>History</Text>
          {entries.slice(0, 30).map((entry, idx) => {
            const cat = classifyBP(entry.systolic, entry.diastolic);
            const catInfo = getCategoryInfo(cat);
            return (
              <View
                key={entry.id}
                style={[
                  styles.historyRow,
                  { borderBottomColor: colors.border },
                  idx === Math.min(entries.length, 30) - 1 && { borderBottomWidth: 0 },
                ]}
              >
                {/* Color indicator */}
                <View style={[styles.historyIndicator, { backgroundColor: catInfo.color }]} />

                <View style={{ flex: 1 }}>
                  <View style={styles.historyTop}>
                    <Text style={[styles.historyBP, { color: colors.text }]}>
                      {entry.systolic}/{entry.diastolic}
                    </Text>
                    <View style={[styles.historyBadge, { backgroundColor: catInfo.bgColor }]}>
                      <Text style={[styles.historyBadgeText, { color: catInfo.color }]}>
                        {catInfo.label}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.historyBottom}>
                    <View style={styles.historyMetaItem}>
                      <Ionicons name="pulse" size={11} color={colors.textMuted} />
                      <Text style={[styles.historyMeta, { color: colors.textMuted }]}>{entry.pulse} bpm</Text>
                    </View>
                    <View style={styles.historyMetaItem}>
                      <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
                      <Text style={[styles.historyMeta, { color: colors.textMuted }]}>
                        {fmtDate(entry.date)} {entry.time}
                      </Text>
                    </View>
                  </View>
                  {entry.notes ? (
                    <Text style={[styles.historyNote, { color: colors.textMuted }]} numberOfLines={1}>
                      {entry.notes}
                    </Text>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => deleteEntry(entry.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            );
          })}
          {entries.length > 30 && (
            <Text style={[styles.moreText, { color: colors.textMuted }]}>
              Showing 30 of {entries.length} readings
            </Text>
          )}
        </View>
      )}

      {/* Empty state */}
      {entries.length === 0 && !showForm && (
        <View style={styles.emptyState}>
          <Ionicons name="heart-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No readings yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Tap "Log Reading" to record your first blood pressure measurement.
          </Text>
        </View>
      )}

    </ScreenShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Card
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

    // Latest reading
    latestHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    latestBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
    },
    latestValues: { alignItems: 'flex-start' },
    latestBPRow: { flexDirection: 'row', alignItems: 'baseline' },
    latestSystolic: { fontSize: 42, fontFamily: Fonts.bold },
    latestSlash: { fontSize: 28, fontFamily: Fonts.regular, marginHorizontal: 2 },
    latestDiastolic: { fontSize: 42, fontFamily: Fonts.bold },
    latestUnit: { fontSize: 12, fontFamily: Fonts.medium, marginTop: -4 },
    latestMeta: { alignItems: 'flex-end', gap: Spacing.sm },
    categoryBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radii.pill,
    },
    categoryDot: { width: 8, height: 8, borderRadius: 4 },
    categoryLabel: { fontSize: 13, fontFamily: Fonts.bold },
    latestPulseRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    latestPulseVal: { fontSize: 18, fontFamily: Fonts.bold },
    latestPulseUnit: { fontSize: 11, fontFamily: Fonts.medium },
    latestFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingTop: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: c.border,
    },
    latestDate: { fontSize: 11, fontFamily: Fonts.regular },
    latestNoteSep: { fontSize: 11, marginHorizontal: 4 },
    latestNote: { fontSize: 11, fontFamily: Fonts.regular, flex: 1 },

    // Add button
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 14,
      borderRadius: Radii.xl,
      marginBottom: Spacing.lg,
    },
    addBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },

    // Form
    formHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    fieldLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: Spacing.sm,
    },
    bpInputRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    numInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 20,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    inputHint: { fontSize: 10, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 4 },
    bpSlash: { fontSize: 28, fontFamily: Fonts.regular, marginTop: 8 },
    notesInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 14,
      fontFamily: Fonts.regular,
      minHeight: 60,
      textAlignVertical: 'top',
      marginBottom: Spacing.md,
    },
    previewRow: {
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    previewBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: Radii.pill,
    },
    previewLabel: { fontSize: 13, fontFamily: Fonts.bold },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: 14,
      borderRadius: Radii.xl,
    },
    submitBtnText: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },

    // Stats
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-around',
      gap: Spacing.md,
    },
    statItem: { alignItems: 'center', minWidth: 70 },
    statVal: { fontSize: 18, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    miniCatBadge: {
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
      borderRadius: Radii.pill,
    },
    miniCatLabel: { fontSize: 11, fontFamily: Fonts.bold },

    // Category guide
    categoryGuide: {
      borderTopWidth: 1,
      marginTop: Spacing.lg,
      paddingTop: Spacing.md,
    },
    categoryGuideRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: 6,
    },
    categoryGuideDot: { width: 8, height: 8, borderRadius: 4 },
    categoryGuideLabel: { fontSize: 11, fontFamily: Fonts.medium, flex: 1 },
    categoryGuideRange: { fontSize: 11, fontFamily: Fonts.regular },

    // Chart
    chart: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'flex-end',
      height: 140,
      marginBottom: Spacing.sm,
    },
    chartRefLines: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      height: 140,
      justifyContent: 'space-around',
    },
    chartRefLine: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    chartRefLabel: { fontSize: 8, fontFamily: Fonts.regular, width: 22 },
    chartRefDash: { flex: 1, borderTopWidth: 1, borderStyle: 'dashed' },
    barCol: { alignItems: 'center', flex: 1, gap: 2 },
    barPair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
    sysBar: { width: 12, borderRadius: 3 },
    diaBar: { width: 12, borderRadius: 3 },
    emptyBar: { width: 24, height: 4, borderRadius: 2 },
    barTopVal: { fontSize: 9, fontFamily: Fonts.bold },
    barBottomVal: { fontSize: 8, fontFamily: Fonts.regular },
    barDayLabel: { fontSize: 9, fontFamily: Fonts.medium },
    chartLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: Spacing.lg,
      marginTop: Spacing.sm,
    },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { fontSize: 10, fontFamily: Fonts.regular },

    // History
    historyRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
      borderBottomWidth: 0.5,
    },
    historyIndicator: {
      width: 4,
      height: 36,
      borderRadius: 2,
      marginTop: 2,
    },
    historyTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: 4,
    },
    historyBP: { fontSize: 16, fontFamily: Fonts.bold },
    historyBadge: {
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: Radii.pill,
    },
    historyBadgeText: { fontSize: 10, fontFamily: Fonts.bold },
    historyBottom: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    historyMetaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
    },
    historyMeta: { fontSize: 11, fontFamily: Fonts.regular },
    historyNote: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 4, fontStyle: 'italic' },
    moreText: { fontSize: 11, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.sm },

    // Empty state
    emptyState: {
      alignItems: 'center',
      paddingVertical: Spacing.huge,
      gap: Spacing.md,
    },
    emptyTitle: { fontSize: 18, fontFamily: Fonts.bold },
    emptyText: {
      fontSize: 14,
      fontFamily: Fonts.regular,
      textAlign: 'center',
      paddingHorizontal: Spacing.xl,
      lineHeight: 20,
    },
  });
