import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

const ACCENT = '#0EA5E9';

type ParseResult = { valid: boolean; formatted: string; error: string; stats: { keys: number; depth: number; type: string } | null };

function analyzeJSON(input: string): ParseResult {
  const trimmed = input.trim();
  if (!trimmed) return { valid: false, formatted: '', error: '', stats: null };

  try {
    const parsed = JSON.parse(trimmed);
    const formatted = JSON.stringify(parsed, null, 2);

    // Count keys and depth
    let keys = 0;
    let maxDepth = 0;
    function walk(obj: any, depth: number) {
      if (depth > maxDepth) maxDepth = depth;
      if (obj && typeof obj === 'object') {
        if (Array.isArray(obj)) {
          obj.forEach(v => walk(v, depth + 1));
        } else {
          const k = Object.keys(obj);
          keys += k.length;
          k.forEach(key => walk(obj[key], depth + 1));
        }
      }
    }
    walk(parsed, 0);

    const type = Array.isArray(parsed) ? 'Array' : typeof parsed === 'object' && parsed !== null ? 'Object' : typeof parsed;

    return { valid: true, formatted, error: '', stats: { keys, depth: maxDepth, type } };
  } catch (e: any) {
    return { valid: false, formatted: '', error: e.message ?? 'Invalid JSON', stats: null };
  }
}

