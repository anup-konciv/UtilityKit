import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing, type ThemeMode } from '@/constants/theme';

const MODES: { value: ThemeMode; label: string; icon: string; desc: string }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline', desc: 'Follow device setting' },
  { value: 'light', label: 'Light', icon: 'sunny-outline', desc: 'Always light mode' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline', desc: 'Always dark mode' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScreenShell title="Settings">
      <Text style={styles.sectionLabel}>Appearance</Text>
      {MODES.map((m) => {
        const active = mode === m.value;
        return (
          <TouchableOpacity
            key={m.value}
            style={[styles.modeCard, active && { borderColor: colors.accent, backgroundColor: colors.accentLight }]}
            onPress={() => setMode(m.value)}
            activeOpacity={0.8}
          >
            <View style={[styles.modeIcon, { backgroundColor: active ? colors.accent : colors.glass }]}>
              <Ionicons name={m.icon as any} size={20} color={active ? '#fff' : colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modeLabel, active && { color: colors.accent }]}>{m.label}</Text>
              <Text style={styles.modeDesc}>{m.desc}</Text>
            </View>
            {active && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
          </TouchableOpacity>
        );
      })}

      <View style={styles.divider} />
      <Text style={styles.sectionLabel}>About</Text>
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.infoTitle}>UtilityKit</Text>
        <Text style={styles.infoDesc}>27+ utilities in a single app — Calculator, Finance, Health, Notes, Weather, and more.</Text>
        <Text style={[styles.infoVersion, { color: colors.textMuted }]}>Version 1.0.0</Text>
      </View>
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    sectionLabel: {
      fontSize: 11,
      fontFamily: Fonts.bold,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: Spacing.sm,
      marginTop: Spacing.xs,
    },
    modeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
      borderRadius: Radii.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      marginBottom: Spacing.sm,
    },
    modeIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modeLabel: { fontSize: 15, fontFamily: Fonts.semibold, color: colors.text },
    modeDesc: { fontSize: 12, fontFamily: Fonts.regular, color: colors.textMuted, marginTop: 2 },
    divider: { height: 1, backgroundColor: colors.border, marginVertical: Spacing.lg },
    infoCard: {
      padding: Spacing.lg,
      borderRadius: Radii.lg,
      borderWidth: 1,
    },
    infoTitle: { fontSize: 17, fontFamily: Fonts.bold, color: colors.text, marginBottom: 6 },
    infoDesc: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSub, lineHeight: 20, marginBottom: 10 },
    infoVersion: { fontSize: 12, fontFamily: Fonts.medium },
  });
