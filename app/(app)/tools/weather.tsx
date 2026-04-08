import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { cache } from '@/lib/cache';
import { getCurrentPosition, reverseGeocode } from '@/lib/location';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// 30 minutes — Open-Meteo updates ~hourly so this is the right balance
// between freshness and offline survivability.
const WEATHER_TTL_MS = 30 * 60 * 1000;

// ── Types ─────────────────────────────────────────────────────────────────────
type GeoResult = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
};

type WeatherData = {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
    precipitation: number;
    uv_index: number;
  };
  hourly: {
    time: string[];
    temperature_2m: number[];
    weather_code: number[];
    precipitation_probability: number[];
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
  };
};

type SavedLocation = {
  name: string;
  country: string;
  admin1?: string;
  latitude: number;
  longitude: number;
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function weatherInfo(code: number, isNight = false): { label: string; icon: string } {
  if (code === 0)   return { label: isNight ? 'Clear Night' : 'Clear Sky',   icon: isNight ? 'moon-outline'          : 'sunny-outline'         };
  if (code <= 2)    return { label: 'Partly Cloudy',                          icon: isNight ? 'cloudy-night-outline'  : 'partly-sunny-outline'   };
  if (code === 3)   return { label: 'Overcast',                               icon: 'cloudy-outline'                                             };
  if (code <= 48)   return { label: 'Foggy',                                  icon: 'cloud-outline'                                              };
  if (code <= 55)   return { label: 'Drizzle',                                icon: 'rainy-outline'                                              };
  if (code <= 65)   return { label: 'Rain',                                   icon: 'rainy-outline'                                              };
  if (code <= 77)   return { label: 'Snow',                                   icon: 'snow-outline'                                               };
  if (code <= 82)   return { label: 'Rain Showers',                           icon: 'rainy-outline'                                              };
  if (code <= 86)   return { label: 'Snow Showers',                           icon: 'snow-outline'                                               };
  if (code >= 95)   return { label: 'Thunderstorm',                           icon: 'thunderstorm-outline'                                       };
  return            { label: 'Cloudy',                                        icon: 'cloudy-outline'                                             };
}

function getGradient(code: number, hour: number): [string, string, string] {
  const night = hour < 6 || hour >= 21;
  if (code >= 95) return ['#1a1a2e', '#2d1b4e', '#4a1942'];
  if (code >= 61) return ['#1e3a5f', '#1565c0', '#2980b9'];
  if (code >= 51) return ['#2c3e50', '#3d5a74', '#4ca1af'];
  if (code >= 45) return ['#29323c', '#485563', '#636e72'];
  if (code >= 1)  return night ? ['#0d1b2a', '#1b2838', '#243b55'] : ['#1565c0', '#1976d2', '#42a5f5'];
  if (night)      return ['#0f0c29', '#1a1248', '#302b63'];
  if (hour < 9)   return ['#c94b4b', '#e67e22', '#f7971e'];
  if (hour >= 18) return ['#c0392b', '#e74c3c', '#f39c12'];
  return ['#1565c0', '#1976d2', '#42a5f5'];
}

function fmtHour(t: string): string {
  const h = parseInt(t.split('T')[1], 10);
  if (h === 0)  return '12AM';
  if (h === 12) return '12PM';
  return h < 12 ? `${h}AM` : `${h - 12}PM`;
}

function dayLabel(dateStr: string, i: number): string {
  if (i === 0) return 'Today';
  if (i === 1) return 'Tomorrow';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

// ── API ───────────────────────────────────────────────────────────────────────
async function searchCities(q: string): Promise<GeoResult[]> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=8&language=en&format=json`
  );
  const data = await res.json();
  return (data.results ?? []) as GeoResult[];
}

async function fetchWeather(lat: number, lon: number): Promise<WeatherData> {
  const p = new URLSearchParams({
    latitude:  String(lat),
    longitude: String(lon),
    current:   'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,uv_index',
    hourly:    'temperature_2m,weather_code,precipitation_probability',
    daily:     'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
    timezone:  'auto',
    forecast_days: '7',
    wind_speed_unit: 'kmh',
  });
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?${p}`);
  if (!res.ok) throw new Error('Weather fetch failed');
  return res.json();
}