export default function JsonFormatterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indentSize, setIndentSize] = useState(2);
  const [copied, setCopied] = useState(false);
  // Persisted snippets the user wants to come back to.
  const history = useToolHistory<{ input: string }>('json-formatter', { max: 10 });

  const analysis = useMemo(() => analyzeJSON(input), [input]);

  const format = useCallback(() => {
    if (!input.trim()) return;
    try {
      const parsed = JSON.parse(input.trim());
      setOutput(JSON.stringify(parsed, null, indentSize));
    } catch {
      setOutput('');
    }
  }, [input, indentSize]);

  const minify = useCallback(() => {
    if (!input.trim()) return;
    try {
      const parsed = JSON.parse(input.trim());
      setOutput(JSON.stringify(parsed));
    } catch {
      setOutput('');
    }
  }, [input]);

  const sortKeys = useCallback(() => {
    if (!input.trim()) return;
    try {
      const parsed = JSON.parse(input.trim());
      const sorted = JSON.parse(JSON.stringify(parsed, Object.keys(parsed).sort(), indentSize));
      setOutput(JSON.stringify(sorted, null, indentSize));
    } catch {
      setOutput('');
    }
  }, [input, indentSize]);

  const copy = useCallback(async () => {
    const text = output || input;
    if (!text) return;
    await Clipboard.setStringAsync(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output, input]);

  const paste = useCallback(async () => {
    const text = await Clipboard.getStringAsync();
    if (text) setInput(text);
  }, []);

  const loadSample = () => {
    const sample = JSON.stringify({
      name: "UtilityKit",
      version: "1.0.0",
      tools: 34,
      categories: ["Math", "Finance", "Health", "Utility"],
      settings: { theme: "dark", haptics: true }
    }, null, 2);
    setInput(sample);
    setOutput('');
  };

  return (
    <ScreenShell title="JSON Formatter" accentColor={ACCENT}>
      {/* Input */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.secHeader}>
          <Text style={styles.secTitle}>Input</Text>
          <View style={styles.secActions}>
            <TouchableOpacity style={[styles.miniBtn, { backgroundColor: ACCENT + '18' }]} onPress={paste}>
              <Ionicons name="clipboard-outline" size={14} color={ACCENT} />
              <Text style={[styles.miniBtnText, { color: ACCENT }]}>Paste</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.miniBtn, { backgroundColor: ACCENT + '18' }]} onPress={loadSample}>
              <Ionicons name="code-outline" size={14} color={ACCENT} />
              <Text style={[styles.miniBtnText, { color: ACCENT }]}>Sample</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TextInput
          style={[styles.textArea, { backgroundColor: colors.inputBg, borderColor: analysis.valid ? ACCENT + '40' : input.trim() ? '#EF444440' : colors.border, color: colors.text }]}
          value={input}
          onChangeText={v => { setInput(v); setOutput(''); }}
          placeholder='Paste or type JSON here...'
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />

        {/* Validation status */}
        {input.trim() !== '' && (
          <View style={styles.statusRow}>
            <Ionicons
              name={analysis.valid ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={analysis.valid ? '#10B981' : '#EF4444'}
            />
            <Text style={[styles.statusText, { color: analysis.valid ? '#10B981' : '#EF4444' }]}>
              {analysis.valid ? 'Valid JSON' : analysis.error}
            </Text>
          </View>
        )}
      </View>

      {/* Stats */}
      {analysis.stats && (
        <View style={styles.statsRow}>
          {[
            { label: 'Type', value: analysis.stats.type },
            { label: 'Keys', value: String(analysis.stats.keys) },
            { label: 'Depth', value: String(analysis.stats.depth) },
            { label: 'Size', value: `${input.length}B` },
          ].map(s => (
            <View key={s.label} style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statValue, { color: ACCENT }]}>{s.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Indent selector */}
      <View style={styles.optRow}>
        <Text style={[styles.optLabel, { color: colors.textMuted }]}>Indent</Text>
        <View style={styles.optBtns}>
          {[2, 4].map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.optBtn, indentSize === n && { backgroundColor: ACCENT, borderColor: ACCENT }]}
              onPress={() => setIndentSize(n)}
            >
              <Text style={[styles.optBtnText, { color: indentSize === n ? '#fff' : colors.textMuted }]}>{n} spaces</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: analysis.valid ? ACCENT : colors.surface, borderColor: analysis.valid ? ACCENT : colors.border }]}
          onPress={() => { format(); haptics.success(); }}
          disabled={!analysis.valid}
        >
          <Ionicons name="code-outline" size={18} color={analysis.valid ? '#fff' : colors.textMuted} />
          <Text style={[styles.actionBtnText, { color: analysis.valid ? '#fff' : colors.textMuted }]}>Format</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: analysis.valid ? '#F97316' : colors.surface, borderColor: analysis.valid ? '#F97316' : colors.border }]}
          onPress={() => { minify(); haptics.success(); }}
          disabled={!analysis.valid}
        >
          <Ionicons name="contract-outline" size={18} color={analysis.valid ? '#fff' : colors.textMuted} />
          <Text style={[styles.actionBtnText, { color: analysis.valid ? '#fff' : colors.textMuted }]}>Minify</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: analysis.valid ? '#8B5CF6' : colors.surface, borderColor: analysis.valid ? '#8B5CF6' : colors.border }]}
          onPress={() => { sortKeys(); haptics.success(); }}
          disabled={!analysis.valid}
        >
          <Ionicons name="swap-vertical-outline" size={18} color={analysis.valid ? '#fff' : colors.textMuted} />
          <Text style={[styles.actionBtnText, { color: analysis.valid ? '#fff' : colors.textMuted }]}>Sort</Text>
        </TouchableOpacity>
        {analysis.valid && (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981', borderColor: '#10B981' }]}
            onPress={() => {
              haptics.success();
              const preview = input.replace(/\s+/g, ' ').slice(0, 60);
              history.push({ input }, `${analysis.stats?.type ?? 'JSON'} • ${analysis.stats?.keys ?? 0} keys • ${preview}…`);
            }}
          >
            <Ionicons name="bookmark-outline" size={18} color="#fff" />
            <Text style={[styles.actionBtnText, { color: '#fff' }]}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.entries.length > 0 && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.secHeader}>
            <Text style={styles.secTitle}>Saved Snippets</Text>
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
                setInput(entry.value.input);
                setOutput('');
              }}
            >
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
              <Text style={[{ color: colors.text, fontFamily: Fonts.semibold, fontSize: 12, flex: 1 }]} numberOfLines={2}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Output */}
      {!!output && (
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.secHeader}>
            <Text style={styles.secTitle}>Output</Text>
            <TouchableOpacity style={[styles.miniBtn, { backgroundColor: copied ? '#10B981' : ACCENT + '18' }]} onPress={copy}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color={copied ? '#fff' : ACCENT} />
              <Text style={[styles.miniBtnText, { color: copied ? '#fff' : ACCENT }]}>{copied ? 'Copied!' : 'Copy'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={[styles.outputScroll, { backgroundColor: colors.inputBg, borderColor: ACCENT + '40' }]} nestedScrollEnabled>
            <Text style={[styles.outputText, { color: colors.text }]} selectable>{output}</Text>
          </ScrollView>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    section: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    secHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    secTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
    secActions: { flexDirection: 'row', gap: 8 },
    miniBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.md },
    miniBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    textArea: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 13, fontFamily: 'monospace', minHeight: 140, maxHeight: 250, lineHeight: 20 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.sm },
    statusText: { fontSize: 12, fontFamily: Fonts.medium },
    statsRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    statBox: { flex: 1, borderRadius: Radii.md, borderWidth: 1, padding: Spacing.sm, alignItems: 'center' },
    statValue: { fontSize: 16, fontFamily: Fonts.bold },
    statLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    optRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
    optLabel: { fontSize: 13, fontFamily: Fonts.medium },
    optBtns: { flexDirection: 'row', gap: 8 },
    optBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: Radii.md, borderWidth: 1.5, borderColor: c.border },
    optBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    actionRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    actionBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 6, paddingVertical: 12, borderRadius: Radii.md, borderWidth: 1,
    },
    actionBtnText: { fontSize: 13, fontFamily: Fonts.bold },
    outputScroll: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, maxHeight: 300 },
    outputText: { fontSize: 13, fontFamily: 'monospace', lineHeight: 20 },
  });
