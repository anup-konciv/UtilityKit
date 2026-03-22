import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';

const ACCENT = '#F97316';

type Mode = 'of' | 'is_what' | 'change' | 'discount';

const MODES: {
  id: Mode;
  label: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: [string, string];
}[] = [
  {
    id: 'of',
    label: '% of',
    desc: 'Find a share of any amount.',
    icon: 'pie-chart-outline',
    colors: ['#FB923C', '#FDBA74'],
  },
  {
    id: 'is_what',
    label: 'Is What %',
    desc: 'See what percent one value is of another.',
    icon: 'analytics-outline',
    colors: ['#0EA5E9', '#67E8F9'],
  },
  {
    id: 'change',
    label: '% Change',
    desc: 'Track growth or decline between two values.',
    icon: 'swap-vertical-outline',
    colors: ['#8B5CF6', '#C4B5FD'],
  },
  {
    id: 'discount',
    label: 'Discount',
    desc: 'Price after any discount rate.',
    icon: 'pricetag-outline',
    colors: ['#EC4899', '#FDA4AF'],
  },
];

export default function PercentageCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('of');
  const [a, setA] = useState('15');
  const [b, setB] = useState('240');

  const activeMode = MODES.find((item) => item.id === mode) ?? MODES[0];

  const labels = useMemo(() => {
    switch (mode) {
      case 'of':
        return { a: 'Percentage', b: 'Base Value' };
      case 'is_what':
        return { a: 'Value', b: 'Total' };
      case 'change':
        return { a: 'Starting Value', b: 'New Value' };
      case 'discount':
        return { a: 'Discount Rate', b: 'Original Price' };
      default:
        return { a: 'Value A', b: 'Value B' };
    }
  }, [mode]);

  const result = useMemo(() => {
    const va = Number.parseFloat(a);
    const vb = Number.parseFloat(b);

    if (Number.isNaN(va) || Number.isNaN(vb)) return null;

    switch (mode) {
      case 'of':
        return {
          label: `${va}% of ${vb}`,
          value: (va / 100) * vb,
          suffix: '',
          insight: `This slice represents ${va / 100} of the whole.`,
        };
      case 'is_what':
        if (vb === 0) return null;
        return {
          label: `${va} is what percent of ${vb}?`,
          value: (va / vb) * 100,
          suffix: '%',
          insight: `${va} takes up ${(va / vb * 100).toFixed(1)}% of the total.`,
        };
      case 'change': {
        if (va === 0) return null;
        const percentChange = ((vb - va) / Math.abs(va)) * 100;
        const changeAmount = vb - va;
        return {
          label: percentChange >= 0 ? 'Increase' : 'Decrease',
          value: percentChange,
          suffix: '%',
          insight: `${changeAmount >= 0 ? 'Up' : 'Down'} by ${Math.abs(changeAmount).toFixed(2)} from the starting value.`,
          extra: `Moved from ${va} to ${vb}`,
        };
      }
      case 'discount': {
        const savings = (va / 100) * vb;
        const finalPrice = vb - savings;
        return {
          label: 'Final Price',
          value: finalPrice,
          suffix: '',
          insight: `You save ${savings.toFixed(2)} on this deal.`,
          extra: `${va}% discount applied`,
        };
      }
      default:
        return null;
    }
  }, [a, b, mode]);

  const examples = useMemo(() => {
    switch (mode) {
      case 'of':
        return ['20% of 450 = 90', '7.5% of 1200 = 90', '32% of 80 = 25.6'];
      case 'is_what':
        return ['45 of 60 = 75%', '18 of 240 = 7.5%', '9 of 12 = 75%'];
      case 'change':
        return ['100 to 140 = +40%', '560 to 420 = -25%', '80 to 100 = +25%'];
      case 'discount':
        return ['15% off 999 = 849.15', '25% off 200 = 150', '40% off 750 = 450'];
      default:
        return [];
    }
  }, [mode]);

  return (
    <ScreenShell title="Percentage Calculator" accentColor={ACCENT}>
      <LinearGradient
        colors={activeMode.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Ionicons name={activeMode.icon} size={24} color="#FFFFFF" />
          </View>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroEyebrow}>Percent Studio</Text>
            <Text style={styles.heroTitle}>{activeMode.label}</Text>
          </View>
        </View>
        <Text style={styles.heroCopy}>{activeMode.desc}</Text>
      </LinearGradient>

      <View style={styles.modeGrid}>
        {MODES.map((item) => {
          const active = item.id === mode;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.modeCard,
                active
                  ? { backgroundColor: withAlpha(item.colors[0], '18'), borderColor: withAlpha(item.colors[0], '4A') }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {
                setMode(item.id);
                setA('');
                setB('');
              }}
            >
              <View style={[styles.modeIcon, { backgroundColor: active ? withAlpha(item.colors[0], '1C') : colors.inputBg }]}>
                <Ionicons name={item.icon} size={18} color={active ? item.colors[0] : colors.textMuted} />
              </View>
              <Text style={[styles.modeLabel, { color: colors.text }]}>{item.label}</Text>
              <Text style={[styles.modeCopy, { color: colors.textMuted }]}>{item.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{labels.a}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={a}
            onChangeText={setA}
            keyboardType="numeric"
            placeholder="Enter value"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={[styles.dividerIcon, { backgroundColor: withAlpha(activeMode.colors[0], '18') }]}>
            <Ionicons name={activeMode.icon} size={18} color={activeMode.colors[0]} />
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: colors.textMuted }]}>{labels.b}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={b}
            onChangeText={setB}
            keyboardType="numeric"
            placeholder="Enter value"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View
        style={[
          styles.resultCard,
          {
            backgroundColor: withAlpha(activeMode.colors[0], '12'),
            borderColor: withAlpha(activeMode.colors[0], '38'),
          },
        ]}
      >
        <Text style={[styles.resultLabel, { color: colors.textMuted }]}>
          {result?.label ?? 'Enter both values to calculate'}
        </Text>
        <Text style={[styles.resultValue, { color: activeMode.colors[0] }]}>
          {result ? `${result.value.toFixed(2)}${result.suffix}` : '--'}
        </Text>
        <Text style={[styles.resultInsight, { color: colors.textSub }]}>
          {result?.insight ?? 'The answer updates live as you type.'}
        </Text>
        {result?.extra ? (
          <Text style={[styles.resultExtra, { color: colors.textMuted }]}>{result.extra}</Text>
        ) : null}
      </View>

      <View style={styles.metricRow}>
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Value A</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{a || '--'}</Text>
        </View>
        <View style={[styles.metricCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Value B</Text>
          <Text style={[styles.metricValue, { color: colors.text }]}>{b || '--'}</Text>
        </View>
      </View>

      <View style={[styles.exampleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.exampleTitle, { color: colors.textMuted }]}>Quick Examples</Text>
        {examples.map((item, index) => (
          <View
            key={item}
            style={[
              styles.exampleRow,
              index < examples.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null,
            ]}
          >
            <Ionicons name="flash-outline" size={16} color={activeMode.colors[0]} />
            <Text style={[styles.exampleText, { color: colors.text }]}>{item}</Text>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    heroIcon: {
      width: 52,
      height: 52,
      borderRadius: Radii.lg,
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroTextBlock: {
      flex: 1,
      gap: 2,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: 'rgba(255,255,255,0.86)',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroTitle: {
      fontSize: 30,
      lineHeight: 34,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#FFFFFF',
    },
    modeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    modeCard: {
      flexGrow: 1,
      minWidth: 160,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    modeIcon: {
      width: 42,
      height: 42,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeLabel: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
    },
    modeCopy: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.medium,
    },
    formCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.lg,
    },
    inputGroup: {
      gap: Spacing.sm,
    },
    inputLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    divider: {
      flex: 1,
      height: 1,
    },
    dividerIcon: {
      width: 42,
      height: 42,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resultCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.xs,
    },
    resultLabel: {
      fontSize: 13,
      fontFamily: Fonts.medium,
    },
    resultValue: {
      fontSize: 38,
      lineHeight: 42,
      fontFamily: Fonts.bold,
    },
    resultInsight: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      marginTop: Spacing.sm,
    },
    resultExtra: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    metricRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    metricCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: 4,
    },
    metricLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    metricValue: {
      fontSize: 24,
      fontFamily: Fonts.bold,
    },
    exampleCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
    },
    exampleTitle: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },
    exampleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
    },
    exampleText: {
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
    },
  });
