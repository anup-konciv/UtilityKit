import { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Magnetometer } from 'expo-sensors';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#DC2626';

const DIRECTIONS = [
  { deg: 0, label: 'N', full: 'North' },
  { deg: 45, label: 'NE', full: 'Northeast' },
  { deg: 90, label: 'E', full: 'East' },
  { deg: 135, label: 'SE', full: 'Southeast' },
  { deg: 180, label: 'S', full: 'South' },
  { deg: 225, label: 'SW', full: 'Southwest' },
  { deg: 270, label: 'W', full: 'West' },
  { deg: 315, label: 'NW', full: 'Northwest' },
];

function getDirection(deg: number) {
  const normalized = ((deg % 360) + 360) % 360;
  let closest = DIRECTIONS[0];
  let minDiff = 360;
  for (const d of DIRECTIONS) {
    const diff = Math.abs(normalized - d.deg);
    const wrappedDiff = Math.min(diff, 360 - diff);
    if (wrappedDiff < minDiff) {
      minDiff = wrappedDiff;
      closest = d;
    }
  }
  return closest;
}

export default function CompassScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [heading, setHeading] = useState(0);
  const [available, setAvailable] = useState(true);
  const [error, setError] = useState('');
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    async function start() {
      const isAvail = await Magnetometer.isAvailableAsync();
      if (!isAvail) {
        setAvailable(false);
        setError('Magnetometer not available on this device');
        return;
      }

      Magnetometer.setUpdateInterval(100);
      sub = Magnetometer.addListener(data => {
        const { x, y } = data;
        let angle = Math.atan2(y, x) * (180 / Math.PI);
        angle = ((angle - 90) % 360 + 360) % 360;
        // Round to reduce jitter
        angle = Math.round(angle);
        setHeading(angle);

        Animated.spring(rotateAnim, {
          toValue: -angle,
          useNativeDriver: true,
          friction: 20,
          tension: 60,
        }).start();
      });
    }

    start();
    return () => { sub?.remove(); };
  }, []);

  const direction = getDirection(heading);

  const rotateStr = rotateAnim.interpolate({
    inputRange: [-360, 360],
    outputRange: ['-360deg', '360deg'],
  });

  return (
    <ScreenShell title="Compass" accentColor={ACCENT} scrollable={false}>
      <View style={styles.container}>
        {!available ? (
          <View style={styles.errorContainer}>
            <Ionicons name="warning-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
            <Text style={[styles.errorSub, { color: colors.textMuted }]}>
              Compass requires a magnetometer sensor
            </Text>
          </View>
        ) : (
          <>
            {/* Direction Label */}
            <View style={styles.directionBox}>
              <Text style={[styles.directionLabel, { color: ACCENT }]}>{direction.label}</Text>
              <Text style={[styles.directionFull, { color: colors.textMuted }]}>{direction.full}</Text>
            </View>

            {/* Heading Degrees */}
            <Text style={[styles.headingText, { color: colors.text }]}>{heading}°</Text>

            {/* Compass Rose */}
            <View style={styles.compassWrap}>
              {/* Fixed needle */}
              <View style={styles.needleContainer}>
                <View style={[styles.needleTop, { backgroundColor: ACCENT }]} />
                <View style={[styles.needleBottom, { backgroundColor: colors.textMuted }]} />
                <View style={[styles.needleCenter, { backgroundColor: colors.bg, borderColor: ACCENT }]} />
              </View>

              {/* Rotating dial */}
              <Animated.View style={[styles.dial, { borderColor: colors.border, transform: [{ rotate: rotateStr }] }]}>
                {/* Cardinal & intercardinal labels */}
                {DIRECTIONS.map(d => (
                  <View
                    key={d.label}
                    style={[
                      styles.dialLabel,
                      { transform: [{ rotate: `${d.deg}deg` }, { translateY: -115 }, { rotate: `-${d.deg}deg` }] },
                    ]}
                  >
                    <Text style={[
                      styles.dialLabelText,
                      {
                        color: d.label === 'N' ? ACCENT : d.label.length === 1 ? colors.text : colors.textMuted,
                        fontSize: d.label.length === 1 ? 20 : 13,
                      },
                    ]}>
                      {d.label}
                    </Text>
                  </View>
                ))}

                {/* Tick marks */}
                {Array.from({ length: 72 }, (_, i) => i * 5).map(deg => (
                  <View
                    key={deg}
                    style={[
                      styles.tick,
                      {
                        transform: [{ rotate: `${deg}deg` }],
                        height: deg % 90 === 0 ? 16 : deg % 45 === 0 ? 12 : deg % 15 === 0 ? 8 : 4,
                        backgroundColor: deg % 90 === 0 ? ACCENT : deg % 45 === 0 ? colors.text : colors.textMuted + '60',
                        width: deg % 90 === 0 ? 2.5 : 1.5,
                      },
                    ]}
                  />
                ))}
              </Animated.View>
            </View>

            {/* Info Cards */}
            <View style={styles.infoRow}>
              {[
                { label: 'Heading', value: `${heading}°` },
                { label: 'Direction', value: direction.label },
                { label: 'Cardinal', value: direction.full },
              ].map(item => (
                <View key={item.label} style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.infoValue, { color: ACCENT }]}>{item.value}</Text>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{item.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </View>
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    errorContainer: { alignItems: 'center', gap: Spacing.md, padding: Spacing.xl },
    errorText: { fontSize: 16, fontFamily: Fonts.semibold, textAlign: 'center' },
    errorSub: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center' },
    directionBox: { alignItems: 'center', marginBottom: Spacing.sm },
    directionLabel: { fontSize: 36, fontFamily: Fonts.bold },
    directionFull: { fontSize: 14, fontFamily: Fonts.medium },
    headingText: { fontSize: 48, fontFamily: Fonts.bold, marginBottom: Spacing.lg },
    compassWrap: { width: 280, height: 280, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xl },
    needleContainer: { position: 'absolute', zIndex: 10, alignItems: 'center', height: 120 },
    needleTop: { width: 4, height: 55, borderRadius: 2 },
    needleBottom: { width: 4, height: 55, borderRadius: 2 },
    needleCenter: { position: 'absolute', top: 50, width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
    dial: { width: 270, height: 270, borderRadius: 135, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    dialLabel: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
    dialLabelText: { fontFamily: Fonts.bold },
    tick: { position: 'absolute', top: 0, alignSelf: 'center', transformOrigin: 'bottom center' },
    infoRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
    infoCard: { flex: 1, borderRadius: Radii.md, borderWidth: 1, padding: Spacing.md, alignItems: 'center' },
    infoValue: { fontSize: 16, fontFamily: Fonts.bold },
    infoLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
  });
