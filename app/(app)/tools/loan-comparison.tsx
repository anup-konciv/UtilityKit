import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#7C3AED';

type Loan = { id: number; label: string; amount: string; rate: string; years: string; color: string };

const COLORS = ['#3B82F6', '#10B981', '#F97316'];

function calcEMI(principal: number, annualRate: number, years: number) {
  if (principal <= 0 || years <= 0) return { emi: 0, totalInterest: 0, totalPayment: 0 };
  if (annualRate === 0) {
    const emi = principal / (years * 12);
    return { emi, totalInterest: 0, totalPayment: principal };
  }
  const r = annualRate / 100 / 12;
  const n = years * 12;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  const totalPayment = emi * n;
  const totalInterest = totalPayment - principal;
  return { emi, totalInterest, totalPayment };
}

function fmt(n: number) {
  if (n >= 10000000) return (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000) return (n / 100000).toFixed(2) + ' L';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function fmtFull(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function LoanComparisonScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [loans, setLoans] = useState<Loan[]>([
    { id: 1, label: 'Loan A', amount: '1000000', rate: '8.5', years: '20', color: COLORS[0] },
    { id: 2, label: 'Loan B', amount: '1000000', rate: '9.0', years: '15', color: COLORS[1] },
  ]);

  const updateLoan = (id: number, field: keyof Loan, value: string) => {
    setLoans(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const addLoan = () => {
    if (loans.length >= 3) return;
    const id = Date.now();
    setLoans(prev => [...prev, { id, label: `Loan ${String.fromCharCode(65 + prev.length)}`, amount: '', rate: '', years: '', color: COLORS[prev.length] }]);
  };

  const removeLoan = (id: number) => {
    if (loans.length <= 1) return;
    setLoans(prev => prev.filter(l => l.id !== id));
  };

  const results = useMemo(() =>
    loans.map(l => ({
      ...l,
      ...calcEMI(parseFloat(l.amount) || 0, parseFloat(l.rate) || 0, parseFloat(l.years) || 0),
    })),
    [loans],
  );

  const validResults = results.filter(r => r.emi > 0);
  const bestEMI = validResults.length > 0 ? Math.min(...validResults.map(r => r.emi)) : 0;
  const bestInterest = validResults.length > 0 ? Math.min(...validResults.map(r => r.totalInterest)) : 0;
  const bestTotal = validResults.length > 0 ? Math.min(...validResults.map(r => r.totalPayment)) : 0;

  return (
    <ScreenShell title="Loan Compare" accentColor={ACCENT}>
      {/* Loan Input Cards */}
      {loans.map((loan, idx) => (
        <View key={loan.id} style={[styles.loanCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.loanHeader}>
            <View style={[styles.loanBadge, { backgroundColor: loan.color + '20' }]}>
              <Text style={[styles.loanBadgeText, { color: loan.color }]}>{loan.label}</Text>
            </View>
            {loans.length > 1 && (
              <TouchableOpacity onPress={() => removeLoan(loan.id)}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.inputsRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={loan.amount}
                onChangeText={v => updateLoan(loan.id, 'amount', v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Rate %</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={loan.rate}
                onChangeText={v => updateLoan(loan.id, 'rate', v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fieldLabel}>Years</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={loan.years}
                onChangeText={v => updateLoan(loan.id, 'years', v)}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.textMuted}
              />
            </View>
          </View>
        </View>
      ))}

      {/* Add Loan Button */}
      {loans.length < 3 && (
        <TouchableOpacity style={[styles.addBtn, { borderColor: ACCENT }]} onPress={addLoan}>
          <Ionicons name="add" size={20} color={ACCENT} />
          <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Loan</Text>
        </TouchableOpacity>
      )}

      {/* Comparison Table */}
      {validResults.length > 0 && (
        <View style={[styles.compareCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.compareTitle}>Comparison</Text>

          {/* Header */}
          <View style={styles.tableRow}>
            <Text style={[styles.tableHeader, { color: colors.textMuted, flex: 1.2 }]}>Metric</Text>
            {validResults.map(r => (
              <Text key={r.id} style={[styles.tableHeader, { color: r.color, flex: 1 }]}>{r.label}</Text>
            ))}
          </View>

          {/* EMI */}
          <View style={[styles.tableRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cellLabel, { flex: 1.2 }]}>Monthly EMI</Text>
            {validResults.map(r => (
              <View key={r.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.cellValue, { color: r.emi === bestEMI ? '#10B981' : colors.text }]}>
                  {fmt(r.emi)}
                </Text>
                {r.emi === bestEMI && validResults.length > 1 && <Ionicons name="trophy" size={12} color="#10B981" />}
              </View>
            ))}
          </View>

          {/* Total Interest */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellLabel, { flex: 1.2 }]}>Total Interest</Text>
            {validResults.map(r => (
              <View key={r.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.cellValue, { color: r.totalInterest === bestInterest ? '#10B981' : colors.text }]}>
                  {fmt(r.totalInterest)}
                </Text>
                {r.totalInterest === bestInterest && validResults.length > 1 && <Ionicons name="trophy" size={12} color="#10B981" />}
              </View>
            ))}
          </View>

          {/* Total Payment */}
          <View style={[styles.tableRow, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cellLabel, { flex: 1.2 }]}>Total Payment</Text>
            {validResults.map(r => (
              <View key={r.id} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={[styles.cellValue, { color: r.totalPayment === bestTotal ? '#10B981' : colors.text }]}>
                  {fmt(r.totalPayment)}
                </Text>
                {r.totalPayment === bestTotal && validResults.length > 1 && <Ionicons name="trophy" size={12} color="#10B981" />}
              </View>
            ))}
          </View>

          {/* Interest % */}
          <View style={styles.tableRow}>
            <Text style={[styles.cellLabel, { flex: 1.2 }]}>Interest %</Text>
            {validResults.map(r => {
              const pct = (parseFloat(r.amount) || 0) > 0 ? (r.totalInterest / parseFloat(r.amount) * 100) : 0;
              return (
                <Text key={r.id} style={[styles.cellValue, { flex: 1, color: colors.text }]}>
                  {pct.toFixed(1)}%
                </Text>
              );
            })}
          </View>
        </View>
      )}

      {/* Detailed Breakdown */}
      {validResults.length > 0 && validResults.map(r => (
        <View key={r.id} style={[styles.detailCard, { backgroundColor: r.color + '10', borderColor: r.color + '40' }]}>
          <Text style={[styles.detailTitle, { color: r.color }]}>{r.label} Breakdown</Text>
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={[styles.detailValue, { color: colors.text }]}>{fmtFull(r.emi)}</Text>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Monthly EMI</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailValue, { color: colors.text }]}>{fmtFull(r.totalInterest)}</Text>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Total Interest</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={[styles.detailValue, { color: colors.text }]}>{fmtFull(r.totalPayment)}</Text>
              <Text style={[styles.detailLabel, { color: colors.textMuted }]}>Total Payment</Text>
            </View>
          </View>

          {/* Visual bar */}
          <View style={styles.barWrap}>
            <View style={[styles.barPrincipal, { flex: parseFloat(r.amount) || 0, backgroundColor: r.color }]} />
            <View style={[styles.barInterest, { flex: r.totalInterest || 0.01, backgroundColor: r.color + '40' }]} />
          </View>
          <View style={styles.barLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: r.color }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Principal</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: r.color + '40' }]} />
              <Text style={[styles.legendText, { color: colors.textMuted }]}>Interest</Text>
            </View>
          </View>
        </View>
      ))}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    loanCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
    loanHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    loanBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: Radii.pill },
    loanBadgeText: { fontSize: 13, fontFamily: Fonts.bold },
    inputsRow: { flexDirection: 'row', gap: Spacing.sm },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 4 },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.sm, fontSize: 15, fontFamily: Fonts.semibold, textAlign: 'center' },
    addBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
      paddingVertical: 12, borderRadius: Radii.lg, borderWidth: 1.5, borderStyle: 'dashed', marginBottom: Spacing.lg,
    },
    addBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    compareCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    compareTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: Spacing.sm, borderRadius: Radii.sm },
    tableHeader: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    cellLabel: { fontSize: 12, fontFamily: Fonts.medium, color: c.textMuted },
    cellValue: { fontSize: 13, fontFamily: Fonts.bold },
    detailCard: { borderRadius: Radii.lg, borderWidth: 1.5, padding: Spacing.lg, marginBottom: Spacing.md },
    detailTitle: { fontSize: 14, fontFamily: Fonts.bold, marginBottom: Spacing.md },
    detailGrid: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
    detailItem: { flex: 1, alignItems: 'center' },
    detailValue: { fontSize: 16, fontFamily: Fonts.bold },
    detailLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    barWrap: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginBottom: Spacing.sm },
    barPrincipal: { height: '100%' },
    barInterest: { height: '100%' },
    barLegend: { flexDirection: 'row', gap: Spacing.lg },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 11, fontFamily: Fonts.regular },
  });
