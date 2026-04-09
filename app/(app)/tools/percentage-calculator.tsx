import { useMemo, useState, useCallback } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

const ACCENT = '#F97316';

type Mode = 'of' | 'is_what' | 'change' | 'discount';

const MODES: {
  id: Mode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { id: 'of',      label: '% of',       icon: 'pie-chart-outline',      color: '#F97316' },
  { id: 'is_what', label: 'Is What %',  icon: 'analytics-outline',      color: '#0EA5E9' },
  { id: 'change',  label: '% Change',   icon: 'swap-vertical-outline',  color: '#8B5CF6' },
  { id: 'discount',label: 'Discount',   icon: 'pricetag-outline',       color: '#EC4899' },
];

const EXAMPLES: Record<Mode, { a: string; b: string; label: string }[]> = {
  of: [
    { a: '20', b: '450', label: '20% of 450' },
    { a: '7.5', b: '1200', label: '7.5% of 1200' },
    { a: '32', b: '80', label: '32% of 80' },
    { a: '18', b: '5000', label: '18% of 5000' },
  ],
  is_what: [
    { a: '45', b: '60', label: '45 of 60' },
    { a: '18', b: '240', label: '18 of 240' },
    { a: '9', b: '12', label: '9 of 12' },
    { a: '350', b: '1000', label: '350 of 1000' },
  ],
  change: [
    { a: '100', b: '140', label: '100 → 140' },
    { a: '560', b: '420', label: '560 → 420' },
    { a: '80', b: '100', label: '80 → 100' },
    { a: '250', b: '200', label: '250 → 200' },
  ],
  discount: [
    { a: '15', b: '999', label: '15% off 999' },
    { a: '25', b: '200', label: '25% off 200' },
    { a: '40', b: '750', label: '40% off 750' },
    { a: '10', b: '4999', label: '10% off 4999' },
  ],
};

function getLabels(mode: Mode): { a: string; b: string; placeholder_a: string; placeholder_b: string } {
  switch (mode) {
    case 'of':       return { a: 'Percentage', b: 'Base Value', placeholder_a: 'e.g. 15', placeholder_b: 'e.g. 240' };
    case 'is_what':  return { a: 'Value', b: 'Total', placeholder_a: 'e.g. 45', placeholder_b: 'e.g. 60' };
    case 'change':   return { a: 'From', b: 'To', placeholder_a: 'e.g. 100', placeholder_b: 'e.g. 140' };
    case 'discount': return { a: 'Discount %', b: 'Price', placeholder_a: 'e.g. 15', placeholder_b: 'e.g. 999' };
  }
}

