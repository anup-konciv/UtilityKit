import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#14B8A6';

function toTitleCase(text: string): string {
  return text.replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function toCamelCase(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  return words
    .map((w, i) =>
      i === 0
        ? w.toLowerCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join('');
}

function toSnakeCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/\s+/g, '_')
    .toLowerCase();
}

function toKebabCase(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

function removeDuplicateLines(text: string): string {
  const lines = text.split('\n');
  return [...new Set(lines)].join('\n');
}

function sortLines(text: string, desc = false): string {
  const lines = text.split('\n');
  lines.sort((a, b) => desc ? b.localeCompare(a) : a.localeCompare(b));
  return lines.join('\n');
}

function addLineNumbers(text: string): string {
  return text.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
}

function removeExtraSpaces(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function toBase64(text: string): string {
  try {
    // Use a simple base64 encoding that works in RN
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const bytes = Array.from(text).map(c => c.charCodeAt(0));
    for (let i = 0; i < bytes.length; i += 3) {
      const b1 = bytes[i], b2 = bytes[i + 1] ?? 0, b3 = bytes[i + 2] ?? 0;
      result += chars[b1 >> 2] + chars[((b1 & 3) << 4) | (b2 >> 4)] +
        (i + 1 < bytes.length ? chars[((b2 & 15) << 2) | (b3 >> 6)] : '=') +
        (i + 2 < bytes.length ? chars[b3 & 63] : '=');
    }
    return result;
  } catch { return text; }
}

function fromBase64(text: string): string {
  try {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const cleaned = text.replace(/[^A-Za-z0-9+/=]/g, '');
    let result = '';
    for (let i = 0; i < cleaned.length; i += 4) {
      const b1 = chars.indexOf(cleaned[i]), b2 = chars.indexOf(cleaned[i + 1]);
      const b3 = chars.indexOf(cleaned[i + 2]), b4 = chars.indexOf(cleaned[i + 3]);
      result += String.fromCharCode((b1 << 2) | (b2 >> 4));
      if (b3 !== -1 && cleaned[i + 2] !== '=') result += String.fromCharCode(((b2 & 15) << 4) | (b3 >> 2));
      if (b4 !== -1 && cleaned[i + 3] !== '=') result += String.fromCharCode(((b3 & 3) << 6) | b4);
    }
    return result;
  } catch { return text; }
}

function urlEncode(text: string): string {
  return encodeURIComponent(text);
}

function urlDecode(text: string): string {
  try { return decodeURIComponent(text); } catch { return text; }
}

const LOREM = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

export default function TextToolsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [text, setText] = useState('');
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');

  const stats = useMemo(() => {
    const chars = text.length;
    const words = text.split(/\s+/).filter(Boolean);
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0);
    const readingTime = Math.max(1, Math.ceil(words.length / 200));
    return {
      chars,
      words: words.length,
      sentences: sentences.length,
      paragraphs: paragraphs.length,
      readingTime,
    };
  }, [text]);

  const transforms: { label: string; fn: (t: string) => string }[] = [
    { label: 'UPPERCASE', fn: (t) => t.toUpperCase() },
    { label: 'lowercase', fn: (t) => t.toLowerCase() },
    { label: 'Title Case', fn: (t) => toTitleCase(t) },
    { label: 'camelCase', fn: (t) => toCamelCase(t) },
    { label: 'snake_case', fn: (t) => toSnakeCase(t) },
    { label: 'kebab-case', fn: (t) => toKebabCase(t) },
    { label: 'Reverse', fn: (t) => t.split('').reverse().join('') },
  ];

  const lineTools: { label: string; fn: (t: string) => string }[] = [
    { label: 'Sort A→Z', fn: (t) => sortLines(t) },
    { label: 'Sort Z→A', fn: (t) => sortLines(t, true) },
    { label: 'Remove Dupes', fn: (t) => removeDuplicateLines(t) },
    { label: 'Line Numbers', fn: (t) => addLineNumbers(t) },
    { label: 'Trim Spaces', fn: (t) => removeExtraSpaces(t) },
  ];

  const encodingTools: { label: string; fn: (t: string) => string }[] = [
    { label: 'Base64 Encode', fn: (t) => toBase64(t) },
    { label: 'Base64 Decode', fn: (t) => fromBase64(t) },
    { label: 'URL Encode', fn: (t) => urlEncode(t) },
    { label: 'URL Decode', fn: (t) => urlDecode(t) },
  ];

  const handleCopy = async () => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Text copied to clipboard');
  };

  const handleClear = () => {
    setText('');
    setFindText('');
    setReplaceText('');
  };

  const handleReplaceAll = () => {
    if (!findText) return;
    const updated = text.split(findText).join(replaceText);
    setText(updated);
    const count =
      text.split(findText).length - 1;
    Alert.alert('Replaced', `${count} occurrence${count !== 1 ? 's' : ''} replaced`);
  };

  return (
    <ScreenShell title="Text Tools" accentColor={ACCENT}>
      {/* Text Input */}
      <TextInput
        style={[
          styles.textArea,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
            color: colors.text,
          },
        ]}
        value={text}
        onChangeText={setText}
        placeholder="Enter or paste your text here..."
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
      />

      {/* Stats */}
      <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.statsTitle}>Stats</Text>
        <View style={styles.statsGrid}>
          {[
            { label: 'Characters', value: stats.chars },
            { label: 'Words', value: stats.words },
            { label: 'Sentences', value: stats.sentences },
            { label: 'Paragraphs', value: stats.paragraphs },
            { label: 'Reading Time', value: `${stats.readingTime} min` },
          ].map((item) => (
            <View key={item.label} style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {item.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Transform Buttons */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Transform</Text>
        <View style={styles.transformGrid}>
          {transforms.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.transformBtn, { backgroundColor: ACCENT + '18' }]}
              onPress={() => setText(t.fn(text))}
            >
              <Text style={styles.transformBtnText}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Copy & Clear */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: ACCENT }]}
          onPress={handleCopy}
        >
          <Ionicons name="copy-outline" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>Copy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: colors.error }]}
          onPress={handleClear}
        >
          <Ionicons name="trash-outline" size={18} color="#fff" />
          <Text style={styles.actionBtnText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Line Tools */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Line Tools</Text>
        <View style={styles.transformGrid}>
          {lineTools.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.transformBtn, { backgroundColor: '#8B5CF6' + '18' }]}
              onPress={() => setText(t.fn(text))}
            >
              <Text style={[styles.transformBtnText, { color: '#8B5CF6' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Encoding Tools */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Encode / Decode</Text>
        <View style={styles.transformGrid}>
          {encodingTools.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={[styles.transformBtn, { backgroundColor: '#F97316' + '18' }]}
              onPress={() => setText(t.fn(text))}
            >
              <Text style={[styles.transformBtnText, { color: '#F97316' }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Lorem Ipsum Generator */}
      <TouchableOpacity
        style={[styles.loremBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => setText(LOREM)}
      >
        <Ionicons name="document-text-outline" size={16} color={ACCENT} />
        <Text style={[styles.loremBtnText, { color: ACCENT }]}>Generate Lorem Ipsum</Text>
      </TouchableOpacity>

      {/* Find & Replace */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.sectionTitle}>Find & Replace</Text>
        <TextInput
          style={[
            styles.frInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={findText}
          onChangeText={setFindText}
          placeholder="Find text..."
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={[
            styles.frInput,
            {
              backgroundColor: colors.inputBg,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          value={replaceText}
          onChangeText={setReplaceText}
          placeholder="Replace with..."
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity
          style={[styles.replaceBtn, { backgroundColor: ACCENT }]}
          onPress={handleReplaceAll}
        >
          <Text style={styles.replaceBtnText}>Replace All</Text>
        </TouchableOpacity>
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    textArea: {
      borderWidth: 1.5,
      borderRadius: Radii.lg,
      padding: Spacing.lg,
      fontSize: 15,
      fontFamily: Fonts.regular,
      minHeight: 160,
      maxHeight: 300,
      marginBottom: Spacing.lg,
    },
    statsCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    statsTitle: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    statItem: {
      alignItems: 'center',
      minWidth: 80,
      flex: 1,
    },
    statValue: {
      fontSize: 20,
      fontFamily: Fonts.bold,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: Fonts.medium,
      marginTop: 2,
    },
    section: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.lg,
      marginBottom: Spacing.lg,
    },
    sectionTitle: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      color: c.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: Spacing.md,
    },
    transformGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    transformBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm + 2,
      borderRadius: Radii.md,
    },
    transformBtnText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
      color: ACCENT,
    },
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.md,
      marginBottom: Spacing.lg,
    },
    actionBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
    },
    actionBtnText: {
      fontSize: 14,
      fontFamily: Fonts.bold,
      color: '#fff',
    },
    frInput: {
      borderWidth: 1.5,
      borderRadius: Radii.md,
      padding: Spacing.md,
      fontSize: 14,
      fontFamily: Fonts.medium,
      marginBottom: Spacing.sm,
    },
    replaceBtn: {
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      marginTop: Spacing.xs,
    },
    replaceBtnText: {
      fontSize: 14,
      fontFamily: Fonts.bold,
      color: '#fff',
    },
    loremBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      paddingVertical: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginBottom: Spacing.lg,
    },
    loremBtnText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
  });
