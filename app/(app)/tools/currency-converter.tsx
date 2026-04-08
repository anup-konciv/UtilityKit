import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';
import { cache } from '@/lib/cache';

// 12 hours — exchange rates barely move during a day for everyday uses,
// and offline survivability matters more than freshness for a converter.
const FX_TTL_MS = 12 * 60 * 60 * 1000;

const ACCENT = '#059669';

const POPULAR = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'AED'];

const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar', EUR: 'Euro', GBP: 'British Pound', INR: 'Indian Rupee',
  JPY: 'Japanese Yen', AUD: 'Australian Dollar', CAD: 'Canadian Dollar',
  CHF: 'Swiss Franc', CNY: 'Chinese Yuan', AED: 'UAE Dirham',
  KRW: 'South Korean Won', SGD: 'Singapore Dollar', HKD: 'Hong Kong Dollar',
  SEK: 'Swedish Krona', NOK: 'Norwegian Krone', DKK: 'Danish Krone',
  NZD: 'New Zealand Dollar', ZAR: 'South African Rand', BRL: 'Brazilian Real',
  MXN: 'Mexican Peso', THB: 'Thai Baht', MYR: 'Malaysian Ringgit',
  IDR: 'Indonesian Rupiah', PHP: 'Philippine Peso', TRY: 'Turkish Lira',
  RUB: 'Russian Ruble', PLN: 'Polish Zloty', CZK: 'Czech Koruna',
  HUF: 'Hungarian Forint', SAR: 'Saudi Riyal', PKR: 'Pakistani Rupee',
  BDT: 'Bangladeshi Taka', LKR: 'Sri Lankan Rupee', NGN: 'Nigerian Naira',
  EGP: 'Egyptian Pound', KES: 'Kenyan Shilling', GHS: 'Ghanaian Cedi',
};

const SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CNY: '¥',
  KRW: '₩', THB: '฿', TRY: '₺', BRL: 'R$', ZAR: 'R', PHP: '₱',
};

type PickerTarget = 'from' | 'to' | null;

