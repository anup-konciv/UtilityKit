import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { haptics } from '@/lib/haptics';

type ViewMode = 'modern' | 'simple';
const VIEW_PREF_KEY = 'uk_unit_converter_view';

const ACCENT = '#14B8A6';

// ── Unit data ────────────────────────────────────────────────────────────────
type UnitDef = { label: string; short: string; toBase: (v: number) => number; fromBase: (v: number) => number };
type Category = { name: string; icon: keyof typeof Ionicons.glyphMap; units: UnitDef[] };

const CATEGORIES: Category[] = [
  {
    name: 'Length', icon: 'resize-outline',
    units: [
      { label: 'Meter', short: 'm', toBase: v => v, fromBase: v => v },
      { label: 'Kilometer', short: 'km', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { label: 'Centimeter', short: 'cm', toBase: v => v / 100, fromBase: v => v * 100 },
      { label: 'Millimeter', short: 'mm', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { label: 'Mile', short: 'mi', toBase: v => v * 1609.34, fromBase: v => v / 1609.34 },
      { label: 'Yard', short: 'yd', toBase: v => v * 0.9144, fromBase: v => v / 0.9144 },
      { label: 'Foot', short: 'ft', toBase: v => v * 0.3048, fromBase: v => v / 0.3048 },
      { label: 'Inch', short: 'in', toBase: v => v * 0.0254, fromBase: v => v / 0.0254 },
    ],
  },
  {
    name: 'Weight', icon: 'scale-outline',
    units: [
      { label: 'Kilogram', short: 'kg', toBase: v => v, fromBase: v => v },
      { label: 'Gram', short: 'g', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { label: 'Milligram', short: 'mg', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
      { label: 'Pound', short: 'lb', toBase: v => v * 0.453592, fromBase: v => v / 0.453592 },
      { label: 'Ounce', short: 'oz', toBase: v => v * 0.0283495, fromBase: v => v / 0.0283495 },
      { label: 'Tonne', short: 't', toBase: v => v * 1000, fromBase: v => v / 1000 },
    ],
  },
  {
    name: 'Temp', icon: 'thermometer-outline',
    units: [
      { label: 'Celsius', short: '°C', toBase: v => v, fromBase: v => v },
      { label: 'Fahrenheit', short: '°F', toBase: v => (v - 32) * 5 / 9, fromBase: v => v * 9 / 5 + 32 },
      { label: 'Kelvin', short: 'K', toBase: v => v - 273.15, fromBase: v => v + 273.15 },
    ],
  },
  {
    name: 'Speed', icon: 'speedometer-outline',
    units: [
      { label: 'km/h', short: 'km/h', toBase: v => v / 3.6, fromBase: v => v * 3.6 },
      { label: 'm/s', short: 'm/s', toBase: v => v, fromBase: v => v },
      { label: 'mph', short: 'mph', toBase: v => v * 0.44704, fromBase: v => v / 0.44704 },
      { label: 'Knot', short: 'kn', toBase: v => v * 0.514444, fromBase: v => v / 0.514444 },
    ],
  },
  {
    name: 'Volume', icon: 'beaker-outline',
    units: [
      { label: 'Liter', short: 'L', toBase: v => v / 1000, fromBase: v => v * 1000 },
      { label: 'Milliliter', short: 'mL', toBase: v => v / 1e6, fromBase: v => v * 1e6 },
      { label: 'Cubic m', short: 'm³', toBase: v => v, fromBase: v => v },
      { label: 'Gallon', short: 'gal', toBase: v => v * 0.00378541, fromBase: v => v / 0.00378541 },
      { label: 'Cup', short: 'cup', toBase: v => v * 0.000236588, fromBase: v => v / 0.000236588 },
    ],
  },
  {
    name: 'Area', icon: 'grid-outline',
    units: [
      { label: 'sq meter', short: 'm²', toBase: v => v, fromBase: v => v },
      { label: 'sq km', short: 'km²', toBase: v => v * 1e6, fromBase: v => v / 1e6 },
      { label: 'Hectare', short: 'ha', toBase: v => v * 10000, fromBase: v => v / 10000 },
      { label: 'Acre', short: 'ac', toBase: v => v * 4046.86, fromBase: v => v / 4046.86 },
      { label: 'sq foot', short: 'ft²', toBase: v => v * 0.092903, fromBase: v => v / 0.092903 },
    ],
  },
  {
    name: 'Time', icon: 'time-outline',
    units: [
      { label: 'Second', short: 's', toBase: v => v, fromBase: v => v },
      { label: 'Minute', short: 'min', toBase: v => v * 60, fromBase: v => v / 60 },
      { label: 'Hour', short: 'hr', toBase: v => v * 3600, fromBase: v => v / 3600 },
      { label: 'Day', short: 'd', toBase: v => v * 86400, fromBase: v => v / 86400 },
      { label: 'Week', short: 'wk', toBase: v => v * 604800, fromBase: v => v / 604800 },
    ],
  },
  {
    name: 'Data', icon: 'server-outline',
    units: [
      { label: 'Byte', short: 'B', toBase: v => v, fromBase: v => v },
      { label: 'Kilobyte', short: 'KB', toBase: v => v * 1024, fromBase: v => v / 1024 },
      { label: 'Megabyte', short: 'MB', toBase: v => v * 1048576, fromBase: v => v / 1048576 },
      { label: 'Gigabyte', short: 'GB', toBase: v => v * 1073741824, fromBase: v => v / 1073741824 },
      { label: 'Terabyte', short: 'TB', toBase: v => v * 1099511627776, fromBase: v => v / 1099511627776 },
    ],
  },
  {
    name: 'Energy', icon: 'flash-outline',
    units: [
      { label: 'Joule', short: 'J', toBase: v => v, fromBase: v => v },
      { label: 'Kilojoule', short: 'kJ', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { label: 'Calorie', short: 'cal', toBase: v => v * 4.184, fromBase: v => v / 4.184 },
      { label: 'Kilocalorie', short: 'kcal', toBase: v => v * 4184, fromBase: v => v / 4184 },
      { label: 'kWh', short: 'kWh', toBase: v => v * 3600000, fromBase: v => v / 3600000 },
    ],
  },
  {
    name: 'Pressure', icon: 'fitness-outline',
    units: [
      { label: 'Pascal', short: 'Pa', toBase: v => v, fromBase: v => v },
      { label: 'kPa', short: 'kPa', toBase: v => v * 1000, fromBase: v => v / 1000 },
      { label: 'Bar', short: 'bar', toBase: v => v * 100000, fromBase: v => v / 100000 },
      { label: 'Atm', short: 'atm', toBase: v => v * 101325, fromBase: v => v / 101325 },
      { label: 'PSI', short: 'psi', toBase: v => v * 6894.76, fromBase: v => v / 6894.76 },
    ],
  },
];

function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  const s = parseFloat(n.toPrecision(8));
  if (Math.abs(s) >= 1e9 || (Math.abs(s) < 0.0001 && s !== 0)) return s.toExponential(3);
  return s.toLocaleString('en', { maximumFractionDigits: 6 });
}

export default function UnitConverterScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [catIdx, setCatIdx] = useState(0);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [value, setValue] = useState('1');
  const [viewMode, setViewMode] = useState<ViewMode>('modern');

  useEffect(() => {
    loadJSON<'metric' | 'imperial'>(KEYS.defaultUnits, 'metric').then(pref => {
      if (pref === 'imperial' && catIdx === 0) { setFromIdx(6); setToIdx(0); }
    });
    loadJSON<ViewMode>(VIEW_PREF_KEY, 'modern').then(setViewMode);
  }, []);

  const toggleView = useCallback(() => {
    const next: ViewMode = viewMode === 'modern' ? 'simple' : 'modern';
    setViewMode(next);
    saveJSON(VIEW_PREF_KEY, next);
    haptics.tap();
  }, [viewMode]);

  const cat = CATEGORIES[catIdx];
  const fromUnit = cat.units[fromIdx] ?? cat.units[0];
  const toUnit = cat.units[toIdx] ?? cat.units[1];

  const result = useMemo(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return '';
    const base = fromUnit.toBase(v);
    return fmt(toUnit.fromBase(base));
  }, [value, fromUnit, toUnit]);

  // All-units grid: convert the current value to every unit in the category.
  const allConversions = useMemo(() => {
    const v = parseFloat(value);
    if (isNaN(v)) return [];
    const base = fromUnit.toBase(v);
    return cat.units.map((u, i) => ({
      label: u.label,
      short: u.short,
      value: fmt(u.fromBase(base)),
      isCurrent: i === fromIdx,
    }));
  }, [value, fromUnit, cat.units, fromIdx]);

  const swap = useCallback(() => {
    haptics.tap();
    setFromIdx(toIdx);
    setToIdx(fromIdx);
  }, [fromIdx, toIdx]);

  const selectCategory = useCallback((i: number) => {
    setCatIdx(i);
    setFromIdx(0);
    setToIdx(Math.min(1, CATEGORIES[i].units.length - 1));
  }, []);

  // Cycle through units on tap — faster than opening a picker.
  const cycleFrom = useCallback(() => {
    setFromIdx(i => (i + 1) % cat.units.length);
  }, [cat.units.length]);
  const cycleTo = useCallback(() => {
    setToIdx(i => (i + 1) % cat.units.length);
  }, [cat.units.length]);

  // ── Simple view: compact From → To with inline unit selectors ──
  const renderSimpleView = () => (
    <>
      {/* Value input */}
      <View style={[s.simpleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.simpleLabel, { color: colors.textMuted }]}>Value</Text>
        <TextInput
          style={[s.simpleInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={value}
          onChangeText={setValue}
          keyboardType="numeric"
          placeholder="Enter value"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      {/* From */}
      <View style={[s.simpleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.simpleLabel, { color: colors.textMuted }]}>From</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.unitChipRow}>
          {cat.units.map((u, i) => {
            const active = fromIdx === i;
            return (
              <TouchableOpacity
                key={u.label}
                style={[s.unitChip, {
                  backgroundColor: active ? ACCENT : colors.inputBg,
                  borderColor: active ? ACCENT : colors.border,
                }]}
                onPress={() => setFromIdx(i)}
              >
                <Text style={[s.unitChipText, { color: active ? '#fff' : colors.text }]}>{u.short}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Swap */}
      <View style={{ alignItems: 'center', marginVertical: 4 }}>
        <TouchableOpacity style={[s.swapBtn, { backgroundColor: ACCENT }]} onPress={swap} activeOpacity={0.8}>
          <Ionicons name="swap-vertical" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* To */}
      <View style={[s.simpleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.simpleLabel, { color: colors.textMuted }]}>To</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.unitChipRow}>
          {cat.units.map((u, i) => {
            const active = toIdx === i;
            return (
              <TouchableOpacity
                key={u.label}
                style={[s.unitChip, {
                  backgroundColor: active ? ACCENT : colors.inputBg,
                  borderColor: active ? ACCENT : colors.border,
                }]}
                onPress={() => setToIdx(i)}
              >
                <Text style={[s.unitChipText, { color: active ? '#fff' : colors.text }]}>{u.short}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Result */}
      <View style={[s.simpleResult, { backgroundColor: withAlpha(ACCENT, '10'), borderColor: withAlpha(ACCENT, '30') }]}>
        <Text style={[s.simpleResultLabel, { color: colors.textMuted }]}>
          {value || '0'} {fromUnit.short} =
        </Text>
        <Text style={[s.simpleResultValue, { color: ACCENT }]}>{result || '—'} {toUnit.short}</Text>
      </View>
    </>
  );

  // ── Modern view (the existing rich view) ──
  const renderModernView = () => (
    <>
      {/* Converter card */}
      <View style={[s.converterCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* FROM */}
        <View style={s.unitSection}>
          <TouchableOpacity style={[s.unitPill, { borderColor: ACCENT, backgroundColor: withAlpha(ACCENT, '10') }]} onPress={cycleFrom}>
            <Text style={[s.unitPillText, { color: ACCENT }]}>{fromUnit.label}</Text>
            <Ionicons name="chevron-down" size={14} color={ACCENT} />
          </TouchableOpacity>
          <TextInput
            style={[s.valueInput, { color: colors.text }]}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
          <Text style={[s.unitShort, { color: colors.textMuted }]}>{fromUnit.short}</Text>
        </View>

        {/* SWAP */}
        <View style={s.swapRow}>
          <View style={[s.swapLine, { backgroundColor: colors.border }]} />
          <TouchableOpacity style={[s.swapBtn, { backgroundColor: ACCENT }]} onPress={swap} activeOpacity={0.8}>
            <Ionicons name="swap-vertical" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={[s.swapLine, { backgroundColor: colors.border }]} />
        </View>

        {/* TO */}
        <View style={s.unitSection}>
          <TouchableOpacity style={[s.unitPill, { borderColor: colors.border, backgroundColor: colors.inputBg }]} onPress={cycleTo}>
            <Text style={[s.unitPillText, { color: colors.text }]}>{toUnit.label}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={async () => {
              if (result) {
                await Clipboard.setStringAsync(`${result} ${toUnit.short}`);
                haptics.success();
              }
            }}
          >
            <Text style={[s.resultText, { color: ACCENT }]} numberOfLines={1} adjustsFontSizeToFit>
              {result || '—'}
            </Text>
          </TouchableOpacity>
          <Text style={[s.unitShort, { color: colors.textMuted }]}>
            {toUnit.short}
            {result ? '  ·  tap to copy' : ''}
          </Text>
        </View>
      </View>

      {/* All conversions grid */}
      {allConversions.length > 0 && (
        <>
          <Text style={[s.sectionLabel, { color: colors.textMuted }]}>
            {value || '0'} {fromUnit.short} in all units
          </Text>
          <View style={s.convGrid}>
            {allConversions.map(c => (
              <View
                key={c.label}
                style={[
                  s.convCell,
                  {
                    backgroundColor: c.isCurrent ? withAlpha(ACCENT, '10') : colors.card,
                    borderColor: c.isCurrent ? withAlpha(ACCENT, '30') : colors.border,
                  },
                ]}
              >
                <Text style={[s.convValue, { color: c.isCurrent ? ACCENT : colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
                  {c.value}
                </Text>
                <Text style={[s.convLabel, { color: colors.textMuted }]}>{c.short}</Text>
              </View>
            ))}
          </View>
        </>
      )}
    </>
  );

  return (
    <ScreenShell
      title="Unit Converter"
      accentColor={ACCENT}
      rightAction={
        <TouchableOpacity onPress={toggleView} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons
            name={viewMode === 'modern' ? 'list-outline' : 'apps-outline'}
            size={22}
            color={ACCENT}
          />
        </TouchableOpacity>
      }
    >
      {/* Category strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.catStrip}
      >
        {CATEGORIES.map((c, i) => {
          const active = catIdx === i;
          return (
            <TouchableOpacity
              key={c.name}
              style={[s.catTab, {
                backgroundColor: active ? ACCENT : colors.card,
                borderColor: active ? ACCENT : colors.border,
              }]}
              onPress={() => selectCategory(i)}
              activeOpacity={0.7}
            >
              <Ionicons name={c.icon} size={14} color={active ? '#fff' : colors.textMuted} />
              <Text style={[s.catTabText, { color: active ? '#fff' : colors.text }]}>{c.name}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {viewMode === 'modern' ? renderModernView() : renderSimpleView()}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // Category strip
    catStrip: { gap: 7, marginBottom: Spacing.md },
    catTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    catTabText: { fontSize: 12, fontFamily: Fonts.semibold },

    // Converter card
    converterCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
    },
    unitSection: { alignItems: 'center', gap: 6 },
    unitPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1.5,
    },
    unitPillText: { fontFamily: Fonts.semibold, fontSize: 13 },
    valueInput: {
      fontSize: 36,
      fontFamily: Fonts.bold,
      textAlign: 'center',
      width: '100%',
      paddingVertical: 4,
    },
    resultText: {
      fontSize: 36,
      fontFamily: Fonts.bold,
      textAlign: 'center',
      paddingVertical: 4,
    },
    unitShort: { fontFamily: Fonts.medium, fontSize: 12 },

    // Swap
    swapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: Spacing.sm,
    },
    swapLine: { flex: 1, height: 1 },
    swapBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: Spacing.md,
    },

    // Section label
    sectionLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.sm,
    },

    // ── Simple view ──
    simpleCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    simpleLabel: {
      fontFamily: Fonts.semibold,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    simpleInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    unitChipRow: { gap: 6 },
    unitChip: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    unitChipText: { fontFamily: Fonts.semibold, fontSize: 13 },
    simpleResult: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.xl,
      alignItems: 'center',
      marginTop: Spacing.sm,
    },
    simpleResultLabel: { fontFamily: Fonts.medium, fontSize: 13, marginBottom: 4 },
    simpleResultValue: { fontFamily: Fonts.bold, fontSize: 28 },

    // All conversions grid
    convGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    convCell: {
      flexGrow: 1,
      flexBasis: '30%',
      minWidth: 90,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      alignItems: 'center',
      gap: 3,
    },
    convValue: { fontSize: 15, fontFamily: Fonts.bold },
    convLabel: { fontSize: 11, fontFamily: Fonts.medium },
  });
