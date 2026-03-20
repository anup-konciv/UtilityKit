import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Vibration,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

function factorial(n: number): number {
  n = Math.abs(Math.round(n));
  if (n > 170) return Infinity;
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

function evaluate(expr: string, mode: 'deg' | 'rad'): string {
  try {
    const toRad = mode === 'deg' ? (v: number) => (v * Math.PI) / 180 : (v: number) => v;
    const scope = {
      sin: (v: number) => Math.sin(toRad(v)),
      cos: (v: number) => Math.cos(toRad(v)),
      tan: (v: number) => Math.tan(toRad(v)),
      asin: (v: number) => Math.asin(v),
      acos: (v: number) => Math.acos(v),
      atan: (v: number) => Math.atan(v),
      log: Math.log10,
      ln: Math.log,
      sqrt: Math.sqrt,
      abs: Math.abs,
      fact: factorial,
      PI: Math.PI,
      E: Math.E,
      pow: Math.pow,
    };
    const fn = new Function(
      ...Object.keys(scope),
      '"use strict"; return (' + expr + ')'
    );
    const result = fn(...Object.values(scope)) as number;
    if (!isFinite(result)) return 'Error';
    const val = parseFloat(result.toFixed(10));
    return String(val);
  } catch {
    return 'Error';
  }
}

const FN_BUTTONS = [
  { label: 'sin', value: 'sin(' },
  { label: 'cos', value: 'cos(' },
  { label: 'tan', value: 'tan(' },
  { label: 'log', value: 'log(' },
  { label: 'ln', value: 'ln(' },
  { label: '√', value: 'sqrt(' },
  { label: 'x²', value: '**2' },
  { label: '|x|', value: 'abs(' },
  { label: 'n!', value: 'fact(' },
  { label: 'π', value: 'PI' },
  { label: 'e', value: 'E' },
  { label: '(', value: '(' },
  { label: ')', value: ')' },
  { label: '^', value: '**' },
];

const BUTTON_ROWS = [
  [{ label: 'AC', value: 'AC' }, { label: '⌫', value: 'DEL' }, { label: '%', value: '%' }, { label: '÷', value: '/' }],
  [{ label: '7', value: '7' }, { label: '8', value: '8' }, { label: '9', value: '9' }, { label: '×', value: '*' }],
  [{ label: '4', value: '4' }, { label: '5', value: '5' }, { label: '6', value: '6' }, { label: '−', value: '-' }],
  [{ label: '1', value: '1' }, { label: '2', value: '2' }, { label: '3', value: '3' }, { label: '+', value: '+' }],
  [{ label: '0', value: '0', span: 2 }, { label: '.', value: '.' }, { label: '=', value: '=' }],
];

export default function ScientificCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');
  const [mode, setMode] = useState<'deg' | 'rad'>('deg');

  const press = useCallback((val: string) => {
    Vibration.vibrate(10);
    if (val === 'AC') { setExpr(''); setResult('0'); return; }
    if (val === 'DEL') { setExpr((e) => e.slice(0, -1)); return; }
    if (val === '=') {
      if (!expr) return;
      const r = evaluate(expr, mode);
      setResult(r);
      if (r !== 'Error') setExpr(r);
      return;
    }
    setExpr((e) => e + val);
    setResult('');
  }, [expr, mode]);

  const btnColor = (val: string) => {
    if (val === '=') return { bg: colors.accent, text: '#fff' };
    if (val === 'AC') return { bg: colors.errorLight, text: colors.error };
    if (['+', '-', '*', '/', '%'].includes(val)) return { bg: colors.accentLight, text: colors.accent };
    return { bg: colors.surface, text: colors.text };
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: '#6366F1' }]}>Scientific Calc</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Display */}
      <View style={[styles.display, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.exprText, { color: colors.textMuted }]} numberOfLines={2}>{expr || ' '}</Text>
        <Text style={[styles.resultText, { color: result === 'Error' ? colors.error : colors.accent }]} numberOfLines={1} adjustsFontSizeToFit>{result || '0'}</Text>
      </View>

      {/* DEG/RAD Toggle */}
      <View style={[styles.modeRow, { backgroundColor: colors.surface }]}>
        {(['deg', 'rad'] as const).map((m) => (
          <TouchableOpacity
            key={m}
            style={[styles.modePill, mode === m && { backgroundColor: colors.accent }]}
            onPress={() => setMode(m)}
          >
            <Text style={[styles.modePillText, { color: mode === m ? '#fff' : colors.textMuted }]}>{m.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Function row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fnRow} contentContainerStyle={{ gap: 7, paddingHorizontal: Spacing.md }}>
        {FN_BUTTONS.map((b) => (
          <TouchableOpacity
            key={b.label}
            style={[styles.fnBtn, { backgroundColor: colors.accentLight }]}
            onPress={() => press(b.value)}
          >
            <Text style={[styles.fnLabel, { color: colors.accent }]}>{b.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Main grid */}
      <View style={styles.mainGrid}>
        {BUTTON_ROWS.map((row, ri) => (
          <View key={ri} style={styles.btnRow}>
            {row.map((btn) => {
              const vc = btnColor(btn.value);
              return (
                <TouchableOpacity
                  key={btn.label}
                  style={[styles.btn, { backgroundColor: vc.bg, flex: (btn as any).span || 1 }]}
                  onPress={() => press(btn.value)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.btnLabel, { color: vc.text }]}>{btn.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
      backgroundColor: c.surface, borderBottomWidth: 1, borderBottomColor: c.border, gap: Spacing.sm,
    },
    backBtn: { width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg, borderWidth: 1, borderColor: c.border },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: Fonts.bold },
    display: { margin: Spacing.md, padding: Spacing.lg, borderRadius: Radii.xl, borderWidth: 1, minHeight: 90, justifyContent: 'flex-end' },
    exprText: { fontSize: 14, fontFamily: Fonts.regular, marginBottom: 4 },
    resultText: { fontSize: 32, fontFamily: Fonts.regular, textAlign: 'right' },
    modeRow: { flexDirection: 'row', marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: 4, borderRadius: Radii.pill, gap: 4 },
    modePill: { flex: 1, paddingVertical: 6, borderRadius: Radii.pill, alignItems: 'center' },
    modePillText: { fontSize: 12, fontFamily: Fonts.bold },
    fnRow: { maxHeight: 50, marginBottom: Spacing.sm },
    fnBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    fnLabel: { fontSize: 13, fontFamily: Fonts.semibold },
    mainGrid: { flex: 1, paddingHorizontal: Spacing.sm, paddingBottom: Spacing.sm, gap: 8 },
    btnRow: { flexDirection: 'row', flex: 1, gap: 8 },
    btn: { borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', paddingVertical: 15 },
    btnLabel: { fontSize: 18, fontFamily: Fonts.medium },
  });
