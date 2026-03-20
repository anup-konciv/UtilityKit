import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

function parseDate(dd: string, mm: string, yyyy: string): Date | null {
  const d = parseInt(dd), m = parseInt(mm), y = parseInt(yyyy);
  if (!d || !m || !y || m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return null;
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

export default function AgeCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const today = new Date();
  const [dobD, setDobD] = useState('15');
  const [dobM, setDobM] = useState('06');
  const [dobY, setDobY] = useState(String(today.getFullYear() - 25));

  const [asofD, setAsofD] = useState(String(today.getDate()).padStart(2, '0'));
  const [asofM, setAsofM] = useState(String(today.getMonth() + 1).padStart(2, '0'));
  const [asofY, setAsofY] = useState(String(today.getFullYear()));

  const result = useMemo(() => {
    const dob = parseDate(dobD, dobM, dobY);
    const asof = parseDate(asofD, asofM, asofY);
    if (!dob || !asof || dob >= asof) return null;

    let years = asof.getFullYear() - dob.getFullYear();
    let months = asof.getMonth() - dob.getMonth();
    let days = asof.getDate() - dob.getDate();

    if (days < 0) {
      months--;
      const prevMonth = new Date(asof.getFullYear(), asof.getMonth(), 0);
      days += prevMonth.getDate();
    }
    if (months < 0) { years--; months += 12; }

    const totalDays = Math.floor((asof.getTime() - dob.getTime()) / 86400000);
    const totalWeeks = Math.floor(totalDays / 7);
    const totalMonths = years * 12 + months;

    let nextBD = new Date(asof.getFullYear(), dob.getMonth(), dob.getDate());
    if (nextBD <= asof) nextBD = new Date(asof.getFullYear() + 1, dob.getMonth(), dob.getDate());
    const daysToNextBD = Math.ceil((nextBD.getTime() - asof.getTime()) / 86400000);
    const nextBDStr = nextBD.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    return { years, months, days, totalDays, totalWeeks, totalMonths, daysToNextBD, nextBDStr };
  }, [dobD, dobM, dobY, asofD, asofM, asofY]);

  const DateInput = useCallback(({ label, d, m, y, setD, setM, setY }: {
    label: string; d: string; m: string; y: string;
    setD: (v: string) => void; setM: (v: string) => void; setY: (v: string) => void;
  }) => (
    <View style={styles.dateField}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.dateRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.subLabel}>Day</Text>
          <TextInput style={[styles.dateInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={d} onChangeText={setD} keyboardType="numeric" maxLength={2} placeholder="DD" placeholderTextColor={colors.textMuted} textAlign="center" />
        </View>
        <Text style={[styles.slash, { color: colors.textMuted }]}>/</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.subLabel}>Month</Text>
          <TextInput style={[styles.dateInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={m} onChangeText={setM} keyboardType="numeric" maxLength={2} placeholder="MM" placeholderTextColor={colors.textMuted} textAlign="center" />
        </View>
        <Text style={[styles.slash, { color: colors.textMuted }]}>/</Text>
        <View style={{ flex: 2 }}>
          <Text style={styles.subLabel}>Year</Text>
          <TextInput style={[styles.dateInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={y} onChangeText={setY} keyboardType="numeric" maxLength={4} placeholder="YYYY" placeholderTextColor={colors.textMuted} textAlign="center" />
        </View>
      </View>
    </View>
  ), [colors, styles]);

  return (
    <ScreenShell title="Age Calculator" accentColor="#84CC16">
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <DateInput label="Date of Birth" d={dobD} m={dobM} y={dobY} setD={setDobD} setM={setDobM} setY={setDobY} />
        <DateInput label="As of Date" d={asofD} m={asofM} y={asofY} setD={setAsofD} setM={setAsofM} setY={setAsofY} />
      </View>

      {result ? (
        <>
          {/* Primary age */}
          <View style={styles.ageGrid}>
            {[
              { val: result.years, lbl: 'Years' },
              { val: result.months, lbl: 'Months' },
              { val: result.days, lbl: 'Days' },
            ].map((item) => (
              <View key={item.lbl} style={[styles.ageBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.ageVal, { color: '#84CC16' }]}>{item.val}</Text>
                <Text style={[styles.ageLbl, { color: colors.textMuted }]}>{item.lbl}</Text>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.ageGrid}>
            {[
              { val: result.totalMonths, lbl: 'Total Months' },
              { val: result.totalWeeks, lbl: 'Total Weeks' },
              { val: result.totalDays, lbl: 'Total Days' },
            ].map((item) => (
              <View key={item.lbl} style={[styles.ageBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.ageValSm, { color: '#84CC16' }]}>{item.val.toLocaleString()}</Text>
                <Text style={[styles.ageLbl, { color: colors.textMuted }]}>{item.lbl}</Text>
              </View>
            ))}
          </View>

          {/* Birthday countdown */}
          <View style={[styles.bdayCard, { backgroundColor: '#f0fdf4', borderColor: '#86efac' }]}>
            <Text style={{ fontSize: 24, marginBottom: 4 }}>🎂</Text>
            <Text style={{ fontSize: 14, fontFamily: Fonts.semibold, color: '#15803d' }}>
              Next birthday in <Text style={{ fontFamily: Fonts.bold, fontSize: 20 }}>{result.daysToNextBD}</Text> day{result.daysToNextBD !== 1 ? 's' : ''}
            </Text>
            <Text style={{ fontSize: 12, color: '#166534', marginTop: 3, fontFamily: Fonts.regular }}>{result.nextBDStr}</Text>
          </View>
        </>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 13, color: colors.textMuted, fontFamily: Fonts.regular, textAlign: 'center' }}>
            Enter a valid date of birth to calculate age.
          </Text>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    dateField: { marginBottom: Spacing.md },
    label: { fontSize: 13, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 6 },
    subLabel: { fontSize: 10, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 3, textAlign: 'center' },
    dateRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    dateInput: { borderWidth: 1.5, borderRadius: Radii.md, paddingVertical: 10, fontSize: 16, fontFamily: Fonts.bold },
    slash: { fontSize: 20, fontFamily: Fonts.bold, paddingBottom: 6 },
    ageGrid: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
    ageBox: { flex: 1, borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
    ageVal: { fontSize: 34, fontFamily: Fonts.bold },
    ageValSm: { fontSize: 20, fontFamily: Fonts.bold },
    ageLbl: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
    bdayCard: { borderRadius: Radii.xl, borderWidth: 1.5, padding: Spacing.xl, alignItems: 'center', marginTop: Spacing.sm },
    emptyCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.xl, alignItems: 'center' },
  });
