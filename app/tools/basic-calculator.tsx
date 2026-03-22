import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';

type BtnVariant = 'num' | 'op' | 'eq' | 'clr' | 'fn';
type BtnDef = { label: string; value: string; variant: BtnVariant; span?: number };

const ACCENT = '#3B82F6';

const BUTTON_ROWS: BtnDef[][] = [
  [
    { label: 'AC', value: 'AC', variant: 'clr' },
    { label: 'DEL', value: 'DEL', variant: 'fn' },
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

function formatExpression(expression: string) {
  return expression
    .replace(/\*/g, ' × ')
    .replace(/\//g, ' ÷ ')
    .replace(/-/g, ' − ')
    .replace(/\+/g, ' + ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeEval(expression: string) {
  try {
    const clean = expression.replace(/[^0-9+\-*/.() ]/g, '');
    const result = Function(`"use strict"; return (${clean})`)() as number;

    if (!Number.isFinite(result)) return 'Error';

    return String(Number.parseFloat(result.toFixed(10)));
  } catch {
    return 'Error';
  }
}

export default function BasicCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [display, setDisplay] = useState('0');
  const [expression, setExpression] = useState('');
  const [fresh, setFresh] = useState(true);
  const [history, setHistory] = useState<string[]>([]);

  const preview = useMemo(() => {
    if (!expression || expression.endsWith('=')) return null;
    if (display === 'Error') return null;

    const result = safeEval(`${expression}${display}`);
    return result === 'Error' ? null : result;
  }, [display, expression]);

  const press = useCallback((value: string) => {
    Vibration.vibrate(10);

    if (value === 'AC') {
      setDisplay('0');
      setExpression('');
      setFresh(true);
      return;
    }

    if (value === 'DEL') {
      if (fresh || display === 'Error') {
        setDisplay('0');
        return;
      }

      if (display.length <= 1 || (display.length === 2 && display.startsWith('-'))) {
        setDisplay('0');
        setFresh(true);
        return;
      }

      setDisplay((current) => current.slice(0, -1));
      return;
    }

    if (value === '=') {
      if (!expression && display === '0') return;

      const full = `${expression}${display}`;
      const result = safeEval(full);

      setHistory((current) => [`${formatExpression(full)} = ${result}`, ...current].slice(0, 6));
      setExpression(`${full}=`);
      setDisplay(result);
      setFresh(true);
      return;
    }

    if (['+', '-', '*', '/'].includes(value)) {
      if (display === 'Error') {
        setDisplay('0');
        setExpression('');
        setFresh(true);
        return;
      }

      if (fresh && expression && !expression.endsWith('=')) {
        setExpression((current) => `${current.slice(0, -1)}${value}`);
        return;
      }

      const base = expression.endsWith('=') ? display : `${expression}${display}`;
      setExpression(`${base}${value}`);
      setFresh(true);
      return;
    }

    if (value === '%') {
      setDisplay(String((Number.parseFloat(display) || 0) / 100));
      return;
    }

    if (value === '.') {
      if (fresh) {
        setDisplay('0.');
        setFresh(false);
        if (expression.endsWith('=')) setExpression('');
        return;
      }

      if (!display.includes('.')) {
        setDisplay((current) => `${current}.`);
      }

      return;
    }

    if (fresh || display === '0' || display === 'Error') {
      setDisplay(value);
      setFresh(false);
      if (expression.endsWith('=')) setExpression('');
      return;
    }

    setDisplay((current) => (current.length < 15 ? `${current}${value}` : current));
  }, [display, expression, fresh]);

  const variantColor = (variant: BtnVariant) => {
    if (variant === 'eq') return { background: ACCENT, text: '#FFFFFF' };
    if (variant === 'op') return { background: withAlpha(ACCENT, '16'), text: ACCENT };
    if (variant === 'clr') return { background: colors.errorLight, text: colors.error };
    if (variant === 'fn') return { background: colors.surface, text: colors.textSub };
    return { background: colors.card, text: colors.text };
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.headerButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={[styles.headerEyebrow, { color: colors.textMuted }]}>Everyday Math</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Calculator</Text>
        </View>
        <View style={[styles.historyBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.historyBadgeText, { color: ACCENT }]}>{history.length}</Text>
        </View>
      </View>

      <LinearGradient
        colors={['#0F172A', '#1D4ED8', '#60A5FA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.displayCard}
      >
        <Text style={styles.expressionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
          {expression ? formatExpression(expression.replace(/=$/, ' =')) : ' '}
        </Text>
        <Text
          style={[
            styles.displayText,
            {
              fontSize:
                display.length > 14
                  ? 48
                  : display.length > 10
                    ? 62
                    : 78,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {display}
        </Text>
        {preview ? <Text style={styles.previewText}>Preview: {preview}</Text> : null}
      </LinearGradient>

      {history.length > 0 ? (
        <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.historyHeader}>
            <Text style={[styles.historyTitle, { color: colors.textMuted }]}>Recent</Text>
            <TouchableOpacity onPress={() => setHistory([])}>
              <Text style={[styles.clearText, { color: ACCENT }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {history.map((item, index) => (
            <Text key={`${item}-${index}`} style={[styles.historyItem, { color: colors.text }]}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.grid}>
        {BUTTON_ROWS.map((row) => (
          <View key={row.map((item) => item.label).join('-')} style={styles.row}>
            {row.map((button) => {
              const palette = variantColor(button.variant);
              return (
                <TouchableOpacity
                  key={button.label}
                  style={[
                    styles.button,
                    {
                      flex: button.span ?? 1,
                      backgroundColor: palette.background,
                      borderColor: button.variant === 'eq' ? ACCENT : colors.border,
                    },
                  ]}
                  onPress={() => press(button.value)}
                  activeOpacity={0.82}
                >
                  <Text
                    style={[
                      styles.buttonLabel,
                      { color: palette.text },
                      button.variant === 'op'
                        ? styles.buttonLabelOperator
                        : button.label.length <= 2
                          ? styles.buttonLabelLarge
                          : null,
                    ]}
                  >
                    {button.label}
                  </Text>
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
    root: {
      flex: 1,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
      gap: Spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingTop: Spacing.md,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerText: {
      flex: 1,
      gap: 2,
    },
    headerEyebrow: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    headerTitle: {
      fontSize: 24,
      fontFamily: Fonts.bold,
    },
    historyBadge: {
      minWidth: 42,
      height: 42,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: Spacing.sm,
    },
    historyBadgeText: {
      fontSize: 16,
      fontFamily: Fonts.bold,
    },
    displayCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      minHeight: 250,
      justifyContent: 'flex-end',
      gap: 6,
    },
    expressionText: {
      fontSize: 22,
      lineHeight: 28,
      fontFamily: Fonts.semibold,
      color: '#E0EEFF',
      letterSpacing: -0.3,
      textAlign: 'right',
    },
    displayText: {
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
      letterSpacing: -1.4,
      lineHeight: 86,
      textAlign: 'right',
    },
    previewText: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      color: '#DBEAFE',
      textAlign: 'right',
    },
    historyCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    historyTitle: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    clearText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    historyItem: {
      fontSize: 14,
      fontFamily: Fonts.medium,
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
      borderWidth: 1,
      borderRadius: Radii.xl,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 72,
    },
    buttonLabel: {
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    buttonLabelLarge: {
      fontSize: 28,
    },
    buttonLabelOperator: {
      fontSize: 34,
      fontFamily: Fonts.bold,
      lineHeight: 36,
    },
  });
