import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { loadJSON, saveJSON } from '@/lib/storage';

const ACCENT = '#3B82F6';
const STORAGE_KEY = 'uk_world_clocks';

type TimezoneEntry = {
  city: string;
  offset: number;
  zone: string;
};

const TIMEZONES: TimezoneEntry[] = [
  { city: 'New York', offset: -5, zone: 'EST' },
  { city: 'Los Angeles', offset: -8, zone: 'PST' },
  { city: 'Chicago', offset: -6, zone: 'CST' },
  { city: 'London', offset: 0, zone: 'GMT' },
  { city: 'Paris', offset: 1, zone: 'CET' },
  { city: 'Berlin', offset: 1, zone: 'CET' },
  { city: 'Dubai', offset: 4, zone: 'GST' },
  { city: 'Mumbai', offset: 5.5, zone: 'IST' },
  { city: 'Kolkata', offset: 5.5, zone: 'IST' },
  { city: 'Singapore', offset: 8, zone: 'SGT' },
  { city: 'Hong Kong', offset: 8, zone: 'HKT' },
  { city: 'Tokyo', offset: 9, zone: 'JST' },
  { city: 'Sydney', offset: 11, zone: 'AEDT' },
  { city: 'Auckland', offset: 13, zone: 'NZDT' },
  { city: 'São Paulo', offset: -3, zone: 'BRT' },
  { city: 'Moscow', offset: 3, zone: 'MSK' },
  { city: 'Seoul', offset: 9, zone: 'KST' },
  { city: 'Bangkok', offset: 7, zone: 'ICT' },
];

function padZ(n: number): string {
  return String(n).padStart(2, '0');
}

function getLocalOffsetHours(): number {
  return -(new Date().getTimezoneOffset() / 60);
}

function getTimeInOffset(offset: number, now: Date): Date {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + offset * 3600000);
}

