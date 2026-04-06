import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { hexToRgb } from '@/lib/color-utils';

type AngleMode = 'deg' | 'rad';
type ButtonRole = 'digit' | 'operator' | 'function' | 'special' | 'equals';

type ButtonDef = {
  label: string;
  altLabel?: string;
  value: string;
  altValue?: string;
  role: ButtonRole;
};

type HistoryItem = {
  expression: string;
  displayExpression: string;
  result: string;
};

type EvaluationResult =
  | { ok: true; text: string; numeric: number }
  | { ok: false; text: 'Error' };

const ACCENT = '#2563EB';
const ACCENT_DEEP = '#1D4ED8';

const OPERATOR_TOKENS = ['**', '+', '-', '*', '/', '%'] as const;

const DELETE_TOKENS = [
  'pow10(',
  'asin(',
  'acos(',
  'atan(',
  'sqrt(',
  'cbrt(',
  'fact(',
  'abs(',
  'sin(',
  'cos(',
  'tan(',
  'log(',
  'ln(',
  'exp(',
  'Ans',
  'PI',
  '**3',
  '**2',
  '**',
] as const;

const BUTTON_ROWS: ButtonDef[][] = [
  [
    { label: 'Ans', value: 'Ans', role: 'special' },
    { label: '(', value: '(', role: 'special' },
    { label: ')', value: ')', role: 'special' },
    { label: 'DEL', value: 'DEL', role: 'special' },
    { label: 'AC', value: 'AC', role: 'special' },
  ],
  [
    { label: 'sin', altLabel: 'asin', value: 'sin(', altValue: 'asin(', role: 'function' },
    { label: 'cos', altLabel: 'acos', value: 'cos(', altValue: 'acos(', role: 'function' },
    { label: 'tan', altLabel: 'atan', value: 'tan(', altValue: 'atan(', role: 'function' },
    { label: 'log', altLabel: '10^x', value: 'log(', altValue: 'pow10(', role: 'function' },
    { label: 'ln', altLabel: 'e^x', value: 'ln(', altValue: 'exp(', role: 'function' },
  ],
  [
    { label: 'sqrt', altLabel: 'cbrt', value: 'sqrt(', altValue: 'cbrt(', role: 'function' },
    { label: 'x^2', altLabel: 'x^3', value: '**2', altValue: '**3', role: 'operator' },
    { label: 'x^y', value: '**', role: 'operator' },
    { label: 'n!', value: 'fact(', role: 'function' },
    { label: 'pi', value: 'PI', role: 'function' },
  ],
  [
    { label: 'e', value: 'E', role: 'function' },
    { label: '7', value: '7', role: 'digit' },
    { label: '8', value: '8', role: 'digit' },
    { label: '9', value: '9', role: 'digit' },
    { label: '÷', value: '/', role: 'operator' },
  ],
  [
    { label: 'abs', value: 'abs(', role: 'function' },
    { label: '4', value: '4', role: 'digit' },
    { label: '5', value: '5', role: 'digit' },
    { label: '6', value: '6', role: 'digit' },
    { label: '×', value: '*', role: 'operator' },
  ],
  [
    { label: '%', value: '%', role: 'operator' },
    { label: '1', value: '1', role: 'digit' },
    { label: '2', value: '2', role: 'digit' },
    { label: '3', value: '3', role: 'digit' },
    { label: '−', value: '-', role: 'operator' },
  ],
  [
    { label: '+/-', value: 'NEGATE', role: 'special' },
    { label: '0', value: '0', role: 'digit' },
    { label: '.', value: '.', role: 'digit' },
    { label: '+', value: '+', role: 'operator' },
    { label: '=', value: '=', role: 'equals' },
  ],
];

function rgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function factorial(value: number) {
  if (!Number.isFinite(value) || value < 0 || Math.floor(value) !== value) {
    return NaN;
  }
  if (value > 170) return Infinity;

  let result = 1;
  for (let index = 2; index <= value; index += 1) {
    result *= index;
  }
  return result;
}

