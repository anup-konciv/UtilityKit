import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Math helpers ────────────────────────────────────────────────────────────

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
    const fromRad = mode === 'deg' ? (v: number) => (v * 180) / Math.PI : (v: number) => v;
    const scope = {
      sin: (v: number) => Math.sin(toRad(v)),
      cos: (v: number) => Math.cos(toRad(v)),
      tan: (v: number) => Math.tan(toRad(v)),
      asin: (v: number) => fromRad(Math.asin(v)),
      acos: (v: number) => fromRad(Math.acos(v)),
      atan: (v: number) => fromRad(Math.atan(v)),
      log: Math.log10,
      ln: Math.log,
      sqrt: Math.sqrt,
      cbrt: Math.cbrt,
      abs: Math.abs,
      fact: factorial,
      PI: Math.PI,
      E: Math.E,
      pow: Math.pow,
      exp: Math.exp,
      pow10: (v: number) => Math.pow(10, v),
    };
    const fn = new Function(
      ...Object.keys(scope),
      '"use strict"; return (' + expr + ')',
    );
    const result = fn(...Object.values(scope)) as number;
    if (!isFinite(result)) return 'Error';
    const val = parseFloat(result.toFixed(10));
    return String(val);
  } catch {
    return 'Error';
  }
}

// ─── Button types ────────────────────────────────────────────────────────────

type BtnType = 'num' | 'op' | 'fn' | 'fn2' | 'eq' | 'clr' | 'del' | 'mode';
type BtnDef = { label: string; label2?: string; value: string; value2?: string; type: BtnType; span?: number };

// 5-column grid: scientific functions integrated with number pad
const BUTTON_ROWS: BtnDef[][] = [
  [
    { label: '2nd', value: '2ND', type: 'mode' },
    { label: '(', value: '(', type: 'fn' },
    { label: ')', value: ')', type: 'fn' },
    { label: '%', value: '%', type: 'op' },
    { label: 'AC', value: 'AC', type: 'clr' },
  ],
  [
    { label: 'sin', label2: 'sin⁻¹', value: 'sin(', value2: 'asin(', type: 'fn2' },
    { label: 'cos', label2: 'cos⁻¹', value: 'cos(', value2: 'acos(', type: 'fn2' },
    { label: 'tan', label2: 'tan⁻¹', value: 'tan(', value2: 'atan(', type: 'fn2' },
    { label: '^', value: '**', type: 'op' },
    { label: '⌫', value: 'DEL', type: 'del' },
  ],
  [
    { label: 'ln', label2: 'eˣ', value: 'ln(', value2: 'exp(', type: 'fn2' },
    { label: 'log', label2: '10ˣ', value: 'log(', value2: 'pow10(', type: 'fn2' },
    { label: '√', label2: '³√', value: 'sqrt(', value2: 'cbrt(', type: 'fn2' },
    { label: 'x²', label2: 'x³', value: '**2', value2: '**3', type: 'fn2' },
    { label: '÷', value: '/', type: 'op' },
  ],
  [
    { label: 'π', value: 'PI', type: 'fn' },
    { label: '7', value: '7', type: 'num' },
    { label: '8', value: '8', type: 'num' },
    { label: '9', value: '9', type: 'num' },
    { label: '×', value: '*', type: 'op' },
  ],
  [
    { label: 'e', value: 'E', type: 'fn' },
    { label: '4', value: '4', type: 'num' },
    { label: '5', value: '5', type: 'num' },
    { label: '6', value: '6', type: 'num' },
    { label: '−', value: '-', type: 'op' },
  ],
  [
    { label: 'n!', value: 'fact(', type: 'fn' },
    { label: '1', value: '1', type: 'num' },
    { label: '2', value: '2', type: 'num' },
    { label: '3', value: '3', type: 'num' },
    { label: '+', value: '+', type: 'op' },
  ],
  [
    { label: '|x|', value: 'abs(', type: 'fn' },
    { label: '0', value: '0', type: 'num', span: 2 },
    { label: '.', value: '.', type: 'num' },
    { label: '=', value: '=', type: 'eq' },
  ],
];

const ACCENT = '#6366F1';

// ─── Component ───────────────────────────────────────────────────────────────

