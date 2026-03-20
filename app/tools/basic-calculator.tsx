import { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

type BtnVariant = 'num' | 'op' | 'eq' | 'clr' | 'fn';

type BtnDef = { label: string; value: string; variant: BtnVariant; span?: number };

const BUTTON_ROWS: BtnDef[][] = [
  [
    { label: 'AC', value: 'AC', variant: 'clr' },
    { label: '±', value: '±', variant: 'fn' },
    { label: '%', value: '%', variant: 'fn' },
    { label: '÷', value: '/', variant: 'op' },
  ],
  [
    { label: '7', value: '7', variant: 'num' },
    { label: '8', value: '8', variant: 'num' },
    { label: '9', value: '9', variant: 'num' },
    { label: '×', value: '*', variant: 'op' },
  ],
  [
    { label: '4', value: '4', variant: 'num' },
    { label: '5', value: '5', variant: 'num' },
    { label: '6', value: '6', variant: 'num' },
    { label: '−', value: '-', variant: 'op' },
  ],
  [
    { label: '1', value: '1', variant: 'num' },
    { label: '2', value: '2', variant: 'num' },
    { label: '3', value: '3', variant: 'num' },
    { label: '+', value: '+', variant: 'op' },
  ],
  [
    { label: '0', value: '0', variant: 'num', span: 2 },
    { label: '.', value: '.', variant: 'num' },
    { label: '=', value: '=', variant: 'eq' },
  ],
];

function safeEval(expr: string): string {
  try {
    const clean = expr.replace(/[^0-9+\-*/.() ]/g, '');
    const result = Function('"use strict"; return (' + clean + ')')() as number;
    if (!isFinite(result)) return 'Error';
    return String(parseFloat(result.toFixed(10)));
  } catch {
    return 'Error';
  }
}

export default function BasicCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [display, setDisplay] = useState('0');
  const [expr, setExpr] = useState('');
  const [fresh, setFresh] = useState(true);

  const press = useCallback((val: string) => {
    Vibration.vibrate(10);

    if (val === 'AC') {
      setDisplay('0'); setExpr(''); setFresh(true); return;
    }
    if (val === '=') {
      if (!expr && display === '0') return;
      const full = expr + display;
      const result = safeEval(full);
      setExpr(full + ' =');
      setDisplay(result);
      setFresh(true);
      return;
    }
    if (['+', '-', '*', '/'].includes(val)) {
      if (display === 'Error') { setDisplay('0'); setExpr(''); setFresh(true); return; }
      setExpr((expr.endsWith('=') ? display : expr + display) + ' ' + val + ' ');
      setFresh(true);
      return;
    }
    if (val === '±') { setDisplay(String(parseFloat(display) * -1)); return; }
    if (val === '%') { setDisplay(String(parseFloat(display) / 100)); return; }
    if (val === '.') {
      if (fresh) { setDisplay('0.'); setFresh(false); return; }
      if (!display.includes('.')) setDisplay(display + '.');
      return;
    }
    // digit
    if (fresh || display === '0') {
      setDisplay(val);
      setFresh(false);
      if (expr.endsWith('=')) setExpr('');
    } else {
      if (display.length < 15) setDisplay(display + val);
    }
  }, [display, expr, fresh]);

  const variantColor = (v: BtnVariant) => {
    if (v === 'eq') return { bg: colors.accent, text: '#fff' };
    if (v === 'op') return { bg: colors.accentLight, text: colors.accent };
    if (v === 'clr') return { bg: colors.errorLight, text: colors.error };
    if (v === 'fn') return { bg: colors.glass, text: colors.textSub };
    return { bg: colors.surface, text: colors.text };
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: '#3B82F6' }]}>Calculator</Text>
        <View style={{ width: 38 }} />
      </View>

      {/* Display */}
      <View style={[styles.display, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.exprText, { color: colors.textMuted }]} numberOfLines={1}>{expr || ' '}</Text>
        <Text
          style={[styles.displayText, { color: colors.text, fontSize: display.length > 12 ? 30 : 44 }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {display}
        </Text>
      </View>

      {/* Buttons */}
      <View style={styles.grid}>
        {BUTTON_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.row}>
            {row.map((btn) => {
              const vc = variantColor(btn.variant);
              return (
                <TouchableOpacity
                  key={btn.label}
                  style={[
                    styles.btn,
                    { backgroundColor: vc.bg, flex: btn.span ?? 1 },
                    btn.variant === 'eq' && styles.btnEq,
                  ]}
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

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    root: { flex: 1 },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.sm,
    },
    backBtn: {
      width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    },
    title: { flex: 1, textAlign: 'center', fontSize: 18, fontFamily: Fonts.bold },
    display: {
      margin: Spacing.lg,
      padding: Spacing.xl,
      borderRadius: Radii.xl,
      borderWidth: 1,
      alignItems: 'flex-end',
      minHeight: 110,
      justifyContent: 'flex-end',
    },
    exprText: { fontSize: 14, fontFamily: Fonts.regular, marginBottom: 4 },
    displayText: { fontFamily: Fonts.regular, letterSpacing: -1 },
    grid: { flex: 1, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: 10 },
    row: { flexDirection: 'row', flex: 1, gap: 10 },
    btn: {
      flex: 1,
      margin: 5,
      borderRadius: Radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 18,
      flexDirection: 'row',
    },
    btnEq: { backgroundColor: '#3B82F6' },
    btnLabel: { fontSize: 22, fontFamily: Fonts.medium },
  });
