import { useState, useMemo, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

const ACCENT = '#1E293B';

const PRESETS = [
  { label: 'URL', placeholder: 'https://example.com', icon: 'globe-outline' },
  { label: 'Text', placeholder: 'Enter any text...', icon: 'text-outline' },
  { label: 'Email', placeholder: 'mailto:user@example.com', icon: 'mail-outline' },
  { label: 'Phone', placeholder: 'tel:+1234567890', icon: 'call-outline' },
  { label: 'Wi-Fi', placeholder: 'WIFI:T:WPA;S:MyNetwork;P:MyPass;;', icon: 'wifi-outline' },
];

const SIZES = [150, 200, 250, 300];

export default function QRGeneratorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [text, setText] = useState('');
  const [presetIdx, setPresetIdx] = useState(0);
  const [sizeIdx, setSizeIdx] = useState(2); // 250
  const [generated, setGenerated] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Persisted recently-generated codes — auto-saved on every Generate.
  // Tap an entry to re-render the same QR.
  const history = useToolHistory<{ text: string; presetIdx: number }>('qr-gen', { max: 10 });

  const size = SIZES[sizeIdx];

  const qrUrl = useMemo(() => {
    if (!generated) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(generated)}&margin=8`;
  }, [generated, size]);

  const generate = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    haptics.success();
    setLoading(true);
    setError('');
    setGenerated(trimmed);
    // Auto-save to history; dedupe by exact text match.
    if (!history.entries.some((e) => e.value.text === trimmed)) {
      const previewLabel = trimmed.length > 50 ? `${trimmed.slice(0, 50)}…` : trimmed;
      history.push({ text: trimmed, presetIdx }, `${PRESETS[presetIdx].label} • ${previewLabel}`);
    }
  }, [text, history, presetIdx]);

  const copyUrl = useCallback(async () => {
    if (!qrUrl) return;
    await Clipboard.setStringAsync(qrUrl);
  }, [qrUrl]);

  return (
    <ScreenShell title="QR Generator" accentColor={ACCENT}>
      {/* Preset Tabs */}
      <View style={styles.presets}>
        {PRESETS.map((p, i) => (
          <TouchableOpacity
            key={p.label}
            style={[styles.presetTab, presetIdx === i && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => { setPresetIdx(i); setText(''); setGenerated(''); setError(''); }}
          >
            <Ionicons name={p.icon as any} size={14} color={presetIdx === i ? '#fff' : colors.textMuted} />
            <Text style={[styles.presetText, { color: presetIdx === i ? '#fff' : colors.textMuted }]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Input */}
      <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          style={[styles.textArea, { color: colors.text }]}
          placeholder={PRESETS[presetIdx].placeholder}
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={v => { setText(v); setError(''); }}
          multiline
          maxLength={1000}
          textAlignVertical="top"
        />
        <Text style={[styles.charCount, { color: colors.textMuted }]}>{text.length}/1000</Text>
      </View>

      {/* Size selector */}
      <View style={styles.sizeRow}>
        <Text style={styles.sizeLabel}>Size</Text>
        <View style={styles.sizeBtns}>
          {SIZES.map((s, i) => (
            <TouchableOpacity
              key={s}
              style={[styles.sizeBtn, sizeIdx === i && { backgroundColor: ACCENT, borderColor: ACCENT }]}
              onPress={() => setSizeIdx(i)}
            >
              <Text style={[styles.sizeBtnText, { color: sizeIdx === i ? '#fff' : colors.textMuted }]}>{s}px</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Generate Button */}
      <TouchableOpacity
        style={[styles.generateBtn, { backgroundColor: text.trim() ? ACCENT : colors.surface, borderWidth: text.trim() ? 0 : 1, borderColor: colors.border }]}
        onPress={generate}
        disabled={!text.trim()}
        activeOpacity={0.85}
      >
        <Ionicons name="qr-code-outline" size={20} color={text.trim() ? '#fff' : colors.textMuted} />
        <Text style={[styles.generateText, { color: text.trim() ? '#fff' : colors.textMuted }]}>Generate QR Code</Text>
      </TouchableOpacity>

      {/* Error */}
      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: '#EF444415', borderColor: '#EF4444' }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* QR Code Output */}
      {!!qrUrl && (
        <View style={[styles.qrCard, { backgroundColor: '#fff', borderColor: colors.border }]}>
          {loading && (
            <View style={styles.qrLoading}>
              <ActivityIndicator size="large" color={ACCENT} />
            </View>
          )}
          <Image
            source={{ uri: qrUrl }}
            style={{ width: size, height: size }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError('Failed to generate QR code.'); setGenerated(''); }}
            resizeMode="contain"
          />
          <Text style={styles.qrDataText} numberOfLines={2}>{generated}</Text>
          <TouchableOpacity style={[styles.copyBtn, { backgroundColor: ACCENT + '15' }]} onPress={copyUrl}>
            <Ionicons name="copy-outline" size={16} color={ACCENT} />
            <Text style={[styles.copyText, { color: ACCENT }]}>Copy Image URL</Text>
          </TouchableOpacity>
        </View>
      )}

      {history.entries.length > 0 && (
        <View style={[styles.inputCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={[{ color: colors.textMuted, fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 1, textTransform: 'uppercase' }]}>Recent</Text>
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
                setPresetIdx(entry.value.presetIdx);
                setText(entry.value.text);
                setGenerated(entry.value.text);
                setError('');
              }}
            >
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
              <Text style={[{ color: colors.text, fontFamily: Fonts.semibold, fontSize: 12, flex: 1 }]} numberOfLines={1}>
                {entry.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    presets: { flexDirection: 'row', gap: 8, marginBottom: Spacing.lg, flexWrap: 'wrap' },
    presetTab: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: Radii.md,
      borderWidth: 1.5,
      borderColor: c.border,
    },
    presetText: { fontSize: 12, fontFamily: Fonts.semibold },
    inputCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
    textArea: { fontSize: 15, fontFamily: Fonts.regular, minHeight: 80, lineHeight: 22 },
    charCount: { fontSize: 11, fontFamily: Fonts.regular, textAlign: 'right', marginTop: 4 },
    sizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
    sizeLabel: { fontSize: 13, fontFamily: Fonts.medium, color: c.textMuted },
    sizeBtns: { flexDirection: 'row', gap: 8 },
    sizeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radii.md, borderWidth: 1.5, borderColor: c.border },
    sizeBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    generateBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingVertical: 14,
      borderRadius: Radii.lg,
      marginBottom: Spacing.lg,
    },
    generateText: { fontSize: 16, fontFamily: Fonts.bold },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md },
    errorText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: '#EF4444' },
    qrCard: {
      borderRadius: Radii.xl,
      borderWidth: 1,
      padding: Spacing.xl,
      alignItems: 'center',
    },
    qrLoading: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
    qrDataText: { fontSize: 12, fontFamily: Fonts.regular, color: '#64748B', marginTop: Spacing.md, textAlign: 'center' },
    copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.md, marginTop: Spacing.md },
    copyText: { fontSize: 13, fontFamily: Fonts.semibold },
  });
