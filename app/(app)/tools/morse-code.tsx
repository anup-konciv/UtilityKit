import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#1E293B';

const CHAR_TO_MORSE: Record<string, string> = {
  A: '·—', B: '—···', C: '—·—·', D: '—··', E: '·', F: '··—·', G: '——·', H: '····',
  I: '··', J: '·———', K: '—·—', L: '·—··', M: '——', N: '—·', O: '———', P: '·——·',
  Q: '——·—', R: '·—·', S: '···', T: '—', U: '··—', V: '···—', W: '·——', X: '—··—',
  Y: '—·——', Z: '——··',
  '0': '—————', '1': '·————', '2': '··———', '3': '···——', '4': '····—',
  '5': '·····', '6': '—····', '7': '——···', '8': '———··', '9': '————·',
  '.': '·—·—·—', ',': '——··——', '?': '··——··', '!': '—·—·——', '/': '—··—·',
  '(': '—·——·', ')': '—·——·—', '&': '·—···', ':': '———···', ';': '—·—·—·',
  '=': '—···—', '+': '·—·—·', '-': '—····—', '_': '··——·—', '"': '·—··—·',
  '@': '·——·—·', ' ': '/',
};

const MORSE_TO_CHAR: Record<string, string> = {};
for (const [ch, morse] of Object.entries(CHAR_TO_MORSE)) {
  if (ch !== ' ') MORSE_TO_CHAR[morse] = ch;
}

function textToMorse(text: string): string {
  return text.toUpperCase().split('').map(ch => CHAR_TO_MORSE[ch] ?? '').filter(Boolean).join(' ');
}

function morseToText(morse: string): string {
  return morse.split(' / ').map(word =>
    word.split(' ').map(code => MORSE_TO_CHAR[code] ?? '').join('')
  ).join(' ');
}

const ALPHA_REF = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NUM_REF = '0123456789'.split('');

