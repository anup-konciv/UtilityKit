import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#7C3AED';

type Base = { name: string; prefix: string; radix: number; placeholder: string; regex: RegExp };

const BASES: Base[] = [
  { name: 'Binary', prefix: '0b', radix: 2, placeholder: '1010', regex: /^[01]*$/ },
  { name: 'Octal', prefix: '0o', radix: 8, placeholder: '12', regex: /^[0-7]*$/ },
  { name: 'Decimal', prefix: '', radix: 10, placeholder: '10', regex: /^-?\d*$/ },
  { name: 'Hexadecimal', prefix: '0x', radix: 16, placeholder: 'A', regex: /^[0-9a-fA-F]*$/ },
];

export default function BaseConverterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [activeBase, setActiveBase] = useState(2); // Decimal
  const [inputVal, setInputVal] = useState('');

  const decimalValue = useMemo(() => {
    if (!inputVal.trim()) return null;
    const parsed = parseInt(inputVal, BASES[activeBase].radix);
    return isNaN(parsed) ? null : parsed;
  }, [inputVal, activeBase]);

  const conversions = useMemo(() => {
    if (decimalValue === null) return BASES.map(() => '');
    return BASES.map(b => {
      const val = decimalValue.toString(b.radix);
      return b.radix === 16 ? val.toUpperCase() : val;
    });
  }, [decimalValue]);

  const handleInput = (text: string) => {
    if (text === '' || text === '-' || BASES[activeBase].regex.test(text)) {
      setInputVal(text);
    }
  };

  const copyValue = (val: string) => {
    if (val) Clipboard.setStringAsync(val);
  };

  const bitInfo = useMemo(() => {
    if (decimalValue === null) return null;
    const bin = (decimalValue >>> 0).toString(2);
    return {
      bits: bin.length,
      ones: bin.split('').filter(b => b === '1').length,
      zeros: bin.split('').filter(b => b === '0').length,
      isPowerOf2: decimalValue > 0 && (decimalValue & (decimalValue - 1)) === 0,
      isEven: decimalValue % 2 === 0,
    };
  }, [decimalValue]);

  return (
    <ScreenShell title="Base Converter" accentColor={ACCENT}>
      {/* Input base selector */}
      <View style={styles.baseRow}>
        {BASES.map((b, i) => (
          <TouchableOpacity
            key={b.name}
            style={[styles.baseBtn, activeBase === i && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => {
              if (decimalValue !== null) {
                const converted = decimalValue.toString(BASES[i].radix);
                setInputVal(BASES[i].radix === 16 ? converted.toUpperCase() : converted);
              } else {
                setInputVal('');
              }
              setActiveBase(i);
            }}
          >
            <Text style={[styles.baseBtnText, { color: activeBase === i ? '#fff' : colors.textMuted }]}>
              {b.name}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input */}
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.inputLabel, { color: colors.textMuted }]}>Enter {BASES[activeBase].name}</Text>
        <View style={styles.inputRow}>
          {BASES[activeBase].prefix ? (
            <Text style={[styles.prefix, { color: ACCENT }]}>{BASES[activeBase].prefix}</Text>
          ) : null}
          <TextInput
            style={[styles.input, { color: colors.text }]}
            value={inputVal}
            onChangeText={handleInput}
            placeholder={BASES[activeBase].placeholder}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          {inputVal.length > 0 && (
            <TouchableOpacity onPress={() => setInputVal('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results */}
      {BASES.map((b, i) => (
        <View key={b.name} style={[styles.resultCard, { backgroundColor: colors.card, borderColor: colors.border }, i === activeBase && { borderLeftColor: ACCENT, borderLeftWidth: 3 }]}>
          <View style={styles.resultHeader}>
            <Text style={[styles.resultName, { color: colors.textMuted }]}>{b.name}</Text>
            <TouchableOpacity onPress={() => copyValue(conversions[i])} disabled={!conversions[i]}>
              <Ionicons name="copy-outline" size={16} color={conversions[i] ? ACCENT : colors.border} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.resultValue, { color: conversions[i] ? colors.text : colors.border }]}>
            {b.prefix}{conversions[i] || '—'}
          </Text>
        </View>
      ))}

      {/* Bit info */}
      {bitInfo && (
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.infoTitle}>Bit Analysis</Text>
          <View style={styles.infoGrid}>
            {[
              { label: 'Bits', val: String(bitInfo.bits) },
              { label: '1s', val: String(bitInfo.ones) },
              { label: '0s', val: String(bitInfo.zeros) },
              { label: 'Power of 2', val: bitInfo.isPowerOf2 ? 'Yes' : 'No' },
              { label: 'Even', val: bitInfo.isEven ? 'Yes' : 'No' },
            ].map(item => (
              <View key={item.label} style={styles.infoItem}>
                <Text style={[styles.infoVal, { color: ACCENT }]}>{item.val}</Text>
                <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    baseRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    baseBtn: { flex: 1, minWidth: 70, paddingVertical: 8, borderRadius: Radii.md, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
    baseBtnText: { fontSize: 11, fontFamily: Fonts.semibold },
    inputCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    inputLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
    inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    prefix: { fontSize: 18, fontFamily: Fonts.bold },
    input: { flex: 1, fontSize: 24, fontFamily: Fonts.bold, padding: 0 },
    resultCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
    resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    resultName: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1 },
    resultValue: { fontSize: 18, fontFamily: Fonts.bold },
    infoCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginTop: Spacing.sm },
    infoTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    infoGrid: { flexDirection: 'row', justifyContent: 'space-around' },
    infoItem: { alignItems: 'center' },
    infoVal: { fontSize: 18, fontFamily: Fonts.bold },
    infoLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
  });
