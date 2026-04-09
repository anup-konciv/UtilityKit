import { useState, useMemo, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, type GestureResponderEvent } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { hexToRgb, rgbToHex, rgbToHsl, hslToRgb } from '@/lib/color-utils';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

function hslToHex(h: number, s: number, l: number): string {
  const rgb = hslToRgb(((h % 360) + 360) % 360, s, l);
  return rgbToHex(rgb.r, rgb.g, rgb.b);
}

// ── HSV conversions for the continuous picker ────────────────────────────────
function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  const sn = s / 100, vn = v / 100;
  const c = vn * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = vn - c;
  let rp: number, gp: number, bp: number;
  if (h < 60)       { rp = c; gp = x; bp = 0; }
  else if (h < 120) { rp = x; gp = c; bp = 0; }
  else if (h < 180) { rp = 0; gp = c; bp = x; }
  else if (h < 240) { rp = 0; gp = x; bp = c; }
  else if (h < 300) { rp = x; gp = 0; bp = c; }
  else              { rp = c; gp = 0; bp = x; }
  return {
    r: Math.round((rp + m) * 255),
    g: Math.round((gp + m) * 255),
    b: Math.round((bp + m) * 255),
  };
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = 60 * (((gn - bn) / d + 6) % 6);
    else if (max === gn) h = 60 * ((bn - rn) / d + 2);
    else h = 60 * ((rn - gn) / d + 4);
  }
  const s = max === 0 ? 0 : (d / max) * 100;
  const v = max * 100;
  return { h: Math.round(h), s: Math.round(s), v: Math.round(v) };
}

// Full-saturation hex for a given hue (used for the SV square gradient end).
function pureHueHex(h: number): string {
  const { r, g, b } = hsvToRgb(h, 100, 100);
  return rgbToHex(r, g, b);
}

// Rainbow hue stops for the hue bar.
const HUE_COLORS = ['#FF0000','#FFFF00','#00FF00','#00FFFF','#0000FF','#FF00FF','#FF0000'] as const;

const HARMONIES = [
  { name: 'Complementary', offsets: [180] },
  { name: 'Analogous', offsets: [-30, 30] },
  { name: 'Triadic', offsets: [120, 240] },
  { name: 'Split Comp', offsets: [150, 210] },
];