export default function MorseCodeScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<'encode' | 'decode'>('encode');
  const [input, setInput] = useState('');
  const [showRef, setShowRef] = useState(false);

  const output = useMemo(() => {
    if (!input.trim()) return '';
    return mode === 'encode' ? textToMorse(input) : morseToText(input);
  }, [input, mode]);

  const charBreakdown = useMemo(() => {
    if (mode !== 'encode' || !input.trim()) return [];
    return input.toUpperCase().split('').map(ch => ({
      char: ch,
      morse: CHAR_TO_MORSE[ch] ?? '',
    })).filter(c => c.morse);
  }, [input, mode]);

  const swap = () => {
    if (output) setInput(output);
    else setInput('');
    setMode(m => m === 'encode' ? 'decode' : 'encode');
  };

  const isDark = colors.bg === '#0B1120';

  return (
    <ScreenShell title="Morse Code" accentColor={isDark ? '#94A3B8' : ACCENT}>
      {/* Mode toggle */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.modeRow}>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'encode' && { backgroundColor: (isDark ? '#94A3B8' : ACCENT) + '22', borderColor: isDark ? '#94A3B8' : ACCENT }]}
            onPress={() => { setMode('encode'); setInput(''); }}
          >
            <Text style={[styles.modeBtnText, { color: mode === 'encode' ? (isDark ? '#94A3B8' : ACCENT) : colors.textMuted }]}>Text → Morse</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={swap} style={[styles.swapBtn, { backgroundColor: (isDark ? '#94A3B8' : ACCENT) + '15' }]}>
            <Ionicons name="swap-horizontal" size={18} color={isDark ? '#94A3B8' : ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, mode === 'decode' && { backgroundColor: (isDark ? '#94A3B8' : ACCENT) + '22', borderColor: isDark ? '#94A3B8' : ACCENT }]}
            onPress={() => { setMode('decode'); setInput(''); }}
          >
            <Text style={[styles.modeBtnText, { color: mode === 'decode' ? (isDark ? '#94A3B8' : ACCENT) : colors.textMuted }]}>Morse → Text</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Input */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textMuted }]}>{mode === 'encode' ? 'Enter Text' : 'Enter Morse Code'}</Text>
        <TextInput
          style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
          value={input}
          onChangeText={setInput}
          placeholder={mode === 'encode' ? 'Type your message...' : 'Use · and — (or . and -)'}
          placeholderTextColor={colors.textMuted}
          multiline
          autoCapitalize={mode === 'encode' ? 'sentences' : 'none'}
        />
        {input.length > 0 && (
          <TouchableOpacity onPress={() => setInput('')} style={styles.clearRow}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Output */}
      {output !== '' && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>{mode === 'encode' ? 'Morse Code' : 'Decoded Text'}</Text>
          <View style={[styles.outputBox, { backgroundColor: (isDark ? '#94A3B8' : ACCENT) + '08', borderColor: (isDark ? '#94A3B8' : ACCENT) + '25' }]}>
            <Text style={[styles.outputText, { color: colors.text }]} selectable>{output}</Text>
          </View>
        </View>
      )}

      {/* Visual morse display */}
      {mode === 'encode' && charBreakdown.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Visual Breakdown</Text>
          <View style={styles.breakdownGrid}>
            {charBreakdown.map((item, i) => (
              <View key={i} style={[styles.breakdownItem, { backgroundColor: colors.glass }]}>
                <Text style={[styles.breakdownChar, { color: colors.text }]}>{item.char}</Text>
                <View style={styles.dotsRow}>
                  {item.morse.split('').map((sym, j) => (
                    sym === '/' ? (
                      <View key={j} style={{ width: 8 }} />
                    ) : (
                      <View
                        key={j}
                        style={[
                          sym === '·' ? styles.dot : styles.dash,
                          { backgroundColor: isDark ? '#94A3B8' : ACCENT },
                        ]}
                      />
                    )
                  ))}
                </View>
                <Text style={[styles.breakdownMorse, { color: colors.textMuted }]}>{item.morse}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* SOS Quick */}
      <TouchableOpacity
        style={[styles.sosBtn, { backgroundColor: '#EF4444' + '15', borderColor: '#EF4444' + '30' }]}
        onPress={() => { setMode('encode'); setInput('SOS'); }}
      >
        <Text style={[styles.sosLabel, { color: '#EF4444' }]}>SOS</Text>
        <Text style={[styles.sosMorse, { color: colors.textMuted }]}>··· ——— ···</Text>
      </TouchableOpacity>

      {/* Reference */}
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setShowRef(!showRef)}
        activeOpacity={0.7}
      >
        <View style={styles.refHeader}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>Morse Code Reference</Text>
          <Ionicons name={showRef ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </View>
        {showRef && (
          <>
            <Text style={[styles.refSubhead, { color: colors.textMuted }]}>Letters</Text>
            <View style={styles.refGrid}>
              {ALPHA_REF.map(ch => (
                <TouchableOpacity
                  key={ch}
                  style={[styles.refItem, { backgroundColor: colors.glass }]}
                  onPress={() => { setMode('encode'); setInput(ch); }}
                >
                  <Text style={[styles.refChar, { color: colors.text }]}>{ch}</Text>
                  <Text style={[styles.refMorse, { color: colors.textMuted }]}>{CHAR_TO_MORSE[ch]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.refSubhead, { color: colors.textMuted }]}>Numbers</Text>
            <View style={styles.refGrid}>
              {NUM_REF.map(ch => (
                <TouchableOpacity
                  key={ch}
                  style={[styles.refItem, { backgroundColor: colors.glass }]}
                  onPress={() => { setMode('encode'); setInput(ch); }}
                >
                  <Text style={[styles.refChar, { color: colors.text }]}>{ch}</Text>
                  <Text style={[styles.refMorse, { color: colors.textMuted }]}>{CHAR_TO_MORSE[ch]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
      </TouchableOpacity>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    label: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
    modeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    modeBtn: { flex: 1, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: 'transparent', alignItems: 'center' },
    modeBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    swapBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    input: { fontSize: 16, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1, minHeight: 80, textAlignVertical: 'top' },
    clearRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: Spacing.sm, alignSelf: 'flex-end' },
    clearText: { fontSize: 11, fontFamily: Fonts.medium },
    outputBox: { padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1 },
    outputText: { fontSize: 18, fontFamily: Fonts.bold, letterSpacing: 2, lineHeight: 28 },
    breakdownGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    breakdownItem: { alignItems: 'center', padding: Spacing.sm, borderRadius: Radii.md, minWidth: 50 },
    breakdownChar: { fontSize: 16, fontFamily: Fonts.bold, marginBottom: 4 },
    dotsRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 4, height: 12 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    dash: { width: 20, height: 6, borderRadius: 3 },
    breakdownMorse: { fontSize: 9, fontFamily: Fonts.regular },
    sosBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.lg },
    sosLabel: { fontSize: 18, fontFamily: Fonts.bold },
    sosMorse: { fontSize: 14, fontFamily: Fonts.medium },
    refHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    refSubhead: { fontSize: 11, fontFamily: Fonts.semibold, marginTop: Spacing.md, marginBottom: Spacing.sm },
    refGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    refItem: { alignItems: 'center', paddingVertical: 6, paddingHorizontal: 8, borderRadius: Radii.sm, minWidth: 44 },
    refChar: { fontSize: 14, fontFamily: Fonts.bold },
    refMorse: { fontSize: 9, fontFamily: Fonts.regular, marginTop: 2 },
  });
