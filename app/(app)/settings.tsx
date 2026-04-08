import { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/auth';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import {
  exportToClipboard,
  exportToFile,
  importFromClipboard,
  importFromFile,
  resetAll,
} from '@/lib/backup';
import { invalidateHapticsCache } from '@/lib/haptics';
import { Fonts, Radii, Spacing, type ThemeMode } from '@/constants/theme';

const MODES: { value: ThemeMode; label: string; icon: string; desc: string }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline', desc: 'Follow device setting' },
  { value: 'light', label: 'Light', icon: 'sunny-outline', desc: 'Always light mode' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline', desc: 'Always dark mode' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
  const { session, signOut } = useAuth();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [defaultUnits, setDefaultUnits] = useState<'metric' | 'imperial'>('metric');

  useEffect(() => {
    loadJSON<boolean>(KEYS.hapticsEnabled, true).then(setHapticsEnabled);
    loadJSON<'metric' | 'imperial'>(KEYS.defaultUnits, 'metric').then(setDefaultUnits);
  }, []);

  const toggleHaptics = (val: boolean) => {
    setHapticsEnabled(val);
    saveJSON(KEYS.hapticsEnabled, val);
    invalidateHapticsCache();
  };

  const exportAsFile = async () => {
    try {
      const { summary } = await exportToFile();
      Alert.alert(
        'Backup ready',
        `Saved ${summary.populatedKeys} data slices (${(summary.byteSize / 1024).toFixed(1)} KB). Use the share sheet to send it to Files, iCloud, Drive, or email.`,
      );
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to export backup.');
    }
  };

  const exportToClip = async () => {
    try {
      const summary = await exportToClipboard();
      Alert.alert(
        'Copied',
        `${summary.populatedKeys} data slices copied to clipboard (${(summary.byteSize / 1024).toFixed(1)} KB). Paste it somewhere safe to restore later.`,
      );
    } catch {
      Alert.alert('Error', 'Failed to copy backup to clipboard.');
    }
  };

  const importFromFilePicker = async () => {
    try {
      const restored = await importFromFile();
      if (restored == null) return; // user cancelled
      Alert.alert('Imported', `Restored ${restored} data slices. Restart the app to see changes.`);
    } catch (e) {
      Alert.alert('Invalid file', e instanceof Error ? e.message : 'Could not parse the selected file.');
    }
  };

  const importFromClip = async () => {
    try {
      const restored = await importFromClipboard();
      Alert.alert('Imported', `Restored ${restored} data slices. Restart the app to see changes.`);
    } catch (e) {
      Alert.alert('Invalid Data', e instanceof Error ? e.message : 'Clipboard does not contain valid JSON.');
    }
  };

  const resetAllData = () => {
    Alert.alert(
      'Reset All Data',
      'This will permanently delete ALL your data including todos, expenses, notes, habits, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'Last chance — all data will be permanently erased.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Reset',
                  style: 'destructive',
                  onPress: async () => {
                    await resetAll();
                    Alert.alert('Done', 'All data has been reset. Restart the app.');
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <ScreenShell title="Settings">
      {/* Appearance */}
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

      {/* Preferences */}
      <Text style={styles.sectionLabel}>Preferences</Text>
      <View style={[styles.prefCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.prefRow}>
          <View style={[styles.prefIcon, { backgroundColor: '#F5920B20' }]}>
            <Ionicons name="phone-portrait-outline" size={18} color="#F59E0B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Haptic Feedback</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Vibrate on button presses</Text>
          </View>
          <Switch
            value={hapticsEnabled}
            onValueChange={toggleHaptics}
            trackColor={{ true: colors.accent, false: colors.border }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        {/* Default Units */}
        <View style={styles.prefRow}>
          <View style={[styles.prefIcon, { backgroundColor: '#14B8A620' }]}>
            <Ionicons name="speedometer-outline" size={18} color="#14B8A6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Default Units</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Used by Unit Converter & BMI</Text>
          </View>
        </View>
        <View style={styles.unitToggleRow}>
          {(['metric', 'imperial'] as const).map(u => (
            <TouchableOpacity
              key={u}
              style={[
                styles.unitBtn,
                {
                  backgroundColor: defaultUnits === u ? colors.accent : colors.surface,
                  borderColor: defaultUnits === u ? colors.accent : colors.border,
                },
              ]}
              onPress={() => {
                setDefaultUnits(u);
                saveJSON(KEYS.defaultUnits, u);
              }}
            >
              <Ionicons
                name={u === 'metric' ? 'globe-outline' : 'flag-outline'}
                size={16}
                color={defaultUnits === u ? '#fff' : colors.textMuted}
              />
              <Text style={[styles.unitBtnText, { color: defaultUnits === u ? '#fff' : colors.textMuted }]}>
                {u === 'metric' ? 'Metric' : 'Imperial'}
              </Text>
              <Text style={[styles.unitBtnSub, { color: defaultUnits === u ? '#ffffffaa' : colors.textMuted }]}>
                {u === 'metric' ? 'kg, m, °C, L' : 'lb, ft, °F, gal'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.divider} />

      {/* Data Management */}
      <Text style={styles.sectionLabel}>Data Management</Text>
      <View style={[styles.prefCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <TouchableOpacity style={styles.dataRow} onPress={exportAsFile}>
          <View style={[styles.prefIcon, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="cloud-upload-outline" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Backup to File</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Save versioned JSON via the share sheet (Files, iCloud, Drive, email)</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.dataRow} onPress={importFromFilePicker}>
          <View style={[styles.prefIcon, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="cloud-download-outline" size={18} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Restore from File</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Pick a .json backup with the document picker</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.dataRow} onPress={exportToClip}>
          <View style={[styles.prefIcon, { backgroundColor: '#A855F720' }]}>
            <Ionicons name="copy-outline" size={18} color="#A855F7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Copy to Clipboard</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Quick text export, useful when sharing via chat</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.dataRow} onPress={importFromClip}>
          <View style={[styles.prefIcon, { backgroundColor: '#0EA5E920' }]}>
            <Ionicons name="clipboard-outline" size={18} color="#0EA5E9" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Paste from Clipboard</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Restore from a backup JSON in clipboard</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.dataRow} onPress={resetAllData}>
          <View style={[styles.prefIcon, { backgroundColor: '#EF444420' }]}>
            <Ionicons name="trash-outline" size={18} color="#EF4444" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: '#EF4444' }]}>Reset All Data</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Permanently delete everything</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Account */}
      <Text style={styles.sectionLabel}>Account</Text>
      <View style={[styles.prefCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {session ? (
          <TouchableOpacity style={styles.dataRow} onPress={signOut}>
            <View style={[styles.prefIcon, { backgroundColor: '#EF444420' }]}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prefLabel, { color: '#EF4444' }]}>Sign Out</Text>
              <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Log out of your account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.dataRow} onPress={signOut}>
            <View style={[styles.prefIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="log-in-outline" size={18} color="#10B981" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.prefLabel, { color: '#10B981' }]}>Sign In / Register</Text>
              <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Create an account to sync your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.divider} />

      {/* About */}
      <Text style={styles.sectionLabel}>About</Text>
      <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.infoTitle}>UtilityKit</Text>
        <Text style={styles.infoDesc}>54+ utilities in a single app — Calculator, Finance, Health, Notes, Weather, and more.</Text>
        <Text style={[styles.infoVersion, { color: colors.textMuted }]}>Version 1.1.0</Text>
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
    prefCard: {
      borderRadius: Radii.lg,
      borderWidth: 1,
      overflow: 'hidden',
    },
    prefRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
    },
    prefIcon: {
      width: 36,
      height: 36,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    prefLabel: { fontSize: 14, fontFamily: Fonts.semibold },
    prefDesc: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 2 },
    dataRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      padding: Spacing.md,
    },
    rowDivider: { height: 1, marginLeft: 56 },
    infoCard: {
      padding: Spacing.lg,
      borderRadius: Radii.lg,
      borderWidth: 1,
    },
    infoTitle: { fontSize: 17, fontFamily: Fonts.bold, color: colors.text, marginBottom: 6 },
    infoDesc: { fontSize: 13, fontFamily: Fonts.regular, color: colors.textSub, lineHeight: 20, marginBottom: 10 },
    infoVersion: { fontSize: 12, fontFamily: Fonts.medium },
    unitToggleRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      paddingHorizontal: Spacing.md,
      paddingBottom: Spacing.md,
    },
    unitBtn: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      borderWidth: 1.5,
    },
    unitBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    unitBtnSub: { fontSize: 10, fontFamily: Fonts.regular },
  });
