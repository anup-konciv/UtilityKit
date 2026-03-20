import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const QUICK_TIPS = [5, 10, 15, 18, 20, 25];

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

export default function TipCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bill, setBill] = useState('1000');
  const [tipPct, setTipPct] = useState('15');
  const [people, setPeople] = useState('2');
  const [activeTip, setActiveTip] = useState<number | null>(15);

  const calc = useMemo(() => {
    const b = parseFloat(bill) || 0;
    const t = parseFloat(tipPct) || 0;
    const p = Math.max(1, parseInt(people) || 1);
    const tipAmt = b * t / 100;
    const total = b + tipAmt;
    return { tipAmt, total, tipPP: tipAmt / p, totalPP: total / p };
  }, [bill, tipPct, people]);

  return (
    <ScreenShell title="Tip Calculator" accentColor="#F59E0B">
      {/* Inputs */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.field}>
          <Text style={styles.label}>Bill Amount (₹)</Text>
          <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={bill} onChangeText={setBill} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textMuted} />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Tip %</Text>
          <View style={styles.quickRow}>
            {QUICK_TIPS.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.quickBtn, activeTip === p && { backgroundColor: '#F59E0B', borderColor: '#F59E0B' }]}
                onPress={() => { setTipPct(String(p)); setActiveTip(p); }}
              >
                <Text style={[styles.quickBtnText, { color: activeTip === p ? '#fff' : colors.textMuted }]}>{p}%</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, marginTop: Spacing.sm }]}
            value={tipPct}
            onChangeText={(v) => { setTipPct(v); setActiveTip(null); }}
            keyboardType="numeric"
            placeholder="Custom %"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Number of People</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity style={[styles.counterBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
              onPress={() => setPeople(String(Math.max(1, (parseInt(people) || 1) - 1)))}>
              <Text style={{ fontSize: 20, color: colors.text, fontFamily: Fonts.bold }}>−</Text>
            </TouchableOpacity>
            <Text style={[styles.counterVal, { color: colors.text }]}>{people}</Text>
            <TouchableOpacity style={[styles.counterBtn, { backgroundColor: colors.bg, borderColor: colors.border }]}
              onPress={() => setPeople(String((parseInt(people) || 1) + 1))}>
              <Text style={{ fontSize: 20, color: colors.text, fontFamily: Fonts.bold }}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Result */}
      <View style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {[
          { label: 'Bill Amount', val: `₹${fmt(parseFloat(bill) || 0)}`, big: false },
          { label: `Tip (${tipPct}%)`, val: `₹${fmt(calc.tipAmt)}`, big: false },
          { label: 'Total Bill', val: `₹${fmt(calc.total)}`, big: false },
        ].map((row) => (
          <View key={row.label} style={[styles.resultRow, { borderBottomColor: colors.border }]}>
            <Text style={[styles.rowLabel, { color: colors.textSub }]}>{row.label}</Text>
            <Text style={[styles.rowVal, { color: '#F59E0B' }]}>{row.val}</Text>
          </View>
        ))}
        <View style={[styles.resultRow, { borderBottomColor: colors.border, marginTop: Spacing.sm, paddingTop: Spacing.sm }]}>
          <Text style={[styles.rowLabel, { color: colors.text, fontFamily: Fonts.semibold }]}>Tip / Person</Text>
          <Text style={[styles.rowValBig, { color: '#F59E0B' }]}>₹{fmt(calc.tipPP)}</Text>
        </View>
        <View style={[styles.resultRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.rowLabel, { color: colors.text, fontFamily: Fonts.bold, fontSize: 16 }]}>Total / Person</Text>
          <Text style={[styles.rowValBig, { color: '#F59E0B', fontSize: 28 }]}>₹{fmt(calc.totalPP)}</Text>
        </View>
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    field: { marginBottom: Spacing.md },
    label: { fontSize: 13, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 5 },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular },
    quickRow: { flexDirection: 'row', gap: 7, flexWrap: 'wrap', marginBottom: 4 },
    quickBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: c.border },
    quickBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    counterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
    counterBtn: { width: 42, height: 42, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
    counterVal: { fontSize: 22, fontFamily: Fonts.bold, minWidth: 32, textAlign: 'center' },
    resultCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1 },
    rowLabel: { fontSize: 14, fontFamily: Fonts.regular },
    rowVal: { fontSize: 16, fontFamily: Fonts.bold },
    rowValBig: { fontSize: 22, fontFamily: Fonts.bold },
  });
