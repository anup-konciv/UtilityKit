import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import DateField from '@/components/DateField';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

const ACCENT = '#0D9488';

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDaysToDate(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

function formatDate(d: Date): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDetailedDiff(a: Date, b: Date) {
  const totalDays = Math.abs(daysBetween(a, b));
  const years = Math.floor(totalDays / 365.25);
  const months = Math.floor((totalDays % 365.25) / 30.44);
  const days = Math.round(totalDays - years * 365.25 - months * 30.44);
  const weeks = Math.floor(totalDays / 7);
  const hours = totalDays * 24;
  const minutes = hours * 60;
  return { totalDays, years, months, days, weeks, hours, minutes };
}

type Mode = 'between' | 'addsubtract';

export default function DateCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('between');

  // Between mode
  const [dateA, setDateA] = useState(todayISO());
  const [dateB, setDateB] = useState('');

  // Add/Subtract mode
  const [startDate, setStartDate] = useState(todayISO());
  const [daysInput, setDaysInput] = useState('');
  const [operation, setOperation] = useState<'add' | 'subtract'>('add');
  // Saved scenarios cover both modes — discriminator carried in payload.
  const history = useToolHistory<{
    mode: Mode;
    dateA?: string;
    dateB?: string;
    startDate?: string;
    daysInput?: string;
    operation?: 'add' | 'subtract';
  }>('date-calc', { max: 10 });

  const betweenResult = useMemo(() => {
    const a = parseDate(dateA);
    const b = parseDate(dateB);
    if (!a || !b) return null;
    return getDetailedDiff(a, b);
  }, [dateA, dateB]);

  const addSubResult = useMemo(() => {
    const d = parseDate(startDate);
    const days = parseInt(daysInput);
    if (!d || isNaN(days)) return null;
    const result = addDaysToDate(d, operation === 'add' ? days : -days);
    return { date: result, formatted: formatDate(result), iso: dateToISO(result) };
  }, [startDate, daysInput, operation]);

  return (
    <ScreenShell title="Date Calculator" accentColor={ACCENT}>
      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        {([
          { key: 'between' as Mode, label: 'Days Between', icon: 'swap-horizontal-outline' },
          { key: 'addsubtract' as Mode, label: 'Add / Subtract', icon: 'add-circle-outline' },
        ]).map(m => (
          <TouchableOpacity
            key={m.key}
            style={[styles.modeBtn, mode === m.key && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => setMode(m.key)}
          >
            <Ionicons name={m.icon as any} size={16} color={mode === m.key ? '#fff' : colors.textMuted} />
            <Text style={[styles.modeBtnText, { color: mode === m.key ? '#fff' : colors.textMuted }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'between' ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.cardLabel}>Start Date</Text>
            <DateField
              value={dateA}
              onChange={setDateA}
              accent={ACCENT}
              placeholder="Pick start date"
            />
          </View>

          <View style={{ alignItems: 'center', marginVertical: Spacing.sm }}>
            <Ionicons name="arrow-down" size={20} color={colors.textMuted} />
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.cardLabel}>End Date</Text>
            <DateField
              value={dateB}
              onChange={setDateB}
              accent={ACCENT}
              placeholder="Pick end date"
            />
          </View>

          {betweenResult && (
            <View style={[styles.resultCard, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '40' }]}>
              <Text style={[styles.resultMain, { color: ACCENT }]}>{betweenResult.totalDays} days</Text>
              <Text style={[styles.resultSub, { color: colors.text }]}>
                {betweenResult.years > 0 ? `${betweenResult.years}y ` : ''}
                {betweenResult.months > 0 ? `${betweenResult.months}m ` : ''}
                {betweenResult.days}d
              </Text>
              <View style={styles.detailGrid}>
                {[
                  { val: betweenResult.weeks.toLocaleString(), label: 'Weeks' },
                  { val: betweenResult.hours.toLocaleString(), label: 'Hours' },
                  { val: betweenResult.minutes.toLocaleString(), label: 'Minutes' },
                ].map(item => (
                  <View key={item.label} style={styles.detailItem}>
                    <Text style={[styles.detailVal, { color: colors.text }]}>{item.val}</Text>
                    <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: ACCENT + '20' }]}
                onPress={() => {
                  haptics.success();
                  history.push(
                    { mode: 'between', dateA, dateB },
                    `${dateA} → ${dateB} = ${betweenResult.totalDays}d`,
                  );
                }}
              >
                <Ionicons name="bookmark-outline" size={14} color={ACCENT} />
                <Text style={[styles.saveBtnText, { color: ACCENT }]}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      ) : (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.cardLabel}>Start Date</Text>
            <DateField
              value={startDate}
              onChange={setStartDate}
              accent={ACCENT}
              placeholder="Pick start date"
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.opRow}>
              {(['add', 'subtract'] as const).map(op => (
                <TouchableOpacity
                  key={op}
                  style={[styles.opBtn, operation === op && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                  onPress={() => setOperation(op)}
                >
                  <Ionicons name={op === 'add' ? 'add' : 'remove'} size={16} color={operation === op ? '#fff' : colors.textMuted} />
                  <Text style={[styles.opBtnText, { color: operation === op ? '#fff' : colors.textMuted }]}>
                    {op === 'add' ? 'Add' : 'Subtract'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.daysInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={daysInput}
              onChangeText={setDaysInput}
              placeholder="Number of days"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
            />
          </View>

          {/* Quick add buttons */}
          <View style={styles.quickRow}>
            {[7, 14, 30, 60, 90, 365].map(d => (
              <TouchableOpacity
                key={d}
                style={[styles.quickBtn, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]}
                onPress={() => setDaysInput(String(d))}
              >
                <Text style={[styles.quickBtnText, { color: ACCENT }]}>{d}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {addSubResult && (
            <View style={[styles.resultCard, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '40' }]}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Result</Text>
              <Text style={[styles.resultMain, { color: ACCENT }]}>{addSubResult.iso}</Text>
              <Text style={[styles.resultFormatted, { color: colors.text }]}>{addSubResult.formatted}</Text>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: ACCENT + '20' }]}
                onPress={() => {
                  haptics.success();
                  history.push(
                    { mode: 'addsubtract', startDate, daysInput, operation },
                    `${startDate} ${operation === 'add' ? '+' : '−'} ${daysInput}d → ${addSubResult.iso}`,
                  );
                }}
              >
                <Ionicons name="bookmark-outline" size={14} color={ACCENT} />
                <Text style={[styles.saveBtnText, { color: ACCENT }]}>Save</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {history.entries.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={[styles.cardLabel, { marginBottom: 0 }]}>Saved</Text>
            <TouchableOpacity onPress={() => { haptics.warning(); history.clear(); }}>
              <Text style={[{ color: ACCENT, fontFamily: Fonts.semibold, fontSize: 12 }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {history.entries.map((entry, idx) => (
            <TouchableOpacity
              key={entry.id}
              style={[
                {
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: 10,
                },
                idx < history.entries.length - 1 ? { borderBottomWidth: 0.5, borderBottomColor: colors.border } : null,
              ]}
              onPress={() => {
                haptics.tap();
                setMode(entry.value.mode);
                if (entry.value.mode === 'between') {
                  if (entry.value.dateA) setDateA(entry.value.dateA);
                  if (entry.value.dateB) setDateB(entry.value.dateB);
                } else {
                  if (entry.value.startDate) setStartDate(entry.value.startDate);
                  if (entry.value.daysInput !== undefined) setDaysInput(entry.value.daysInput);
                  if (entry.value.operation) setOperation(entry.value.operation);
                }
              }}
            >
              <Text style={[{ color: colors.text, fontFamily: Fonts.semibold, fontSize: 13, flex: 1 }]} numberOfLines={1}>
                {entry.label}
              </Text>
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: c.border },
    modeBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.sm },
    cardLabel: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
    dateInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 18, fontFamily: Fonts.bold, textAlign: 'center' },
    todayLink: { fontSize: 12, fontFamily: Fonts.semibold, textAlign: 'right', marginTop: 6 },
    opRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
    opBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8, borderRadius: Radii.md, borderWidth: 1.5, borderColor: c.border },
    opBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    daysInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 18, fontFamily: Fonts.bold, textAlign: 'center' },
    quickRow: { flexDirection: 'row', gap: 6, marginVertical: Spacing.md, flexWrap: 'wrap' },
    quickBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1 },
    quickBtnText: { fontSize: 13, fontFamily: Fonts.bold },
    resultCard: { borderRadius: Radii.xl, borderWidth: 1.5, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.md },
    resultLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4 },
    resultMain: { fontSize: 32, fontFamily: Fonts.bold },
    resultSub: { fontSize: 16, fontFamily: Fonts.medium, marginTop: 4, marginBottom: Spacing.md },
    resultFormatted: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 4 },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: Radii.pill,
      marginTop: Spacing.md,
      alignSelf: 'flex-start',
    },
    saveBtnText: { fontSize: 12, fontFamily: Fonts.bold },
    detailGrid: { flexDirection: 'row', gap: Spacing.xl, marginTop: Spacing.sm },
    detailItem: { alignItems: 'center' },
    detailVal: { fontSize: 16, fontFamily: Fonts.bold },
    detailLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
  });
