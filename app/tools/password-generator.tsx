import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, FlatList } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EF4444';

const AMBIGUOUS = /[0OoIl1|]/g;

const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

const WORD_LIST = [
  'apple','river','cloud','tiger','brave','ocean','flame','glass','dream','stone',
  'music','green','light','smile','world','quiet','dance','frost','bloom','swift',
  'solar','crane','maple','quest','vivid','pearl','ember','lunar','coral','spark',
  'cedar','noble','azure','blaze','crest','delta','eagle','forge','grain','haven',
  'ivory','jewel','knack','lemon','medal','nexus','olive','plume','radar','sigma',
  'tower','ultra','vapor','wheat','xenon','yacht','zebra','amber','birch','cliff',
];

function genPassword(len: number, opts: Record<string, boolean>, excludeAmbiguous: boolean): string {
  let cs = '';
  if (opts.upper) cs += CHARSETS.upper;
  if (opts.lower) cs += CHARSETS.lower;
  if (opts.digits) cs += CHARSETS.digits;
  if (opts.symbols) cs += CHARSETS.symbols;
  if (!cs) return '';
  if (excludeAmbiguous) cs = cs.replace(AMBIGUOUS, '');
  if (!cs) return '';
  const arr = new Uint8Array(len * 2);
  crypto.getRandomValues(arr);
  let result = '';
  const max = Math.floor(256 / cs.length) * cs.length;
  for (const byte of arr) {
    if (result.length >= len) break;
    if (byte < max) result += cs[byte % cs.length];
  }
  while (result.length < len) result += cs[Math.floor(Math.random() * cs.length)];
  return result;
}

function genPassphrase(wordCount: number, separator: string): string {
  const words: string[] = [];
  const arr = new Uint8Array(wordCount);
  crypto.getRandomValues(arr);
  for (let i = 0; i < wordCount; i++) {
    words.push(WORD_LIST[arr[i] % WORD_LIST.length]);
  }
  return words.join(separator);
}

function strengthInfo(len: number, opts: Record<string, boolean>) {
  let csSize = 0;
  if (opts.upper) csSize += 26;
  if (opts.lower) csSize += 26;
  if (opts.digits) csSize += 10;
  if (opts.symbols) csSize += 32;
  if (!csSize) return { label: '—', color: '#64748B', pct: 0 };
  const entropy = Math.log2(Math.pow(csSize, len));
  if (entropy < 40) return { label: 'Weak', color: '#EF4444', pct: 25 };
  if (entropy < 60) return { label: 'Fair', color: '#F59E0B', pct: 50 };
  if (entropy < 80) return { label: 'Good', color: '#3B82F6', pct: 75 };
  return { label: 'Strong', color: '#10B981', pct: 100 };
}

function passphraseStrength(wordCount: number) {
  const entropy = Math.log2(Math.pow(WORD_LIST.length, wordCount));
  if (entropy < 40) return { label: 'Weak', color: '#EF4444', pct: 25 };
  if (entropy < 60) return { label: 'Fair', color: '#F59E0B', pct: 50 };
  if (entropy < 80) return { label: 'Good', color: '#3B82F6', pct: 75 };
  return { label: 'Strong', color: '#10B981', pct: 100 };
}

type HistoryItem = { password: string; timestamp: number };

const LEN_STEPS = [8, 12, 16, 20, 24, 32, 48, 64];
const WORD_COUNTS = [3, 4, 5, 6, 7, 8];
const SEPARATORS = ['-', '.', '_', ' '];

type Mode = 'password' | 'passphrase';

