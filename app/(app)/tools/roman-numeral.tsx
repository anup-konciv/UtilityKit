import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#9333EA';

const ROMAN_MAP: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
];

const ROMAN_VALS: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function toRoman(num: number): string {
  if (num < 1 || num > 3999) return '';
  let result = '';
  let n = num;
  for (const [val, sym] of ROMAN_MAP) {
    while (n >= val) { result += sym; n -= val; }
  }
  return result;
}

function fromRoman(s: string): number | null {
  const str = s.toUpperCase().trim();
  if (!str || !/^[IVXLCDM]+$/.test(str)) return null;
  let total = 0;
  for (let i = 0; i < str.length; i++) {
    const cur = ROMAN_VALS[str[i]];
    const next = i + 1 < str.length ? ROMAN_VALS[str[i + 1]] : 0;
    if (cur < next) total -= cur;
    else total += cur;
  }
  if (total < 1 || total > 3999) return null;
  if (toRoman(total) !== str) return null;
  return total;
}

function breakdown(num: number): { value: number; roman: string }[] {
  const parts: { value: number; roman: string }[] = [];
  let n = num;
  for (const [val, sym] of ROMAN_MAP) {
    while (n >= val) { parts.push({ value: val, roman: sym }); n -= val; }
  }
  return parts;
}

const EXAMPLES = [
  { num: 1, label: '1' }, { num: 4, label: '4' }, { num: 9, label: '9' },
  { num: 14, label: '14' }, { num: 42, label: '42' }, { num: 99, label: '99' },
  { num: 100, label: '100' }, { num: 500, label: '500' }, { num: 1000, label: '1000' },
  { num: 2024, label: '2024' }, { num: 2026, label: '2026' }, { num: 3999, label: '3999' },
];

const REFERENCE = [
  { sym: 'I', val: 1 }, { sym: 'V', val: 5 }, { sym: 'X', val: 10 },
  { sym: 'L', val: 50 }, { sym: 'C', val: 100 }, { sym: 'D', val: 500 }, { sym: 'M', val: 1000 },
];

