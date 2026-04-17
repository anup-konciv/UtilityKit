import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#0891B2';

function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

const PRESETS = [
  { label: '16:9', w: 16, h: 9, desc: 'Widescreen' },
  { label: '4:3', w: 4, h: 3, desc: 'Classic TV' },
  { label: '1:1', w: 1, h: 1, desc: 'Square' },
  { label: '21:9', w: 21, h: 9, desc: 'Ultrawide' },
  { label: '3:2', w: 3, h: 2, desc: 'DSLR Photo' },
  { label: '9:16', w: 9, h: 16, desc: 'Mobile Story' },
  { label: '5:4', w: 5, h: 4, desc: 'Old Monitor' },
  { label: '2:3', w: 2, h: 3, desc: 'Portrait Photo' },
];

const RESOLUTIONS = [
  { label: '720p HD', w: 1280, h: 720 },
  { label: '1080p FHD', w: 1920, h: 1080 },
  { label: '1440p QHD', w: 2560, h: 1440 },
  { label: '4K UHD', w: 3840, h: 2160 },
  { label: '8K', w: 7680, h: 4320 },
  { label: 'Instagram', w: 1080, h: 1080 },
  { label: 'IG Story', w: 1080, h: 1920 },
  { label: 'Twitter', w: 1200, h: 675 },
  { label: 'YouTube', w: 2560, h: 1440 },
  { label: 'A4 @300dpi', w: 2480, h: 3508 },
];

function fmt(n: number) {
  return n >= 1000000 ? (n / 1000000).toFixed(2) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
}

