import { useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#D946EF';

export default function RandomPickerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [input, setInput] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [mode, setMode] = useState<'list' | 'number'>('list');
  const [minNum, setMinNum] = useState('1');
  const [maxNum, setMaxNum] = useState('100');

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const items = useMemo(() =>
    input.split('\n').map(s => s.trim()).filter(Boolean),
    [input],
  );

  const animatePick = useCallback(() => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [scaleAnim]);

  const pickRandom = useCallback(() => {
    if (mode === 'list') {
      if (items.length === 0) return;
      const idx = Math.floor(Math.random() * items.length);
      setPicked(items[idx]);
      setHistory(prev => [items[idx], ...prev].slice(0, 20));
    } else {
      const min = parseInt(minNum) || 0;
      const max = parseInt(maxNum) || 100;
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      const result = String(num);
      setPicked(result);
      setHistory(prev => [result, ...prev].slice(0, 20));
    }
    animatePick();
  }, [mode, items, minNum, maxNum, animatePick]);

  const loadPreset = (preset: string) => {
    setInput(preset);
    setPicked(null);
  };

  return (
    <ScreenShell title="Random Picker" accentColor={ACCENT}>
      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        {(['list', 'number'] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => { setMode(m); setPicked(null); }}
          >
            <Ionicons name={m === 'list' ? 'list-outline' : 'calculator-outline'} size={16} color={mode === m ? '#fff' : colors.textMuted} />
            <Text style={[styles.modeBtnText, { color: mode === m ? '#fff' : colors.textMuted }]}>
              {m === 'list' ? 'From List' : 'Number Range'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'list' ? (
        <>
          {/* Input */}
          <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textArea, { color: colors.text }]}
              placeholder={'Enter items (one per line)...\nPizza\nBurger\nSushi\nTacos'}
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              textAlignVertical="top"
            />
            <Text style={[styles.itemCount, { color: colors.textMuted }]}>{items.length} items</Text>
          </View>

          {/* Presets */}
          <View style={styles.presetRow}>
            {[
              { label: 'Yes/No', data: 'Yes\nNo' },
              { label: 'Coins', data: 'Heads\nTails' },
              { label: 'Colors', data: 'Red\nBlue\nGreen\nYellow\nPurple\nOrange' },
              { label: 'Days', data: 'Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday' },
            ].map(p => (
              <TouchableOpacity key={p.label} style={[styles.presetBtn, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]} onPress={() => loadPreset(p.data)}>
                <Text style={[styles.presetText, { color: ACCENT }]}>{p.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={[styles.rangeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rangeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rangeLabel}>Min</Text>
              <TextInput
                style={[styles.rangeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={minNum}
                onChangeText={setMinNum}
                keyboardType="numeric"
              />
            </View>
            <Text style={[styles.rangeTo, { color: colors.textMuted }]}>to</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.rangeLabel}>Max</Text>
              <TextInput
                style={[styles.rangeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={maxNum}
                onChangeText={setMaxNum}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      )}

      {/* Pick Button */}
      <TouchableOpacity
        style={[styles.pickBtn, { backgroundColor: (mode === 'list' && items.length === 0) ? colors.surface : ACCENT }]}
        onPress={pickRandom}
        disabled={mode === 'list' && items.length === 0}
        activeOpacity={0.8}
      >
        <Ionicons name="shuffle" size={22} color={(mode === 'list' && items.length === 0) ? colors.textMuted : '#fff'} />
        <Text style={[styles.pickBtnText, { color: (mode === 'list' && items.length === 0) ? colors.textMuted : '#fff' }]}>Pick Random</Text>
      </TouchableOpacity>

      {/* Result */}
      {picked !== null && (
        <Animated.View style={[styles.resultCard, { backgroundColor: ACCENT + '12', borderColor: ACCENT + '40', transform: [{ scale: scaleAnim }] }]}>
          <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Result</Text>
          <Text style={[styles.resultValue, { color: ACCENT }]}>{picked}</Text>
        </Animated.View>
      )}

      {/* History */}
      {history.length > 0 && (
        <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.historyHeader}>
            <Text style={styles.historyTitle}>History</Text>
            <TouchableOpacity onPress={() => setHistory([])}>
              <Text style={{ fontSize: 12, fontFamily: Fonts.semibold, color: ACCENT }}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyList}>
            {history.map((item, i) => (
              <View key={i} style={[styles.historyChip, { backgroundColor: ACCENT + '15' }]}>
                <Text style={[styles.historyChipText, { color: ACCENT }]}>{item}</Text>
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
    modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    modeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: c.border },
    modeBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    inputCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
    textArea: { fontSize: 15, fontFamily: Fonts.regular, minHeight: 120, lineHeight: 24 },
    itemCount: { fontSize: 11, fontFamily: Fonts.regular, textAlign: 'right', marginTop: 4 },
    presetRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    presetBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1 },
    presetText: { fontSize: 12, fontFamily: Fonts.semibold },
    rangeCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    rangeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
    rangeLabel: { fontSize: 12, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 6 },
    rangeInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 20, fontFamily: Fonts.bold, textAlign: 'center' },
    rangeTo: { fontSize: 14, fontFamily: Fonts.medium, paddingBottom: 14 },
    pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    pickBtnText: { fontSize: 18, fontFamily: Fonts.bold },
    resultCard: { borderRadius: Radii.xl, borderWidth: 1.5, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
    resultLabel: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 4 },
    resultValue: { fontSize: 42, fontFamily: Fonts.bold },
    historyCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    historyTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    historyList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    historyChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radii.pill },
    historyChipText: { fontSize: 13, fontFamily: Fonts.semibold },
  });