export default function RomanNumeralScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<'toRoman' | 'toNumber'>('toRoman');
  const [input, setInput] = useState('');
  const [showRef, setShowRef] = useState(false);

  const result = useMemo(() => {
    if (!input.trim()) return { output: '', error: false, parts: [] as ReturnType<typeof breakdown> };
    if (mode === 'toRoman') {
      const num = parseInt(input);
      if (isNaN(num) || num < 1 || num > 3999) return { output: '', error: true, parts: [] };
      return { output: toRoman(num), error: false, parts: breakdown(num) };
    } else {
      const num = fromRoman(input);
      if (num === null) return { output: '', error: true, parts: [] };
      return { output: String(num), error: false, parts: breakdown(num) };
    }
  }, [input, mode]);

  const swap = () => {
    if (result.output && !result.error) {
      setInput(result.output);
    } else {
      setInput('');
    }
    setMode(m => m === 'toRoman' ? 'toNumber' : 'toRoman');
  };

  return (
    <ScreenShell title="Roman Numerals" accentColor={ACCENT}>
      {/* Mode toggle */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.modeRow}>
          <View style={styles.modeLabel}>
            <Text style={[styles.modeText, { color: colors.text }]}>{mode === 'toRoman' ? 'Number' : 'Roman'}</Text>
          </View>
          <TouchableOpacity onPress={swap} style={[styles.swapBtn, { backgroundColor: ACCENT + '18' }]}>
            <Ionicons name="swap-horizontal" size={20} color={ACCENT} />
          </TouchableOpacity>
          <View style={styles.modeLabel}>
            <Text style={[styles.modeText, { color: colors.text }]}>{mode === 'toRoman' ? 'Roman' : 'Number'}</Text>
          </View>
        </View>

        <TextInput
          style={[styles.mainInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
          value={input}
          onChangeText={setInput}
          keyboardType={mode === 'toRoman' ? 'number-pad' : 'default'}
          placeholder={mode === 'toRoman' ? 'Enter a number (1-3999)' : 'Enter Roman numeral'}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
        />

        {result.error && input.trim() !== '' && (
          <Text style={[styles.errorText, { color: '#EF4444' }]}>
            {mode === 'toRoman' ? 'Enter a number between 1 and 3999' : 'Invalid Roman numeral'}
          </Text>
        )}

        {result.output !== '' && !result.error && (
          <View style={[styles.resultBox, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30' }]}>
            <Text style={[styles.resultOutput, { color: ACCENT }]}>{result.output}</Text>
          </View>
        )}
      </View>

      {/* Breakdown */}
      {result.parts.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Breakdown</Text>
          <View style={styles.breakdownRow}>
            {result.parts.map((p, i) => (
              <View key={i} style={styles.breakdownItem}>
                <Text style={[styles.breakdownRoman, { color: ACCENT }]}>{p.roman}</Text>
                <Text style={[styles.breakdownVal, { color: colors.textMuted }]}>{p.value}</Text>
                {i < result.parts.length - 1 && <Text style={[styles.breakdownPlus, { color: colors.textMuted }]}>+</Text>}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Number pad */}
      {mode === 'toRoman' && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Quick Input</Text>
          <View style={styles.numpad}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.numKey, { backgroundColor: colors.glass, borderColor: colors.border }]}
                onPress={() => setInput(prev => prev + String(n))}
              >
                <Text style={[styles.numKeyText, { color: colors.text }]}>{n}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.numKey, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '30' }]}
              onPress={() => setInput('')}
            >
              <Ionicons name="backspace-outline" size={20} color={ACCENT} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Examples */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Common Examples</Text>
        <View style={styles.exampleGrid}>
          {EXAMPLES.map(e => (
            <TouchableOpacity
              key={e.num}
              style={[styles.exampleChip, { backgroundColor: colors.glass, borderColor: colors.border }]}
              onPress={() => { setMode('toRoman'); setInput(String(e.num)); }}
            >
              <Text style={[styles.exampleNum, { color: colors.text }]}>{e.num}</Text>
              <Text style={[styles.exampleRoman, { color: ACCENT }]}>{toRoman(e.num)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Reference */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowRef(!showRef)}
      >
        <View style={styles.refHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>Reference</Text>
          <Ionicons name={showRef ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </View>
        {showRef && (
          <View style={styles.refGrid}>
            {REFERENCE.map(r => (
              <View key={r.sym} style={[styles.refItem, { backgroundColor: ACCENT + '10' }]}>
                <Text style={[styles.refSym, { color: ACCENT }]}>{r.sym}</Text>
                <Text style={[styles.refVal, { color: colors.textMuted }]}>{r.val}</Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    modeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
    modeLabel: { flex: 1, alignItems: 'center' },
    modeText: { fontSize: 14, fontFamily: Fonts.semibold },
    swapBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    mainInput: { fontSize: 22, fontFamily: Fonts.bold, padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1, textAlign: 'center' },
    errorText: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'center', marginTop: Spacing.sm },
    resultBox: { alignItems: 'center', padding: Spacing.xl, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.lg },
    resultOutput: { fontSize: 36, fontFamily: Fonts.bold, letterSpacing: 4 },
    breakdownRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 4 },
    breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    breakdownRoman: { fontSize: 18, fontFamily: Fonts.bold },
    breakdownVal: { fontSize: 10, fontFamily: Fonts.regular },
    breakdownPlus: { fontSize: 14, marginHorizontal: 4 },
    numpad: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, justifyContent: 'center' },
    numKey: { width: 52, height: 44, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    numKeyText: { fontSize: 18, fontFamily: Fonts.bold },
    exampleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    exampleChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center' },
    exampleNum: { fontSize: 13, fontFamily: Fonts.bold },
    exampleRoman: { fontSize: 11, fontFamily: Fonts.medium, marginTop: 2 },
    refHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    refGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
    refItem: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radii.md, alignItems: 'center' },
    refSym: { fontSize: 20, fontFamily: Fonts.bold },
    refVal: { fontSize: 11, fontFamily: Fonts.medium },
  });