export default function ScientificCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');
  const [mode, setMode] = useState<'deg' | 'rad'>('deg');
  const [is2nd, setIs2nd] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const press = useCallback(
    (val: string) => {
      Vibration.vibrate(10);
      if (val === '2ND') {
        setIs2nd((p) => !p);
        return;
      }
      if (val === 'AC') {
        setExpr('');
        setResult('0');
        return;
      }
      if (val === 'DEL') {
        setExpr((e) => e.slice(0, -1));
        return;
      }
      if (val === '=') {
        if (!expr) return;
        const r = evaluate(expr, mode);
        setResult(r);
        if (r !== 'Error') {
          setHistory((h) => [`${expr} = ${r}`, ...h].slice(0, 10));
          setExpr(r);
        }
        return;
      }
      setExpr((e) => e + val);
      setResult('');
    },
    [expr, mode],
  );

  const btnColor = (type: BtnType) => {
    if (type === 'eq') return { bg: ACCENT, text: '#fff' };
    if (type === 'clr') return { bg: colors.errorLight, text: colors.error };
    if (type === 'del') return { bg: colors.warningLight, text: colors.warning };
    if (type === 'op') return { bg: ACCENT + '20', text: ACCENT };
    if (type === 'fn' || type === 'fn2') return { bg: colors.glass, text: colors.accent };
    if (type === 'mode') return { bg: is2nd ? ACCENT : colors.glass, text: is2nd ? '#fff' : colors.textMuted };
    return { bg: colors.surface, text: colors.text };
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: ACCENT }]}>Scientific Calc</Text>
        {/* DEG/RAD toggle in header */}
        <TouchableOpacity
          style={[styles.modeToggle, { backgroundColor: colors.glass, borderColor: colors.border }]}
          onPress={() => setMode((m) => (m === 'deg' ? 'rad' : 'deg'))}
        >
          <Text style={[styles.modeToggleText, { color: ACCENT }]}>{mode.toUpperCase()}</Text>
        </TouchableOpacity>
      </View>

      {/* Display */}
      <View style={[styles.display, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {/* History preview */}
        {history.length > 0 && (
          <Text style={[styles.historyText, { color: colors.textMuted }]} numberOfLines={1}>
            {history[0]}
          </Text>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exprScroll}>
          <Text style={[styles.exprText, { color: colors.textMuted }]}>{expr || ' '}</Text>
        </ScrollView>
        <Text
          style={[styles.resultText, { color: result === 'Error' ? colors.error : ACCENT }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {result || '0'}
        </Text>
      </View>

      {/* Button Grid — 5 columns */}
      <View style={styles.grid}>
        {BUTTON_ROWS.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((btn) => {
              const vc = btnColor(btn.type);
              const label = is2nd && btn.label2 ? btn.label2 : btn.label;
              const value = is2nd && btn.value2 ? btn.value2 : btn.value;
              return (
                <TouchableOpacity
                  key={btn.label}
                  style={[
                    styles.btn,
                    { backgroundColor: vc.bg, flex: btn.span || 1 },
                    btn.type === 'eq' && styles.btnEq,
                  ]}
                  onPress={() => press(value)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      btn.type === 'num' || btn.type === 'eq' ? styles.btnLabelLg : styles.btnLabelSm,
                      { color: vc.text },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {label}
                  </Text>
                  {btn.label2 && !is2nd && (
                    <Text style={[styles.btn2ndHint, { color: ACCENT + '60' }]}>{btn.label2}</Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      backgroundColor: c.surface,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
      gap: Spacing.sm,
    },
    backBtn: {
      width: 36,
      height: 36,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.bg,
      borderWidth: 1,
      borderColor: c.border,
    },
    title: {
      flex: 1,
      textAlign: 'center',
      fontSize: 17,
      fontFamily: Fonts.bold,
    },
    modeToggle: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    modeToggleText: {
      fontSize: 12,
      fontFamily: Fonts.bold,
      letterSpacing: 1,
    },

    // Display
    display: {
      marginHorizontal: Spacing.md,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
      padding: Spacing.md,
      paddingBottom: Spacing.lg,
      borderRadius: Radii.xl,
      borderWidth: 1,
      minHeight: 100,
      justifyContent: 'flex-end',
    },
    historyText: {
      fontSize: 11,
      fontFamily: Fonts.regular,
      textAlign: 'right',
      marginBottom: 2,
      opacity: 0.6,
    },
    exprScroll: {
      maxHeight: 24,
      marginBottom: 4,
    },
    exprText: {
      fontSize: 15,
      fontFamily: Fonts.regular,
      textAlign: 'right',
    },
    resultText: {
      fontSize: 36,
      fontFamily: Fonts.bold,
      textAlign: 'right',
      letterSpacing: -1,
    },

    // Grid
    grid: {
      flex: 1,
      paddingHorizontal: Spacing.xs,
      paddingBottom: Spacing.xs,
      gap: 6,
    },
    row: {
      flexDirection: 'row',
      flex: 1,
      gap: 6,
    },
    btn: {
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 2,
      paddingHorizontal: 2,
      position: 'relative',
    },
    btnEq: {},
    btnLabelLg: {
      fontSize: 20,
      fontFamily: Fonts.medium,
    },
    btnLabelSm: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    btn2ndHint: {
      position: 'absolute',
      bottom: 2,
      right: 4,
      fontSize: 8,
      fontFamily: Fonts.regular,
    },
  });
