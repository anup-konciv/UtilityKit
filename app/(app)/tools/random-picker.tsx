import { useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';

const ACCENT = '#D946EF';

const LIST_PRESETS = [
  { label: 'Yes / No', value: 'Yes\nNo', icon: 'help-outline' as const },
  { label: 'Dinner', value: 'Pizza\nBurgers\nSushi\nTacos\nPasta', icon: 'restaurant-outline' as const },
  { label: 'Weekday', value: 'Monday\nTuesday\nWednesday\nThursday\nFriday\nSaturday\nSunday', icon: 'calendar-outline' as const },
  { label: 'Colors', value: 'Coral\nMint\nBlue\nGold\nRose\nTeal', icon: 'color-palette-outline' as const },
];

export default function RandomPickerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<'list' | 'number'>('list');
  const [input, setInput] = useState('Coral\nMint\nOcean Blue\nAmber\nRose');
  const [picked, setPicked] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [pickCount, setPickCount] = useState(1);
  const [minNum, setMinNum] = useState('1');
  const [maxNum, setMaxNum] = useState('50');

  const scaleAnim = useRef(new Animated.Value(1)).current;

  const items = useMemo(
    () => input.split('\n').map((item) => item.trim()).filter(Boolean),
    [input],
  );

  const canPick = mode === 'list' ? items.length > 0 : true;

  const summary = useMemo(() => {
    if (mode === 'number') {
      const min = Number.parseInt(minNum, 10) || 0;
      const max = Number.parseInt(maxNum, 10) || 0;
      return `${Math.min(min, max)} to ${Math.max(min, max)}`;
    }

    return `${items.length} option${items.length === 1 ? '' : 's'} ready`;
  }, [items.length, maxNum, minNum, mode]);

  function animateReveal() {
    scaleAnim.setValue(0.92);
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }

  function handlePick() {
    if (mode === 'list') {
      if (items.length === 0) return;

      const pool = [...items];
      const results: string[] = [];
      const totalPicks = Math.min(pickCount, pool.length);

      while (results.length < totalPicks) {
        const index = Math.floor(Math.random() * pool.length);
        const [choice] = pool.splice(index, 1);
        results.push(choice);
      }

      setPicked(results);
      setHistory((current) => [...results, ...current].slice(0, 16));
    } else {
      const min = Number.parseInt(minNum, 10) || 0;
      const max = Number.parseInt(maxNum, 10) || 0;
      const lower = Math.min(min, max);
      const upper = Math.max(min, max);
      const result = String(Math.floor(Math.random() * (upper - lower + 1)) + lower);

      setPicked([result]);
      setHistory((current) => [result, ...current].slice(0, 16));
    }

    animateReveal();
  }

  return (
    <ScreenShell title="Random Picker" accentColor={ACCENT}>
      <LinearGradient
        colors={['#701A75', '#D946EF', '#F9A8D4']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Chance Machine</Text>
        <Text style={styles.heroTitle}>{picked.length > 0 ? picked.join(', ') : 'Ready to pick'}</Text>
        <Text style={styles.heroCopy}>
          Switch between list and number modes, draw multiple winners, and keep a playful history.
        </Text>
      </LinearGradient>

      <View style={styles.toggleRow}>
        {(['list', 'number'] as const).map((item) => {
          const active = mode === item;
          return (
            <TouchableOpacity
              key={item}
              style={[
                styles.toggleChip,
                active
                  ? { backgroundColor: ACCENT, borderColor: ACCENT }
                  : { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => {
                setMode(item);
                setPicked([]);
              }}
            >
              <Ionicons
                name={item === 'list' ? 'list-outline' : 'calculator-outline'}
                size={16}
                color={active ? '#FFFFFF' : colors.textMuted}
              />
              <Text style={[styles.toggleChipText, { color: active ? '#FFFFFF' : colors.textMuted }]}>
                {item === 'list' ? 'From List' : 'Number Range'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.summaryBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Live Setup</Text>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{summary}</Text>
        </View>
        {mode === 'list' ? (
          <View style={styles.pickCountRow}>
            {[1, 2, 3].map((value) => {
              const active = pickCount === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.pickCountChip,
                    active
                      ? { backgroundColor: withAlpha(ACCENT, '18'), borderColor: withAlpha(ACCENT, '36') }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                  onPress={() => setPickCount(value)}
                >
                  <Text style={[styles.pickCountText, { color: active ? ACCENT : colors.textMuted }]}>{value}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}
      </View>

      {mode === 'list' ? (
        <>
          <View style={[styles.editorCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>List Input</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              placeholder={'One item per line\nCoral\nMint\nOcean Blue'}
              placeholderTextColor={colors.textMuted}
              value={input}
              onChangeText={setInput}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.presetGrid}>
            {LIST_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={[styles.presetCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => {
                  setInput(preset.value);
                  setPicked([]);
                }}
              >
                <View style={[styles.presetIcon, { backgroundColor: withAlpha(ACCENT, '16') }]}>
                  <Ionicons name={preset.icon} size={18} color={ACCENT} />
                </View>
                <Text style={[styles.presetLabel, { color: colors.text }]}>{preset.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      ) : (
        <View style={[styles.rangeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rangeField}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Minimum</Text>
            <TextInput
              style={[styles.rangeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={minNum}
              onChangeText={setMinNum}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.rangeField}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Maximum</Text>
            <TextInput
              style={[styles.rangeInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={maxNum}
              onChangeText={setMaxNum}
              keyboardType="numeric"
            />
          </View>
        </View>
      )}

      <TouchableOpacity
        style={[
          styles.pickButton,
          { backgroundColor: canPick ? ACCENT : colors.surface, borderColor: canPick ? ACCENT : colors.border },
        ]}
        onPress={handlePick}
        disabled={!canPick}
      >
        <Ionicons name="shuffle" size={20} color={canPick ? '#FFFFFF' : colors.textMuted} />
        <Text style={[styles.pickButtonText, { color: canPick ? '#FFFFFF' : colors.textMuted }]}>Pick Random</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.resultCard,
          {
            backgroundColor: withAlpha(ACCENT, '12'),
            borderColor: withAlpha(ACCENT, '36'),
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Result</Text>
        {picked.length > 0 ? (
          <View style={styles.resultChipRow}>
            {picked.map((item) => (
              <View key={item} style={[styles.resultChip, { backgroundColor: withAlpha(ACCENT, '18') }]}>
                <Text style={[styles.resultChipText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.resultPlaceholder, { color: colors.textMuted }]}>
            Your random choice will appear here.
          </Text>
        )}
      </Animated.View>

      {history.length > 0 ? (
        <View style={[styles.historyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.historyHeader}>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Recent Picks</Text>
            <TouchableOpacity onPress={() => setHistory([])}>
              <Text style={[styles.clearText, { color: ACCENT }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyWrap}>
            {history.map((item, index) => (
              <View
                key={`${item}-${index}`}
                style={[
                  styles.historyChip,
                  { backgroundColor: index % 2 === 0 ? withAlpha(ACCENT, '12') : withAlpha('#0EA5E9', '12') },
                ]}
              >
                <Text style={[styles.historyChipText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
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
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: '#FCE7F3',
    },
    heroTitle: {
      fontSize: 30,
      lineHeight: 36,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#FDF2F8',
    },
    toggleRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    toggleChip: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingVertical: 12,
    },
    toggleChipText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    summaryBar: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
    },
    summaryLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    summaryValue: {
      fontSize: 22,
      fontFamily: Fonts.bold,
      marginTop: 4,
    },
    pickCountRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    pickCountChip: {
      minWidth: 40,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingVertical: 8,
      alignItems: 'center',
    },
    pickCountText: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    editorCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    textArea: {
      minHeight: 160,
      borderWidth: 1,
      borderRadius: Radii.xl,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 15,
      lineHeight: 22,
      fontFamily: Fonts.medium,
    },
    presetGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    presetCard: {
      flexGrow: 1,
      minWidth: 150,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    presetIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    presetLabel: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    rangeCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    rangeField: {
      gap: Spacing.sm,
    },
    rangeInput: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 26,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    pickButton: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      paddingVertical: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    },
    pickButtonText: {
      fontSize: 17,
      fontFamily: Fonts.bold,
    },
    resultCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    resultLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    resultChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    resultChip: {
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
    },
    resultChipText: {
      fontSize: 16,
      fontFamily: Fonts.bold,
    },
    resultPlaceholder: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
    },
    historyCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    historyHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    clearText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    historyWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    historyChip: {
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 9,
    },
    historyChipText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
  });