function formatTime(d: Date): string {
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${padZ(d.getMinutes())}:${padZ(d.getSeconds())} ${ampm}`;
}

function formatDate(d: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function formatOffset(offset: number): string {
  const localOffset = getLocalOffsetHours();
  const diff = offset - localOffset;
  const sign = diff >= 0 ? '+' : '-';
  const abs = Math.abs(diff);
  const hours = Math.floor(abs);
  const mins = Math.round((abs - hours) * 60);
  return `${sign}${hours}:${padZ(mins)}`;
}

function isDaytime(d: Date): boolean {
  const h = d.getHours();
  return h >= 6 && h < 18;
}

export default function WorldClockScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [now, setNow] = useState(new Date());
  const [savedCities, setSavedCities] = useState<string[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [searchText, setSearchText] = useState('');

  // Load saved cities
  useEffect(() => {
    loadJSON<string[]>(STORAGE_KEY, []).then(setSavedCities);
  }, []);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const persist = useCallback((cities: string[]) => {
    setSavedCities(cities);
    saveJSON(STORAGE_KEY, cities);
  }, []);

  const addCity = useCallback((city: string) => {
    if (!savedCities.includes(city)) {
      const next = [...savedCities, city];
      persist(next);
    }
    setModalVisible(false);
    setSearchText('');
  }, [savedCities, persist]);

  const removeCity = useCallback((city: string) => {
    const next = savedCities.filter((c) => c !== city);
    persist(next);
  }, [savedCities, persist]);

  const savedTimezones = useMemo(() => {
    return savedCities
      .map((city) => TIMEZONES.find((tz) => tz.city === city))
      .filter(Boolean) as TimezoneEntry[];
  }, [savedCities]);

  const availableTimezones = useMemo(() => {
    const lower = searchText.toLowerCase();
    return TIMEZONES.filter(
      (tz) => !savedCities.includes(tz.city) && tz.city.toLowerCase().includes(lower),
    );
  }, [savedCities, searchText]);

  const localTime = getTimeInOffset(getLocalOffsetHours(), now);

  const renderClockCard = useCallback(({ item }: { item: TimezoneEntry }) => {
    const tzTime = getTimeInOffset(item.offset, now);
    const daytime = isDaytime(tzTime);

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Ionicons
            name={daytime ? 'sunny' : 'moon'}
            size={24}
            color={daytime ? '#F59E0B' : '#818CF8'}
          />
        </View>
        <View style={styles.cardCenter}>
          <View style={styles.cityRow}>
            <Text style={styles.cityName}>{item.city}</Text>
            <Text style={styles.zone}>{item.zone}</Text>
          </View>
          <Text style={styles.cardDate}>{formatDate(tzTime)}</Text>
          <Text style={styles.offsetText}>{formatOffset(item.offset)} from local</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={styles.cardTime}>{formatTime(tzTime)}</Text>
          <TouchableOpacity
            onPress={() => removeCity(item.city)}
            style={styles.removeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close-circle" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [now, styles, colors, removeCity]);

  return (
    <ScreenShell title="World Clock" accentColor={ACCENT} scrollable={false}>
      {/* Local time */}
      <View style={styles.localSection}>
        <Ionicons
          name={isDaytime(localTime) ? 'sunny' : 'moon'}
          size={28}
          color={isDaytime(localTime) ? '#F59E0B' : '#818CF8'}
        />
        <Text style={styles.localLabel}>Local Time</Text>
        <Text style={styles.localTime}>{formatTime(localTime)}</Text>
        <Text style={styles.localDate}>{formatDate(localTime)}</Text>
      </View>

      {/* Add button */}
      <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
        <Ionicons name="add-circle" size={22} color="#fff" />
        <Text style={styles.addBtnText}>Add City</Text>
      </TouchableOpacity>

      {/* Saved clocks list */}
      {savedTimezones.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="globe-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No cities added yet</Text>
          <Text style={styles.emptySubText}>Tap "Add City" to track time in other zones</Text>
        </View>
      ) : (
        <FlatList
          data={savedTimezones}
          keyExtractor={(item) => item.city}
          renderItem={renderClockCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Add city modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add City</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setSearchText(''); }}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Search input */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search cities..."
                placeholderTextColor={colors.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                autoCorrect={false}
              />
              {searchText.length > 0 && (
                <TouchableOpacity onPress={() => setSearchText('')}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* City list */}
            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {availableTimezones.map((tz) => {
                const tzTime = getTimeInOffset(tz.offset, now);
                const daytime = isDaytime(tzTime);
                return (
                  <TouchableOpacity
                    key={tz.city}
                    style={styles.modalItem}
                    onPress={() => addCity(tz.city)}
                  >
                    <Ionicons
                      name={daytime ? 'sunny' : 'moon'}
                      size={20}
                      color={daytime ? '#F59E0B' : '#818CF8'}
                    />
                    <View style={styles.modalItemInfo}>
                      <Text style={styles.modalItemCity}>{tz.city}</Text>
                      <Text style={styles.modalItemZone}>{tz.zone} ({formatOffset(tz.offset)})</Text>
                    </View>
                    <Text style={styles.modalItemTime}>{formatTime(tzTime)}</Text>
                  </TouchableOpacity>
                );
              })}
              {availableTimezones.length === 0 && (
                <Text style={styles.noResults}>No cities available</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function createStyles(colors: any) {
  return StyleSheet.create({
    /* Local time section */
    localSection: {
      alignItems: 'center',
      paddingVertical: Spacing.xl,
      marginBottom: Spacing.md,
      backgroundColor: colors.card,
      borderRadius: Radii.lg,
      marginHorizontal: Spacing.lg,
    },
    localLabel: {
      fontFamily: Fonts.medium,
      fontSize: 14,
      color: colors.textMuted,
      marginTop: Spacing.sm,
    },
    localTime: {
      fontFamily: Fonts.bold,
      fontSize: 40,
      color: colors.text,
      marginTop: Spacing.xs,
    },
    localDate: {
      fontFamily: Fonts.regular,
      fontSize: 15,
      color: colors.textSub,
      marginTop: Spacing.xs,
    },

    /* Add button */
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT,
      paddingVertical: Spacing.md,
      borderRadius: Radii.md,
      marginHorizontal: Spacing.lg,
      marginBottom: Spacing.md,
      gap: Spacing.sm,
    },
    addBtnText: {
      fontFamily: Fonts.semibold,
      fontSize: 15,
      color: '#fff',
    },

    /* List */
    listContent: {
      paddingHorizontal: Spacing.lg,
      paddingBottom: Spacing.xxl,
    },

    /* Card */
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: Radii.md,
      padding: Spacing.lg,
      marginBottom: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardLeft: {
      marginRight: Spacing.md,
    },
    cardCenter: {
      flex: 1,
    },
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    cityName: {
      fontFamily: Fonts.semibold,
      fontSize: 16,
      color: colors.text,
    },
    zone: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: colors.textMuted,
      backgroundColor: colors.glass,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      borderRadius: Radii.sm,
      overflow: 'hidden',
    },
    cardDate: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: colors.textSub,
      marginTop: 2,
    },
    offsetText: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    cardRight: {
      alignItems: 'flex-end',
      gap: Spacing.sm,
    },
    cardTime: {
      fontFamily: Fonts.bold,
      fontSize: 17,
      color: ACCENT,
    },
    removeBtn: {
      padding: 2,
    },

    /* Empty */
    emptyContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingBottom: Spacing.huge,
    },
    emptyText: {
      fontFamily: Fonts.medium,
      fontSize: 16,
      color: colors.textMuted,
      marginTop: Spacing.md,
    },
    emptySubText: {
      fontFamily: Fonts.regular,
      fontSize: 13,
      color: colors.textMuted,
      marginTop: Spacing.xs,
    },

    /* Modal */
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      maxHeight: '80%',
      paddingBottom: Spacing.xxl,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
      paddingBottom: Spacing.md,
    },
    modalTitle: {
      fontFamily: Fonts.bold,
      fontSize: 20,
      color: colors.text,
    },

    /* Search */
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: Radii.md,
      marginHorizontal: Spacing.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchInput: {
      flex: 1,
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: colors.text,
      paddingVertical: 0,
    },

    /* Modal list */
    modalList: {
      marginTop: Spacing.md,
      paddingHorizontal: Spacing.lg,
    },
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: Spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: Spacing.md,
    },
    modalItemInfo: {
      flex: 1,
    },
    modalItemCity: {
      fontFamily: Fonts.semibold,
      fontSize: 15,
      color: colors.text,
    },
    modalItemZone: {
      fontFamily: Fonts.regular,
      fontSize: 12,
      color: colors.textMuted,
      marginTop: 2,
    },
    modalItemTime: {
      fontFamily: Fonts.medium,
      fontSize: 14,
      color: ACCENT,
    },
    noResults: {
      fontFamily: Fonts.regular,
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: Spacing.xl,
    },
  });
}
