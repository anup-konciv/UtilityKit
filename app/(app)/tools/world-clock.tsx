import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';

const ACCENT = '#3B82F6';

type DisplayMode = 'digital' | 'watch';
type TimezoneEntry = { city: string; country: string; timeZone: string; fallbackOffset: number; isCapital?: boolean };

const TIMEZONES: TimezoneEntry[] = [
  { city: 'Washington, DC', country: 'United States', timeZone: 'America/New_York', fallbackOffset: -5, isCapital: true },
  { city: 'New York', country: 'United States', timeZone: 'America/New_York', fallbackOffset: -5 },
  { city: 'Los Angeles', country: 'United States', timeZone: 'America/Los_Angeles', fallbackOffset: -8 },
  { city: 'Chicago', country: 'United States', timeZone: 'America/Chicago', fallbackOffset: -6 },
  { city: 'Ottawa', country: 'Canada', timeZone: 'America/Toronto', fallbackOffset: -5, isCapital: true },
  { city: 'Mexico City', country: 'Mexico', timeZone: 'America/Mexico_City', fallbackOffset: -6, isCapital: true },
  { city: 'Brasilia', country: 'Brazil', timeZone: 'America/Sao_Paulo', fallbackOffset: -3, isCapital: true },
  { city: 'Buenos Aires', country: 'Argentina', timeZone: 'America/Argentina/Buenos_Aires', fallbackOffset: -3, isCapital: true },
  { city: 'London', country: 'United Kingdom', timeZone: 'Europe/London', fallbackOffset: 0, isCapital: true },
  { city: 'Lisbon', country: 'Portugal', timeZone: 'Europe/Lisbon', fallbackOffset: 0, isCapital: true },
  { city: 'Madrid', country: 'Spain', timeZone: 'Europe/Madrid', fallbackOffset: 1, isCapital: true },
  { city: 'Paris', country: 'France', timeZone: 'Europe/Paris', fallbackOffset: 1, isCapital: true },
  { city: 'Berlin', country: 'Germany', timeZone: 'Europe/Berlin', fallbackOffset: 1, isCapital: true },
  { city: 'Rome', country: 'Italy', timeZone: 'Europe/Rome', fallbackOffset: 1, isCapital: true },
  { city: 'Amsterdam', country: 'Netherlands', timeZone: 'Europe/Amsterdam', fallbackOffset: 1, isCapital: true },
  { city: 'Athens', country: 'Greece', timeZone: 'Europe/Athens', fallbackOffset: 2, isCapital: true },
  { city: 'Cairo', country: 'Egypt', timeZone: 'Africa/Cairo', fallbackOffset: 2, isCapital: true },
  { city: 'Nairobi', country: 'Kenya', timeZone: 'Africa/Nairobi', fallbackOffset: 3, isCapital: true },
  { city: 'Riyadh', country: 'Saudi Arabia', timeZone: 'Asia/Riyadh', fallbackOffset: 3, isCapital: true },
  { city: 'Doha', country: 'Qatar', timeZone: 'Asia/Qatar', fallbackOffset: 3, isCapital: true },
  { city: 'Abu Dhabi', country: 'United Arab Emirates', timeZone: 'Asia/Dubai', fallbackOffset: 4, isCapital: true },
  { city: 'Dubai', country: 'United Arab Emirates', timeZone: 'Asia/Dubai', fallbackOffset: 4 },
  { city: 'Tehran', country: 'Iran', timeZone: 'Asia/Tehran', fallbackOffset: 3.5, isCapital: true },
  { city: 'New Delhi', country: 'India', timeZone: 'Asia/Kolkata', fallbackOffset: 5.5, isCapital: true },
  { city: 'Mumbai', country: 'India', timeZone: 'Asia/Kolkata', fallbackOffset: 5.5 },
  { city: 'Kolkata', country: 'India', timeZone: 'Asia/Kolkata', fallbackOffset: 5.5 },
  { city: 'Kathmandu', country: 'Nepal', timeZone: 'Asia/Kathmandu', fallbackOffset: 5.75, isCapital: true },
  { city: 'Dhaka', country: 'Bangladesh', timeZone: 'Asia/Dhaka', fallbackOffset: 6, isCapital: true },
  { city: 'Bangkok', country: 'Thailand', timeZone: 'Asia/Bangkok', fallbackOffset: 7, isCapital: true },
  { city: 'Singapore', country: 'Singapore', timeZone: 'Asia/Singapore', fallbackOffset: 8, isCapital: true },
  { city: 'Beijing', country: 'China', timeZone: 'Asia/Shanghai', fallbackOffset: 8, isCapital: true },
  { city: 'Hong Kong', country: 'Hong Kong', timeZone: 'Asia/Hong_Kong', fallbackOffset: 8 },
  { city: 'Seoul', country: 'South Korea', timeZone: 'Asia/Seoul', fallbackOffset: 9, isCapital: true },
  { city: 'Tokyo', country: 'Japan', timeZone: 'Asia/Tokyo', fallbackOffset: 9, isCapital: true },
  { city: 'Canberra', country: 'Australia', timeZone: 'Australia/Sydney', fallbackOffset: 10, isCapital: true },
  { city: 'Sydney', country: 'Australia', timeZone: 'Australia/Sydney', fallbackOffset: 10 },
  { city: 'Wellington', country: 'New Zealand', timeZone: 'Pacific/Auckland', fallbackOffset: 12, isCapital: true },
];