function CurrencyPicker({
  visible,
  selected,
  currencies,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean;
  selected: string;
  currencies: string[];
  onSelect: (code: string) => void;
  onClose: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return currencies;
    return currencies.filter(c =>
      c.toLowerCase().includes(q) ||
      (CURRENCY_NAMES[c] ?? '').toLowerCase().includes(q),
    );
  }, [search, currencies]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={ps.backdrop}>
        <View style={[ps.sheet, { backgroundColor: colors.bg }]}>
          <View style={[ps.header, { borderBottomColor: colors.border }]}>
            <Text style={[ps.title, { color: colors.text }]}>Select Currency</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={[ps.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="search-outline" size={16} color={colors.textMuted} />
            <TextInput
              style={[ps.searchInput, { color: colors.text }]}
              placeholder="Search currency..."
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={item => item}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <TouchableOpacity
                  style={[ps.row, active && { backgroundColor: ACCENT + '15' }]}
                  onPress={() => { onSelect(item); onClose(); setSearch(''); }}
                >
                  <Text style={[ps.code, { color: active ? ACCENT : colors.text }]}>{item}</Text>
                  <Text style={[ps.name, { color: colors.textMuted }]}>{CURRENCY_NAMES[item] ?? item}</Text>
                  {active && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000066' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '75%', paddingBottom: 32 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1 },
  title: { fontSize: 16, fontFamily: Fonts.bold },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: Spacing.md, paddingHorizontal: Spacing.md, height: 40, borderRadius: Radii.lg, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: Fonts.regular, padding: 0 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: 12, gap: Spacing.md },
  code: { fontSize: 15, fontFamily: Fonts.bold, width: 50 },
  name: { flex: 1, fontSize: 14, fontFamily: Fonts.regular },
});

export default function CurrencyConverterScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [fromCur, setFromCur] = useState('USD');
  const [toCur, setToCur] = useState('INR');
  const [amount, setAmount] = useState('1');
  // Persisted favourite currency pairs.
  const favourites = useToolHistory<{ from: string; to: string }>('currency-favs', { max: 8 });
  const [rates, setRates] = useState<Record<string, number>>({});
  const [currencies, setCurrencies] = useState<string[]>(POPULAR);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [pickerFor, setPickerFor] = useState<PickerTarget>(null);

  const fetchRates = useCallback(async (base: string) => {
    setLoading(true);
    setError('');
    const cacheKey = `fx:${base}`;

    // Hydrate from cache immediately so the UI never shows an empty grid
    // on a flaky network. Re-fetch in the background unless cache is fresh.
    const cached = await cache.get<{ rates: Record<string, number>; date?: string }>(
      cacheKey,
      FX_TTL_MS,
    );
    if (cached) {
      setRates(cached.value.rates);
      setCurrencies(Object.keys(cached.value.rates).sort());
      setLastUpdated(cached.value.date ?? '');
      if (cached.fresh) {
        setLoading(false);
        return;
      }
    }

    try {
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
      const json = await res.json();
      setRates(json.rates);
      setCurrencies(Object.keys(json.rates).sort());
      setLastUpdated(json.date ?? new Date().toISOString().slice(0, 10));
      void cache.set(cacheKey, { rates: json.rates, date: json.date });
    } catch {
      if (!cached) setError('Failed to fetch rates. Check your connection.');
      // Keep cached values visible if we already painted them.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRates(fromCur); }, [fromCur]);

  const result = useMemo(() => {
    const v = parseFloat(amount);
    if (isNaN(v) || !rates[toCur]) return null;
    return v * rates[toCur];
  }, [amount, rates, toCur]);

  const rate = rates[toCur] ?? 0;

  const swap = () => {
    haptics.tap();
    const oldFrom = fromCur;
    setFromCur(toCur);
    setToCur(oldFrom);
  };

  // Pin the current pair as a favourite. Dedupe by label.
  const pinPair = useCallback(() => {
    const label = `${fromCur} → ${toCur}`;
    if (favourites.entries.some((e) => e.label === label)) return;
    haptics.success();
    favourites.push({ from: fromCur, to: toCur }, label);
  }, [fromCur, toCur, favourites]);

  const sym = (code: string) => SYMBOLS[code] ?? code;

  return (
    <ScreenShell title="Currency Converter" accentColor={ACCENT}>
      {/* Currency Selector Row */}
      <View style={styles.curRow}>
        <TouchableOpacity
          style={[styles.curBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPickerFor('from')}
        >
          <Text style={[styles.curCode, { color: ACCENT }]}>{fromCur}</Text>
          <Text style={[styles.curName, { color: colors.text }]} numberOfLines={1}>
            {CURRENCY_NAMES[fromCur] ?? fromCur}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity style={[styles.swapBtn, { backgroundColor: ACCENT + '18', borderColor: ACCENT + '40' }]} onPress={swap}>
          <Ionicons name="swap-horizontal" size={20} color={ACCENT} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.curBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setPickerFor('to')}
        >
          <Text style={[styles.curCode, { color: ACCENT }]}>{toCur}</Text>
          <Text style={[styles.curName, { color: colors.text }]} numberOfLines={1}>
            {CURRENCY_NAMES[toCur] ?? toCur}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Amount Input */}
      <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.label}>Amount</Text>
        <View style={styles.amountRow}>
          <Text style={[styles.amountSymbol, { color: ACCENT }]}>{sym(fromCur)}</Text>
          <TextInput
            style={[styles.amountInput, { color: colors.text }]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      {/* Loading / Error */}
      {loading && <ActivityIndicator size="large" color={ACCENT} style={{ marginVertical: Spacing.lg }} />}
      {!!error && (
        <View style={[styles.errorBox, { backgroundColor: '#EF444415', borderColor: '#EF4444' }]}>
          <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchRates(fromCur)}>
            <Text style={{ color: '#EF4444', fontFamily: Fonts.bold, fontSize: 13 }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Result */}
      {result !== null && !loading && (
        <View style={[styles.resultCard, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '40' }]}>
          <Text style={[styles.resultLabel, { color: colors.textMuted }]}>
            {amount || '0'} {fromCur} =
          </Text>
          <Text style={[styles.resultValue, { color: ACCENT }]}>
            {sym(toCur)} {result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
          </Text>
          <Text style={[styles.rateText, { color: colors.textMuted }]}>
            1 {fromCur} = {rate.toFixed(4)} {toCur}
          </Text>
          {!!lastUpdated && (
            <Text style={[styles.updatedText, { color: colors.textMuted }]}>
              Updated: {lastUpdated}
            </Text>
          )}
          <TouchableOpacity
            style={[
              styles.pinBtn,
              { backgroundColor: ACCENT + '20', borderColor: ACCENT + '40' },
            ]}
            onPress={pinPair}
          >
            <Ionicons name="bookmark-outline" size={14} color={ACCENT} />
            <Text style={[styles.pinBtnText, { color: ACCENT }]}>Pin pair</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pinned pairs */}
      {favourites.entries.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={styles.gridTitle}>Pinned Pairs</Text>
            <TouchableOpacity onPress={() => { haptics.warning(); favourites.clear(); }}>
              <Text style={{ color: ACCENT, fontFamily: Fonts.semibold, fontSize: 12 }}>Clear</Text>
            </TouchableOpacity>
          </View>
          {favourites.entries.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={[styles.gridRow, { borderBottomColor: colors.border }]}
              onPress={() => {
                haptics.tap();
                setFromCur(entry.value.from);
                setToCur(entry.value.to);
              }}
            >
              <Text style={[styles.gridCode, { color: colors.text }]}>{entry.value.from}</Text>
              <Text style={[styles.gridName, { color: colors.textMuted }]}>→ {entry.value.to}</Text>
              <Ionicons name="refresh" size={14} color={ACCENT} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Popular Currencies Quick Grid */}
      {!loading && Object.keys(rates).length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.gridTitle}>1 {fromCur} equals</Text>
          {POPULAR.filter(c => c !== fromCur).slice(0, 6).map(code => (
            <View key={code} style={[styles.gridRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.gridCode, { color: colors.text }]}>{code}</Text>
              <Text style={[styles.gridName, { color: colors.textMuted }]}>{CURRENCY_NAMES[code] ?? ''}</Text>
              <Text style={[styles.gridRate, { color: ACCENT }]}>
                {(rates[code] ?? 0).toFixed(code === 'JPY' || code === 'KRW' ? 2 : 4)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Pickers */}
      <CurrencyPicker
        visible={pickerFor === 'from'}
        selected={fromCur}
        currencies={currencies}
        onSelect={setFromCur}
        onClose={() => setPickerFor(null)}
        colors={colors}
      />
      <CurrencyPicker
        visible={pickerFor === 'to'}
        selected={toCur}
        currencies={currencies}
        onSelect={setToCur}
        onClose={() => setPickerFor(null)}
        colors={colors}
      />
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    curRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.lg },
    curBtn: {
      flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6,
      paddingHorizontal: Spacing.md, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1,
    },
    curCode: { fontSize: 12, fontFamily: Fonts.bold },
    curName: { flex: 1, fontSize: 13, fontFamily: Fonts.semibold },
    swapBtn: { width: 40, height: 40, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    inputCard: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    label: { fontSize: 12, fontFamily: Fonts.medium, color: c.textMuted, marginBottom: 6 },
    amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    amountSymbol: { fontSize: 24, fontFamily: Fonts.bold },
    amountInput: { flex: 1, fontSize: 28, fontFamily: Fonts.bold, padding: 0 },
    errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.md },
    errorText: { flex: 1, fontSize: 13, fontFamily: Fonts.regular, color: '#EF4444' },
    resultCard: { borderRadius: Radii.xl, borderWidth: 1.5, padding: Spacing.xl, alignItems: 'center', marginBottom: Spacing.lg },
    resultLabel: { fontSize: 14, fontFamily: Fonts.medium, marginBottom: 4 },
    resultValue: { fontSize: 32, fontFamily: Fonts.bold },
    rateText: { fontSize: 13, fontFamily: Fonts.regular, marginTop: 8 },
    updatedText: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 4 },
    pinBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: Radii.pill,
      borderWidth: 1,
      marginTop: Spacing.md,
      alignSelf: 'center',
    },
    pinBtnText: { fontSize: 12, fontFamily: Fonts.bold },
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    gridTitle: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
    gridRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
    gridCode: { width: 45, fontSize: 14, fontFamily: Fonts.bold },
    gridName: { flex: 1, fontSize: 12, fontFamily: Fonts.regular },
    gridRate: { fontSize: 14, fontFamily: Fonts.bold },
  });
