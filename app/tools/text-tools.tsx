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
    { label: 'Reverse', fn: (t) => t.split('').reverse().join('') },
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
  });