const partsCache = new Map<string, Intl.DateTimeFormat>();
const zoneCache = new Map<string, Intl.DateTimeFormat>();

function pad(value: number) { return String(value).padStart(2, '0'); }
function fallbackDate(offset: number, now: Date) {
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + offset * 3600000);
}
function partsFormatter(timeZone: string) {
  if (!partsCache.has(timeZone)) {
    partsCache.set(timeZone, new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }));
  }
  return partsCache.get(timeZone)!;
}
function zoneFormatter(timeZone: string) {
  if (!zoneCache.has(timeZone)) {
    zoneCache.set(timeZone, new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short', hour: '2-digit', minute: '2-digit' }));
  }
  return zoneCache.get(timeZone)!;
}
function getZoneDate(entry: TimezoneEntry, now: Date) {
  try {
    const parts = partsFormatter(entry.timeZone).formatToParts(now);
    const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  } catch {
    return fallbackDate(entry.fallbackOffset, now);
  }
}
function getZoneOffset(entry: TimezoneEntry, now: Date) {
  try {
    const zoneDate = getZoneDate(entry, now);
    return (Date.UTC(
      zoneDate.getFullYear(), zoneDate.getMonth(), zoneDate.getDate(),
      zoneDate.getHours(), zoneDate.getMinutes(), zoneDate.getSeconds(),
    ) - now.getTime()) / 3600000;
  } catch {
    return entry.fallbackOffset;
  }
}
function getZoneLabel(entry: TimezoneEntry, now: Date) {
  try {
    return zoneFormatter(entry.timeZone).formatToParts(now).find((part) => part.type === 'timeZoneName')?.value ?? 'TZ';
  } catch {
    return 'TZ';
  }
}
function formatTime(date: Date) {
  let hour = date.getHours();
  const suffix = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12 || 12;
  return `${hour}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${suffix}`;
}
function formatDate(date: Date) {
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  return `${day}, ${date.getDate()} ${month}`;
}
function formatDiff(entry: TimezoneEntry, now: Date) {
  const diff = getZoneOffset(entry, now) - -(now.getTimezoneOffset() / 60);
  const sign = diff >= 0 ? '+' : '-';
  const absolute = Math.abs(diff);
  return `${sign}${Math.floor(absolute)}:${pad(Math.round((absolute % 1) * 60))} from local`;
}
function isDay(date: Date) { return date.getHours() >= 6 && date.getHours() < 18; }
function palette(daytime: boolean) {
  return daytime
    ? { card: ['#FFF7ED', '#FFFFFF'] as const, dial: ['#FFFFFF', '#FFEDD5'] as const, accent: '#F59E0B', text: '#7C2D12', muted: '#64748B' }
    : { card: ['#0F172A', '#1E293B'] as const, dial: ['#172554', '#0F172A'] as const, accent: '#818CF8', text: '#FFFFFF', muted: '#BFDBFE' };
}

function WatchFace({ time, day }: { time: Date; day: boolean }) {
  const tone = palette(day);
  const hourAngle = ((time.getHours() % 12) + time.getMinutes() / 60) * 30;
  const minuteAngle = (time.getMinutes() + time.getSeconds() / 60) * 6;
  const secondAngle = time.getSeconds() * 6;

  return (
    <View style={base.watchWrap}>
      <LinearGradient colors={tone.dial} style={[base.face, { borderColor: withAlpha(tone.accent, '36') }]}>
        {Array.from({ length: 12 }).map((_, index) => (
          <View key={index} style={[base.tickWrap, { transform: [{ rotate: `${index * 30}deg` }] }]}>
            <View style={[index % 3 === 0 ? base.tickBig : base.tick, { backgroundColor: withAlpha(tone.accent, index % 3 === 0 ? 'DD' : '80') }]} />
          </View>
        ))}
        <Text style={[base.faceLabel, { color: tone.muted }]}>{day ? 'DAY' : 'NIGHT'}</Text>
        <View style={[base.handLayer, { transform: [{ rotate: `${hourAngle}deg` }] }]}><View style={[base.hourHand, { backgroundColor: tone.text }]} /></View>
        <View style={[base.handLayer, { transform: [{ rotate: `${minuteAngle}deg` }] }]}><View style={[base.minuteHand, { backgroundColor: tone.text }]} /></View>
        <View style={[base.handLayer, { transform: [{ rotate: `${secondAngle}deg` }] }]}><View style={[base.secondHand, { backgroundColor: tone.accent }]} /></View>
        <View style={[base.centerDot, { backgroundColor: tone.accent }]} />
      </LinearGradient>
    </View>
  );
}

export default function WorldClockScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [now, setNow] = useState(new Date());
  const [savedCities, setSavedCities] = useState<string[]>([]);
  const [searchText, setSearchText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [displayMode, setDisplayMode] = useState<DisplayMode>('digital');

  useEffect(() => { loadJSON<string[]>(KEYS.worldClocks, []).then((stored) => setSavedCities(Array.isArray(stored) ? stored : [])); }, []);
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);

  const persist = useCallback((cities: string[]) => { setSavedCities(cities); saveJSON(KEYS.worldClocks, cities); }, []);
  const addCity = useCallback((city: string) => { if (!savedCities.includes(city)) persist([...savedCities, city]); setSearchText(''); setModalVisible(false); }, [persist, savedCities]);
  const removeCity = useCallback((city: string) => persist(savedCities.filter((item) => item !== city)), [persist, savedCities]);

  const savedTimezones = useMemo(() => savedCities.map((city) => TIMEZONES.find((item) => item.city === city)).filter(Boolean) as TimezoneEntry[], [savedCities]);
  const availableTimezones = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return TIMEZONES.filter((entry) => !savedCities.includes(entry.city) && (!query || `${entry.city} ${entry.country} ${entry.isCapital ? 'capital' : ''}`.toLowerCase().includes(query)));
  }, [savedCities, searchText]);
  const quickCapitals = useMemo(() => TIMEZONES.filter((entry) => entry.isCapital && !savedCities.includes(entry.city)).slice(0, 8), [savedCities]);

  const renderClock = useCallback(({ item }: { item: TimezoneEntry }) => {
    const zoneDate = getZoneDate(item, now);
    const daytime = isDay(zoneDate);
    const tone = palette(daytime);
    const textColor = daytime ? colors.text : '#FFFFFF';
    const mutedColor = daytime ? colors.textMuted : tone.muted;

    if (displayMode === 'watch') {
      return (
        <LinearGradient colors={tone.card} style={[styles.watchCard, { borderColor: withAlpha(tone.accent, '2E') }]}>
          <WatchFace time={zoneDate} day={daytime} />
          <View style={styles.watchInfo}>
            <View style={styles.cardTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.city, { color: textColor }]} numberOfLines={1}>{item.city}</Text>
                <Text style={[styles.country, { color: mutedColor }]} numberOfLines={1}>{item.country}</Text>
              </View>
              <TouchableOpacity onPress={() => removeCity(item.city)} style={[styles.removeBtn, { borderColor: daytime ? colors.border : withAlpha('#FFFFFF', '16'), backgroundColor: daytime ? '#FFFFFF' : withAlpha('#FFFFFF', '10') }]}>
                <Ionicons name="close" size={16} color={mutedColor} />
              </TouchableOpacity>
            </View>
            <View style={styles.badgeRow}>
              <View style={[styles.badge, { backgroundColor: daytime ? withAlpha(tone.accent, '16') : withAlpha('#FFFFFF', '10') }]}><Text style={[styles.badgeText, { color: daytime ? tone.accent : '#FFFFFF' }]}>{getZoneLabel(item, now)}</Text></View>
              {item.isCapital ? <View style={[styles.badge, { backgroundColor: daytime ? '#DBEAFE' : withAlpha('#38BDF8', '18') }]}><Text style={[styles.badgeText, { color: daytime ? ACCENT : '#93C5FD' }]}>Capital</Text></View> : null}
            </View>
            <Text style={[styles.watchTime, { color: textColor }]}>{formatTime(zoneDate)}</Text>
            <Text style={[styles.meta, { color: mutedColor }]}>{formatDate(zoneDate)}</Text>
            <Text style={[styles.meta, { color: mutedColor }]}>{formatDiff(item, now)}</Text>
          </View>
        </LinearGradient>
      );
    }

    return (
      <LinearGradient colors={tone.card} style={[styles.digitalCard, { borderColor: withAlpha(tone.accent, '26') }]}>
        <View style={styles.cardIconWrap}>
          <View style={[styles.iconBubble, { backgroundColor: daytime ? withAlpha('#F59E0B', '16') : withAlpha('#818CF8', '18') }]}>
            <Ionicons name={daytime ? 'sunny' : 'moon'} size={20} color={tone.accent} />
          </View>
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cityRow}>
            <Text style={[styles.city, { color: textColor }]} numberOfLines={1}>{item.city}</Text>
            {item.isCapital ? <View style={[styles.smallBadge, { backgroundColor: daytime ? '#DBEAFE' : withAlpha('#38BDF8', '18') }]}><Text style={[styles.smallBadgeText, { color: daytime ? ACCENT : '#93C5FD' }]}>Capital</Text></View> : null}
          </View>
          <Text style={[styles.country, { color: mutedColor }]}>{item.country} . {getZoneLabel(item, now)}</Text>
          <Text style={[styles.meta, { color: mutedColor }]}>{formatDate(zoneDate)}</Text>
          <Text style={[styles.meta, { color: mutedColor }]}>{formatDiff(item, now)}</Text>
        </View>
        <View style={styles.cardSide}>
          <Text style={[styles.digitalTime, { color: textColor }]}>{formatTime(zoneDate)}</Text>
          <TouchableOpacity onPress={() => removeCity(item.city)} style={[styles.removeBtn, { borderColor: daytime ? colors.border : withAlpha('#FFFFFF', '16'), backgroundColor: daytime ? '#FFFFFF' : withAlpha('#FFFFFF', '10') }]}>
            <Ionicons name="close" size={16} color={mutedColor} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }, [colors.border, colors.text, colors.textMuted, displayMode, now, removeCity, styles]);

  return (
    <ScreenShell title="World Clock" accentColor={ACCENT} scrollable={false}>
      <View style={styles.root}>
        <LinearGradient colors={palette(isDay(now)).card} style={[styles.hero, { borderColor: withAlpha(palette(isDay(now)).accent, '24') }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.heroLabel, { color: isDay(now) ? '#9A3412' : '#BFDBFE' }]}>Local Time</Text>
            <Text style={[styles.heroTime, { color: isDay(now) ? colors.text : '#FFFFFF' }]}>{formatTime(now)}</Text>
            <Text style={[styles.heroDate, { color: isDay(now) ? colors.textSub : '#BFDBFE' }]}>{formatDate(now)}</Text>
            <Text style={[styles.heroMeta, { color: isDay(now) ? colors.textMuted : '#BFDBFE' }]}>{savedTimezones.length} saved clocks across capitals and major cities.</Text>
          </View>
          <WatchFace time={now} day={isDay(now)} />
        </LinearGradient>

        <View style={styles.controlsRow}>
          <View style={[styles.toggleGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {([{ key: 'digital', label: 'Digital', icon: 'list-outline' }, { key: 'watch', label: 'Watch Face', icon: 'time-outline' }] as const).map((item) => {
              const active = displayMode === item.key;
              return (
                <TouchableOpacity key={item.key} style={[styles.toggleBtn, active && { backgroundColor: withAlpha(ACCENT, '18'), borderColor: withAlpha(ACCENT, '36') }]} onPress={() => setDisplayMode(item.key)}>
                  <Ionicons name={item.icon} size={16} color={active ? ACCENT : colors.textMuted} />
                  <Text style={[styles.toggleText, { color: active ? ACCENT : colors.textMuted }]}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setModalVisible(true)}>
            <Ionicons name="add" size={18} color="#FFFFFF" />
            <Text style={styles.addBtnText}>Add City</Text>
          </TouchableOpacity>
        </View>

        {savedTimezones.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="globe-outline" size={44} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No clocks added yet</Text>
            <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>Add more capital cities and switch to watch-face view whenever you want a more visual clock style.</Text>
          </View>
        ) : (
          <FlatList data={savedTimezones} key={displayMode} keyExtractor={(item) => item.city} renderItem={renderClock} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
        )}
      </View>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Add a city</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>New capital cities are available across the world.</Text>
              </View>
              <TouchableOpacity style={[styles.modalClose, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={() => { setModalVisible(false); setSearchText(''); }}>
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Ionicons name="search" size={18} color={colors.textMuted} />
              <TextInput style={[styles.searchInput, { color: colors.text }]} placeholder="Search city or country" placeholderTextColor={colors.textMuted} value={searchText} onChangeText={setSearchText} autoCorrect={false} />
            </View>

            {searchText.length === 0 && quickCapitals.length > 0 ? (
              <View style={styles.quickWrap}>
                <Text style={[styles.quickLabel, { color: colors.textMuted }]}>Quick capitals</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickRow}>
                  {quickCapitals.map((entry) => (
                    <TouchableOpacity key={entry.city} style={[styles.quickChip, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => addCity(entry.city)}>
                      <Text style={[styles.quickChipText, { color: colors.text }]}>{entry.city}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <ScrollView style={styles.modalList} keyboardShouldPersistTaps="handled">
              {availableTimezones.map((entry) => {
                const zoneDate = getZoneDate(entry, now);
                const daytime = isDay(zoneDate);
                return (
                  <TouchableOpacity key={entry.city} style={[styles.modalItem, { borderBottomColor: colors.border }]} onPress={() => addCity(entry.city)}>
                    <View style={[styles.modalIcon, { backgroundColor: daytime ? withAlpha('#F59E0B', '12') : withAlpha('#818CF8', '18') }]}>
                      <Ionicons name={daytime ? 'sunny' : 'moon'} size={18} color={daytime ? '#F59E0B' : '#818CF8'} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.modalItemTop}>
                        <Text style={[styles.modalCity, { color: colors.text }]}>{entry.city}</Text>
                        {entry.isCapital ? <View style={[styles.smallBadge, { backgroundColor: '#DBEAFE' }]}><Text style={[styles.smallBadgeText, { color: ACCENT }]}>Capital</Text></View> : null}
                      </View>
                      <Text style={[styles.modalMeta, { color: colors.textMuted }]}>{entry.country} . {getZoneLabel(entry, now)}</Text>
                    </View>
                    <Text style={styles.modalTime}>{formatTime(zoneDate)}</Text>
                  </TouchableOpacity>
                );
              })}
              {availableTimezones.length === 0 ? <Text style={[styles.noResults, { color: colors.textMuted }]}>No matching cities available</Text> : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenShell>
  );
}

const base = StyleSheet.create({
  watchWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  face: { width: 126, height: 126, borderRadius: 63, borderWidth: 6, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  tickWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center' },
  tick: { width: 2, height: 8, borderRadius: 999, marginTop: 8 },
  tickBig: { width: 3, height: 13, borderRadius: 999, marginTop: 8 },
  faceLabel: { position: 'absolute', top: '27%', fontFamily: Fonts.semibold, fontSize: 10, letterSpacing: 1 },
  handLayer: { ...StyleSheet.absoluteFillObject },
  hourHand: { position: 'absolute', left: '50%', bottom: 55, marginLeft: -2.5, width: 5, height: 24, borderRadius: 999 },
  minuteHand: { position: 'absolute', left: '50%', bottom: 55, marginLeft: -1.5, width: 3, height: 34, borderRadius: 999 },
  secondHand: { position: 'absolute', left: '50%', bottom: 55, marginLeft: -1, width: 2, height: 40, borderRadius: 999 },
  centerDot: { width: 14, height: 14, borderRadius: 999 },
});

function createStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    root: { flex: 1, gap: Spacing.md },
    hero: { borderWidth: 1, borderRadius: Radii.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    heroLabel: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 1 },
    heroTime: { fontSize: 32, lineHeight: 36, fontFamily: Fonts.bold },
    heroDate: { fontSize: 15, fontFamily: Fonts.medium },
    heroMeta: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.regular, marginTop: 4 },
    controlsRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
    toggleGroup: { flex: 1, flexDirection: 'row', padding: 4, borderWidth: 1, borderRadius: Radii.lg, gap: 4 },
    toggleBtn: { flex: 1, minHeight: 42, borderRadius: Radii.md, borderWidth: 1, borderColor: 'transparent', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    toggleText: { fontSize: 13, fontFamily: Fonts.semibold },
    addBtn: { minHeight: 42, borderRadius: Radii.lg, paddingHorizontal: Spacing.lg, backgroundColor: ACCENT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
    addBtnText: { fontSize: 14, fontFamily: Fonts.semibold, color: '#FFFFFF' },
    listContent: { paddingBottom: Spacing.huge, gap: Spacing.sm },
    digitalCard: { borderWidth: 1, borderRadius: Radii.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    cardIconWrap: { width: 52, alignItems: 'center' },
    iconBubble: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    cardInfo: { flex: 1, gap: 2 },
    cityRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
    city: { fontSize: 18, fontFamily: Fonts.bold, flexShrink: 1 },
    country: { fontSize: 13, fontFamily: Fonts.medium },
    meta: { fontSize: 12, fontFamily: Fonts.regular },
    smallBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radii.pill },
    smallBadgeText: { fontSize: 10, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.7 },
    cardSide: { alignItems: 'flex-end', gap: Spacing.sm },
    digitalTime: { fontSize: 17, fontFamily: Fonts.bold },
    removeBtn: { width: 30, height: 30, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    watchCard: { borderWidth: 1, borderRadius: Radii.xl, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    watchInfo: { flex: 1, gap: 6 },
    cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.sm },
    badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radii.pill },
    badgeText: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8 },
    watchTime: { fontSize: 26, lineHeight: 30, fontFamily: Fonts.bold, marginTop: 4 },
    emptyCard: { flex: 1, borderWidth: 1, borderRadius: Radii.xl, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl, gap: Spacing.sm },
    emptyTitle: { fontSize: 18, fontFamily: Fonts.bold, textAlign: 'center' },
    emptyCopy: { fontSize: 14, lineHeight: 20, fontFamily: Fonts.medium, textAlign: 'center' },
    modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
    modalCard: { maxHeight: '84%', borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, paddingTop: Spacing.lg, paddingBottom: Spacing.xl },
    modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
    modalTitle: { fontSize: 22, fontFamily: Fonts.bold },
    modalSub: { fontSize: 13, lineHeight: 18, fontFamily: Fonts.medium, marginTop: 4 },
    modalClose: { width: 36, height: 36, borderRadius: Radii.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginHorizontal: Spacing.lg, minHeight: 46, borderWidth: 1, borderRadius: Radii.lg, paddingHorizontal: Spacing.md },
    searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, paddingVertical: 0 },
    quickWrap: { marginTop: Spacing.md },
    quickLabel: { fontSize: 11, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm, paddingHorizontal: Spacing.lg },
    quickRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
    quickChip: { borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: Spacing.md, paddingVertical: 8 },
    quickChipText: { fontSize: 13, fontFamily: Fonts.semibold },
    modalList: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg },
    modalItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 1 },
    modalIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    modalItemTop: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.sm },
    modalCity: { fontSize: 15, fontFamily: Fonts.semibold },
    modalMeta: { fontSize: 12, fontFamily: Fonts.regular, marginTop: 2 },
    modalTime: { fontSize: 13, fontFamily: Fonts.bold, color: ACCENT },
    noResults: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', marginTop: Spacing.xl },
  });
}
