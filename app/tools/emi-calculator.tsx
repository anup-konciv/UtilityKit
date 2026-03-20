import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

export default function EMICalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [principal, setPrincipal] = useState('500000');
  const [rate, setRate] = useState('8.5');
  const [tenure, setTenure] = useState('60');

  const result = useMemo(() => {
    const P = parseFloat(principal), yr = parseFloat(rate), n = parseInt(tenure);
    if (!P || !yr || !n || P <= 0 || yr <= 0 || n <= 0) return null;
    const r = yr / 12 / 100;
    const EMI = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
    const total = EMI * n;
    const interest = total - P;
    const principalPct = (P / total) * 100;

    const rows: { month: number; emi: number; principal: number; interest: number; balance: number }[] = [];
    let bal = P;
    for (let i = 1; i <= n; i++) {
      const ic = bal * r, pc = EMI - ic;
      bal = Math.max(0, bal - pc);
      rows.push({ month: i, emi: EMI, principal: pc, interest: ic, balance: bal });
    }
    return { EMI, total, interest, principalPct, rows };
  }, [principal, rate, tenure]);

  return (
    <ScreenShell title="EMI Calculator" accentColor="#10B981">
      {/* Inputs */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: 'Loan Amount (₹)', value: principal, set: setPrincipal, placeholder: '500000' },
          { label: 'Annual Interest Rate (%)', value: rate, set: setRate, placeholder: '8.5' },
          { label: 'Tenure (Months)', value: tenure, set: setTenure, placeholder: '60' },
        ].map((f) => (
          <View key={f.label} style={styles.field}>
            <Text style={styles.label}>{f.label}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={f.value}
              onChangeText={f.set}
              keyboardType="numeric"
              placeholder={f.placeholder}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        ))}
      </View>

      {/* Result */}
      {result && (
        <>
          <View style={[styles.resultBanner, { backgroundColor: '#10B981' }]}>
            <Text style={styles.emiLabel}>Monthly EMI</Text>
            <Text style={styles.emiValue}>₹{fmt(result.EMI)}</Text>
            <View style={styles.emiRow}>
              {[
                { label: 'Principal', val: `₹${fmt(parseFloat(principal))}` },
                { label: 'Interest', val: `₹${fmt(result.interest)}` },
                { label: 'Total', val: `₹${fmt(result.total)}` },
              ].map((item) => (
                <View key={item.label} style={styles.emiItem}>
                  <Text style={styles.emiItemVal}>{item.val}</Text>
                  <Text style={styles.emiItemLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Bar visualization */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.sectionTitle}>Principal vs Interest</Text>
            <View style={styles.barTrack}>
              <View style={[styles.barFill, { width: `${result.principalPct}%`, backgroundColor: '#10B981' }]} />
              <View style={[styles.barFill, { width: `${100 - result.principalPct}%`, backgroundColor: '#F59E0B' }]} />
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text style={[styles.barLegend, { color: '#10B981' }]}>● Principal {result.principalPct.toFixed(1)}%</Text>
              <Text style={[styles.barLegend, { color: '#F59E0B' }]}>● Interest {(100 - result.principalPct).toFixed(1)}%</Text>
            </View>
          </View>

          {/* Amortization Table */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.sectionTitle}>Amortization Schedule</Text>
            <View style={[styles.tableHead, { backgroundColor: colors.bg }]}>
              {['#', 'EMI', 'Principal', 'Interest', 'Balance'].map((h) => (
                <Text key={h} style={[styles.th, { color: colors.textMuted }]}>{h}</Text>
              ))}
            </View>
            <ScrollView style={{ maxHeight: 220 }}>
              {result.rows.map((r) => (
                <View key={r.month} style={[styles.tableRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.td, { color: colors.textMuted }]}>{r.month}</Text>
                  <Text style={[styles.td, { color: colors.text }]}>₹{fmt(r.emi)}</Text>
                  <Text style={[styles.td, { color: '#10B981' }]}>₹{fmt(r.principal)}</Text>
                  <Text style={[styles.td, { color: '#F59E0B' }]}>₹{fmt(r.interest)}</Text>
                  <Text style={[styles.td, { color: colors.text }]}>₹{fmt(r.balance)}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    field: { marginBottom: Spacing.md },
    label: { fontSize: 13, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 5 },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular },
    resultBanner: { borderRadius: Radii.xl, padding: Spacing.xl, marginBottom: Spacing.lg, alignItems: 'center' },
    emiLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontFamily: Fonts.medium },
    emiValue: { fontSize: 38, fontFamily: Fonts.bold, color: '#fff', marginTop: 4, marginBottom: Spacing.md },
    emiRow: { flexDirection: 'row', gap: Spacing.sm, justifyContent: 'center' },
    emiItem: { backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: Radii.md, padding: Spacing.md, alignItems: 'center', minWidth: 90 },
    emiItemVal: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    emiItemLabel: { fontSize: 10, color: 'rgba(255,255,255,0.75)', marginTop: 2, fontFamily: Fonts.regular },
    sectionTitle: { fontSize: 13, fontFamily: Fonts.semibold, color: c.textMuted, marginBottom: Spacing.sm },
    barTrack: { flexDirection: 'row', height: 10, borderRadius: Radii.pill, overflow: 'hidden', backgroundColor: c.border },
    barFill: { height: '100%' },
    barLegend: { fontSize: 12, fontFamily: Fonts.medium },
    tableHead: { flexDirection: 'row', padding: Spacing.sm, borderRadius: Radii.sm, marginBottom: 4 },
    th: { flex: 1, fontSize: 10, fontFamily: Fonts.bold, textAlign: 'right' },
    tableRow: { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: Spacing.sm, borderBottomWidth: 1 },
    td: { flex: 1, fontSize: 11, fontFamily: Fonts.regular, textAlign: 'right' },
  });
