import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

const ACCENT = '#7C3AED';

type BaseDef = {
  name: string;
  prefix: string;
  radix: number;
  placeholder: string;
  regex: RegExp;
  note: string;
};

const BASES: BaseDef[] = [
  { name: 'Binary', prefix: '0b', radix: 2, placeholder: '1010', regex: /^[01]*$/, note: 'Bits and flags' },
  { name: 'Octal', prefix: '0o', radix: 8, placeholder: '12', regex: /^[0-7]*$/, note: 'Compact groups of three bits' },
  { name: 'Decimal', prefix: '', radix: 10, placeholder: '10', regex: /^-?\d*$/, note: 'Human-friendly base 10' },
  { name: 'Hex', prefix: '0x', radix: 16, placeholder: 'A4', regex: /^[0-9a-fA-F]*$/, note: 'Memory, color, and byte notation' },
];

function formatBinaryGroups(value: string) {
  return value.replace(/(.{4})/g, '$1 ').trim();
}

export default function BaseConverterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeBase, setActiveBase] = useState(2);
  const [inputVal, setInputVal] = useState('255');
  const [copiedLabel, setCopiedLabel] = useState('');
  const history = useToolHistory<{ activeBase: number; inputVal: string }>('base-conv', { max: 12 });

  const active = BASES[activeBase];

  const decimalValue = useMemo(() => {
    if (!inputVal.trim()) return null;
    const parsed = Number.parseInt(inputVal, active.radix);
    return Number.isNaN(parsed) ? null : parsed;
  }, [active.radix, inputVal]);

  const conversions = useMemo(() => {
    if (decimalValue == null) return BASES.map(() => '');
    return BASES.map((item) => {
      const value = decimalValue.toString(item.radix);
      return item.radix === 16 ? value.toUpperCase() : value;
    });
  }, [decimalValue]);

  const bitInfo = useMemo(() => {
    if (decimalValue == null || decimalValue < 0) return null;
    const binary = decimalValue.toString(2);

    return {
      bitLength: binary.length,
      ones: binary.split('').filter((char) => char === '1').length,
      zeros: binary.split('').filter((char) => char === '0').length,
      isPowerOf2: decimalValue > 0 && (decimalValue & (decimalValue - 1)) === 0,
      isEven: decimalValue % 2 === 0,
      ascii: decimalValue >= 32 && decimalValue <= 126 ? String.fromCharCode(decimalValue) : null,
    };
  }, [decimalValue]);

  function handleInput(text: string) {
    if (text === '' || text === '-' || active.regex.test(text)) {
      setInputVal(text);
    }
  }

  async function copyValue(label: string, value: string) {
    if (!value) return;
    await Clipboard.setStringAsync(value);
    setCopiedLabel(label);
  }

  return (
    <ScreenShell title="Base Converter" accentColor={ACCENT}>
      <LinearGradient
        colors={['#4C1D95', '#7C3AED', '#C4B5FD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Number Systems</Text>
        <Text style={styles.heroTitle}>
          {decimalValue == null ? '--' : decimalValue}
        </Text>
        <Text style={styles.heroCopy}>
          Type in any supported base and instantly inspect the same value across binary, octal, decimal, and hex.
        </Text>
      </LinearGradient>

      <View style={styles.baseGrid}>
        {BASES.map((item, index) => {
          const activeCard = activeBase === index;
          return (
            <TouchableOpacity
              key={item.name}
              style={[
                styles.baseCard,
                activeCard
                  ? { backgroundColor: withAlpha(ACCENT, '18'), borderColor: withAlpha(ACCENT, '42') }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {
                if (decimalValue != null) {
                  const nextValue = decimalValue.toString(item.radix);
                  setInputVal(item.radix === 16 ? nextValue.toUpperCase() : nextValue);
                } else {
                  setInputVal('');
                }
                setActiveBase(index);
              }}
            >
              <Text style={[styles.baseName, { color: colors.text }]}>{item.name}</Text>
              <Text style={[styles.baseNote, { color: activeCard ? ACCENT : colors.textMuted }]}>{item.note}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.inputHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Input Value</Text>
          <Text style={[styles.inputHint, { color: ACCENT }]}>Base {active.radix}</Text>
        </View>
        <View style={[styles.inputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          {active.prefix ? <Text style={[styles.prefix, { color: ACCENT }]}>{active.prefix}</Text> : null}
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={inputVal}
            onChangeText={handleInput}
            placeholder={active.placeholder}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {inputVal.length > 0 ? (
            <TouchableOpacity onPress={() => setInputVal('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <View style={styles.resultsGrid}>
        {BASES.map((item, index) => {
          const value = conversions[index];
          const displayValue = item.radix === 2 ? formatBinaryGroups(value) : value;
          const isActive = activeBase === index;

          return (
            <View
              key={item.name}
              style={[
                styles.resultCard,
                isActive
                  ? { backgroundColor: withAlpha(ACCENT, '12'), borderColor: withAlpha(ACCENT, '3A') }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.resultHeader}>
                <View>
                  <Text style={[styles.resultName, { color: colors.text }]}>{item.name}</Text>
                  <Text style={[styles.resultMeta, { color: colors.textMuted }]}>
                    {item.prefix || 'base'} {item.radix}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => copyValue(item.name, value)} disabled={!value}>
                  <Ionicons
                    name={copiedLabel === item.name ? 'checkmark-circle' : 'copy-outline'}
                    size={18}
                    color={value ? ACCENT : colors.borderStrong}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.resultValue, { color: value ? colors.text : colors.borderStrong }]}>
                {value ? `${item.prefix}${displayValue}` : '--'}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={[styles.analysisCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Bit Analysis</Text>
        {bitInfo ? (
          <>
            <View style={styles.metricRow}>
              {[
                { label: 'Bits', value: String(bitInfo.bitLength) },
                { label: '1s', value: String(bitInfo.ones) },
                { label: '0s', value: String(bitInfo.zeros) },
              ].map((item) => (
                <View key={item.label} style={[styles.metricCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.metricValue, { color: ACCENT }]}>{item.value}</Text>
                  <Text style={[styles.metricLabel, { color: colors.textMuted }]}>{item.label}</Text>
                </View>
              ))}
            </View>

            <View style={styles.factRow}>
              <View style={[styles.factPill, { backgroundColor: withAlpha(ACCENT, '14'), borderColor: withAlpha(ACCENT, '2E') }]}>
                <Ionicons name="flash-outline" size={15} color={ACCENT} />
                <Text style={[styles.factText, { color: colors.text }]}>
                  {bitInfo.isPowerOf2 ? 'Power of 2' : 'Not a power of 2'}
                </Text>
              </View>
              <View style={[styles.factPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="resize-outline" size={15} color={colors.textMuted} />
                <Text style={[styles.factText, { color: colors.text }]}>
                  {bitInfo.isEven ? 'Even value' : 'Odd value'}
                </Text>
              </View>
              {bitInfo.ascii ? (
                <View style={[styles.factPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons name="text-outline" size={15} color={colors.textMuted} />
                  <Text style={[styles.factText, { color: colors.text }]}>ASCII {bitInfo.ascii}</Text>
                </View>
              ) : null}
            </View>
          </>
        ) : (
          <Text style={[styles.analysisCopy, { color: colors.textMuted }]}>
            Enter a valid non-negative number to inspect bit length, parity, and ASCII preview.
          </Text>
        )}
        {decimalValue != null && (
          <TouchableOpacity
            style={[styles.factPill, { backgroundColor: withAlpha(ACCENT, '20'), borderColor: withAlpha(ACCENT, '40'), alignSelf: 'flex-start', marginTop: Spacing.md }]}
            onPress={() => {
              haptics.success();
              history.push(
                { activeBase, inputVal },
                `${active.prefix}${inputVal} • dec ${decimalValue}`,
              );
            }}
          >
            <Ionicons name="bookmark-outline" size={14} color={ACCENT} />
            <Text style={[styles.factText, { color: ACCENT }]}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.entries.length > 0 && (
        <View style={[styles.analysisCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted, marginBottom: 0 }]}>Recent</Text>
            <TouchableOpacity onPress={() => { haptics.warning(); history.clear(); }}>
              <Text style={[{ color: ACCENT, fontFamily: Fonts.semibold, fontSize: 12 }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {history.entries.map((entry, idx) => (
            <TouchableOpacity
              key={entry.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                borderBottomWidth: idx < history.entries.length - 1 ? 0.5 : 0,
                borderBottomColor: colors.border,
              }}
              onPress={() => {
                haptics.tap();
                setActiveBase(entry.value.activeBase);
                setInputVal(entry.value.inputVal);
              }}
            >
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
              <Text style={[{ color: colors.text, fontFamily: Fonts.semibold, fontSize: 13, flex: 1 }]} numberOfLines={1}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.sm,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#EDE9FE',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    heroTitle: {
      fontSize: 38,
      lineHeight: 42,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#F5F3FF',
    },
    baseGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    baseCard: {
      flexGrow: 1,
      minWidth: 150,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.xs,
    },
    baseName: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
    },
    baseNote: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.medium,
    },
    inputCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    inputHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    inputHint: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderRadius: Radii.xl,
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.md,
    },
    prefix: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    input: {
      flex: 1,
      fontSize: 28,
      fontFamily: Fonts.bold,
      padding: 0,
    },
    resultsGrid: {
      gap: Spacing.md,
    },
    resultCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    resultHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
    },
    resultName: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
    },
    resultMeta: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    resultValue: {
      fontSize: 24,
      lineHeight: 30,
      fontFamily: Fonts.bold,
    },
    analysisCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    metricRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    metricCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      paddingHorizontal: Spacing.sm,
      alignItems: 'center',
      gap: 4,
    },
    metricValue: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    metricLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    factRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    factPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 9,
    },
    factText: {
      fontSize: 13,
      fontFamily: Fonts.medium,
    },
    analysisCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
    },
  });
