import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

type UnitDef = { label: string; toBase: (v: number) => number; fromBase: (v: number) => number };
type Category = { name: string; units: UnitDef[] };

const CATEGORIES: Category[] = [
  {
    name: 'Length',
    units: [
      { label: 'Meter', toBase: v => v, fromBase: v => v },
      { label: 'Kilometer', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { label: 'Centimeter', toBase: v => v / 100, fromBase: v => v * 100 },
      { label: 'Millimeter', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { label: 'Mile', toBase: v => v * 1609.34, fromBase: v => v / 1609.34 },
      { label: 'Yard', toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
      { label: 'Foot', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
      { label: 'Inch', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
    ],
  },
  {
    name: 'Weight',
    units: [
      { label: 'Kilogram', toBase: v => v, fromBase: v => v },
      { label: 'Gram', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { label: 'Milligram', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
      { label: 'Pound', toBase: v => v * 0.453592, fromBase: v => v / 0.453592 },
      { label: 'Ounce', toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 },
      { label: 'Tonne', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { label: 'Stone', toBase: v => v * 6.35029, fromBase: v => v / 6.35029 },
    ],
  },
  {
    name: 'Temperature',
    units: [
      { label: 'Celsius', toBase: v => v, fromBase: v => v },
      { label: 'Fahrenheit', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
      { label: 'Kelvin', toBase: v => v - 273.15, fromBase: v => v + 273.15 },
    ],
  },
  {
    name: 'Speed',
    units: [
      { label: 'km/h', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
      { label: 'm/s', toBase: v => v, fromBase: v => v },
      { label: 'mph', toBase: v => v * 0.44704, fromBase: v => v / 0.44704 },
      { label: 'Knot', toBase: v => v * 0.514444, fromBase: v => v / 0.514444 },
    ],
  },
  {
    name: 'Volume',
    units: [
      { label: 'Liter', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { label: 'Milliliter', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
      { label: 'Cubic m', toBase: v => v, fromBase: v => v },
      { label: 'Gallon', toBase: v => v * 0.00378541, fromBase: v => v / 0.00378541 },
      { label: 'Pint', toBase: v => v * 0.000473176, fromBase: v => v / 0.000473176 },
      { label: 'Cup', toBase: v => v * 0.000236588, fromBase: v => v / 0.000236588 },
    ],
  },
  {
    name: 'Area',
    units: [
      { label: 'sq meter', toBase: v => v, fromBase: v => v },
      { label: 'sq km', toBase: v => v * 1e6, fromBase: v => v / 1e6 },
      { label: 'Hectare', toBase: v => v * 10000, fromBase: v => v / 10000 },
      { label: 'Acre', toBase: v => v * 4046.86, fromBase: v => v / 4046.86 },
      { label: 'sq foot', toBase: v => v * 0.092903, fromBase: v => v / 0.092903 },
      { label: 'sq inch', toBase: v => v * 0.00064516, fromBase: v => v / 0.00064516 },
    ],
  },
  {
    name: 'Time',
    units: [
      { label: 'Second', toBase: v => v, fromBase: v => v },
      { label: 'Minute', toBase: v => v * 60, fromBase: v => v / 60 },
      { label: 'Hour', toBase: v => v * 3600, fromBase: v => v / 3600 },
      { label: 'Day', toBase: v => v * 86400, fromBase: v => v / 86400 },
      { label: 'Week', toBase: v => v * 604800, fromBase: v => v / 604800 },
    ],
  },
  {
    name: 'Energy',
    units: [
      { label: 'Joule', toBase: v => v, fromBase: v => v },
      { label: 'Kilojoule', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { label: 'Calorie', toBase: v => v * 4.184, fromBase: v => v / 4.184 },
      { label: 'Kilocalorie', toBase: v => v * 4184, fromBase: v => v / 4184 },
      { label: 'Watt-hour', toBase: v => v * 3600, fromBase: v => v / 3600 },
      { label: 'kWh', toBase: v => v * 3600000, fromBase: v => v / 3600000 },
    ],
  },
  {
    name: 'Data',
    units: [
      { label: 'Byte', toBase: v => v, fromBase: v => v },
      { label: 'Kilobyte', toBase: v => v * 1024, fromBase: v => v / 1024 },
      { label: 'Megabyte', toBase: v => v * 1048576, fromBase: v => v / 1048576 },
      { label: 'Gigabyte', toBase: v => v * 1073741824, fromBase: v => v / 1073741824 },
      { label: 'Terabyte', toBase: v => v * 1099511627776, fromBase: v => v / 1099511627776 },
      { label: 'Bit', toBase: v => v / 8, fromBase: v => v * 8 },
    ],
  },
];

export default function UnitConverterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [catIdx, setCatIdx] = useState(0);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [value, setValue] = useState('1');

  const cat = CATEGORIES[catIdx];

  const result = useMemo(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return '';
    const base = cat.units[fromIdx].toBase(v);
    const res = cat.units[toIdx].fromBase(base);
    return parseFloat(res.toPrecision(8)).toString();
  }, [value, catIdx, fromIdx, toIdx]);

  const swap = () => {
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  };

  const tempHint = useMemo(() => {
    if (cat.name !== 'Temperature') return '';
    const v = parseFloat(value);
    if (isNaN(v)) return '';
    const celsius = cat.units[fromIdx].toBase(v);
    const hints: [number, string][] = [[0, '❄️ Freezing'], [10, '🥶 Very cold'], [20, '🌤️ Cool'], [30, '☀️ Warm'], [40, '🌡️ Hot'], [Infinity, '🔥 Very hot']];
    return `${celsius.toFixed(2)}°C — ${(hints.find(([t]) => celsius <= t) ?? hints[hints.length - 1])[1]}`;
  }, [value, catIdx, fromIdx]);

  return (
    <ScreenShell title="Unit Converter" accentColor="#14B8A6">
      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.lg }} contentContainerStyle={{ gap: 7 }}>
        {CATEGORIES.map((c, i) => (
          <TouchableOpacity
            key={c.name}
            style={[styles.catTab, catIdx === i && { backgroundColor: '#14B8A6', borderColor: '#14B8A6' }]}
            onPress={() => { setCatIdx(i); setFromIdx(0); setToIdx(1); }}
          >
            <Text style={[styles.catTabText, { color: catIdx === i ? '#fff' : colors.textMuted }]}>{c.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Converter card */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Value input */}
        <Text style={styles.label}>Value</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={value}
          onChangeText={setValue}
          keyboardType="numeric"
          placeholder="Enter value"
          placeholderTextColor={colors.textMuted}
        />

        {/* From / To */}
        <View style={styles.convRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>From</Text>
            <ScrollView style={[styles.pickerBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]} nestedScrollEnabled>
              {cat.units.map((u, i) => (
                <TouchableOpacity
                  key={u.label}
                  style={[styles.pickerItem, fromIdx === i && { backgroundColor: '#14B8A620' }]}
                  onPress={() => setFromIdx(i)}
                >
                  <Text style={[styles.pickerItemText, { color: fromIdx === i ? '#14B8A6' : colors.text }]}>{u.label}</Text>
                  {fromIdx === i && <Ionicons name="checkmark" size={14} color="#14B8A6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <TouchableOpacity style={[styles.swapBtn, { backgroundColor: '#14B8A620' }]} onPress={swap}>
            <Ionicons name="swap-horizontal" size={22} color="#14B8A6" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.label}>To</Text>
            <ScrollView style={[styles.pickerBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]} nestedScrollEnabled>
              {cat.units.map((u, i) => (
                <TouchableOpacity
                  key={u.label}
                  style={[styles.pickerItem, toIdx === i && { backgroundColor: '#14B8A620' }]}
                  onPress={() => setToIdx(i)}
                >
                  <Text style={[styles.pickerItemText, { color: toIdx === i ? '#14B8A6' : colors.text }]}>{u.label}</Text>
                  {toIdx === i && <Ionicons name="checkmark" size={14} color="#14B8A6" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </View>

      {/* Result */}
      {result !== '' && (
        <View style={[styles.resultBox, { backgroundColor: '#14B8A615', borderColor: '#14B8A6' }]}>
          <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Result</Text>
          <Text style={[styles.resultValue, { color: '#14B8A6' }]}>
            {result} {cat.units[toIdx].label}
          </Text>
          {tempHint !== '' && <Text style={[styles.hint, { color: colors.textMuted }]}>{tempHint}</Text>}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    catTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5, borderColor: c.border, backgroundColor: c.surface },
    catTabText: { fontSize: 13, fontFamily: Fonts.medium },
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    label: { fontSize: 12, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 5 },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 16, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    convRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginTop: Spacing.xs },
    pickerBox: { borderWidth: 1.5, borderRadius: Radii.md, maxHeight: 180 },
    pickerItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: 9, borderRadius: Radii.sm },
    pickerItemText: { fontSize: 13, fontFamily: Fonts.regular },
    swapBtn: { width: 42, height: 42, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', marginTop: 22, alignSelf: 'flex-start' },
    resultBox: { borderRadius: Radii.xl, borderWidth: 1.5, padding: Spacing.xl, alignItems: 'center' },
    resultLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4 },
    resultValue: { fontSize: 28, fontFamily: Fonts.bold },
    hint: { fontSize: 13, fontFamily: Fonts.regular, marginTop: Spacing.sm },
  });
