import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  Dimensions,
} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ─── Constants ───────────────────────────────────────────────────────────────

const ACCENT = '#8B5CF6';

const TYPE_COLORS: Record<Holiday['type'], string> = {
  national: '#3B82F6',
  religious: '#8B5CF6',
  custom: '#F59E0B',
};

const TYPE_LABELS: Record<Holiday['type'], string> = {
  national: 'National',
  religious: 'Religious',
  custom: 'Custom',
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_WIDTH = (SCREEN_WIDTH - 2 * Spacing.lg) / 7;

// ─── Types ────────────────────────────────────────────────────────────────────

type Holiday = {
  id: string;
  name: string;
  day: number;
  month: number;
  year?: number;
  type: 'national' | 'religious' | 'custom';
};

// ─── Built-in Holidays (India fallback when API is unavailable) ──────────────

const BUILTIN_HOLIDAYS: Holiday[] = [
  { id: 'bi_newyear',      name: "New Year's Day",     day: 1,  month: 1,  type: 'national'  },
  { id: 'bi_makar',        name: 'Makar Sankranti',    day: 14, month: 1,  type: 'religious' },
  { id: 'bi_republic',     name: 'Republic Day',       day: 26, month: 1,  type: 'national'  },
  { id: 'bi_holi',         name: 'Holi',               day: 4,  month: 3,  type: 'religious' },
  { id: 'bi_ambedkar',     name: 'Dr. Ambedkar Jayanti', day: 14, month: 4, type: 'national' },
  { id: 'bi_labour',       name: 'Labour Day',         day: 1,  month: 5,  type: 'national'  },
  { id: 'bi_independence', name: 'Independence Day',   day: 15, month: 8,  type: 'national'  },
  { id: 'bi_gandhi',       name: 'Gandhi Jayanti',     day: 2,  month: 10, type: 'national'  },
  { id: 'bi_diwali',       name: 'Diwali',             day: 12, month: 11, type: 'religious' },
  { id: 'bi_children',     name: "Children's Day",     day: 14, month: 11, type: 'national'  },
  { id: 'bi_christmas',    name: 'Christmas',          day: 25, month: 12, type: 'religious' },
];

// ─── Country list for the selector ───────────────────────────────────────────
type CountryOption = { code: string; name: string; flag: string };

const COUNTRIES: CountryOption[] = [
  { code: 'IN', name: 'India',          flag: '🇮🇳' },
  { code: 'US', name: 'United States',  flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'CA', name: 'Canada',         flag: '🇨🇦' },
  { code: 'AU', name: 'Australia',      flag: '🇦🇺' },
  { code: 'DE', name: 'Germany',        flag: '🇩🇪' },
  { code: 'FR', name: 'France',         flag: '🇫🇷' },
  { code: 'JP', name: 'Japan',          flag: '🇯🇵' },
  { code: 'SG', name: 'Singapore',      flag: '🇸🇬' },
  { code: 'AE', name: 'UAE',            flag: '🇦🇪' },
  { code: 'BR', name: 'Brazil',         flag: '🇧🇷' },
  { code: 'ZA', name: 'South Africa',   flag: '🇿🇦' },
  { code: 'NZ', name: 'New Zealand',    flag: '🇳🇿' },
  { code: 'IT', name: 'Italy',          flag: '🇮🇹' },
  { code: 'ES', name: 'Spain',          flag: '🇪🇸' },
  { code: 'KR', name: 'South Korea',    flag: '🇰🇷' },
  { code: 'MX', name: 'Mexico',         flag: '🇲🇽' },
  { code: 'NG', name: 'Nigeria',        flag: '🇳🇬' },
];

const COUNTRY_PREF_KEY = 'uk_holiday_country';

// ─── API fetch + cache ───────────────────────────────────────────────────────
// Uses the free Nager.Date API: https://date.nager.at
// Cached per country+year so we don't re-fetch on every month change.
const apiCache = new Map<string, Holiday[]>();

async function fetchPublicHolidays(countryCode: string, year: number): Promise<Holiday[]> {
  const key = `${countryCode}:${year}`;
  if (apiCache.has(key)) return apiCache.get(key)!;
  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`);
    if (!res.ok) return [];
    const data: { date: string; localName: string; name: string }[] = await res.json();
    const holidays: Holiday[] = data.map((h, i) => {
      const [, m, d] = h.date.split('-').map(Number);
      return {
        id: `api_${countryCode}_${year}_${i}`,
        name: h.localName || h.name,
        day: d,
        month: m,
        year,
        type: 'national' as const,
      };
    });
    apiCache.set(key, holidays);
    return holidays;
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

function firstDayOfMonth(month: number, year: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function getHolidaysForMonth(
  builtIn: Holiday[],
  custom: Holiday[],
  month: number,
  year: number,
): Holiday[] {
  const all = [...builtIn, ...custom];
  return all.filter((h) => {
    if (h.month !== month) return false;
    if (h.year !== undefined && h.year !== year) return false;
    return true;
  });
}

function uid(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: Holiday['type'] }) {
  const color = TYPE_COLORS[type];
  return (
    <View style={[styles.badge, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Text style={[styles.badgeText, { color }]}>{TYPE_LABELS[type]}</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HolidayCalendarScreen() {
  const { colors } = useAppTheme();

  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth() + 1); // 1-12
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [customHolidays, setCustomHolidays] = useState<Holiday[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [countryCode, setCountryCode] = useState('IN');
  const [apiHolidays, setApiHolidays] = useState<Holiday[]>([]);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [loadingApi, setLoadingApi] = useState(false);

  // Modal form state
  const [formName, setFormName] = useState('');
  const [formDay, setFormDay] = useState('');
  const [formMonth, setFormMonth] = useState('');
  const [formYear, setFormYear] = useState('');
  const dayRef = useRef<TextInput>(null);
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  // Load persisted data
  useEffect(() => {
    loadJSON<Holiday[]>(KEYS.customHolidays, []).then(setCustomHolidays);
    loadJSON<string>(COUNTRY_PREF_KEY, 'IN').then(setCountryCode);
  }, []);

  // Fetch holidays from API whenever country or year changes
  useEffect(() => {
    let cancelled = false;
    setLoadingApi(true);
    fetchPublicHolidays(countryCode, viewYear).then(holidays => {
      if (!cancelled) {
        setApiHolidays(holidays);
        setLoadingApi(false);
      }
    });
    return () => { cancelled = true; };
  }, [countryCode, viewYear]);

  const selectCountry = useCallback((code: string) => {
    setCountryCode(code);
    saveJSON(COUNTRY_PREF_KEY, code);
    setShowCountryPicker(false);
    apiCache.delete(`${code}:${viewYear}`); // force re-fetch
  }, [viewYear]);

  const selectedCountry = COUNTRIES.find(c => c.code === countryCode) ?? COUNTRIES[0];

  // Merge API holidays with built-in fallback + custom holidays.
  // If the API returned data for this country, use it. Otherwise fall back
  // to the hardcoded Indian holidays.
  const builtInForMonth = apiHolidays.length > 0 ? apiHolidays : BUILTIN_HOLIDAYS;
  const monthHolidays = getHolidaysForMonth(
    builtInForMonth,
    customHolidays,
    viewMonth,
    viewYear,
  ).sort((a, b) => a.day - b.day);

  const holidaysByDay = monthHolidays.reduce<Record<number, Holiday[]>>((acc, h) => {
    acc[h.day] = acc[h.day] ? [...acc[h.day], h] : [h];
    return acc;
  }, {});

  const selectedHolidays = selectedDay != null ? (holidaysByDay[selectedDay] ?? []) : [];

  // ── Navigation ──────────────────────────────────────────────────────────────

  const prevMonth = () => {
    if (viewMonth === 1) { setViewMonth(12); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (viewMonth === 12) { setViewMonth(1); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
    setSelectedDay(null);
  };

  // ── Calendar grid ────────────────────────────────────────────────────────────

  const totalDays = daysInMonth(viewMonth, viewYear);
  const startOffset = firstDayOfMonth(viewMonth, viewYear);
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];

  const isToday = (day: number) =>
    day === today.getDate() &&
    viewMonth === today.getMonth() + 1 &&
    viewYear === today.getFullYear();

  // ── Add holiday ──────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormName('');
    setFormDay('');
    setFormMonth('');
    setFormYear('');
  };

  const handleSave = useCallback(async () => {
    const name = formName.trim();
    const day = parseInt(formDay, 10);
    const month = parseInt(formMonth, 10);
    const year = formYear.trim() ? parseInt(formYear, 10) : undefined;

    if (!name) { Alert.alert('Validation', 'Holiday name is required.'); return; }
    if (isNaN(day) || day < 1 || day > 31) { Alert.alert('Validation', 'Day must be 1–31.'); return; }
    if (isNaN(month) || month < 1 || month > 12) { Alert.alert('Validation', 'Month must be 1–12.'); return; }
    if (year !== undefined && (isNaN(year) || year < 2000 || year > 2100)) {
      Alert.alert('Validation', 'Year must be between 2000 and 2100.');
      return;
    }

    const newHoliday: Holiday = { id: uid(), name, day, month, year, type: 'custom' };
    const updated = [...customHolidays, newHoliday];
    setCustomHolidays(updated);
    await saveJSON(KEYS.customHolidays, updated);
    resetForm();
    setModalVisible(false);
  }, [formName, formDay, formMonth, formYear, customHolidays]);

  const handleDelete = useCallback(async (id: string) => {
    Alert.alert('Delete Holiday', 'Remove this custom holiday?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          const updated = customHolidays.filter(h => h.id !== id);
          setCustomHolidays(updated);
          await saveJSON(KEYS.customHolidays, updated);
        },
      },
    ]);
  }, [customHolidays]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ScreenShell
      title="Holiday Calendar"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={
        <TouchableOpacity onPress={() => setShowCountryPicker(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={{ fontSize: 22 }}>{selectedCountry.flag}</Text>
        </TouchableOpacity>
      }
    >
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Country + Month Navigator */}
        <View style={[styles.navigator, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-back" size={20} color={ACCENT} />
          </TouchableOpacity>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.monthTitle, { color: colors.text }]}>
              {MONTH_NAMES[viewMonth - 1]} {viewYear}
            </Text>
            <Text style={{ fontSize: 11, fontFamily: Fonts.medium, color: colors.textMuted, marginTop: 1 }}>
              {selectedCountry.flag} {selectedCountry.name}
              {loadingApi ? ' · Loading…' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="chevron-forward" size={20} color={ACCENT} />
          </TouchableOpacity>
        </View>

        {/* Calendar Grid */}
        <View style={[styles.calendarCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Weekday headers */}
          <View style={styles.weekRow}>
            {WEEKDAYS.map(d => (
              <View key={d} style={[styles.dayCell, { width: CELL_WIDTH }]}>
                <Text style={[styles.weekdayLabel, { color: colors.textMuted }]}>{d}</Text>
              </View>
            ))}
          </View>

          {/* Day cells */}
          <View style={styles.gridWrap}>
            {cells.map((day, idx) => {
              if (day === null) {
                return <View key={`blank_${idx}`} style={[styles.dayCell, { width: CELL_WIDTH }]} />;
              }
              const holidays = holidaysByDay[day] ?? [];
              const isSelected = selectedDay === day;
              const todayFlag = isToday(day);
              const hasHoliday = holidays.length > 0;
              const holidayColor = hasHoliday ? TYPE_COLORS[holidays[0].type] : null;

              return (
                <TouchableOpacity
                  key={`day_${day}`}
                  style={[
                    styles.dayCell,
                    styles.dayCellBox,
                    { width: CELL_WIDTH },
                    // Light background for every day; tinted for holidays
                    {
                      backgroundColor: isSelected
                        ? ACCENT + '22'
                        : hasHoliday
                          ? (holidayColor ?? ACCENT) + '10'
                          : colors.surface,
                      borderColor: isSelected
                        ? ACCENT + '55'
                        : hasHoliday
                          ? (holidayColor ?? ACCENT) + '30'
                          : colors.border,
                    },
                    todayFlag && { borderColor: ACCENT, borderWidth: 1.5 },
                  ]}
                  onPress={() => setSelectedDay(isSelected ? null : day)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      { color: todayFlag ? ACCENT : hasHoliday ? (holidayColor ?? ACCENT) : colors.text },
                      (todayFlag || hasHoliday) && styles.todayNumber,
                    ]}
                  >
                    {day}
                  </Text>
                  {hasHoliday && (
                    <View style={styles.dotRow}>
                      {holidays.slice(0, 3).map((h, i) => (
                        <View key={i} style={[styles.dot, { backgroundColor: TYPE_COLORS[h.type] }]} />
                      ))}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Selected Day Panel */}
        {selectedDay !== null && (
          <View style={[styles.selectedPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.selectedDayTitle, { color: colors.text }]}>
              {selectedDay} {MONTH_NAMES[viewMonth - 1]}
            </Text>
            {selectedHolidays.length === 0 ? (
              <Text style={[styles.noHolidayText, { color: colors.textMuted }]}>No holiday</Text>
            ) : (
              selectedHolidays.map(h => (
                <View key={h.id} style={styles.selectedHolidayRow}>
                  <View style={[styles.colorBar, { backgroundColor: TYPE_COLORS[h.type] }]} />
                  <Text style={[styles.selectedHolidayName, { color: colors.text }]}>{h.name}</Text>
                  <TypeBadge type={h.type} />
                </View>
              ))
            )}
          </View>
        )}

        {/* Holidays This Month */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Holidays in {MONTH_NAMES[viewMonth - 1]}
          </Text>
          <Text style={[styles.sectionCount, { color: colors.textMuted }]}>
            {monthHolidays.length} holiday{monthHolidays.length !== 1 ? 's' : ''}
          </Text>
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {monthHolidays.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>No holidays this month</Text>
            </View>
          ) : (
            monthHolidays.map((h, index) => (
              <View
                key={h.id}
                style={[
                  styles.holidayRow,
                  index < monthHolidays.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                ]}
              >
                <View style={[styles.dayBubble, { backgroundColor: TYPE_COLORS[h.type] + '18' }]}>
                  <Text style={[styles.dayBubbleText, { color: TYPE_COLORS[h.type] }]}>{h.day}</Text>
                </View>
                <View style={styles.holidayInfo}>
                  <Text style={[styles.holidayName, { color: colors.text }]}>{h.name}</Text>
                  <TypeBadge type={h.type} />
                </View>
                {h.type === 'custom' && (
                  <TouchableOpacity
                    onPress={() => handleDelete(h.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.deleteBtn}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </View>

        {/* Add Custom Holiday Button */}
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: ACCENT }]}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.addButtonText}>Add Custom Holiday</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add Holiday Modal */}
      <KeyboardAwareModal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { resetForm(); setModalVisible(false); }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add Custom Holiday</Text>
              <TouchableOpacity
                onPress={() => { resetForm(); setModalVisible(false); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Company Foundation Day"
              placeholderTextColor={colors.textMuted}
              value={formName}
              onChangeText={setFormName}
              returnKeyType="next"
            />

            <View style={styles.rowFields}>
              <View style={styles.fieldHalf}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Day (1–31) *</Text>
                <TextInput
                  ref={dayRef}
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="15"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={formDay}
                  onChangeText={v => {
                    setFormDay(v);
                    if (v.length === 2 || (v.length === 1 && parseInt(v, 10) > 3)) {
                      monthRef.current?.focus();
                    }
                  }}
                  maxLength={2}
                  returnKeyType="next"
                  onSubmitEditing={() => monthRef.current?.focus()}
                />
              </View>
              <View style={styles.fieldHalf}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Month (1–12) *</Text>
                <TextInput
                  ref={monthRef}
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                  placeholder="8"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  value={formMonth}
                  onChangeText={v => {
                    setFormMonth(v);
                    if (v.length === 2 || (v.length === 1 && parseInt(v, 10) > 1)) {
                      yearRef.current?.focus();
                    }
                  }}
                  maxLength={2}
                  returnKeyType="next"
                  onSubmitEditing={() => yearRef.current?.focus()}
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Year (optional — leave blank to recur)</Text>
            <TextInput
              ref={yearRef}
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="2026"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              value={formYear}
              onChangeText={setFormYear}
              maxLength={4}
              returnKeyType="done"
            />

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: ACCENT }]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>Save Holiday</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAwareModal>

      {/* Country Picker Modal */}
      <KeyboardAwareModal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setShowCountryPicker(false)} />
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Select Country</Text>
              <TouchableOpacity onPress={() => setShowCountryPicker(false)}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={{ fontSize: 12, fontFamily: Fonts.regular, color: colors.textMuted, marginBottom: Spacing.md }}>
              Public holidays will be fetched for the selected country.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 380 }}>
              {COUNTRIES.map(c => {
                const active = c.code === countryCode;
                return (
                  <TouchableOpacity
                    key={c.code}
                    style={[
                      styles.countryRow,
                      {
                        backgroundColor: active ? ACCENT + '14' : 'transparent',
                        borderColor: active ? ACCENT + '40' : colors.border,
                      },
                    ]}
                    onPress={() => selectCountry(c.code)}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 22 }}>{c.flag}</Text>
                    <Text style={[styles.countryName, { color: colors.text }]}>{c.name}</Text>
                    {active && <Ionicons name="checkmark-circle" size={20} color={ACCENT} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.huge,
  },

  // Navigator
  navigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  navBtn: {
    padding: Spacing.xs,
  },
  monthTitle: {
    fontSize: 16,
    fontFamily: Fonts.semibold,
  },

  // Calendar card
  calendarCard: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 0,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  weekRow: {
    flexDirection: 'row',
    paddingBottom: Spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#00000011',
    marginBottom: Spacing.xs,
  },
  gridWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    height: CELL_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 2,
  },
  dayCellBox: {
    borderWidth: 0.5,
    borderRadius: Radii.sm,
    margin: 0.5,
  },
  weekdayLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
  },
  dayNumber: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    lineHeight: 16,
  },
  todayNumber: {
    fontFamily: Fonts.bold,
  },
  todayUnderline: {
    height: 2,
    width: 14,
    borderRadius: 1,
    marginTop: 1,
  },
  dotRow: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // Selected day panel
  selectedPanel: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  selectedDayTitle: {
    fontSize: 14,
    fontFamily: Fonts.semibold,
    marginBottom: Spacing.sm,
  },
  noHolidayText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    fontStyle: 'italic',
  },
  selectedHolidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  colorBar: {
    width: 3,
    height: 18,
    borderRadius: 2,
  },
  selectedHolidayName: {
    flex: 1,
    fontSize: 14,
    fontFamily: Fonts.medium,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.semibold,
  },
  sectionCount: {
    fontSize: 12,
    fontFamily: Fonts.regular,
  },

  // List card
  listCard: {
    borderRadius: Radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
  },
  holidayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  dayBubble: {
    width: 36,
    height: 36,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBubbleText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  holidayInfo: {
    flex: 1,
    gap: 3,
  },
  holidayName: {
    fontSize: 14,
    fontFamily: Fonts.medium,
  },
  deleteBtn: {
    padding: Spacing.xs,
  },

  // Badge
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radii.pill,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: Fonts.semibold,
    letterSpacing: 0.3,
  },

  // Add button
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radii.lg,
    gap: Spacing.sm,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.semibold,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: Radii.xl,
    borderTopRightRadius: Radii.xl,
    padding: Spacing.lg,
    paddingBottom: Spacing.huge,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: Fonts.bold,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radii.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: 15,
    fontFamily: Fonts.regular,
  },
  rowFields: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  fieldHalf: {
    flex: 1,
  },
  saveButton: {
    marginTop: Spacing.lg,
    borderRadius: Radii.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  // Country picker
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radii.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  countryName: {
    flex: 1,
    fontSize: 15,
    fontFamily: Fonts.medium,
  },
});