// WCAG contrast ratio calculation
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const l1 = luminance(r1, g1, b1);
  const l2 = luminance(r2, g2, b2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function wcagRating(ratio: number): { aa: boolean; aaa: boolean; aaLarge: boolean; aaaLarge: boolean } {
  return { aa: ratio >= 4.5, aaa: ratio >= 7, aaLarge: ratio >= 3, aaaLarge: ratio >= 4.5 };
}

function generateShades(h: number, s: number, l: number): string[] {
  const shades: string[] = [];
  for (let i = 0; i <= 9; i++) {
    const newL = Math.round(95 - (i * 9)); // 95 to 5
    shades.push(hslToHex(h, s, Math.max(5, Math.min(95, newL))));
  }
  return shades;
}

// Checkerboard pattern dimensions for the alpha preview.
const CHECKER_SIZE = 8;

export default function ColorToolsScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [hex, setHexState] = useState('#6366F1');
  const [r, setR] = useState('99');
  const [g, setG] = useState('102');
  const [b, setB] = useState('241');
  const [alpha, setAlpha] = useState(1); // 0-1
  // Saved palette — each entry remembers the full RGB triple.
  const palette = useToolHistory<{ hex: string; r: string; g: string; b: string }>(
    'color-palette',
    { max: 24 },
  );

  const hsl = useMemo(() => rgbToHsl(parseInt(r) || 0, parseInt(g) || 0, parseInt(b) || 0), [r, g, b]);
  const hsv = useMemo(() => rgbToHsv(parseInt(r) || 0, parseInt(g) || 0, parseInt(b) || 0), [r, g, b]);

  // ── Continuous picker state ──
  // We track HSV for the picker, then sync back to hex/rgb when the user
  // interacts with the picker surfaces. The picker and the text inputs are
  // bidirectionally linked — editing hex/rgb updates the picker, and
  // dragging on the picker updates hex/rgb.
  const svWidth = useRef(1);
  const svHeight = useRef(1);
  const hueWidth = useRef(1);
  const alphaWidth = useRef(1);

  const applyHsv = useCallback((h: number, s: number, v: number) => {
    const rgb = hsvToRgb(h, s, v);
    setR(String(rgb.r));
    setG(String(rgb.g));
    setB(String(rgb.b));
    setHexState(rgbToHex(rgb.r, rgb.g, rgb.b));
  }, []);

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

  // Touch handlers — use locationX/locationY relative to the receiving View.
  const handleSVTouch = useCallback((e: GestureResponderEvent) => {
    const { locationX, locationY } = e.nativeEvent;
    const s = clamp(Math.round((locationX / svWidth.current) * 100), 0, 100);
    const v = clamp(Math.round(100 - (locationY / svHeight.current) * 100), 0, 100);
    applyHsv(hsv.h, s, v);
  }, [hsv.h, applyHsv]);

  const handleHueTouch = useCallback((e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    const h = clamp(Math.round((locationX / hueWidth.current) * 360), 0, 360);
    applyHsv(h, hsv.s, hsv.v);
  }, [hsv.s, hsv.v, applyHsv]);

  const handleAlphaTouch = useCallback((e: GestureResponderEvent) => {
    const { locationX } = e.nativeEvent;
    const a = clamp(Math.round((locationX / alphaWidth.current) * 100) / 100, 0, 1);
    setAlpha(a);
  }, []);

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

      {/* ── Continuous color picker ── */}
      <Text style={[styles.secLabel, { marginBottom: Spacing.sm }]}>Color Picker</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Saturation-Value square */}
        <View
          style={styles.svSquare}
          onLayout={e => { svWidth.current = e.nativeEvent.layout.width; svHeight.current = e.nativeEvent.layout.height; }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleSVTouch}
          onResponderMove={handleSVTouch}
        >
          {/* Horizontal gradient: white → pure hue */}
          <LinearGradient
            colors={['#FFFFFF', pureHueHex(hsv.h)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Vertical gradient: transparent → black (overlaid) */}
          <LinearGradient
            colors={['transparent', '#000000']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          {/* Selection crosshair */}
          <View
            style={[
              styles.svThumb,
              {
                left: `${hsv.s}%`,
                top: `${100 - hsv.v}%`,
                borderColor: hsv.v > 50 ? '#000' : '#fff',
              },
            ]}
            pointerEvents="none"
          />
        </View>

        {/* Hue bar */}
        <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>Hue</Text>
        <View
          style={styles.hueBar}
          onLayout={e => { hueWidth.current = e.nativeEvent.layout.width; }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleHueTouch}
          onResponderMove={handleHueTouch}
        >
          <LinearGradient
            colors={HUE_COLORS}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: Radii.sm }]}
          />
          {/* Thumb */}
          <View
            style={[
              styles.hueThumb,
              { left: `${(hsv.h / 360) * 100}%` },
            ]}
            pointerEvents="none"
          />
        </View>

        {/* Opacity bar */}
        <Text style={[styles.pickerLabel, { color: colors.textMuted }]}>
          Opacity — {Math.round(alpha * 100)}%
        </Text>
        <View
          style={styles.alphaBar}
          onLayout={e => { alphaWidth.current = e.nativeEvent.layout.width; }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={handleAlphaTouch}
          onResponderMove={handleAlphaTouch}
        >
          {/* Checkerboard background to visualize transparency */}
          <View style={[StyleSheet.absoluteFillObject, styles.checkerboard]} />
          {/* Color → transparent gradient */}
          <LinearGradient
            colors={[hex, 'transparent']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[StyleSheet.absoluteFillObject, { borderRadius: Radii.sm }]}
          />
          <View
            style={[styles.hueThumb, { left: `${alpha * 100}%` }]}
            pointerEvents="none"
          />
        </View>

        {/* RGBA output */}
        <View style={[styles.rgbaRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <View style={[styles.rgbaDot, { backgroundColor: hex, opacity: alpha }]} />
          <Text style={[styles.rgbaText, { color: colors.text }]} selectable>
            rgba({r}, {g}, {b}, {alpha.toFixed(2)})
          </Text>
          <TouchableOpacity
            onPress={() => copyText(`rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`, 'RGBA')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="copy-outline" size={16} color="#EC4899" />
          </TouchableOpacity>
        </View>
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

      {/* Shades & Tints */}
      <Text style={[styles.secLabel, { marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>Shades & Tints</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.shadesRow}>
          {generateShades(hsl.h, hsl.s, hsl.l).map((shade, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.shadeSwatch, { backgroundColor: shade }]}
              onPress={() => applyHex(shade)}
            />
          ))}
        </View>
        <Text style={[styles.fmtText, { color: colors.textMuted }]}>Tap a shade to apply</Text>
      </View>

      {/* Contrast Checker */}
      <Text style={[styles.secLabel, { marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>Contrast Checker</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* vs White */}
        {(() => {
          const rv = parseInt(r) || 0, gv = parseInt(g) || 0, bv = parseInt(b) || 0;
          const ratioWhite = contrastRatio(rv, gv, bv, 255, 255, 255);
          const ratioBlack = contrastRatio(rv, gv, bv, 0, 0, 0);
          const ratingWhite = wcagRating(ratioWhite);
          const ratingBlack = wcagRating(ratioBlack);
          return (
            <>
              <View style={styles.contrastRow}>
                <View style={[styles.contrastPreview, { backgroundColor: hex }]}>
                  <Text style={[styles.contrastText, { color: '#fff' }]}>Aa</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contrastLabel, { color: colors.text }]}>vs White — {ratioWhite.toFixed(2)}:1</Text>
                  <View style={styles.wcagRow}>
                    <View style={[styles.wcagBadge, { backgroundColor: ratingWhite.aa ? '#10B981' : '#EF4444' }]}>
                      <Text style={styles.wcagText}>AA</Text>
                    </View>
                    <View style={[styles.wcagBadge, { backgroundColor: ratingWhite.aaa ? '#10B981' : '#EF4444' }]}>
                      <Text style={styles.wcagText}>AAA</Text>
                    </View>
                    <View style={[styles.wcagBadge, { backgroundColor: ratingWhite.aaLarge ? '#10B981' : '#EF4444' }]}>
                      <Text style={styles.wcagText}>AA+</Text>
                    </View>
                  </View>
                </View>
              </View>
              <View style={styles.contrastRow}>
                <View style={[styles.contrastPreview, { backgroundColor: hex }]}>
                  <Text style={[styles.contrastText, { color: '#000' }]}>Aa</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.contrastLabel, { color: colors.text }]}>vs Black — {ratioBlack.toFixed(2)}:1</Text>
                  <View style={styles.wcagRow}>
                    <View style={[styles.wcagBadge, { backgroundColor: ratingBlack.aa ? '#10B981' : '#EF4444' }]}>
                      <Text style={styles.wcagText}>AA</Text>
                    </View>
                    <View style={[styles.wcagBadge, { backgroundColor: ratingBlack.aaa ? '#10B981' : '#EF4444' }]}>
                      <Text style={styles.wcagText}>AAA</Text>
                    </View>
                    <View style={[styles.wcagBadge, { backgroundColor: ratingBlack.aaLarge ? '#10B981' : '#EF4444' }]}>
                      <Text style={styles.wcagText}>AA+</Text>
                    </View>
                  </View>
                </View>
              </View>
            </>
          );
        })()}
      </View>

      {/* Saved palette */}
      <View style={styles.secRow}>
        <Text style={[styles.secLabel, { marginTop: Spacing.lg, marginBottom: 0 }]}>My Palette</Text>
        <TouchableOpacity
          style={[styles.copyBtn, { backgroundColor: '#EC489920', width: 'auto', paddingHorizontal: 12, flexDirection: 'row', gap: 4 }]}
          onPress={() => {
            if (palette.entries.some((e) => e.value.hex === hex)) return;
            haptics.success();
            palette.push({ hex, r, g, b }, hex);
          }}
        >
          <Ionicons name="add" size={14} color="#EC4899" />
          <Text style={[{ color: '#EC4899', fontSize: 11, fontFamily: Fonts.bold }]}>Save</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {palette.entries.length === 0 ? (
          <Text style={[styles.fmtText, { color: colors.textMuted }]}>
            Tap Save to pin the current colour. Long-press a swatch to remove it.
          </Text>
        ) : (
          <View style={styles.palette}>
            {palette.entries.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={[styles.paletteDot, { backgroundColor: entry.value.hex, borderWidth: 1, borderColor: colors.border }]}
                onPress={() => {
                  haptics.tap();
                  applyHex(entry.value.hex);
                }}
                onLongPress={() => {
                  haptics.warning();
                  palette.remove(entry.id);
                }}
              />
            ))}
          </View>
        )}
      </View>

      {/* CSS Gradient */}
      <Text style={[styles.secLabel, { marginTop: Spacing.lg, marginBottom: Spacing.sm }]}>CSS Gradient</Text>
      <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(() => {
          const comp = hslToHex(hsl.h + 180, hsl.s, hsl.l);
          const grad1 = `linear-gradient(135deg, ${hex}, ${comp})`;
          const lighter = hslToHex(hsl.h, Math.max(hsl.s - 10, 0), Math.min(hsl.l + 20, 95));
          const grad2 = `linear-gradient(135deg, ${hex}, ${lighter})`;
          return (
            <>
              <View style={styles.gradientPreviewRow}>
                <View style={[styles.gradientPreview, { backgroundColor: hex }]}>
                  <View style={[styles.gradientOverlay, { backgroundColor: comp, opacity: 0.6, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]} />
                </View>
                <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#EC489920' }]} onPress={() => copyText(grad1, 'Gradient')}>
                  <Ionicons name="copy-outline" size={14} color="#EC4899" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.cssText, { color: colors.textMuted }]} selectable>{grad1}</Text>
              <View style={[styles.gradientPreviewRow, { marginTop: Spacing.md }]}>
                <View style={[styles.gradientPreview, { backgroundColor: hex }]}>
                  <View style={[styles.gradientOverlay, { backgroundColor: lighter, opacity: 0.6, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }]} />
                </View>
                <TouchableOpacity style={[styles.copyBtn, { backgroundColor: '#EC489920' }]} onPress={() => copyText(grad2, 'Gradient')}>
                  <Ionicons name="copy-outline" size={14} color="#EC4899" />
                </TouchableOpacity>
              </View>
              <Text style={[styles.cssText, { color: colors.textMuted }]} selectable>{grad2}</Text>
            </>
          );
        })()}
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    swatch: { height: 100, borderRadius: Radii.xl, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.lg },
    swatchLabel: { fontSize: 22, fontFamily: Fonts.bold, letterSpacing: 2 },
    section: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    // ── Continuous picker ──
    svSquare: {
      width: '100%',
      aspectRatio: 1.4,
      borderRadius: Radii.md,
      overflow: 'hidden',
      marginBottom: Spacing.md,
    },
    svThumb: {
      position: 'absolute',
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2.5,
      marginLeft: -11,
      marginTop: -11,
    },
    pickerLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 6,
    },
    hueBar: {
      height: 28,
      borderRadius: Radii.sm,
      overflow: 'hidden',
      marginBottom: Spacing.md,
      justifyContent: 'center',
    },
    hueThumb: {
      position: 'absolute',
      width: 8,
      height: 28,
      borderRadius: 4,
      backgroundColor: '#fff',
      marginLeft: -4,
      borderWidth: 1.5,
      borderColor: 'rgba(0,0,0,0.3)',
      // Shadow for visibility over any color
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
      elevation: 3,
    },
    alphaBar: {
      height: 28,
      borderRadius: Radii.sm,
      overflow: 'hidden',
      marginBottom: Spacing.md,
      justifyContent: 'center',
    },
    checkerboard: {
      // Simple two-tone checkerboard approximation using background color.
      // True checkerboard would need an image or tiled Views — this
      // light gray is a reasonable stand-in for "transparency".
      backgroundColor: '#E5E7EB',
      borderRadius: Radii.sm,
    },
    rgbaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
      borderRadius: Radii.md,
      borderWidth: 1,
    },
    rgbaDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
    },
    rgbaText: {
      flex: 1,
      fontSize: 13,
      fontFamily: Fonts.medium,
    },
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
    shadesRow: { flexDirection: 'row', gap: 4, marginBottom: Spacing.sm },
    shadeSwatch: { flex: 1, height: 40, borderRadius: Radii.sm },
    contrastRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
    contrastPreview: { width: 52, height: 52, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    contrastText: { fontSize: 20, fontFamily: Fonts.bold },
    contrastLabel: { fontSize: 13, fontFamily: Fonts.semibold, marginBottom: 4 },
    wcagRow: { flexDirection: 'row', gap: 4 },
    wcagBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radii.sm },
    wcagText: { fontSize: 10, fontFamily: Fonts.bold, color: '#fff' },
    gradientPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    gradientPreview: { flex: 1, height: 40, borderRadius: Radii.md, overflow: 'hidden', flexDirection: 'row' },
    gradientOverlay: { flex: 1 },
    cssText: { fontSize: 11, fontFamily: 'monospace', marginTop: 4, lineHeight: 16 },
  });
