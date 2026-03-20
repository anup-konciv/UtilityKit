import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

type Unit = 'metric' | 'imperial';

const CATEGORIES = [
  { label: 'Underweight', range: '< 18.5', min: 0, max: 18.5, color: '#3B82F6', bg: '#EFF6FF' },
  { label: 'Normal', range: '18.5–24.9', min: 18.5, max: 25, color: '#10B981', bg: '#F0FDF4' },
  { label: 'Overweight', range: '25–29.9', min: 25, max: 30, color: '#F59E0B', bg: '#FFFBEB' },
  { label: 'Obese', range: '≥ 30', min: 30, max: 100, color: '#EF4444', bg: '#FEF2F2' },
];

export default function BMICalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [unit, setUnit] = useState<Unit>('metric');
  const [height, setHeight] = useState('170');
  const [weight, setWeight] = useState('70');
  const [heightFt, setHeightFt] = useState('5');
  const [heightIn, setHeightIn] = useState('7');
  const [weightLbs, setWeightLbs] = useState('154');

  const result = useMemo(() => {
    let bmi: number;
    if (unit === 'metric') {
      const h = parseFloat(height), w = parseFloat(weight);
      if (!h || !w) return null;
      bmi = w / Math.pow(h / 100, 2);
    } else {
      const totalIn = (parseInt(heightFt) || 0) * 12 + (parseInt(heightIn) || 0);
      const lbs = parseFloat(weightLbs);
      if (!totalIn || !lbs) return null;
      bmi = (lbs / Math.pow(totalIn, 2)) * 703;
    }
    const cat = CATEGORIES.find((c) => bmi >= c.min && bmi < c.max) ?? CATEGORIES[3];
    const clamp = Math.min(100, Math.max(0, ((bmi - 10) / 30) * 100));
    return { bmi, cat, pct: clamp };
  }, [unit, height, weight, heightFt, heightIn, weightLbs]);

  return (
    <ScreenShell title="BMI Calculator" accentColor="#06B6D4">
      {/* Unit Toggle */}
      <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {(['metric', 'imperial'] as Unit[]).map((u) => (
          <TouchableOpacity
            key={u}
            style={[styles.togglePill, unit === u && { backgroundColor: '#06B6D4' }]}
            onPress={() => setUnit(u)}
          >
            <Text style={[styles.toggleText, { color: unit === u ? '#fff' : colors.textMuted }]}>
              {u === 'metric' ? 'Metric (kg/cm)' : 'Imperial (lbs/in)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Inputs */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {unit === 'metric' ? (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Height (cm)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={height} onChangeText={setHeight} keyboardType="numeric" placeholder="170" placeholderTextColor={colors.textMuted} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Weight (kg)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={weight} onChangeText={setWeight} keyboardType="numeric" placeholder="70" placeholderTextColor={colors.textMuted} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.field}>
              <Text style={styles.label}>Height</Text>
              <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={heightFt} onChangeText={setHeightFt} keyboardType="numeric" placeholder="5 ft" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={heightIn} onChangeText={setHeightIn} keyboardType="numeric" placeholder="7 in" placeholderTextColor={colors.textMuted} />
                </View>
              </View>
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Weight (lbs)</Text>
              <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={weightLbs} onChangeText={setWeightLbs} keyboardType="numeric" placeholder="154" placeholderTextColor={colors.textMuted} />
            </View>
          </>
        )}
      </View>

      {/* Result */}
      {result && (
        <>
          <View style={[styles.resultCircleWrap]}>
            <View style={[styles.resultCircle, { borderColor: result.cat.color }]}>
              <Text style={[styles.bmiValue, { color: result.cat.color }]}>{result.bmi.toFixed(1)}</Text>
              <Text style={[styles.bmiUnit, { color: colors.textMuted }]}>BMI</Text>
            </View>
            <Text style={[styles.catLabel, { color: result.cat.color }]}>● {result.cat.label}</Text>
          </View>

          {/* Scale bar */}
          <View style={[styles.scaleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.scaleTitle, { color: colors.textMuted }]}>BMI Scale</Text>
            <View style={styles.scaleBar}>
              {CATEGORIES.map((cat) => (
                <View key={cat.label} style={[styles.scaleSegment, { backgroundColor: cat.color, flex: cat.label === 'Obese' ? 2 : 1 }]} />
              ))}
            </View>
            <View style={[styles.scaleIndicator, { left: `${result.pct}%` as any }]}>
              <View style={[styles.scalePointer, { backgroundColor: result.cat.color }]} />
            </View>
          </View>

          {/* Chart */}
          <View style={styles.catGrid}>
            {CATEGORIES.map((cat) => (
              <View key={cat.label} style={[styles.catBox, { backgroundColor: cat.bg, borderColor: result.cat.label === cat.label ? cat.color : 'transparent' }]}>
                <Text style={[styles.catBoxLabel, { color: cat.color }]}>{cat.label}</Text>
                <Text style={[styles.catBoxRange, { color: cat.color }]}>{cat.range}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    toggle: { flexDirection: 'row', borderRadius: Radii.pill, padding: 3, gap: 4, marginBottom: Spacing.lg, borderWidth: 1 },
    togglePill: { flex: 1, paddingVertical: 9, borderRadius: Radii.pill, alignItems: 'center' },
    toggleText: { fontSize: 13, fontFamily: Fonts.medium },
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    field: { marginBottom: Spacing.md },
    label: { fontSize: 13, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 5 },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular },
    resultCircleWrap: { alignItems: 'center', marginBottom: Spacing.lg },
    resultCircle: { width: 130, height: 130, borderRadius: 65, borderWidth: 8, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
    bmiValue: { fontSize: 36, fontFamily: Fonts.bold },
    bmiUnit: { fontSize: 12, fontFamily: Fonts.medium },
    catLabel: { fontSize: 15, fontFamily: Fonts.semibold },
    scaleCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    scaleTitle: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: Spacing.sm },
    scaleBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', gap: 2, position: 'relative' },
    scaleSegment: { height: '100%' },
    scaleIndicator: { position: 'absolute', top: -4, marginLeft: -6 },
    scalePointer: { width: 4, height: 20, borderRadius: 2 },
    catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    catBox: { flex: 1, minWidth: '45%', borderRadius: Radii.md, padding: Spacing.md, borderWidth: 2 },
    catBoxLabel: { fontSize: 13, fontFamily: Fonts.bold, marginBottom: 2 },
    catBoxRange: { fontSize: 11, fontFamily: Fonts.regular },
  });
