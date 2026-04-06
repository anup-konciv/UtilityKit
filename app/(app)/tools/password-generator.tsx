import { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, Modal, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';
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
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?/~`',
};

const SYMBOL_GROUPS = [
  { label: 'Common', chars: '!@#$%&*' },
  { label: 'Brackets', chars: '()[]{}' },
  { label: 'Math', chars: '+-=<>^~' },
  { label: 'Punctuation', chars: ';:,._|/`?' },
];

const WORD_LIST = [
  'apple','river','cloud','tiger','brave','ocean','flame','glass','dream','stone',
  'music','green','light','smile','world','quiet','dance','frost','bloom','swift',
  'solar','crane','maple','quest','vivid','pearl','ember','lunar','coral','spark',
  'cedar','noble','azure','blaze','crest','delta','eagle','forge','grain','haven',
  'ivory','jewel','knack','lemon','medal','nexus','olive','plume','radar','sigma',
  'tower','ultra','vapor','wheat','xenon','yacht','zebra','amber','birch','cliff',
];

function getRandomBytes(count: number): number[] {
  const hex = Crypto.getRandomBytes(count);
  return Array.from(hex);
}

function genPassword(
  len: number,
  opts: Record<string, boolean>,
  excludeAmbiguous: boolean,
  customSymbols: string,
): string {
  let cs = '';
  if (opts.upper) cs += CHARSETS.upper;
  if (opts.lower) cs += CHARSETS.lower;
  if (opts.digits) cs += CHARSETS.digits;
  if (opts.symbols) cs += customSymbols || CHARSETS.symbols;
  if (!cs) return '';
  if (excludeAmbiguous) cs = cs.replace(AMBIGUOUS, '');
  if (!cs) return '';

  // Guarantee at least one char from each enabled set (mandatory)
  const mandatory: string[] = [];
  const sets: string[] = [];
  if (opts.upper) sets.push(excludeAmbiguous ? CHARSETS.upper.replace(AMBIGUOUS, '') : CHARSETS.upper);
  if (opts.lower) sets.push(excludeAmbiguous ? CHARSETS.lower.replace(AMBIGUOUS, '') : CHARSETS.lower);
  if (opts.digits) sets.push(excludeAmbiguous ? CHARSETS.digits.replace(AMBIGUOUS, '') : CHARSETS.digits);
  if (opts.symbols) {
    const syms = customSymbols || CHARSETS.symbols;
    sets.push(excludeAmbiguous ? syms.replace(AMBIGUOUS, '') : syms);
  }

  // Pick one mandatory char from each enabled set
  const mandatoryBytes = getRandomBytes(sets.length);
  for (let i = 0; i < sets.length; i++) {
    if (sets[i].length > 0) {
      mandatory.push(sets[i][mandatoryBytes[i] % sets[i].length]);
    }
  }

  // Fill remaining with random chars from combined pool
  const remaining = len - mandatory.length;
  const fillBytes = getRandomBytes(remaining * 2);
  const fill: string[] = [];
  const max = Math.floor(256 / cs.length) * cs.length;
  for (const byte of fillBytes) {
    if (fill.length >= remaining) break;
    if (byte < max) fill.push(cs[byte % cs.length]);
  }
  while (fill.length < remaining) {
    const extra = getRandomBytes(1);
    fill.push(cs[extra[0] % cs.length]);
  }

  // Combine and shuffle
  const all = [...mandatory, ...fill];
  const shuffleBytes = getRandomBytes(all.length);
  for (let i = all.length - 1; i > 0; i--) {
    const j = shuffleBytes[i] % (i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }

  return all.join('');
}

function genPassphrase(wordCount: number, separator: string, capitalize: boolean): string {
  const bytes = getRandomBytes(wordCount);
  const words = bytes.slice(0, wordCount).map(b => {
    const w = WORD_LIST[b % WORD_LIST.length];
    return capitalize ? w.charAt(0).toUpperCase() + w.slice(1) : w;
  });
  return words.join(separator);
}

function strengthInfo(len: number, opts: Record<string, boolean>, customSymbols: string) {
  let csSize = 0;
  if (opts.upper) csSize += 26;
  if (opts.lower) csSize += 26;
  if (opts.digits) csSize += 10;
  if (opts.symbols) csSize += (customSymbols || CHARSETS.symbols).length;
  if (!csSize) return { label: '—', color: '#64748B', pct: 0 };
  const entropy = Math.log2(Math.pow(csSize, len));
  if (entropy < 40) return { label: 'Weak', color: '#EF4444', pct: 20 };
  if (entropy < 60) return { label: 'Fair', color: '#F59E0B', pct: 40 };
  if (entropy < 80) return { label: 'Good', color: '#3B82F6', pct: 65 };
  if (entropy < 100) return { label: 'Strong', color: '#10B981', pct: 85 };
  return { label: 'Very Strong', color: '#059669', pct: 100 };
}

function passphraseStrength(wordCount: number) {
  const entropy = Math.log2(Math.pow(WORD_LIST.length, wordCount));
  if (entropy < 40) return { label: 'Weak', color: '#EF4444', pct: 20 };
  if (entropy < 60) return { label: 'Fair', color: '#F59E0B', pct: 40 };
  if (entropy < 80) return { label: 'Good', color: '#3B82F6', pct: 65 };
  return { label: 'Strong', color: '#10B981', pct: 100 };
}

type HistoryItem = { password: string; timestamp: number };
type SavedItem = { id: string; label: string; password: string; createdAt: number };

const LEN_STEPS = [8, 12, 16, 20, 24, 32, 48, 64];
const WORD_COUNTS = [3, 4, 5, 6, 7, 8];
const SEPARATORS = ['-', '.', '_', ' '];

type Mode = 'password' | 'passphrase';
type Tab = 'generate' | 'saved';

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export default function PasswordGeneratorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [tab, setTab] = useState<Tab>('generate');
  const [mode, setMode] = useState<Mode>('password');
  const [lenIdx, setLenIdx] = useState(2);
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: false });
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Custom symbols
  const [customSymbols, setCustomSymbols] = useState(CHARSETS.symbols);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [selectedSymbols, setSelectedSymbols] = useState<Set<string>>(new Set(CHARSETS.symbols.split('')));

  // Passphrase settings
  const [wordCount, setWordCount] = useState(4);
  const [separator, setSeparator] = useState('-');
  const [capitalizeWords, setCapitalizeWords] = useState(true);

  // Saved passwords
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveLabel, setSaveLabel] = useState('');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadJSON<HistoryItem[]>(KEYS.passwordHistory, []).then(setHistory);
    loadJSON<SavedItem[]>(KEYS.savedPasswords, []).then(setSaved);
  }, []);

  const len = LEN_STEPS[lenIdx];
  const strength = useMemo(() =>
    mode === 'password' ? strengthInfo(len, opts, customSymbols) : passphraseStrength(wordCount),
    [mode, len, opts, wordCount, customSymbols],
  );

  const generate = useCallback(() => {
    const enabledCount = Object.values(opts).filter(Boolean).length;
    if (mode === 'password' && enabledCount === 0) {
      Alert.alert('No character types', 'Enable at least one character type.');
      return;
    }
    if (mode === 'password' && len < enabledCount) {
      Alert.alert('Length too short', `Password length must be at least ${enabledCount} to include all selected character types.`);
      return;
    }
    const pw = mode === 'password'
      ? genPassword(len, opts, excludeAmbiguous, customSymbols)
      : genPassphrase(wordCount, separator, capitalizeWords);
    setPassword(pw);
    setCopied(false);
    if (pw) {
      const next = [{ password: pw, timestamp: Date.now() }, ...history].slice(0, 20);
      setHistory(next);
      saveJSON(KEYS.passwordHistory, next);
    }
  }, [mode, len, opts, excludeAmbiguous, wordCount, separator, capitalizeWords, history, customSymbols]);

  const copy = async (text?: string) => {
    const pw = text ?? password;
    if (!pw) return;
    await Clipboard.setStringAsync(pw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    Alert.alert('Clear History', 'Delete all password history?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setHistory([]); saveJSON(KEYS.passwordHistory, []); } },
    ]);
  };

  const savePassword = () => {
    if (!password) return;
    const item: SavedItem = { id: uid(), label: saveLabel.trim() || 'Untitled', password, createdAt: Date.now() };
    const next = [item, ...saved];
    setSaved(next);
    saveJSON(KEYS.savedPasswords, next);
    setSaveLabel('');
    setShowSaveModal(false);
  };

  const deleteSaved = (id: string) => {
    Alert.alert('Delete', 'Remove this saved password?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        const next = saved.filter(s => s.id !== id);
        setSaved(next);
        saveJSON(KEYS.savedPasswords, next);
      }},
    ]);
  };

  const toggleReveal = (id: string) => {
    setRevealedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const applySymbolSelection = () => {
    const syms = Array.from(selectedSymbols).join('');
    setCustomSymbols(syms || CHARSETS.symbols);
    setShowSymbolPicker(false);
  };

  const toggleSymbol = (ch: string) => {
    setSelectedSymbols(prev => {
      const next = new Set(prev);
      if (next.has(ch)) next.delete(ch);
      else next.add(ch);
      return next;
    });
  };

  return (
    <ScreenShell title="Password Generator" accentColor={ACCENT}>
      {/* Top Tabs */}
      <View style={styles.tabRow}>
        {([
          { k: 'generate' as const, ic: 'key-outline', lb: 'Generate' },
          { k: 'saved' as const, ic: 'bookmark-outline', lb: `Saved (${saved.length})` },
        ]).map(t => (
          <TouchableOpacity
            key={t.k}
            style={[styles.tabBtn, tab === t.k && { backgroundColor: ACCENT }]}
            onPress={() => setTab(t.k)}
          >
            <Ionicons name={t.ic as any} size={15} color={tab === t.k ? '#fff' : colors.textMuted} />
            <Text style={[styles.tabBtnText, { color: tab === t.k ? '#fff' : colors.textMuted }]}>{t.lb}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'generate' ? (
        <>
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
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: ACCENT + '20' }]}
                onPress={() => { if (password) { setSaveLabel(''); setShowSaveModal(true); } }}
                disabled={!password}
              >
                <Ionicons name="bookmark-outline" size={18} color={password ? ACCENT : colors.textMuted} />
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
                  <Text style={[styles.lenValue, { color: ACCENT }]}>{len}</Text>
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
                  { key: 'upper', label: 'Uppercase (A–Z)', example: 'ABC', mandatory: true },
                  { key: 'lower', label: 'Lowercase (a–z)', example: 'abc', mandatory: true },
                  { key: 'digits', label: 'Digits (0–9)', example: '123', mandatory: true },
                  { key: 'symbols', label: 'Symbols', example: customSymbols.slice(0, 12) + (customSymbols.length > 12 ? '…' : ''), mandatory: true },
                ] as const).map((opt) => (
                  <View key={opt.key} style={[styles.optRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.optLabel, { color: colors.text }]}>{opt.label}</Text>
                        {opts[opt.key] && (
                          <View style={[styles.mandatoryBadge, { backgroundColor: '#10B981' + '20' }]}>
                            <Text style={[styles.mandatoryText, { color: '#10B981' }]}>1+ required</Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.optExample, { color: colors.textMuted }]}>{opt.example}</Text>
                        {opt.key === 'symbols' && opts.symbols && (
                          <TouchableOpacity onPress={() => setShowSymbolPicker(true)}>
                            <Text style={[styles.customizeLink, { color: ACCENT }]}>Customize</Text>
                          </TouchableOpacity>
                        )}
                      </View>
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
                  <Text style={[styles.lenValue, { color: ACCENT }]}>{wordCount}</Text>
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

              {/* Passphrase options */}
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

                <View style={[styles.optRow, { borderBottomWidth: 0, marginTop: Spacing.sm }]}>
                  <Text style={[styles.optLabel, { color: colors.text }]}>Capitalize Words</Text>
                  <Switch
                    value={capitalizeWords}
                    onValueChange={setCapitalizeWords}
                    trackColor={{ true: ACCENT, false: colors.border }}
                    thumbColor="#fff"
                  />
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
                <Text style={styles.label}>History (last 20)</Text>
                {history.length > 0 && (
                  <TouchableOpacity onPress={clearHistory}>
                    <Text style={{ fontSize: 12, fontFamily: Fonts.semibold, color: ACCENT }}>Clear</Text>
                  </TouchableOpacity>
                )}
              </View>
              {history.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No passwords generated yet.</Text>
              ) : (
                history.map((item) => (
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
        </>
      ) : (
        /* ───── Saved Tab ───── */
        <View>
          {saved.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.emptyState}>
                <Ionicons name="bookmark-outline" size={40} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>No saved passwords yet</Text>
                <Text style={[styles.emptySubText, { color: colors.textMuted }]}>
                  Generate a password and tap the bookmark icon to save it
                </Text>
              </View>
            </View>
          ) : (
            saved.map(item => {
              const isRevealed = revealedIds.has(item.id);
              return (
                <View key={item.id} style={[styles.savedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.savedHeader}>
                    <Ionicons name="bookmark" size={16} color={ACCENT} />
                    <Text style={[styles.savedLabel, { color: colors.text }]}>{item.label}</Text>
                    <Text style={[styles.savedDate, { color: colors.textMuted }]}>
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <View style={styles.savedPwRow}>
                    <Text style={[styles.savedPw, { color: colors.text }]} numberOfLines={1} selectable={isRevealed}>
                      {isRevealed ? item.password : '•'.repeat(Math.min(item.password.length, 20))}
                    </Text>
                  </View>
                  <View style={styles.savedActions}>
                    <TouchableOpacity style={[styles.savedBtn, { backgroundColor: ACCENT + '15' }]} onPress={() => toggleReveal(item.id)}>
                      <Ionicons name={isRevealed ? 'eye-off-outline' : 'eye-outline'} size={16} color={ACCENT} />
                      <Text style={[styles.savedBtnText, { color: ACCENT }]}>{isRevealed ? 'Hide' : 'Show'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.savedBtn, { backgroundColor: ACCENT + '15' }]} onPress={() => copy(item.password)}>
                      <Ionicons name="copy-outline" size={16} color={ACCENT} />
                      <Text style={[styles.savedBtnText, { color: ACCENT }]}>Copy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.savedBtn, { backgroundColor: '#EF4444' + '15' }]} onPress={() => deleteSaved(item.id)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}

      {/* Save Modal */}
      <Modal visible={showSaveModal} transparent animationType="fade" onRequestClose={() => setShowSaveModal(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Save Password</Text>
            <Text style={[styles.modalPwPreview, { color: ACCENT }]} numberOfLines={2}>{password}</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Label</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={saveLabel}
              onChangeText={setSaveLabel}
              placeholder="e.g. Gmail, Netflix, Bank..."
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowSaveModal(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={savePassword}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Symbol Picker Modal */}
      <Modal visible={showSymbolPicker} transparent animationType="fade" onRequestClose={() => setShowSymbolPicker(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalCard, { backgroundColor: colors.bg }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Symbols</Text>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              Tap to toggle individual symbols
            </Text>
            {SYMBOL_GROUPS.map(group => (
              <View key={group.label} style={{ marginBottom: Spacing.md }}>
                <Text style={[styles.symbolGroupLabel, { color: colors.textMuted }]}>{group.label}</Text>
                <View style={styles.symbolGrid}>
                  {group.chars.split('').map(ch => (
                    <TouchableOpacity
                      key={ch}
                      style={[
                        styles.symbolChip,
                        { borderColor: colors.border },
                        selectedSymbols.has(ch) && { backgroundColor: ACCENT, borderColor: ACCENT },
                      ]}
                      onPress={() => toggleSymbol(ch)}
                    >
                      <Text style={[
                        styles.symbolChipText,
                        { color: selectedSymbols.has(ch) ? '#fff' : colors.text },
                      ]}>{ch}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.md }}>
              <TouchableOpacity onPress={() => setSelectedSymbols(new Set(CHARSETS.symbols.split('')))}>
                <Text style={[styles.customizeLink, { color: ACCENT }]}>Select All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setSelectedSymbols(new Set())}>
                <Text style={[styles.customizeLink, { color: ACCENT }]}>Clear All</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalBtns}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.surface }]} onPress={() => setShowSymbolPicker(false)}>
                <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: ACCENT }]} onPress={applySymbolSelection}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    tabRow: { flexDirection: 'row', borderRadius: Radii.lg, borderWidth: 1, borderColor: c.border, padding: 3, gap: 3, marginBottom: Spacing.lg, backgroundColor: c.card },
    tabBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: Radii.md },
    tabBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    modeRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    modeBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: c.border,
    },
    modeBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    outputBox: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    passwordText: { fontSize: 18, fontFamily: 'monospace', letterSpacing: 1.5, lineHeight: 28, marginBottom: Spacing.md },
    outputActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
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
    mandatoryBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: Radii.pill },
    mandatoryText: { fontSize: 9, fontFamily: Fonts.bold },
    customizeLink: { fontSize: 11, fontFamily: Fonts.semibold },
    generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    generateText: { fontSize: 16, fontFamily: Fonts.bold, color: '#fff' },
    historyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 10, borderBottomWidth: 1 },
    historyPw: { flex: 1, fontSize: 13, fontFamily: 'monospace' },
    historyTime: { fontSize: 11, fontFamily: Fonts.regular },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
    emptyText: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', paddingVertical: Spacing.sm },
    emptySubText: { fontSize: 12, fontFamily: Fonts.regular, textAlign: 'center' },
    // Saved passwords
    savedCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    savedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
    savedLabel: { fontSize: 15, fontFamily: Fonts.bold, flex: 1 },
    savedDate: { fontSize: 11, fontFamily: Fonts.regular },
    savedPwRow: { backgroundColor: c.surface, borderRadius: Radii.md, padding: Spacing.md, marginBottom: Spacing.md },
    savedPw: { fontSize: 14, fontFamily: 'monospace', letterSpacing: 1 },
    savedActions: { flexDirection: 'row', gap: Spacing.sm },
    savedBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radii.md },
    savedBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    // Modals
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    modalBg: { flex: 1, backgroundColor: '#00000066', justifyContent: 'center', padding: Spacing.xl },
    modalCard: { borderRadius: Radii.xl, padding: Spacing.xl },
    modalTitle: { fontSize: 18, fontFamily: Fonts.bold, marginBottom: Spacing.md },
    modalPwPreview: { fontSize: 14, fontFamily: 'monospace', letterSpacing: 1, marginBottom: Spacing.lg, lineHeight: 22 },
    modalInput: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 15, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    modalBtns: { flexDirection: 'row', gap: Spacing.md },
    modalBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.md, alignItems: 'center' },
    modalBtnText: { fontSize: 15, fontFamily: Fonts.bold },
    // Symbol picker
    symbolGroupLabel: { fontSize: 11, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.xs },
    symbolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    symbolChip: { width: 38, height: 38, borderRadius: Radii.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
    symbolChipText: { fontSize: 16, fontFamily: 'monospace' },
  });