// ── Search Modal ──────────────────────────────────────────────────────────────
function SearchModal({ onSelect, onClose }: { onSelect: (l: SavedLocation) => void; onClose: () => void }) {
  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [busy, setBusy]       = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const timer                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback((q: string) => {
    setQuery(q);
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) { setResults([]); return; }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try { setResults(await searchCities(q)); }
      catch { setResults([]); }
      finally { setBusy(false); }
    }, 380);
  }, []);

  // Tap-to-locate handler. Uses lib/location which gracefully no-ops
  // until expo-location is installed.
  const useMyLocation = useCallback(async () => {
    setGpsBusy(true);
    setGpsError(null);
    try {
      const fix = await getCurrentPosition();
      if (!fix) {
        setGpsError('Location unavailable. Install expo-location and grant permission, or search by city name.');
        return;
      }
      const named = await reverseGeocode(fix);
      onSelect({
        name: named?.name ?? 'Current location',
        country: named?.country ?? '',
        admin1: named?.region,
        latitude: fix.latitude,
        longitude: fix.longitude,
      });
    } catch {
      setGpsError('Could not read your location. Try the search instead.');
    } finally {
      setGpsBusy(false);
    }
  }, [onSelect]);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={sm.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={sm.header}>
          <TouchableOpacity onPress={onClose} style={sm.closeBtn}>
            <Ionicons name="close" size={22} color="#334155" />
          </TouchableOpacity>
          <View style={sm.inputWrap}>
            <Ionicons name="search-outline" size={18} color="#94A3B8" />
            <TextInput
              style={sm.input}
              value={query}
              onChangeText={search}
              placeholder="Search city…"
              placeholderTextColor="#94A3B8"
              autoFocus
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => search('')}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Use-my-location pill — no-ops until expo-location is installed. */}
        <TouchableOpacity
          style={sm.gpsRow}
          onPress={useMyLocation}
          activeOpacity={0.85}
          disabled={gpsBusy}
        >
          <View style={sm.pinWrap}>
            {gpsBusy ? (
              <ActivityIndicator size="small" color="#3B82F6" />
            ) : (
              <Ionicons name="navigate-circle-outline" size={20} color="#3B82F6" />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={sm.gpsName}>Use my location</Text>
            <Text style={sm.gpsSub}>
              {gpsError ?? 'Auto-detect via GPS'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
        </TouchableOpacity>

        {busy && <ActivityIndicator style={{ marginTop: 32 }} color="#3B82F6" />}

        <FlatList
          data={results}
          keyExtractor={(r) => String(r.id)}
          contentContainerStyle={sm.list}
          ListEmptyComponent={() =>
            !busy ? (
              <Text style={sm.hint}>
                {query.trim() ? 'No cities found.' : 'Type a city name to search.'}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={sm.row}
              onPress={() => onSelect({ name: item.name, country: item.country, admin1: item.admin1, latitude: item.latitude, longitude: item.longitude })}
            >
              <View style={sm.pinWrap}>
                <Ionicons name="location-outline" size={18} color="#3B82F6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={sm.rowName}>{item.name}</Text>
                <Text style={sm.rowSub}>{[item.admin1, item.country].filter(Boolean).join(', ')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>
          )}
        />
      </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const sm = StyleSheet.create({
  root:     { flex: 1, backgroundColor: '#F8FAFC' },
  header:   { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  closeBtn: { width: 38, height: 38, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  inputWrap:{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: Radii.lg, paddingHorizontal: Spacing.md, gap: 8, height: 44 },
  input:    { flex: 1, fontFamily: Fonts.regular, fontSize: 15, color: '#0B1120' },
  list:     { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.huge },
  hint:     { textAlign: 'center', marginTop: 40, fontFamily: Fonts.regular, fontSize: 14, color: '#94A3B8' },
  row:      { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  pinWrap:  { width: 36, height: 36, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  rowName:  { fontFamily: Fonts.semibold, fontSize: 15, color: '#0B1120' },
  rowSub:   { fontFamily: Fonts.regular, fontSize: 13, color: '#64748B', marginTop: 2 },
  gpsRow:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  gpsName:  { fontFamily: Fonts.bold, fontSize: 14, color: '#0B1120' },
  gpsSub:   { fontFamily: Fonts.regular, fontSize: 12, color: '#64748B', marginTop: 2 },
});

// ── Stat tile ─────────────────────────────────────────────────────────────────
function Stat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={ws.stat}>
      <Ionicons name={icon as any} size={22} color="rgba(255,255,255,0.85)" />
      <Text style={ws.statVal}>{value}</Text>
      <Text style={ws.statLbl}>{label}</Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function WeatherScreen() {
  const [location,   setLocation]   = useState<SavedLocation | null>(null);
  const [weather,    setWeather]    = useState<WeatherData | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadJSON<SavedLocation | null>(KEYS.weatherLocation, null).then((saved) => {
      if (saved) { setLocation(saved); load(saved); }
    });
  }, []);

  const load = useCallback(async (loc: SavedLocation) => {
    setLoading(true);
    setError(null);
    const cacheKey = `weather:${loc.latitude.toFixed(3)},${loc.longitude.toFixed(3)}`;

    // Check the cache first — if it's fresh, paint immediately and skip the
    // network call entirely. If it's stale we still re-fetch but paint the
    // cached value first so the screen never goes empty on a flaky network.
    const cached = await cache.get<WeatherData>(cacheKey, WEATHER_TTL_MS);
    if (cached?.fresh) {
      setWeather(cached.value);
      setLoading(false);
      return;
    }
    if (cached) {
      setWeather(cached.value);
    }

    try {
      const fresh = await fetchWeather(loc.latitude, loc.longitude);
      setWeather(fresh);
      void cache.set(cacheKey, fresh);
    } catch {
      // Network failed. If we already painted cached data we keep showing it;
      // otherwise surface an error so the user can retry.
      if (!cached) {
        setError('Failed to load weather. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const pickLocation = useCallback((loc: SavedLocation) => {
    setLocation(loc);
    saveJSON(KEYS.weatherLocation, loc);
    setShowSearch(false);
    load(loc);
  }, [load]);

  const hour    = new Date().getHours();
  const isNight = hour < 6 || hour >= 21;
  const wCode   = weather?.current.weather_code ?? 0;
  const grad    = getGradient(wCode, hour);
  const wInfo   = weatherInfo(wCode, isNight);

  // Slice hourly to next 24h from now
  const hourlySlice = useMemo(() => {
    if (!weather) return null;
    const now = new Date();
    let idx = weather.hourly.time.findIndex((t) => new Date(t) >= now);
    if (idx < 0) idx = 0;
    return {
      time: weather.hourly.time.slice(idx, idx + 24),
      temperature_2m: weather.hourly.temperature_2m.slice(idx, idx + 24),
      weather_code: weather.hourly.weather_code.slice(idx, idx + 24),
      precipitation_probability: weather.hourly.precipitation_probability.slice(idx, idx + 24),
    };
  }, [weather]);

  return (
    <>
      <LinearGradient colors={grad} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

          {/* ── Top bar ── */}
          <View style={ws.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={ws.circleBtn}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </TouchableOpacity>

            <View style={ws.topCenter}>
              {location ? (
                <>
                  <Text style={ws.locName} numberOfLines={1}>{location.name}</Text>
                  <Text style={ws.locSub} numberOfLines={1}>
                    {[location.admin1, location.country].filter(Boolean).join(', ')}
                  </Text>
                </>
              ) : (
                <Text style={ws.locName}>Weather</Text>
              )}
            </View>

            <TouchableOpacity onPress={() => setShowSearch(true)} style={ws.circleBtn}>
              <Ionicons name="search-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* ── States ── */}
          {!location ? (
            <View style={ws.centered}>
              <Ionicons name="partly-sunny-outline" size={80} color="rgba(255,255,255,0.5)" />
              <Text style={ws.bigLabel}>No Location Set</Text>
              <Text style={ws.subLabel}>Search for a city to get started</Text>
              <TouchableOpacity style={ws.ghostBtn} onPress={() => setShowSearch(true)}>
                <Ionicons name="search-outline" size={18} color="#fff" />
                <Text style={ws.ghostBtnText}>Search City</Text>
              </TouchableOpacity>
            </View>

          ) : loading ? (
            <View style={ws.centered}>
              <ActivityIndicator size="large" color="rgba(255,255,255,0.9)" />
              <Text style={[ws.subLabel, { marginTop: 16 }]}>Loading weather…</Text>
            </View>

          ) : error ? (
            <View style={ws.centered}>
              <Ionicons name="cloud-offline-outline" size={80} color="rgba(255,255,255,0.45)" />
              <Text style={ws.bigLabel}>Couldn't Load Weather</Text>
              <Text style={ws.subLabel}>{error}</Text>
              <TouchableOpacity style={ws.ghostBtn} onPress={() => load(location)}>
                <Ionicons name="refresh-outline" size={18} color="#fff" />
                <Text style={ws.ghostBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>

          ) : weather ? (
            <ScrollView contentContainerStyle={ws.scroll} showsVerticalScrollIndicator={false}>

              {/* ── Hero ── */}
              <View style={ws.hero}>
                <Ionicons name={wInfo.icon as any} size={84} color="rgba(255,255,255,0.95)" />
                <Text style={ws.tempHuge}>{Math.round(weather.current.temperature_2m)}°</Text>
                <Text style={ws.condition}>{wInfo.label}</Text>
                <Text style={ws.feelsLike}>
                  Feels like {Math.round(weather.current.apparent_temperature)}°
                </Text>
              </View>

              {/* ── Stats row ── */}
              <View style={ws.statsRow}>
                <Stat icon="water-outline"       label="Humidity" value={`${weather.current.relative_humidity_2m}%`} />
                <View style={ws.statDivider} />
                <Stat icon="speedometer-outline" label="Wind"     value={`${Math.round(weather.current.wind_speed_10m)} km/h`} />
                <View style={ws.statDivider} />
                <Stat icon="sunny-outline"        label="UV"       value={String(Math.round(weather.current.uv_index ?? 0))} />
                <View style={ws.statDivider} />
                <Stat icon="umbrella-outline"    label="Rain"     value={`${weather.current.precipitation} mm`} />
              </View>

              {/* ── Hourly ── */}
              {hourlySlice && (
                <View style={ws.section}>
                  <Text style={ws.sectionLabel}>Hourly Forecast</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {hourlySlice.time.map((t, i) => {
                      const hi = weatherInfo(hourlySlice.weather_code[i], false);
                      const rain = hourlySlice.precipitation_probability[i];
                      return (
                        <View key={t} style={ws.hourCard}>
                          <Text style={ws.hourTime}>{fmtHour(t)}</Text>
                          <Ionicons name={hi.icon as any} size={20} color="rgba(255,255,255,0.9)" />
                          <Text style={ws.hourTemp}>{Math.round(hourlySlice.temperature_2m[i])}°</Text>
                          {rain > 0 && <Text style={ws.hourRain}>{rain}%</Text>}
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              )}

              {/* ── 7-day ── */}
              <View style={ws.section}>
                <Text style={ws.sectionLabel}>7-Day Forecast</Text>
                <View style={ws.dailyCard}>
                  {weather.daily.time.map((date, i) => {
                    const di   = weatherInfo(weather.daily.weather_code[i], false);
                    const rain = weather.daily.precipitation_sum[i];
                    return (
                      <View
                        key={date}
                        style={[ws.dailyRow, i < weather.daily.time.length - 1 && ws.dailyBorder]}
                      >
                        <Text style={ws.dayName}>{dayLabel(date, i)}</Text>
                        <Ionicons name={di.icon as any} size={20} color="rgba(255,255,255,0.9)" />
                        {rain > 0 ? (
                          <Text style={ws.dailyRain}>{rain.toFixed(1)} mm</Text>
                        ) : (
                          <View style={{ width: 44 }} />
                        )}
                        <View style={ws.dailyTemps}>
                          <Text style={ws.dailyHi}>{Math.round(weather.daily.temperature_2m_max[i])}°</Text>
                          <Text style={ws.dailyLo}>{Math.round(weather.daily.temperature_2m_min[i])}°</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>

              <Text style={ws.credit}>Powered by Open-Meteo · No API key required</Text>
            </ScrollView>
          ) : null}

        </SafeAreaView>
      </LinearGradient>

      {showSearch && <SearchModal onSelect={pickLocation} onClose={() => setShowSearch(false)} />}
    </>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const ws = StyleSheet.create({
  // Top bar
  topBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  circleBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  topCenter: { flex: 1, alignItems: 'center' },
  locName:   { fontFamily: Fonts.bold, fontSize: 17, color: '#fff' },
  locSub:    { fontFamily: Fonts.regular, fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },

  // Empty/error/loading
  centered:     { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: 10 },
  bigLabel:     { fontFamily: Fonts.bold, fontSize: 22, color: '#fff', textAlign: 'center' },
  subLabel:     { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.7)', textAlign: 'center' },
  ghostBtn:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: Radii.pill, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, marginTop: Spacing.md },
  ghostBtnText: { fontFamily: Fonts.semibold, fontSize: 15, color: '#fff' },

  // Scroll content
  scroll: { paddingBottom: Spacing.huge },

  // Hero
  hero:      { alignItems: 'center', paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: 2 },
  tempHuge:  { fontFamily: Fonts.bold, fontSize: 96, color: '#fff', lineHeight: 100, letterSpacing: -4 },
  condition: { fontFamily: Fonts.medium, fontSize: 22, color: 'rgba(255,255,255,0.92)', marginTop: 4 },
  feelsLike: { fontFamily: Fonts.regular, fontSize: 14, color: 'rgba(255,255,255,0.65)', marginTop: 2 },

  // Stats
  statsRow:    { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radii.xl, marginHorizontal: Spacing.lg, paddingVertical: Spacing.lg, marginBottom: Spacing.lg },
  stat:        { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)' },
  statVal:     { fontFamily: Fonts.bold, fontSize: 14, color: '#fff' },
  statLbl:     { fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.65)' },

  // Section
  section:      { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionLabel: { fontFamily: Fonts.semibold, fontSize: 12, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.sm },

  // Hourly cards
  hourCard: { alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radii.lg, paddingVertical: Spacing.md, paddingHorizontal: 14, minWidth: 62 },
  hourTime: { fontFamily: Fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.75)' },
  hourTemp: { fontFamily: Fonts.bold, fontSize: 16, color: '#fff' },
  hourRain: { fontFamily: Fonts.regular, fontSize: 11, color: '#90CAF9' },

  // Daily card
  dailyCard:   { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: Radii.xl, overflow: 'hidden' },
  dailyRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: Spacing.lg, gap: Spacing.md },
  dailyBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  dayName:     { flex: 1, fontFamily: Fonts.medium, fontSize: 15, color: '#fff' },
  dailyRain:   { fontFamily: Fonts.regular, fontSize: 12, color: '#90CAF9', width: 44, textAlign: 'center' },
  dailyTemps:  { flexDirection: 'row', gap: 10 },
  dailyHi:     { fontFamily: Fonts.bold, fontSize: 15, color: '#fff', width: 32, textAlign: 'right' },
  dailyLo:     { fontFamily: Fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.55)', width: 32, textAlign: 'right' },

  // Footer
  credit: { textAlign: 'center', fontFamily: Fonts.regular, fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: Spacing.md },
});
