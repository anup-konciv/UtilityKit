import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';

const ACCENT = '#F97316';
const HIGHLIGHT = '#14B8A6';

const QUICK_TIPS = [8, 10, 12, 15, 18, 22];
const SERVICE_PRESETS = [
  { id: 'coffee', label: 'Cafe', tip: 8, icon: 'cafe-outline' as const },
  { id: 'delivery', label: 'Delivery', tip: 10, icon: 'bicycle-outline' as const },
  { id: 'dining', label: 'Dinner', tip: 15, icon: 'restaurant-outline' as const },
  { id: 'celebration', label: 'Celebration', tip: 18, icon: 'sparkles-outline' as const },
];

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

function formatMoney(value: number) {
  return `Rs ${formatNumber(value)}`;
}

export default function TipCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [bill, setBill] = useState('1850');
  const [tipPct, setTipPct] = useState('12');
  const [people, setPeople] = useState('3');
  const [service, setService] = useState<string>('dining');

  const peopleCount = Math.max(1, Number.parseInt(people, 10) || 1);

  const calc = useMemo(() => {
    const billValue = Math.max(0, Number.parseFloat(bill) || 0);
    const tipValue = Math.max(0, Number.parseFloat(tipPct) || 0);
    const tipAmount = billValue * tipValue / 100;
    const total = billValue + tipAmount;
    const tipPerPerson = tipAmount / peopleCount;
    const totalPerPerson = total / peopleCount;
    const roundedPerPerson = Math.ceil(totalPerPerson);
    const roundUpDelta = roundedPerPerson * peopleCount - total;

    return {
      billValue,
      tipValue,
      tipAmount,
      total,
      tipPerPerson,
      totalPerPerson,
      roundedPerPerson,
      roundUpDelta,
    };
  }, [bill, peopleCount, tipPct]);

  const smartMessage = useMemo(() => {
    if (!calc.billValue) return 'Pick a service style and we will split everything instantly.';
    if (peopleCount === 1) return `A ${calc.tipValue}% tip adds ${formatMoney(calc.tipAmount)} to your bill.`;
    return `Each person pays ${formatMoney(calc.totalPerPerson)}. Round to ${formatMoney(calc.roundedPerPerson)} if you want a clean split.`;
  }, [calc, peopleCount]);

  const insightRows = [
    {
      label: 'Bill',
      value: formatMoney(calc.billValue),
      icon: 'receipt-outline' as const,
      tint: ACCENT,
    },
    {
      label: 'Tip',
      value: formatMoney(calc.tipAmount),
      icon: 'cash-outline' as const,
      tint: '#FB7185',
    },
    {
      label: 'Per Person',
      value: formatMoney(calc.totalPerPerson),
      icon: 'people-outline' as const,
      tint: HIGHLIGHT,
    },
  ];

  return (
    <ScreenShell title="Tip Calculator" accentColor={ACCENT}>
      <LinearGradient
        colors={['#7C2D12', '#EA580C', '#FDBA74']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Dining Split</Text>
        <Text style={styles.heroTitle}>{formatMoney(calc.total || 0)}</Text>
        <Text style={styles.heroCopy}>{smartMessage}</Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{peopleCount}</Text>
            <Text style={styles.heroStatLabel}>People</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{calc.tipValue}%</Text>
            <Text style={styles.heroStatLabel}>Tip Rate</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{formatMoney(calc.totalPerPerson || 0)}</Text>
            <Text style={styles.heroStatLabel}>Each Pays</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>Service Style</Text>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Quick presets for common occasions</Text>
        </View>
        <View style={styles.serviceGrid}>
          {SERVICE_PRESETS.map((preset) => {
            const active = service === preset.id;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.serviceCard,
                  active
                    ? { backgroundColor: withAlpha(ACCENT, '18'), borderColor: withAlpha(ACCENT, '48') }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => {
                  setService(preset.id);
                  setTipPct(String(preset.tip));
                }}
              >
                <View style={[styles.serviceIcon, { backgroundColor: active ? withAlpha(ACCENT, '20') : colors.inputBg }]}>
                  <Ionicons name={preset.icon} size={18} color={active ? ACCENT : colors.textMuted} />
                </View>
                <Text style={[styles.serviceLabel, { color: colors.text }]}>{preset.label}</Text>
                <Text style={[styles.serviceTip, { color: active ? ACCENT : colors.textMuted }]}>{preset.tip}%</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Bill Amount</Text>
          <TextInput
            style={[styles.largeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={bill}
            onChangeText={setBill}
            keyboardType="numeric"
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Tip Percentage</Text>
            <Text style={[styles.inlineValue, { color: ACCENT }]}>{tipPct || '0'}%</Text>
          </View>
          <View style={styles.quickRow}>
            {QUICK_TIPS.map((value) => {
              const active = tipPct === String(value);
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.quickChip,
                    active
                      ? { backgroundColor: ACCENT, borderColor: ACCENT }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => setTipPct(String(value))}
                >
                  <Text style={[styles.quickChipText, { color: active ? '#FFFFFF' : colors.textMuted }]}>{value}%</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={tipPct}
            onChangeText={setTipPct}
            keyboardType="numeric"
            placeholder="Custom tip"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        <View style={styles.field}>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>People Splitting</Text>
            <Text style={[styles.inlineValue, { color: colors.text }]}>{peopleCount}</Text>
          </View>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={[styles.counterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setPeople(String(Math.max(1, peopleCount - 1)))}
            >
              <Ionicons name="remove" size={18} color={colors.text} />
            </TouchableOpacity>
            {[1, 2, 3, 4, 5, 6].map((value) => {
              const active = peopleCount === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.peopleChip,
                    active
                      ? { backgroundColor: HIGHLIGHT, borderColor: HIGHLIGHT }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => setPeople(String(value))}
                >
                  <Text style={[styles.peopleChipText, { color: active ? '#FFFFFF' : colors.textMuted }]}>{value}</Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.counterButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => setPeople(String(peopleCount + 1))}
            >
              <Ionicons name="add" size={18} color={colors.text} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        {insightRows.map((item) => (
          <View
            key={item.label}
            style={[
              styles.summaryCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                shadowColor: item.tint,
              },
            ]}
          >
            <View style={[styles.summaryIcon, { backgroundColor: withAlpha(item.tint, '16') }]}>
              <Ionicons name={item.icon} size={18} color={item.tint} />
            </View>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionEyebrow, { color: colors.textMuted }]}>Smart Split</Text>
          <Ionicons name="sparkles-outline" size={18} color={ACCENT} />
        </View>
        <Text style={[styles.insightTitle, { color: colors.text }]}>
          Clean round-up: {formatMoney(calc.roundedPerPerson)} each
        </Text>
        <Text style={[styles.insightCopy, { color: colors.textMuted }]}>
          Add {formatMoney(Math.max(calc.roundUpDelta, 0))} to make the full bill land on a clean per-person number.
        </Text>
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
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      letterSpacing: 1,
      textTransform: 'uppercase',
      color: '#FFEDD5',
    },
    heroTitle: {
      fontSize: 36,
      lineHeight: 40,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#FFF7ED',
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    heroStat: {
      flex: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    heroStatValue: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroStatLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: '#FFEDD5',
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    panel: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.lg,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    sectionEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    sectionHint: {
      flex: 1,
      textAlign: 'right',
      fontSize: 12,
      fontFamily: Fonts.medium,
    },
    serviceGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    serviceCard: {
      flexGrow: 1,
      minWidth: 150,
      borderWidth: 1,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: Spacing.sm,
    },
    serviceIcon: {
      width: 38,
      height: 38,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    serviceLabel: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    serviceTip: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    field: {
      gap: Spacing.sm,
    },
    fieldRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    inlineValue: {
      fontSize: 14,
      fontFamily: Fonts.bold,
    },
    largeInput: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
      fontSize: 28,
      fontFamily: Fonts.bold,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 18,
      fontFamily: Fonts.semibold,
    },
    quickRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    quickChip: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: 14,
      paddingVertical: 8,
    },
    quickChipText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    counterButton: {
      width: 42,
      height: 42,
      borderRadius: Radii.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    peopleChip: {
      minWidth: 42,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: Radii.pill,
      borderWidth: 1,
      alignItems: 'center',
    },
    peopleChipText: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    summaryCard: {
      flexGrow: 1,
      minWidth: 180,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.12,
      shadowRadius: 16,
      elevation: 4,
    },
    summaryIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    summaryValue: {
      fontSize: 20,
      fontFamily: Fonts.bold,
    },
    insightCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    insightTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontFamily: Fonts.bold,
    },
    insightCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
    },
  });
