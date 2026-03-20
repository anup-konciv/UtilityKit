import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '@/lib/color-utils';
import { Fonts, Radii, Spacing } from '@/constants/theme';

function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(((h % 360) + 360) % 360, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

const HARMONIES = [
  { name: 'Complementary', offsets: [180] },
  { name: 'Analogous', offsets: [-30, 30] },
  { name: 'Triadic', offsets: [120, 240] },
  { name: 'Split Comp', offsets: [150, 210] },
];

export default function ColorToolsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [hex, setHexState] = useState('#6366F1');
  const [r, setR] = useState('99');
  const [g, setG] = useState('102');
  const [b, setB] = useState('241');

  const hsl = useMemo(() => rgbToHsl(parseInt(r) || 0, parseInt(g) || 0, parseInt(b) || 0), [r, g, b]);

  const harmonies = useMemo(() =>
    HARMONIES.map(h => ({
      name: h.name,
      colors: h.offsets.map(o => hslToHex(hsl.h + o, hsl.s, hsl.l)),
    })),
    [hsl.h, hsl.s, hsl.l],
  );

  const applyHex = (raw: string) => {
    let h = raw.trim();
    if (!h.startsWith('#')) h = '#' + h;
    if (!/^#[0-9A-Fa-f]{6}$/.test(h)) return;
    const rgb = hexToRgb(h);
    if (!rgb) return;
    setHexState(h.toUpperCase());
    setR(String(rgb.r));
    setG(String(rgb.g));
    setB(String(rgb.b));
  };

  const applyRgb = (nr: string, ng: string, nb: string) => {
    const rv = Math.max(0, Math.min(255, parseInt(nr) || 0));
    const gv = Math.max(0, Math.min(255, parseInt(ng) || 0));
    const bv = Math.max(0, Math.min(255, parseInt(nb) || 0));
    setR(String(rv)); setG(String(gv)); setB(String(bv));
    setHexState(rgbToHex(rv, gv, bv));
  };

  const copyText = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const rgbStr = `rgb(${r}, ${g}, ${b})`;
  const hslStr = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  return (
    <ScreenShell title="Color Tools" accentColor="#EC4899">
      {/* Swatch */}
      <View style={[styles.swatch, { backgroundColor: hex }]}>
        <Text style={[styles.swatchLabel, { color: hsl.l > 55 ? '#000' : '#fff' }]}>{hex}</Text>
      </View>

      {/* HEX */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.secLabel}>HEX</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, flex: 1 }]}
            value={hex}
            onChangeText={applyHex}
            autoCapitalize="characters"
            placeholder="#RRGGBB"
            placeholderTextColor={colors.textMuted}
            maxLength={7}
          />
          <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#EC489920' }]} onPress={() => copyText(hex, 'HEX')}>
            <Ionicons name="copy-outline" size={18} color="#EC4899" />
          </TouchableOpacity>
        </View>
      </View>

      {/* RGB */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.secRow}>
          <Text style={styles.secLabel}>RGB</Text>
          <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#EC489920' }]} onPress={() => copyText(rgbStr, 'RGB')}>
            <Ionicons name="copy-outline" size={18} color="#EC4899" />
          </TouchableOpacity>
        </View>
        <View style={styles.rgbRow}>
          {[
            { ch: 'R', val: r, set: (v: string) => applyRgb(v, g, b), color: '#EF4444' },
            { ch: 'G', val: g, set: (v: string) => applyRgb(r, v, b), color: '#10B981' },
            { ch: 'B', val: b, set: (v: string) => applyRgb(r, g, v), color: '#3B82F6' },
          ].map((ch) => (
            <View key={ch.ch} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.chLabel, { color: ch.color }]}>{ch.ch}</Text>
              <TextInput
                style={[styles.chInput, { backgroundColor: colors.inputBg, borderColor: ch.color + '40', color: colors.text }]}
                value={ch.val}
                onChangeText={ch.set}
                keyboardType="numeric"
                maxLength={3}
                textAlign="center"
              />
              {/* Mini bar */}
              <View style={[styles.chBar, { backgroundColor: colors.border }]}>
                <View style={[styles.chBarFill, { width: `${((parseInt(ch.val) || 0) / 255) * 100}%`, backgroundColor: ch.color }]} />
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.fmtText, { color: colors.textMuted }]}>{rgbStr}</Text>
      </View>

      {/* HSL */}
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.secRow}>
          <Text style={styles.secLabel}>HSL</Text>
          <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#EC489920' }]} onPress={() => copyText(hslStr, 'HSL')}>
            <Ionicons name="copy-outline" size={18} color="#EC4899" />
          </TouchableOpacity>
        </View>
        <View style={styles.hslRow}>
          {[
            { ch: 'H°', val: hsl.h, max: 360 },
            { ch: 'S%', val: hsl.s, max: 100 },
            { ch: 'L%', val: hsl.l, max: 100 },
          ].map((item) => (
            <View key={item.ch} style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.chLabel, { color: '#EC4899' }]}>{item.ch}</Text>
              <Text style={[styles.hslVal, { color: colors.text }]}>{item.val}</Text>
              <View style={[styles.chBar, { backgroundColor: colors.border }]}>
                <View style={[styles.chBarFill, { width: `${(item.val / item.max) * 100}%`, backgroundColor: '#EC4899' }]} />
              </View>
            </View>
          ))}
        </View>
        <Text style={[styles.fmtText, { color: colors.textMuted }]}>{hslStr}</Text>
      </View>

      {/* Palette presets */}
      <Text style={[styles.secLabel, { marginBottom: Spacing.sm }]}>Preset Colors</Text>
      <View style={styles.palette}>
        {['#EF4444','#F97316','#F59E0B','#10B981','#3B82F6','#6366F1','#8B5CF6','#EC4899','#14B8A6','#64748B'].map((clr) => (
          <TouchableOpacity key={clr} style={[styles.paletteDot, { backgroundColor: clr }]} onPress={() => applyHex(clr)} />
        ))}
      </View>

      {/* Color Harmony */}
      <Text style={[styles.secLabel, { marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>Color Harmony</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {harmonies.map((harmony) => (
          <View key={harmony.name} style={styles.harmonyRow}>
            <Text style={[styles.harmonyLabel, { color: colors.text }]}>{harmony.name}</Text>
            <View style={styles.harmonySwatches}>
              <TouchableOpacity style={[styles.harmonySwatch, { backgroundColor: hex }]} disabled />
              {harmony.colors.map((clr) => (
                <TouchableOpacity
                  key={clr}
                  style={[styles.harmonySwatch, { backgroundColor: clr }]}
                  onPress={() => applyHex(clr)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    swatch: { height: 100, borderRadius: Radii.xl, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    swatchLabel: { fontSize: 22, fontFamily: Fonts.bold, letterSpacing: 2 },
    section: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    secRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
    secLabel: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
    row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 16, fontFamily: Fonts.medium },
    copyBtn: { width: 42, height: 42, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    rgbRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
    chLabel: { fontSize: 12, fontFamily: Fonts.bold, marginBottom: 4 },
    chInput: { width: 64, borderWidth: 1.5, borderRadius: Radii.md, paddingVertical: 8, fontSize: 16, fontFamily: Fonts.bold, marginBottom: 6 },
    chBar: { width: '90%', height: 4, borderRadius: 2, overflow: 'hidden' },
    chBarFill: { height: '100%' },
    hslRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
    hslVal: { fontSize: 20, fontFamily: Fonts.bold, marginBottom: 6 },
    fmtText: { fontSize: 12, fontFamily: Fonts.medium, textAlign: 'center', marginTop: Spacing.xs },
    palette: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
    paletteDot: { width: 40, height: 40, borderRadius: Radii.md },
    harmonyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
    harmonyLabel: { fontSize: 14, fontFamily: Fonts.medium },
    harmonySwatches: { flexDirection: 'row', gap: Spacing.sm },
    harmonySwatch: { width: 32, height: 32, borderRadius: 16 },
  });
