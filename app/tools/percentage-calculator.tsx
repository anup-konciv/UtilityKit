import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F97316';

type Mode = 'of' | 'is_what' | 'change' | 'discount';

const MODES: { id: Mode; label: string; desc: string }[] = [
  { id: 'of', label: '% of', desc: 'What is X% of Y?' },
  { id: 'is_what', label: 'Is what %', desc: 'X is what % of Y?' },
  { id: 'change', label: '% Change', desc: 'Change from X to Y' },
  { id: 'discount', label: 'Discount', desc: 'Price after X% off' },
];

export default function PercentageCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('of');
  const [a, setA] = useState('');
  const [b, setB] = useState('');

  const result = useMemo(() => {
    const va = parseFloat(a);
    const vb = parseFloat(b);
    if (isNaN(va) || isNaN(vb)) return null;

    switch (mode) {
      case 'of':
        return { value: (va / 100) * vb, label: `${va}% of ${vb}`, unit: '' };
      case 'is_what':
        return vb === 0
          ? null
          : { value: (va / vb) * 100, label: `${va} is this % of ${vb}`, unit: '%' };
      case 'change':
        return va === 0
          ? null
          : { value: ((vb - va) / Math.abs(va)) * 100, label: vb >= va ? 'Increase' : 'Decrease', unit: '%' };
      case 'discount': {
        const discount = (va / 100) * vb;
        const final = vb - discount;
        return { value: final, label: `Save ${discount.toFixed(2)}`, unit: '', extra: `${va}% off ${vb}` };
      }
      default:
        return null;
    }
  }, [mode, a, b]);

  const labels = useMemo(() => {
    switch (mode) {
      case 'of': return { a: 'Percentage (%)', b: 'Number' };
      case 'is_what': return { a: 'Value', b: 'Total' };
      case 'change': return { a: 'Original Value', b: 'New Value' };
      case 'discount': return { a: 'Discount (%)', b: 'Original Price' };
    }
  }, [mode]);

  return (
    <ScreenShell title="Percentage Calculator" accentColor={ACCENT}>
      {/* Mode Tabs */}
      <View style={styles.tabs}>
        {MODES.map(m => (
          <TouchableOpacity
            key={m.id}
            style={[styles.tab, mode === m.id && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => { setMode(m.id); setA(''); setB(''); }}
          >
            <Text style={[styles.tabText, { color: mode === m.id ? '#fff' : colors.textMuted }]}>{m.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Description */}
      <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
        {MODES.find(m => m.id === mode)?.desc}
      </Text>

      {/* Inputs */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.inputLabel}>{labels.a}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={a}
          onChangeText={setA}
          keyboardType="numeric"
          placeholder="Enter value"
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.dividerIcon, { backgroundColor: ACCENT + '20' }]}>
            <Ionicons name={mode === 'change' ? 'swap-vertical' : 'calculator'} size={16} color={ACCENT} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <Text style={styles.inputLabel}>{labels.b}</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={b}
          onChangeText={setB}
          keyboardType="numeric"
          placeholder="Enter value"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Result */}
      {result !== null && (
        <View style={[styles.resultCard, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '40' }]}>
          <Text style={[styles.resultLabel, { color: colors.textMuted }]}>{result.label}</Text>
          <Text style={[styles.resultValue, { color: ACCENT }]}>
            {result.value.toFixed(2)}{result.unit}
          </Text>
          {result.extra && (
            <Text style={[styles.resultExtra, { color: colors.textMuted }]}>{result.extra}</Text>
          )}
        </View>
      )}

      {/* Quick Reference */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.refTitle}>Quick Reference</Text>
        {[
          { label: '10% of 250', value: '25' },
          { label: '15% tip on 80', value: '12' },
          { label: '20% discount on 500', value: '400' },
          { label: '% change 50 → 75', value: '+50%' },
        ].map((item, i) => (
          <View key={i} style={[styles.refRow, i < 3 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
            <Text style={[styles.refLabel, { color: colors.textSub }]}>{item.label}</Text>
            <Text style={[styles.refValue, { color: ACCENT }]}>{item.value}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    tabs: { flexDirection: 'row', gap: 8, marginBottom: Spacing.md, flexWrap: 'wrap' },
    tab: {
      flex: 1,
      minWidth: 70,
      paddingVertical: 8,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      borderColor: c.border,
      alignItems: 'center',
    },
    tabText: { fontSize: 12, fontFamily: Fonts.semibold },
    modeDesc: { fontSize: 13, fontFamily: Fonts.regular, marginBottom: Spacing.lg, textAlign: 'center' },
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    inputLabel: { fontSize: 12, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 6 },
    input: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 18,
      fontFamily: Fonts.semibold,
    },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: Spacing.md },
    divider: { flex: 1, height: 1 },
    dividerIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginHorizontal: Spacing.sm },
    resultCard: {
      borderRadius: Radii.xl,
      borderWidth: 1.5,
      padding: Spacing.xl,
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    resultLabel: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 4 },
    resultValue: { fontSize: 36, fontFamily: Fonts.bold },
    resultExtra: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 4 },
    refTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    refRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 },
    refLabel: { fontSize: 13, fontFamily: Fonts.regular },
    refValue: { fontSize: 13, fontFamily: Fonts.bold },
  });