function compute(mode: Mode, a: string, b: string) {
  const va = parseFloat(a), vb = parseFloat(b);
  if (isNaN(va) || isNaN(vb)) return null;

  switch (mode) {
    case 'of':
      return { main: ((va / 100) * vb).toFixed(2), suffix: '', sub: `${va}% of ${vb}` };
    case 'is_what':
      if (vb === 0) return null;
      return { main: ((va / vb) * 100).toFixed(2), suffix: '%', sub: `${va} is ${((va / vb) * 100).toFixed(1)}% of ${vb}` };
    case 'change': {
      if (va === 0) return null;
      const pct = ((vb - va) / Math.abs(va)) * 100;
      return {
        main: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}`,
        suffix: '%',
        sub: `${pct >= 0 ? 'Increased' : 'Decreased'} by ${Math.abs(vb - va).toFixed(2)}`,
        up: pct >= 0,
      };
    }
    case 'discount': {
      const savings = (va / 100) * vb;
      return { main: (vb - savings).toFixed(2), suffix: '', sub: `You save ${savings.toFixed(2)}` };
    }
  }
}

export default function PercentageCalculatorScreen() {
  const { colors } = useAppTheme();
  const s = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('of');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const history = useToolHistory<{ mode: Mode; a: string; b: string }>('percent-calc', { max: 10 });

  const activeMode = MODES.find(m => m.id === mode)!;
  const labels = getLabels(mode);
  const result = useMemo(() => compute(mode, a, b), [mode, a, b]);

  const fillExample = useCallback((ex: { a: string; b: string }) => {
    haptics.tap();
    setA(ex.a);
    setB(ex.b);
  }, []);

  return (
    <ScreenShell title="Percentage" accentColor={ACCENT}>
      {/* ── Mode tabs ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabStrip}
      >
        {MODES.map(m => {
          const active = m.id === mode;
          return (
            <TouchableOpacity
              key={m.id}
              style={[
                s.tab,
                {
                  backgroundColor: active ? m.color : colors.card,
                  borderColor: active ? m.color : colors.border,
                },
              ]}
              onPress={() => { setMode(m.id); setA(''); setB(''); }}
              activeOpacity={0.7}
            >
              <Ionicons name={m.icon} size={15} color={active ? '#fff' : colors.textMuted} />
              <Text style={[s.tabText, { color: active ? '#fff' : colors.text }]}>{m.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* ── Input card ── */}
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={s.inputRow}>
          <View style={s.inputCol}>
            <Text style={[s.inputLabel, { color: colors.textMuted }]}>{labels.a}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={a}
              onChangeText={setA}
              keyboardType="numeric"
              placeholder={labels.placeholder_a}
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={[s.inputDivider, { backgroundColor: withAlpha(activeMode.color, '30') }]}>
            <Ionicons name={activeMode.icon} size={16} color={activeMode.color} />
          </View>
          <View style={s.inputCol}>
            <Text style={[s.inputLabel, { color: colors.textMuted }]}>{labels.b}</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={b}
              onChangeText={setB}
              keyboardType="numeric"
              placeholder={labels.placeholder_b}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>
      </View>

      {/* ── Result ── */}
      <View style={[s.resultCard, { backgroundColor: withAlpha(activeMode.color, '10'), borderColor: withAlpha(activeMode.color, '30') }]}>
        {result ? (
          <>
            <Text style={[s.resultMain, { color: activeMode.color }]}>
              {result.main}{result.suffix}
            </Text>
            <Text style={[s.resultSub, { color: colors.textSub }]}>{result.sub}</Text>
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: withAlpha(activeMode.color, '18') }]}
              onPress={() => {
                haptics.success();
                history.push({ mode, a, b }, `${result.sub} = ${result.main}${result.suffix}`);
              }}
            >
              <Ionicons name="bookmark-outline" size={13} color={activeMode.color} />
              <Text style={[s.saveBtnText, { color: activeMode.color }]}>Save</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={[s.resultPlaceholder, { color: colors.textMuted }]}>
            Enter values above — result updates live
          </Text>
        )}
      </View>

      {/* ── Quick examples — tappable ── */}
      <Text style={[s.sectionLabel, { color: colors.textMuted }]}>Try an example</Text>
      <View style={s.exGrid}>
        {EXAMPLES[mode].map(ex => (
          <TouchableOpacity
            key={ex.label}
            style={[s.exChip, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => fillExample(ex)}
            activeOpacity={0.7}
          >
            <Ionicons name="flash-outline" size={13} color={activeMode.color} />
            <Text style={[s.exChipText, { color: colors.text }]}>{ex.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── History ── */}
      {history.entries.length > 0 && (
        <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={s.histHeader}>
            <Text style={[s.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>Saved</Text>
            <TouchableOpacity onPress={() => { haptics.warning(); history.clear(); }}>
              <Text style={{ color: ACCENT, fontFamily: Fonts.semibold, fontSize: 12 }}>Clear</Text>
            </TouchableOpacity>
          </View>
          {history.entries.map((entry, idx) => (
            <TouchableOpacity
              key={entry.id}
              style={[s.histRow, idx < history.entries.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => { haptics.tap(); setMode(entry.value.mode); setA(entry.value.a); setB(entry.value.b); }}
            >
              <Text style={[s.histText, { color: colors.text }]} numberOfLines={1}>{entry.label}</Text>
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    // ── Mode tabs ──
    tabStrip: { gap: 8, marginBottom: Spacing.md },
    tab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    tabText: { fontFamily: Fonts.semibold, fontSize: 13 },

    // ── Shared card ──
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },

    // ── Input ──
    inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
    inputCol: { flex: 1, gap: 4 },
    inputLabel: { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
    input: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 22,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    inputDivider: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },

    // ── Result ──
    resultCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    resultMain: { fontSize: 42, fontFamily: Fonts.bold, lineHeight: 48 },
    resultSub: { fontSize: 14, fontFamily: Fonts.medium, marginTop: 4, textAlign: 'center' },
    resultPlaceholder: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center', paddingVertical: Spacing.lg },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 14,
      paddingVertical: 7,
      borderRadius: Radii.pill,
      marginTop: Spacing.md,
    },
    saveBtnText: { fontFamily: Fonts.bold, fontSize: 12 },

    // ── Examples ──
    sectionLabel: { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
    exGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: Spacing.md },
    exChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: Radii.pill,
      borderWidth: 1,
    },
    exChipText: { fontFamily: Fonts.medium, fontSize: 13 },

    // ── History ──
    histHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    histRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
    histText: { flex: 1, fontFamily: Fonts.semibold, fontSize: 13 },
  });