function formatNumericResult(value: number) {
  if (!Number.isFinite(value) || Number.isNaN(value)) return 'Error';

  const normalized = Object.is(value, -0) ? 0 : value;
  const absolute = Math.abs(normalized);

  if ((absolute >= 1e12 || (absolute > 0 && absolute < 1e-9)) && absolute !== 0) {
    return normalized
      .toExponential(8)
      .replace(/\.?0+e/, 'e')
      .replace('e+', 'e');
  }

  return String(Number.parseFloat(normalized.toFixed(10)));
}

function evaluateExpression(
  expression: string,
  mode: AngleMode,
  answer: string,
): EvaluationResult {
  if (!expression.trim()) {
    return { ok: false, text: 'Error' };
  }

  if (!/^[0-9+\-*/%.(),A-Za-z]*$/.test(expression)) {
    return { ok: false, text: 'Error' };
  }

  const answerValue = Number.parseFloat(answer);
  const toRad = mode === 'deg' ? (value: number) => (value * Math.PI) / 180 : (value: number) => value;
  const fromRad = mode === 'deg' ? (value: number) => (value * 180) / Math.PI : (value: number) => value;

  const scope = {
    sin: (value: number) => Math.sin(toRad(value)),
    cos: (value: number) => Math.cos(toRad(value)),
    tan: (value: number) => Math.tan(toRad(value)),
    asin: (value: number) => fromRad(Math.asin(value)),
    acos: (value: number) => fromRad(Math.acos(value)),
    atan: (value: number) => fromRad(Math.atan(value)),
    log: Math.log10,
    ln: Math.log,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    fact: factorial,
    pow10: (value: number) => 10 ** value,
    exp: Math.exp,
    PI: Math.PI,
    E: Math.E,
    Ans: Number.isFinite(answerValue) ? answerValue : 0,
  };

  try {
    const evaluator = new Function(
      ...Object.keys(scope),
      `"use strict"; return (${expression});`,
    );
    const numeric = evaluator(...Object.values(scope)) as number;

    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) {
      return { ok: false, text: 'Error' };
    }

    return { ok: true, text: formatNumericResult(numeric), numeric };
  } catch {
    return { ok: false, text: 'Error' };
  }
}