export default function AspectRatioScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [scaleW, setScaleW] = useState('');
  const [scaleH, setScaleH] = useState('');
  const [lockRatio, setLockRatio] = useState<{ w: number; h: number } | null>(null);

  const w = parseInt(width) || 0;
  const h = parseInt(height) || 0;

  const ratio = useMemo(() => {
    if (w <= 0 || h <= 0) return null;
    const g = gcd(w, h);
    return { rw: w / g, rh: h / g, pixels: w * h, mp: (w * h) / 1000000 };
  }, [w, h]);

  // Scaling
  const scaled = useMemo(() => {
    if (!lockRatio) return null;
    const sw = parseInt(scaleW);
    const sh = parseInt(scaleH);
    if (sw > 0 && !sh) return { w: sw, h: Math.round(sw * lockRatio.h / lockRatio.w) };
    if (sh > 0 && !sw) return { w: Math.round(sh * lockRatio.w / lockRatio.h), h: sh };
    return null;
  }, [lockRatio, scaleW, scaleH]);

  const applyPreset = (pw: number, ph: number) => {
    setWidth(String(pw));
    setHeight(String(ph));
  };

  const applyResolution = (rw: number, rh: number) => {
    setWidth(String(rw));
    setHeight(String(rh));
  };

  // Preview dimensions (max 200px)
  const preview = useMemo(() => {
    if (w <= 0 || h <= 0) return null;
    const maxSize = 180;
    const scale = Math.min(maxSize / w, maxSize / h);
    return { pw: Math.max(w * scale, 20), ph: Math.max(h * scale, 20) };
  }, [w, h]);

  return (
    <ScreenShell title="Aspect Ratio" accentColor={ACCENT}>
      {/* Inputs */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Dimensions</Text>
        <View style={styles.inputRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Width</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={width}
              onChangeText={setWidth}
              keyboardType="number-pad"
              placeholder="1920"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <Ionicons name="close" size={16} color={colors.textMuted} style={{ marginTop: 26 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Height</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
              value={height}
              onChangeText={setHeight}
              keyboardType="number-pad"
              placeholder="1080"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* Result */}
        {ratio && (
          <View style={[styles.resultBox, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '30' }]}>
            <Text style={[styles.ratioText, { color: ACCENT }]}>{ratio.rw}:{ratio.rh}</Text>
            <View style={styles.pixelRow}>
              <Text style={[styles.pixelText, { color: colors.textMuted }]}>{fmt(ratio.pixels)} pixels</Text>
              <Text style={[styles.pixelText, { color: colors.textMuted }]}>{ratio.mp.toFixed(2)} MP</Text>
            </View>
          </View>
        )}

        {/* Preview */}
        {preview && (
          <View style={styles.previewContainer}>
            <View
              style={[styles.previewBox, { width: preview.pw, height: preview.ph, borderColor: ACCENT, backgroundColor: ACCENT + '12' }]}
            >
              <Text style={[styles.previewLabel, { color: ACCENT }]}>{w} x {h}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Presets */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Common Ratios</Text>
        <View style={styles.presetGrid}>
          {PRESETS.map(p => {
            const active = ratio && ratio.rw === p.w && ratio.rh === p.h;
            return (
              <TouchableOpacity
                key={p.label}
                style={[styles.presetItem, { backgroundColor: active ? ACCENT + '20' : colors.glass, borderColor: active ? ACCENT : colors.border }]}
                onPress={() => applyPreset(p.w * 100, p.h * 100)}
              >
                <Text style={[styles.presetLabel, { color: active ? ACCENT : colors.text }]}>{p.label}</Text>
                <Text style={[styles.presetDesc, { color: colors.textMuted }]}>{p.desc}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Scale calculator */}
      {ratio && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.scaleHeader}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 0 }]}>Scale Calculator</Text>
            <TouchableOpacity onPress={() => setLockRatio(lockRatio ? null : { w: ratio.rw, h: ratio.rh })}>
              <Ionicons name={lockRatio ? 'lock-closed' : 'lock-open-outline'} size={16} color={lockRatio ? ACCENT : colors.textMuted} />
            </TouchableOpacity>
          </View>
          {lockRatio ? (
            <>
              <Text style={[styles.lockInfo, { color: colors.textMuted }]}>Ratio locked at {lockRatio.w}:{lockRatio.h}. Enter one dimension:</Text>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>New Width</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                    value={scaleW}
                    onChangeText={t => { setScaleW(t); setScaleH(''); }}
                    keyboardType="number-pad"
                    placeholder="Width"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
                <Text style={[styles.orText, { color: colors.textMuted }]}>or</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>New Height</Text>
                  <TextInput
                    style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
                    value={scaleH}
                    onChangeText={t => { setScaleH(t); setScaleW(''); }}
                    keyboardType="number-pad"
                    placeholder="Height"
                    placeholderTextColor={colors.textMuted}
                  />
                </View>
              </View>
              {scaled && (
                <View style={[styles.scaledResult, { backgroundColor: ACCENT + '10' }]}>
                  <Text style={[styles.scaledText, { color: ACCENT }]}>{scaled.w} x {scaled.h}</Text>
                </View>
              )}
            </>
          ) : (
            <Text style={[styles.lockInfo, { color: colors.textMuted }]}>Tap the lock to fix the ratio and scale to new dimensions.</Text>
          )}
        </View>
      )}

      {/* Common resolutions */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Common Resolutions</Text>
        <View style={styles.resGrid}>
          {RESOLUTIONS.map(r => {
            const g = gcd(r.w, r.h);
            return (
              <TouchableOpacity
                key={r.label}
                style={[styles.resItem, { backgroundColor: colors.glass, borderColor: colors.border }]}
                onPress={() => applyResolution(r.w, r.h)}
              >
                <Text style={[styles.resLabel, { color: colors.text }]}>{r.label}</Text>
                <Text style={[styles.resDims, { color: colors.textMuted }]}>{r.w}x{r.h}</Text>
                <Text style={[styles.resRatio, { color: ACCENT }]}>{r.w / g}:{r.h / g}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    label: { fontSize: 10, fontFamily: Fonts.medium, marginBottom: 4 },
    inputRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    input: { fontSize: 16, fontFamily: Fonts.semibold, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    resultBox: { alignItems: 'center', padding: Spacing.lg, borderRadius: Radii.lg, borderWidth: 1, marginTop: Spacing.lg },
    ratioText: { fontSize: 36, fontFamily: Fonts.bold },
    pixelRow: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.sm },
    pixelText: { fontSize: 12, fontFamily: Fonts.medium },
    previewContainer: { alignItems: 'center', marginTop: Spacing.lg },
    previewBox: { borderWidth: 2, borderRadius: Radii.sm, alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed' },
    previewLabel: { fontSize: 11, fontFamily: Fonts.semibold },
    presetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    presetItem: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', minWidth: 72 },
    presetLabel: { fontSize: 14, fontFamily: Fonts.bold },
    presetDesc: { fontSize: 9, fontFamily: Fonts.regular, marginTop: 2 },
    scaleHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
    lockInfo: { fontSize: 12, fontFamily: Fonts.regular, marginBottom: Spacing.md },
    orText: { fontSize: 12, fontFamily: Fonts.medium, marginTop: 20 },
    scaledResult: { alignItems: 'center', padding: Spacing.md, borderRadius: Radii.lg, marginTop: Spacing.md },
    scaledText: { fontSize: 20, fontFamily: Fonts.bold },
    resGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    resItem: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', minWidth: 80 },
    resLabel: { fontSize: 11, fontFamily: Fonts.bold },
    resDims: { fontSize: 9, fontFamily: Fonts.regular, marginTop: 2 },
    resRatio: { fontSize: 10, fontFamily: Fonts.semibold, marginTop: 2 },
  });