export default function PasswordGeneratorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [mode, setMode] = useState<Mode>('password');
  const [lenIdx, setLenIdx] = useState(2);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: false });
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Passphrase settings
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');

  useEffect(() => {
    loadJSON<HistoryItem[]>(KEYS.passwordHistory, []).then(setHistory);
  }, []);

  const len = LEN_STEPS[lenIdx];
  const strength = useMemo(() =>
    mode === 'password' ? strengthInfo(len, opts) : passphraseStrength(wordCount),
    [mode, len, opts, wordCount],
  );

  const generate = useCallback(() => {
    const pw = mode === 'password'
      ? genPassword(len, opts, excludeAmbiguous)
      : genPassphrase(wordCount, separator);
    setPassword(pw);
    setCopied(false);
    if (pw) {
      const next = [{ password: pw, timestamp: Date.now() }, ...history].slice(0, 10);
      setHistory(next);
      saveJSON(KEYS.passwordHistory, next);
    }
  }, [mode, len, opts, excludeAmbiguous, wordCount, separator, history]);

  const copy = async (text?: string) => {
    const pw = text ?? password;
    if (!pw) return;
    await Clipboard.setStringAsync(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    setHistory([]);
    saveJSON(KEYS.passwordHistory, []);
  };

  return (
    <ScreenShell title="Password Generator" accentColor={ACCENT}>
      {/* Mode Toggle */}
      <View style={styles.modeRow}>
        {(['password', 'passphrase'] as const).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, mode === m && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => { setMode(m); setPassword(''); }}
          >
            <Ionicons name={m === 'password' ? 'key-outline' : 'text-outline'} size={16} color={mode === m ? '#fff' : colors.textMuted} />
            <Text style={[styles.modeBtnText, { color: mode === m ? '#fff' : colors.textMuted }]}>
              {m === 'password' ? 'Password' : 'Passphrase'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Output */}
      <View style={[styles.outputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.passwordText, { color: password ? ACCENT : colors.textMuted }]} numberOfLines={3} selectable>
          {password || `Tap Generate to create a ${mode}`}
        </Text>
        <View style={styles.outputActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: copied ? '#10B981' : ACCENT + '20' }]} onPress={() => copy()} disabled={!password}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? '#fff' : ACCENT} />
            <Text style={[styles.actionBtnText, { color: copied ? '#fff' : ACCENT }]}>{copied ? 'Copied!' : 'Copy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT + '20' }]} onPress={generate}>
            <Ionicons name="refresh" size={18} color={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: ACCENT + '20' }]} onPress={() => setShowHistory(!showHistory)}>
            <Ionicons name="time-outline" size={18} color={ACCENT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Strength bar */}
      <View style={[styles.strengthCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.strengthRow}>
          <Text style={styles.label}>Strength</Text>
          <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
        </View>
        <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.barFill, { width: `${strength.pct}%`, backgroundColor: strength.color }]} />
        </View>
      </View>

      {mode === 'password' ? (
        <>
          {/* Length */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.lenRow}>
              <Text style={styles.label}>Length</Text>
              <Text style={[styles.lenValue, { color: colors.accent }]}>{len}</Text>
            </View>
            <View style={styles.lenBtns}>
              {LEN_STEPS.map((l, i) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.lenBtn, lenIdx === i && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                  onPress={() => setLenIdx(i)}
                >
                  <Text style={[styles.lenBtnText, { color: lenIdx === i ? '#fff' : colors.textMuted }]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Options */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.label}>Character Types</Text>
            {([
              { key: 'upper', label: 'Uppercase (A–Z)', example: 'ABC' },
              { key: 'lower', label: 'Lowercase (a–z)', example: 'abc' },
              { key: 'digits', label: 'Digits (0–9)', example: '123' },
              { key: 'symbols', label: 'Symbols (!@#$)', example: '!@#' },
            ] as const).map((opt) => (
              <View key={opt.key} style={[styles.optRow, { borderBottomColor: colors.border }]}>
                <View>
                  <Text style={[styles.optLabel, { color: colors.text }]}>{opt.label}</Text>
                  <Text style={[styles.optExample, { color: colors.textMuted }]}>{opt.example}</Text>
                </View>
                <Switch
                  value={opts[opt.key]}
                  onValueChange={(v) => setOpts((o) => ({ ...o, [opt.key]: v }))}
                  trackColor={{ true: ACCENT, false: colors.border }}
                  thumbColor="#fff"
                />
              </View>
            ))}
            {/* Exclude ambiguous */}
            <View style={[styles.optRow, { borderBottomWidth: 0 }]}>
              <View>
                <Text style={[styles.optLabel, { color: colors.text }]}>Exclude Ambiguous</Text>
                <Text style={[styles.optExample, { color: colors.textMuted }]}>0O o I l 1 |</Text>
              </View>
              <Switch
                value={excludeAmbiguous}
                onValueChange={setExcludeAmbiguous}
                trackColor={{ true: ACCENT, false: colors.border }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </>
      ) : (
        <>
          {/* Word Count */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.lenRow}>
              <Text style={styles.label}>Word Count</Text>
              <Text style={[styles.lenValue, { color: colors.accent }]}>{wordCount}</Text>
            </View>
            <View style={styles.lenBtns}>
              {WORD_COUNTS.map(wc => (
                <TouchableOpacity
                  key={wc}
                  style={[styles.lenBtn, wordCount === wc && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                  onPress={() => setWordCount(wc)}
                >
                  <Text style={[styles.lenBtnText, { color: wordCount === wc ? '#fff' : colors.textMuted }]}>{wc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Separator */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={styles.label}>Separator</Text>
            <View style={styles.lenBtns}>
              {SEPARATORS.map(sep => (
                <TouchableOpacity
                  key={sep}
                  style={[styles.lenBtn, { minWidth: 44 }, separator === sep && { backgroundColor: ACCENT, borderColor: ACCENT }]}
                  onPress={() => setSeparator(sep)}
                >
                  <Text style={[styles.lenBtnText, { color: separator === sep ? '#fff' : colors.textMuted, fontFamily: 'monospace' }]}>
                    {sep === ' ' ? '␣' : sep}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Generate button */}
      <TouchableOpacity style={[styles.generateBtn, { backgroundColor: ACCENT }]} onPress={generate}>
        <Ionicons name="dice-outline" size={20} color="#fff" />
        <Text style={styles.generateText}>Generate {mode === 'password' ? 'Password' : 'Passphrase'}</Text>
      </TouchableOpacity>

      {/* History */}
      {showHistory && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.historyHeader}>
            <Text style={styles.label}>History (last 10)</Text>
            {history.length > 0 && (
              <TouchableOpacity onPress={clearHistory}>
                <Text style={{ fontSize: 12, fontFamily: Fonts.semibold, color: ACCENT }}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          {history.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No passwords generated yet.</Text>
          ) : (
            history.map((item, i) => (
              <TouchableOpacity
                key={item.timestamp}
                style={[styles.historyRow, { borderBottomColor: colors.border }]}
                onPress={() => copy(item.password)}
              >
                <Text style={[styles.historyPw, { color: colors.text }]} numberOfLines={1}>{item.password}</Text>
                <Text style={[styles.historyTime, { color: colors.textMuted }]}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Ionicons name="copy-outline" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    modeBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: c.border,
    },
    modeBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    outputBox: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    passwordText: { fontSize: 18, fontFamily: 'monospace', letterSpacing: 1.5, lineHeight: 28, marginBottom: Spacing.md },
    outputActions: { flexDirection: 'row', gap: Spacing.sm },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.md },
    actionBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    strengthCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    strengthRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
    label: { fontSize: 13, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: Spacing.sm },
    strengthLabel: { fontSize: 13, fontFamily: Fonts.bold },
    barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 4 },
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    lenRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    lenValue: { fontSize: 22, fontFamily: Fonts.bold },
    lenBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    lenBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.md, borderWidth: 1.5, borderColor: c.border },
    lenBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    optRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
    optLabel: { fontSize: 14, fontFamily: Fonts.regular },
    optExample: { fontSize: 11, fontFamily: 'monospace', marginTop: 2 },
    generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radii.xl },
    generateText: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, borderBottomWidth: 1 },
    historyPw: { flex: 1, fontSize: 13, fontFamily: 'monospace' },
    historyTime: { fontSize: 11, fontFamily: Fonts.regular },
    emptyText: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.lg },
  });
