import { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const CHARSETS = {
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?',
};

function genPassword(len: number, opts: Record<string, boolean>): string {
  let cs = '';
  if (opts.upper) cs += CHARSETS.upper;
  if (opts.lower) cs += CHARSETS.lower;
  if (opts.digits) cs += CHARSETS.digits;
  if (opts.symbols) cs += CHARSETS.symbols;
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

const LEN_STEPS = [8, 12, 16, 20, 24, 32, 48, 64];

export default function PasswordGeneratorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [lenIdx, setLenIdx] = useState(2); // default 16
  const [opts, setOpts] = useState({ upper: true, lower: true, digits: true, symbols: false });
  const [password, setPassword] = useState('');
  const [copied, setCopied] = useState(false);

  const len = LEN_STEPS[lenIdx];
  const strength = useMemo(() => strengthInfo(len, opts), [len, opts]);

  const generate = useCallback(() => {
    setPassword(genPassword(len, opts));
    setCopied(false);
  }, [len, opts]);

  const copy = async () => {
    if (!password) return;
    await Clipboard.setStringAsync(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScreenShell title="Password Generator" accentColor="#EF4444">
      {/* Output */}
      <View style={[styles.outputBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.passwordText, { color: password ? '#EF4444' : colors.textMuted }]} numberOfLines={3} selectable>
          {password || 'Tap Generate to create a password'}
        </Text>
        <View style={styles.outputActions}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: copied ? '#10B981' : '#EF444420' }]} onPress={copy} disabled={!password}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={18} color={copied ? '#fff' : '#EF4444'} />
            <Text style={[styles.actionBtnText, { color: copied ? '#fff' : '#EF4444' }]}>{copied ? 'Copied!' : 'Copy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#EF444420' }]} onPress={generate}>
            <Ionicons name="refresh" size={18} color="#EF4444" />
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
              style={[styles.lenBtn, lenIdx === i && { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
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
              trackColor={{ true: '#EF4444', false: colors.border }}
              thumbColor="#fff"
            />
          </View>
        ))}
      </View>

      {/* Generate button */}
      <TouchableOpacity style={[styles.generateBtn, { backgroundColor: '#EF4444' }]} onPress={generate}>
        <Ionicons name="dice-outline" size={20} color="#fff" />
        <Text style={styles.generateText}>Generate Password</Text>
      </TouchableOpacity>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
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
  });
