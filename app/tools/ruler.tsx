import { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, PixelRatio, ScrollView } from 'react-native';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#CA8A04';

const { width: SCREEN_W } = Dimensions.get('window');
const PIXEL_RATIO = PixelRatio.get();
// Approximate DPI for common devices
const APPROX_DPI = PIXEL_RATIO * 160;
const PX_PER_CM = APPROX_DPI / 2.54;
const PX_PER_INCH = APPROX_DPI;

const CM_COUNT = Math.floor((SCREEN_W - 48) / PX_PER_CM);
const INCH_COUNT = Math.floor((SCREEN_W - 48) / PX_PER_INCH);

export default function RulerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScreenShell title="Ruler" accentColor={ACCENT}>
      <Text style={[styles.note, { color: colors.textMuted }]}>
        Approximate ruler based on screen density ({APPROX_DPI.toFixed(0)} DPI). Accuracy varies by device.
      </Text>

      {/* CM Ruler */}
      <View style={[styles.rulerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.unitLabel}>Centimeters (cm)</Text>
        <View style={styles.rulerWrap}>
          {Array.from({ length: CM_COUNT + 1 }, (_, i) => (
            <View key={i} style={[styles.cmGroup, { width: PX_PER_CM }]}>
              {/* Main tick */}
              <View style={[styles.tickMain, { backgroundColor: ACCENT }]} />
              <Text style={[styles.tickNum, { color: colors.text }]}>{i}</Text>
              {/* mm ticks */}
              {i < CM_COUNT && Array.from({ length: 9 }, (_, j) => (
                <View
                  key={j}
                  style={[
                    j === 4 ? styles.tickHalf : styles.tickSmall,
                    {
                      backgroundColor: j === 4 ? ACCENT : colors.textMuted,
                      position: 'absolute',
                      left: (j + 1) * (PX_PER_CM / 10),
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={[styles.rulerLine, { backgroundColor: ACCENT }]} />
      </View>

      {/* Inch Ruler */}
      <View style={[styles.rulerCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.unitLabel}>Inches (in)</Text>
        <View style={styles.rulerWrap}>
          {Array.from({ length: INCH_COUNT + 1 }, (_, i) => (
            <View key={i} style={[styles.cmGroup, { width: PX_PER_INCH }]}>
              <View style={[styles.tickMain, { backgroundColor: '#3B82F6' }]} />
              <Text style={[styles.tickNum, { color: colors.text }]}>{i}</Text>
              {/* 1/4 and 1/2 ticks */}
              {i < INCH_COUNT && [0.25, 0.5, 0.75].map((frac, j) => (
                <View
                  key={j}
                  style={[
                    frac === 0.5 ? styles.tickHalf : styles.tickSmall,
                    {
                      backgroundColor: frac === 0.5 ? '#3B82F6' : colors.textMuted,
                      position: 'absolute',
                      left: frac * PX_PER_INCH,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
        <View style={[styles.rulerLine, { backgroundColor: '#3B82F6' }]} />
      </View>

      {/* Info */}
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.infoTitle}>Device Info</Text>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Screen Width</Text>
          <Text style={[styles.infoVal, { color: colors.text }]}>{SCREEN_W.toFixed(0)} px</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Pixel Ratio</Text>
          <Text style={[styles.infoVal, { color: colors.text }]}>{PIXEL_RATIO}x</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Approx DPI</Text>
          <Text style={[styles.infoVal, { color: colors.text }]}>{APPROX_DPI.toFixed(0)}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>1 cm ≈</Text>
          <Text style={[styles.infoVal, { color: colors.text }]}>{PX_PER_CM.toFixed(1)} px</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>1 inch ≈</Text>
          <Text style={[styles.infoVal, { color: colors.text }]}>{PX_PER_INCH.toFixed(1)} px</Text>
        </View>
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    note: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 18, marginBottom: Spacing.lg, textAlign: 'center' },
    rulerCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg, overflow: 'hidden' },
    unitLabel: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    rulerWrap: { flexDirection: 'row', height: 60, alignItems: 'flex-end' },
    cmGroup: { alignItems: 'flex-start', height: 60, position: 'relative' },
    tickMain: { width: 2, height: 30 },
    tickHalf: { width: 1.5, height: 20, top: 10 },
    tickSmall: { width: 1, height: 12, top: 18 },
    tickNum: { fontSize: 10, fontFamily: Fonts.bold, marginTop: 2 },
    rulerLine: { height: 2, borderRadius: 1, marginTop: 2 },
    infoCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg },
    infoTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
    infoLabel: { fontSize: 13, fontFamily: Fonts.regular },
    infoVal: { fontSize: 13, fontFamily: Fonts.bold },
  });
