import { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing, type ThemeMode } from '@/constants/theme';

const MODES: { value: ThemeMode; label: string; icon: string; desc: string }[] = [
  { value: 'system', label: 'System', icon: 'phone-portrait-outline', desc: 'Follow device setting' },
  { value: 'light', label: 'Light', icon: 'sunny-outline', desc: 'Always light mode' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline', desc: 'Always dark mode' },
];

export default function SettingsScreen() {
  const { colors, mode, setMode } = useAppTheme();
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
  };

  const exportAllData = async () => {
    try {
      const allKeys = Object.values(KEYS);
      const data: Record<string, any> = {};
      for (const key of allKeys) {
        const val = await AsyncStorage.getItem(key);
        if (val !== null) data[key] = JSON.parse(val);
      }
      const json = JSON.stringify(data, null, 2);
      await Clipboard.setStringAsync(json);
      Alert.alert('Exported', 'All data copied to clipboard as JSON. Save it somewhere safe to restore later.');
    } catch {
      Alert.alert('Error', 'Failed to export data.');
    }
  };

  const importData = async () => {
    try {
      const json = await Clipboard.getStringAsync();
      if (!json || !json.trim()) {
        Alert.alert('Empty Clipboard', 'Copy your backup JSON to clipboard first, then tap Import.');
        return;
      }
      const data = JSON.parse(json);
      if (typeof data !== 'object' || data === null) {
        Alert.alert('Invalid Data', 'Clipboard does not contain valid UtilityKit backup data.');
        return;
      }

      Alert.alert(
        'Import Data',
        `Found ${Object.keys(data).length} data entries. This will overwrite existing data. Continue?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import',
            style: 'destructive',
            onPress: async () => {
              for (const [key, value] of Object.entries(data)) {
                await AsyncStorage.setItem(key, JSON.stringify(value));
              }
              Alert.alert('Success', 'Data imported. Restart the app to see changes.');
            },
          },
        ],
      );
    } catch {
      Alert.alert('Invalid Data', 'Clipboard does not contain valid JSON. Copy your backup first.');
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
                    const allKeys = Object.values(KEYS);
                    await AsyncStorage.multiRemove(allKeys);
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
        <TouchableOpacity style={styles.dataRow} onPress={exportAllData}>
          <View style={[styles.prefIcon, { backgroundColor: '#10B98120' }]}>
            <Ionicons name="cloud-upload-outline" size={18} color="#10B981" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Export Data</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Copy all data as JSON to clipboard</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />

        <TouchableOpacity style={styles.dataRow} onPress={importData}>
          <View style={[styles.prefIcon, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="cloud-download-outline" size={18} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.prefLabel, { color: colors.text }]}>Import Data</Text>
            <Text style={[styles.prefDesc, { color: colors.textMuted }]}>Restore from clipboard JSON backup</Text>
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
