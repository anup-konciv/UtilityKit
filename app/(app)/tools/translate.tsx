import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/components/ThemeProvider';
import ScreenShell from '@/components/ScreenShell';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { translateText, type TranslationProvider } from '@/lib/translate-service';

const ACCENT = '#D946EF';

const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'ar', name: 'Arabic' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'it', name: 'Italian' },
  { code: 'nl', name: 'Dutch' },
  { code: 'tr', name: 'Turkish' },
  { code: 'pl', name: 'Polish' },
  { code: 'sv', name: 'Swedish' },
  { code: 'da', name: 'Danish' },
  { code: 'fi', name: 'Finnish' },
  { code: 'no', name: 'Norwegian' },
  { code: 'th', name: 'Thai' },
  { code: 'vi', name: 'Vietnamese' },
  { code: 'id', name: 'Indonesian' },
  { code: 'ms', name: 'Malay' },
  { code: 'bn', name: 'Bengali' },
  { code: 'ta', name: 'Tamil' },
  { code: 'te', name: 'Telugu' },
  { code: 'mr', name: 'Marathi' },
  { code: 'gu', name: 'Gujarati' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'pa', name: 'Punjabi' },
  { code: 'ur', name: 'Urdu' },
  { code: 'fa', name: 'Persian' },
  { code: 'uk', name: 'Ukrainian' },
  { code: 'cs', name: 'Czech' },
  { code: 'ro', name: 'Romanian' },
  { code: 'hu', name: 'Hungarian' },
  { code: 'el', name: 'Greek' },
  { code: 'he', name: 'Hebrew' },
  { code: 'sk', name: 'Slovak' },
];

type Lang = (typeof LANGUAGES)[number];

// ── Language Picker Modal ──────────────────────────────────────────────────────
function LangPicker({
  visible,
  selected,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  selected: string;
  onSelect: (lang: Lang) => void;
  onClose: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? LANGUAGES.filter(l => l.name.toLowerCase().includes(q) || l.code.includes(q)) : LANGUAGES;
  }, [search]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
      <View style={[ps.backdrop, { backgroundColor: '#00000066' }]}>
        <View style={[ps.sheet, { backgroundColor: colors.bg }]}>
          {/* Header */}
          <View style={[ps.header, { borderBottomColor: colors.border }]}>
            <Text style={[ps.title, { color: colors.text }]}>Select Language</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          {/* Search */}
          <View style={[ps.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[ps.searchInput, { color: colors.text }]}
              placeholder="Search language..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {/* List */}
          <FlatList
            data={filtered}
            keyExtractor={item => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.code === selected;
              return (
                <TouchableOpacity
                  style={[ps.langRow, active && { backgroundColor: ACCENT + '15' }]}
                  onPress={() => { onSelect(item); onClose(); setSearch(''); }}
                >
                  <View style={[ps.codeBadge, { backgroundColor: active ? ACCENT : colors.surface, borderColor: colors.border }]}>
                    <Text style={[ps.codeText, { color: active ? '#fff' : colors.textMuted }]}>
                      {item.code.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[ps.langName, { color: colors.text }]}>{item.name}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const ps = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  title: { fontSize: 16, fontFamily: Fonts.bold },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 40,
    borderRadius: Radii.lg,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, padding: 0 },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    gap: Spacing.md,
  },
  codeBadge: {
    width: 40,
    paddingVertical: 3,
    borderRadius: Radii.sm,
    alignItems: 'center',
    borderWidth: 1,
  },
  codeText: { fontSize: 11, fontFamily: Fonts.bold },
  langName: { flex: 1, fontSize: 15, fontFamily: Fonts.regular },
});

