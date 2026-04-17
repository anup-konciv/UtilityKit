import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#E11D48';

const DISCOUNT_PRESETS = [5, 10, 15, 20, 25, 30, 40, 50, 60, 70];
const TAX_PRESETS = [
  { label: 'No Tax', value: 0 },
  { label: '5%', value: 5 },
  { label: '12%', value: 12 },
  { label: '18%', value: 18 },
  { label: '28%', value: 28 },
];

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function DiscountCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [price, setPrice] = useState('');
  const [discount1, setDiscount1] = useState('');
  const [discount2, setDiscount2] = useState('');
  const [tax, setTax] = useState('');
  const [showDouble, setShowDouble] = useState(false);

  // Buy X Get Y
  const [bxgyQty, setBxgyQty] = useState('');
  const [bxgyPrice, setBxgyPrice] = useState('');
  const [bxgyFree, setBxgyFree] = useState('');

  const calc = useMemo(() => {
    const p = parseFloat(price) || 0;
    const d1 = parseFloat(discount1) || 0;
    const d2 = parseFloat(discount2) || 0;
    const t = parseFloat(tax) || 0;

    const disc1Amt = p * (d1 / 100);
    const afterDisc1 = p - disc1Amt;
    const disc2Amt = showDouble ? afterDisc1 * (d2 / 100) : 0;
    const afterDisc = afterDisc1 - disc2Amt;
    const totalDisc = disc1Amt + disc2Amt;
    const taxAmt = afterDisc * (t / 100);
    const finalPrice = afterDisc + taxAmt;
    const effectiveDisc = p > 0 ? (totalDisc / p) * 100 : 0;

    return { disc1Amt, afterDisc1, disc2Amt, afterDisc, totalDisc, taxAmt, finalPrice, effectiveDisc };
  }, [price, discount1, discount2, tax, showDouble]);

  const bxgy = useMemo(() => {
    const qty = parseInt(bxgyQty) || 0;
    const pr = parseFloat(bxgyPrice) || 0;
    const free = parseInt(bxgyFree) || 0;
    if (qty <= 0 || free <= 0) return null;
    const totalItems = qty + free;
    const totalCost = qty * pr;
    const effectivePrice = totalCost / totalItems;
    const savings = free * pr;
    const savingsPct = (savings / (totalItems * pr)) * 100;
    return { totalItems, totalCost, effectivePrice, savings, savingsPct };
  }, [bxgyQty, bxgyPrice, bxgyFree]);

  const p = parseFloat(price) || 0;

  return (
    <ScreenShell title="Discount Calc" accentColor={ACCENT}>
      {/* Price input */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Original Price</Text>
        <TextInput
          style={[styles.priceInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
          value={price}
          onChangeText={setPrice}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* Discount */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.row}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Discount %</Text>
          <TouchableOpacity onPress={() => setShowDouble(!showDouble)}>
            <Text style={[styles.toggleText, { color: ACCENT }]}>{showDouble ? 'Single Discount' : '+ Double Discount'}</Text>
          </TouchableOpacity>
        </View>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
          value={discount1}
          onChangeText={setDiscount1}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.presetRow}>
          {DISCOUNT_PRESETS.map(d => (
            <TouchableOpacity
              key={d}
              style={[styles.presetChip, { backgroundColor: discount1 === String(d) ? ACCENT + '22' : colors.glass, borderColor: discount1 === String(d) ? ACCENT : colors.border }]}
              onPress={() => setDiscount1(String(d))}
            >
              <Text style={[styles.presetText, { color: discount1 === String(d) ? ACCENT : colors.textMuted }]}>{d}%</Text>
            </TouchableOpacity>
          ))}
        </View>

        {showDouble && (
          <>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: Spacing.md }]}>2nd Discount %</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={discount2}
              onChangeText={setDiscount2}
              keyboardType="decimal-pad"
              placeholder="0"
              placeholderTextColor={colors.textMuted}
            />
          </>
        )}
      </View>

      {/* Tax */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Tax / GST %</Text>
        <View style={styles.presetRow}>
          {TAX_PRESETS.map(t => (
            <TouchableOpacity
              key={t.value}
              style={[styles.presetChip, { backgroundColor: tax === String(t.value) ? ACCENT + '22' : colors.glass, borderColor: tax === String(t.value) ? ACCENT : colors.border }]}
              onPress={() => setTax(String(t.value))}
            >
              <Text style={[styles.presetText, { color: tax === String(t.value) ? ACCENT : colors.textMuted }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Results */}
      {p > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Breakdown</Text>

          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Original Price</Text>
            <Text style={[styles.resultVal, { color: colors.text }]}>{fmt(p)}</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Discount ({discount1 || 0}%{showDouble ? ` + ${discount2 || 0}%` : ''})</Text>
            <Text style={[styles.resultVal, { color: '#10B981' }]}>-{fmt(calc.totalDisc)}</Text>
          </View>
          {parseFloat(tax) > 0 && (
            <View style={styles.resultRow}>
              <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Tax ({tax}%)</Text>
              <Text style={[styles.resultVal, { color: '#F97316' }]}>+{fmt(calc.taxAmt)}</Text>
            </View>
          )}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.resultRow}>
            <Text style={[styles.finalLabel, { color: colors.text }]}>Final Price</Text>
            <Text style={[styles.finalVal, { color: ACCENT }]}>{fmt(calc.finalPrice)}</Text>
          </View>

          {/* Savings highlight */}
          <View style={[styles.savingsCard, { backgroundColor: '#10B981' + '15', borderColor: '#10B981' + '30' }]}>
            <Ionicons name="pricetag" size={18} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.savingsText, { color: '#10B981' }]}>You Save {fmt(calc.totalDisc)}</Text>
              <Text style={[styles.savingsPct, { color: colors.textMuted }]}>Effective discount: {calc.effectiveDisc.toFixed(1)}%</Text>
            </View>
          </View>

          {/* Visual comparison */}
          <Text style={[styles.label, { color: colors.textMuted, marginTop: Spacing.md }]}>Price Comparison</Text>
          <View style={styles.barContainer}>
            <View style={[styles.barFull, { backgroundColor: colors.glass }]}>
              <Text style={[styles.barLabel, { color: colors.textMuted }]}>Original: {fmt(p)}</Text>
            </View>
            <View style={[styles.barFull, { backgroundColor: ACCENT + '25', width: `${Math.max((calc.finalPrice / p) * 100, 5)}%` as any }]}>
              <Text style={[styles.barLabel, { color: ACCENT }]} numberOfLines={1}>Final: {fmt(calc.finalPrice)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Buy X Get Y */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Buy X Get Y Free</Text>
        <View style={styles.bxgyRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Buy Qty</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={bxgyQty}
              onChangeText={setBxgyQty}
              keyboardType="number-pad"
              placeholder="2"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Price Each</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={bxgyPrice}
              onChangeText={setBxgyPrice}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.smallLabel, { color: colors.textMuted }]}>Get Free</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={bxgyFree}
              onChangeText={setBxgyFree}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
        {bxgy && (
          <View style={[styles.bxgyResult, { backgroundColor: '#10B981' + '10', borderColor: '#10B981' + '25' }]}>
            <Text style={[styles.bxgyLine, { color: colors.text }]}>Total items: {bxgy.totalItems} for {fmt(bxgy.totalCost)}</Text>
            <Text style={[styles.bxgyLine, { color: '#10B981' }]}>Effective price: {fmt(bxgy.effectivePrice)} each</Text>
            <Text style={[styles.bxgyLine, { color: '#10B981' }]}>You save: {fmt(bxgy.savings)} ({bxgy.savingsPct.toFixed(0)}%)</Text>
          </View>
        )}
      </View>

      {/* Clear */}
      <TouchableOpacity
        style={[styles.clearBtn, { borderColor: colors.border }]}
        onPress={() => { setPrice(''); setDiscount1(''); setDiscount2(''); setTax(''); setBxgyQty(''); setBxgyPrice(''); setBxgyFree(''); }}
      >
        <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
        <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear All</Text>
      </TouchableOpacity>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    label: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
    smallLabel: { fontSize: 10, fontFamily: Fonts.medium, marginBottom: 4 },
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    toggleText: { fontSize: 12, fontFamily: Fonts.semibold },
    priceInput: { fontSize: 28, fontFamily: Fonts.bold, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, textAlign: 'center' },
    input: { fontSize: 16, fontFamily: Fonts.semibold, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
    presetChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    presetText: { fontSize: 12, fontFamily: Fonts.medium },
    resultRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    resultLabel: { fontSize: 13, fontFamily: Fonts.medium },
    resultVal: { fontSize: 14, fontFamily: Fonts.bold },
    divider: { height: 1, marginVertical: Spacing.sm },
    finalLabel: { fontSize: 16, fontFamily: Fonts.bold },
    finalVal: { fontSize: 24, fontFamily: Fonts.bold },
    savingsCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.md },
    savingsText: { fontSize: 15, fontFamily: Fonts.bold },
    savingsPct: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
    barContainer: { gap: Spacing.sm },
    barFull: { height: 28, borderRadius: Radii.sm, justifyContent: 'center', paddingHorizontal: Spacing.md },
    barLabel: { fontSize: 11, fontFamily: Fonts.semibold },
    bxgyRow: { flexDirection: 'row', gap: Spacing.sm },
    bxgyResult: { padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.md },
    bxgyLine: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 2 },
    clearBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1 },
    clearText: { fontSize: 13, fontFamily: Fonts.medium },
  });