function formatExpression(expression: string) {
  return expression
    .replace(/pow10\(/g, '10^(')
    .replace(/asin\(/g, 'asin(')
    .replace(/acos\(/g, 'acos(')
    .replace(/atan\(/g, 'atan(')
    .replace(/sqrt\(/g, 'sqrt(')
    .replace(/cbrt\(/g, 'cbrt(')
    .replace(/fact\(/g, 'fact(')
    .replace(/abs\(/g, 'abs(')
    .replace(/exp\(/g, 'e^(')
    .replace(/PI/g, 'pi')
    .replace(/\*\*3/g, '^3')
    .replace(/\*\*2/g, '^2')
    .replace(/\*\*/g, '^');
}

function tokenNeedsLeftOperand(token: string) {
  return ['**', '**2', '**3', '+', '*', '/', '%', ')'].includes(token);
}

function tokenStartsANewFactor(token: string) {
  return token.endsWith('(') || token === 'PI' || token === 'E' || token === 'Ans';
}

function trailingOperator(expression: string) {
  return [...OPERATOR_TOKENS].find((token) => expression.endsWith(token)) ?? null;
}

function removeLastToken(expression: string) {
  for (const token of DELETE_TOKENS) {
    if (expression.endsWith(token)) {
      return expression.slice(0, -token.length);
    }
  }
  return expression.slice(0, -1);
}

function currentNumberHasDecimal(expression: string) {
  let index = expression.length - 1;
  let segment = '';

  while (index >= 0) {
    const char = expression[index];
    if ((char >= '0' && char <= '9') || char === '.') {
      segment = char + segment;
      index -= 1;
      continue;
    }
    break;
  }

  return segment.includes('.');
}

function shouldInsertImplicitMultiply(expression: string, token: string) {
  if (!expression || !tokenStartsANewFactor(token)) return false;
  if (expression.endsWith('PI') || expression.endsWith('Ans') || expression.endsWith('E')) {
    return true;
  }
  const previous = expression.slice(-1);
  return /[0-9.)]/.test(previous);
}

function replaceTrailingOperator(expression: string, token: string) {
  const trailing = trailingOperator(expression);
  if (!trailing) return expression + token;
  return expression.slice(0, -trailing.length) + token;
}

function isValidAnswer(value: string) {
  return value !== 'Error' && value.trim().length > 0;
}

export default function ScientificCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [expr, setExpr] = useState('');
  const [result, setResult] = useState('0');
  const [lastAnswer, setLastAnswer] = useState('0');
  const [mode, setMode] = useState<AngleMode>('deg');
  const [is2nd, setIs2nd] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [freshResult, setFreshResult] = useState(false);

  const preview = useMemo(() => {
    if (!expr) return null;
    return evaluateExpression(expr, mode, lastAnswer);
  }, [expr, lastAnswer, mode]);

  const displayValue =
    expr && preview?.ok ? preview.text : result;
  const displayLabel =
    expr.length > 0 ? (preview?.ok ? 'Live Preview' : 'Last Result') : 'Result';
  const displayExpression = formatExpression(expr);
  const primaryDisplay = displayExpression || displayValue;

  function commitExpression() {
    if (!expr) return;

    const evaluated = evaluateExpression(expr, mode, lastAnswer);
    if (!evaluated.ok) {
      setResult('Error');
      setFreshResult(true);
      return;
    }

    const formattedExpression = formatExpression(expr);
    setResult(evaluated.text);
    setLastAnswer(evaluated.text);
    setExpr(evaluated.text);
    setFreshResult(true);
    setHistory((current) =>
      [{ expression: expr, displayExpression: formattedExpression, result: evaluated.text }, ...current].slice(0, 8),
    );
    setIs2nd(false);
  }

  function press(token: string) {
    Vibration.vibrate(10);

    if (token === 'AC') {
      setExpr('');
      setResult('0');
      setFreshResult(false);
      setIs2nd(false);
      return;
    }

    if (token === 'DEL') {
      setExpr((current) => removeLastToken(current));
      setFreshResult(false);
      return;
    }

    if (token === '=') {
      commitExpression();
      return;
    }

    if (token === 'NEGATE') {
      const base = expr && preview?.ok ? preview.text : lastAnswer;
      const numeric = Number.parseFloat(base);
      if (!Number.isFinite(numeric)) return;
      const next = formatNumericResult(numeric * -1);
      setExpr(next);
      setResult(next);
      setLastAnswer(next);
      setFreshResult(true);
      return;
    }

    let nextExpression = freshResult ? '' : expr;

    if (freshResult) {
      if (tokenNeedsLeftOperand(token) && isValidAnswer(lastAnswer)) {
        nextExpression = lastAnswer;
      }
      if (token === '.') {
        setExpr('0.');
        setFreshResult(false);
        setIs2nd(false);
        return;
      }
    }

    if (!nextExpression) {
      if (token === '-') {
        setExpr('-');
        setFreshResult(false);
        setIs2nd(false);
        return;
      }
      if (token === '.') {
        setExpr('0.');
        setFreshResult(false);
        setIs2nd(false);
        return;
      }
      if (tokenNeedsLeftOperand(token)) {
        return;
      }
    }

    if (token === '.' && currentNumberHasDecimal(nextExpression)) {
      return;
    }

    if (shouldInsertImplicitMultiply(nextExpression, token)) {
      nextExpression += '*';
    }

    if (token === '.' && /[A-Za-z)]$/.test(nextExpression)) {
      nextExpression += '*0';
    }

    if (OPERATOR_TOKENS.includes(token as (typeof OPERATOR_TOKENS)[number])) {
      nextExpression = replaceTrailingOperator(nextExpression, token);
    } else {
      nextExpression += token;
    }

    setExpr(nextExpression);
    setFreshResult(false);
    if (is2nd) setIs2nd(false);
  }

  function restoreHistory(item: HistoryItem) {
    setExpr(item.result);
    setResult(item.result);
    setLastAnswer(item.result);
    setFreshResult(true);
  }

  function buttonTone(role: ButtonRole) {
    if (role === 'equals') {
      return { bg: ACCENT, text: '#FFFFFF', border: rgba(ACCENT, 0.3) };
    }
    if (role === 'operator') {
      return { bg: rgba(ACCENT, 0.1), text: ACCENT, border: rgba(ACCENT, 0.18) };
    }
    if (role === 'special') {
      return { bg: colors.surface, text: colors.textSub, border: colors.border };
    }
    return { bg: colors.card, text: colors.text, border: colors.border };
  }

  return (
    <ScreenShell title="Scientific Calc" accentColor={ACCENT} scrollable={false}>
      <View style={styles.layout}>
        <LinearGradient
          colors={['#0F172A', '#1D4ED8', '#38BDF8']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.displayCard}
        >
          <View style={styles.topRow}>
            <TouchableOpacity
              onPress={() => setIs2nd((current) => !current)}
              style={[styles.inlineChip, is2nd ? styles.inlineChipActive : null]}
            >
              <Text style={[styles.inlineChipText, is2nd ? styles.inlineChipTextActive : null]}>
                2nd
              </Text>
            </TouchableOpacity>

            <View style={styles.modePill}>
              {(['deg', 'rad'] as AngleMode[]).map((value) => {
                const active = mode === value;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setMode(value)}
                    style={[styles.modeTab, active ? styles.modeTabActive : null]}
                  >
                    <Text style={[styles.modeTabText, active ? styles.modeTabTextActive : null]}>
                      {value.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              onPress={() => setHistory([])}
              style={[styles.inlineChip, history.length === 0 ? styles.inlineChipDisabled : null]}
              disabled={history.length === 0}
            >
              <Text
                style={[
                  styles.inlineChipText,
                  history.length === 0 ? styles.inlineChipTextDim : null,
                ]}
              >
                Clear
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.statusText}>
            {displayExpression ? 'Expression' : displayLabel}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.expressionWrap}>
            <Text style={styles.resultText} numberOfLines={1} adjustsFontSizeToFit>
              {primaryDisplay || 'Build an expression with the keypad'}
            </Text>
          </ScrollView>
          <Text style={styles.previewText} numberOfLines={1} adjustsFontSizeToFit>
            {displayExpression ? `${displayLabel}: ${displayValue}` : 'Ready'}
          </Text>

          <View style={styles.helperRow}>
            <View style={styles.helperPill}>
              <Ionicons name="flash-outline" size={14} color="#DBEAFE" />
              <Text style={styles.helperPillText}>
                {preview?.ok ? 'Preview updates live' : 'Use = to confirm a result'}
              </Text>
            </View>
            <View style={styles.helperPill}>
              <Ionicons name="time-outline" size={14} color="#DBEAFE" />
              <Text style={styles.helperPillText}>{history.length} saved</Text>
            </View>
          </View>

          {history.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.historyRow}
            >
              {history.map((item, index) => (
                <TouchableOpacity
                  key={`${item.expression}-${index}`}
                  onPress={() => restoreHistory(item)}
                  style={styles.historyChip}
                >
                  <Text style={styles.historyChipExpr} numberOfLines={1}>
                    {item.displayExpression}
                  </Text>
                  <Text style={styles.historyChipValue}>{item.result}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.emptyHistoryText}>
              Try `sin(45)` in DEG mode, `log(100)`, or `pi*2`.
            </Text>
          )}
        </LinearGradient>

        <View style={styles.grid}>
          {BUTTON_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.row}>
              {row.map((button) => {
                const tone = buttonTone(button.role);
                const label = is2nd && button.altLabel ? button.altLabel : button.label;
                const value = is2nd && button.altValue ? button.altValue : button.value;
                return (
                  <TouchableOpacity
                    key={`${button.label}-${button.value}`}
                    onPress={() => press(value)}
                    activeOpacity={0.8}
                    style={[
                      styles.button,
                      {
                        backgroundColor: tone.bg,
                        borderColor: tone.border,
                      },
                      button.role === 'equals' ? styles.equalsButton : null,
                    ]}
                  >
                    <Text
                      style={[
                        button.role === 'digit' ||
                        button.role === 'equals' ||
                        (button.role === 'operator' && label.length === 1)
                          ? styles.buttonLabelLarge
                          : styles.buttonLabelSmall,
                        { color: tone.text },
                      ]}
                    >
                      {label}
                    </Text>
                    {button.altLabel && !is2nd ? (
                      <Text style={styles.altHint}>{button.altLabel}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>
      </View>
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    layout: {
      flex: 1,
      gap: Spacing.md,
    },
    displayCard: {
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    inlineChip: {
      minWidth: 56,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radii.pill,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      backgroundColor: 'rgba(255,255,255,0.12)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    inlineChipActive: {
      backgroundColor: '#FFFFFF',
      borderColor: '#FFFFFF',
    },
    inlineChipDisabled: {
      opacity: 0.55,
    },
    inlineChipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#E0F2FE',
    },
    inlineChipTextActive: {
      color: ACCENT_DEEP,
    },
    inlineChipTextDim: {
      color: '#BFDBFE',
    },
    modePill: {
      flexDirection: 'row',
      borderRadius: Radii.pill,
      padding: 3,
      backgroundColor: 'rgba(255,255,255,0.14)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    modeTab: {
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radii.pill,
    },
    modeTabActive: {
      backgroundColor: '#FFFFFF',
    },
    modeTabText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#DBEAFE',
    },
    modeTabTextActive: {
      color: ACCENT_DEEP,
    },
    statusText: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: '#BFDBFE',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    expressionWrap: {
      maxHeight: 52,
    },
    expressionText: {
      fontSize: 15,
      lineHeight: 22,
      fontFamily: Fonts.regular,
      color: '#DBEAFE',
    },
    resultText: {
      fontSize: 40,
      lineHeight: 46,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
      letterSpacing: -1,
    },
    previewText: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.medium,
      color: '#DBEAFE',
    },
    helperRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    helperPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 7,
      borderRadius: Radii.pill,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    helperPillText: {
      fontSize: 11,
      fontFamily: Fonts.medium,
      color: '#DBEAFE',
    },
    historyRow: {
      gap: Spacing.sm,
      paddingTop: 2,
    },
    historyChip: {
      width: 132,
      borderRadius: Radii.lg,
      padding: Spacing.sm,
      backgroundColor: 'rgba(255,255,255,0.12)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      gap: 4,
    },
    historyChipExpr: {
      fontSize: 11,
      fontFamily: Fonts.regular,
      color: '#BFDBFE',
    },
    historyChipValue: {
      fontSize: 16,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    emptyHistoryText: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: Fonts.regular,
      color: '#BFDBFE',
    },
    grid: {
      flex: 1,
      gap: Spacing.sm,
    },
    row: {
      flex: 1,
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    button: {
      flex: 1,
      borderRadius: Radii.lg,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 4,
      paddingVertical: 8,
      position: 'relative',
    },
    equalsButton: {
      backgroundColor: ACCENT,
      borderColor: rgba(ACCENT, 0.28),
    },
    buttonLabelLarge: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    buttonLabelSmall: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    altHint: {
      position: 'absolute',
      right: 6,
      bottom: 4,
      fontSize: 9,
      fontFamily: Fonts.regular,
      color: colors.textMuted,
    },
  });