// ── Main Screen ────────────────────────────────────────────────────────────────
export default function TranslateScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [sourceLang, setSourceLang] = useState<Lang>(LANGUAGES[0]); // English
  const [targetLang, setTargetLang] = useState<Lang>(LANGUAGES[1]); // Hindi
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [pickerFor, setPickerFor] = useState<'source' | 'target' | null>(null);
  const [provider, setProvider] = useState<TranslationProvider | null>(null);

  const swapLangs = useCallback(() => {
    setSourceLang(targetLang);
    setTargetLang(sourceLang);
    setInputText(result);
    setResult(inputText);
    setError('');
    setProvider(null);
  }, [sourceLang, targetLang, inputText, result]);

  const translate = useCallback(async () => {
    const text = inputText.trim();
    if (!text) return;
    setLoading(true);
    setError('');
    setResult('');
    try {
      const translated = await translateText(text, sourceLang.code, targetLang.code);
      setResult(translated.text);
      setProvider(translated.provider);
    } catch (translationError) {
      setProvider(null);
      setError(
        translationError instanceof Error
          ? translationError.message
          : 'Network error. Please check your connection.',
      );
    } finally {
      setLoading(false);
    }
  }, [inputText, sourceLang, targetLang]);

  const copyResult = useCallback(async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const charCount = inputText.length;

  return (
    <ScreenShell title="Translate" accentColor={ACCENT}>
      {/* Language Selector Row */}
      <View style={styles.langRow}>
        <TouchableOpacity
          style={[styles.langBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPickerFor('source')}
        >
          <Text style={[styles.langCode, { color: ACCENT }]}>{sourceLang.code.toUpperCase()}</Text>
          <Text style={[styles.langName, { color: colors.text }]} numberOfLines={1}>{sourceLang.name}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.swapBtn, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '40' }]}
          onPress={swapLangs}
        >
          <Ionicons name="swap-horizontal" size={20} color={ACCENT} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.langBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPickerFor('target')}
        >
          <Text style={[styles.langCode, { color: ACCENT }]}>{targetLang.code.toUpperCase()}</Text>
          <Text style={[styles.langName, { color: colors.text }]} numberOfLines={1}>{targetLang.name}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Source Input */}
      <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.textArea, { color: colors.text }]}
          placeholder={`Enter text in ${sourceLang.name}...`}
          placeholderTextColor={colors.textMuted}
          value={inputText}
          onChangeText={v => { setInputText(v); setError(''); setProvider(null); }}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
        <View style={styles.inputFooter}>
          <Text style={[styles.charCount, { color: colors.textMuted }]}>{charCount}/500</Text>
          {inputText.length > 0 && (
            <TouchableOpacity
              onPress={() => { setInputText(''); setResult(''); setError(''); setProvider(null); }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[styles.providerNote, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={16} color={ACCENT} />
        <Text style={[styles.providerNoteText, { color: colors.textMuted }]}>
          Primary source: LibreTranslate-compatible API. Fallback: MyMemory only if the primary provider fails.
        </Text>
      </View>

      {/* Translate Button */}
      <TouchableOpacity
        style={[
          styles.translateBtn,
          { backgroundColor: inputText.trim() ? ACCENT : colors.surface },
          !inputText.trim() && { borderWidth: 1, borderColor: colors.border },
        ]}
        onPress={translate}
        disabled={!inputText.trim() || loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator size="small" color={inputText.trim() ? '#fff' : colors.textMuted} />
        ) : (
          <>
            <Ionicons
              name="language-outline"
              size={18}
              color={inputText.trim() ? '#fff' : colors.textMuted}
            />
            <Text style={[styles.translateBtnText, { color: inputText.trim() ? '#fff' : colors.textMuted }]}>
              Translate
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Error */}
      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: '#EF444415', borderColor: '#EF4444' }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Result */}
      {!!result && (
        <View style={[styles.resultCard, { backgroundColor: ACCENT + '0D', borderColor: ACCENT + '40' }]}>
          <View style={styles.resultHeader}>
            <View style={styles.resultHeaderLeft}>
              <View style={[styles.resultLangBadge, { backgroundColor: ACCENT + '20' }]}>
                <Text style={[styles.resultLangText, { color: ACCENT }]}>{targetLang.name}</Text>
              </View>
              {provider ? (
                <View style={[styles.providerBadge, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.providerBadgeText, { color: colors.textMuted }]}>{provider}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity style={styles.copyBtn} onPress={copyResult}>
              <Ionicons
                name={copied ? 'checkmark-circle' : 'copy-outline'}
                size={18}
                color={copied ? '#10B981' : ACCENT}
              />
              <Text style={[styles.copyText, { color: copied ? '#10B981' : ACCENT }]}>
                {copied ? 'Copied!' : 'Copy'}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.resultText, { color: colors.text }]}>{result}</Text>
        </View>
      )}

      {/* Language Pickers */}
      <LangPicker
        visible={pickerFor === 'source'}
        selected={sourceLang.code}
        onSelect={setSourceLang}
        onClose={() => setPickerFor(null)}
        colors={colors}
      />
      <LangPicker
        visible={pickerFor === 'target'}
        selected={targetLang.code}
        onSelect={setTargetLang}
        onClose={() => setPickerFor(null)}
        colors={colors}
      />
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    langRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    langBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: Radii.lg,
      borderWidth: 1,
    },
    langCode: { fontSize: 12, fontFamily: Fonts.bold },
    langName: { flex: 1, fontSize: 13, fontFamily: Fonts.semibold },
    swapBtn: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    inputCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    textArea: {
      fontSize: 16,
      fontFamily: Fonts.regular,
      minHeight: 120,
      lineHeight: 24,
    },
    inputFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 8,
    },
    charCount: { fontSize: 12, fontFamily: Fonts.regular },
    clearBtn: { padding: 2 },
    providerNote: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      marginBottom: Spacing.md,
    },
    providerNoteText: {
      flex: 1,
      fontSize: 12,
      lineHeight: 18,
      fontFamily: Fonts.medium,
    },
    translateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radii.lg,
      marginBottom: Spacing.lg,
    },
    translateBtnText: { fontSize: 16, fontFamily: Fonts.bold },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1,
      marginBottom: Spacing.md,
    },
    errorText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: '#EF4444', lineHeight: 19 },
    resultCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      padding: Spacing.md,
    },
    resultHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.sm,
      gap: Spacing.sm,
    },
    resultHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' },
    resultLangBadge: {
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: Radii.pill,
    },
    resultLangText: { fontSize: 12, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 0.5 },
    providerBadge: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    providerBadgeText: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
    },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    copyText: { fontSize: 13, fontFamily: Fonts.semibold },
    resultText: { fontSize: 16, fontFamily: Fonts.regular, lineHeight: 26 },
  });
