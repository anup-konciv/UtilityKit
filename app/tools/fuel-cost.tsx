import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#EA580C';

type UnitSystem = 'metric' | 'imperial';

export default function FuelCostScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [units, setUnits] = useState<UnitSystem>('metric');
  const [distance, setDistance] = useState('');
  const [mileage, setMileage] = useState('');
  const [fuelPrice, setFuelPrice] = useState('');
  const [passengers, setPassengers] = useState('1');

  const distLabel = units === 'metric' ? 'km' : 'miles';
  const mileageLabel = units === 'metric' ? 'km/L' : 'MPG';
  const priceLabel = units === 'metric' ? '/L' : '/gal';

  const result = useMemo(() => {
    const d = parseFloat(distance);
    const m = parseFloat(mileage);
    const p = parseFloat(fuelPrice);
    const pax = Math.max(1, parseInt(passengers) || 1);

    if (!d || !m || !p || d <= 0 || m <= 0 || p <= 0) return null;

    const fuelUsed = d / m;
    const totalCost = fuelUsed * p;
    const costPerPerson = totalCost / pax;
    const costPerUnit = totalCost / d;

    return { fuelUsed, totalCost, costPerPerson, costPerUnit, passengers: pax };
  }, [distance, mileage, fuelPrice, passengers, units]);

  const presets = [
    { label: 'City', val: units === 'metric' ? '12' : '25' },
    { label: 'Highway', val: units === 'metric' ? '18' : '35' },
    { label: 'SUV', val: units === 'metric' ? '9' : '20' },
    { label: 'Electric', val: units === 'metric' ? '50' : '100' },
  ];

  return (
    <ScreenShell title="Fuel Cost" accentColor={ACCENT}>
      {/* Unit toggle */}
      <View style={styles.unitRow}>
        {(['metric', 'imperial'] as UnitSystem[]).map(u => (
          <TouchableOpacity
            key={u}
            style={[styles.unitBtn, units === u && { backgroundColor: ACCENT, borderColor: ACCENT }]}
            onPress={() => { setUnits(u); setMileage(''); }}
          >
            <Text style={[styles.unitBtnText, { color: units === u ? '#fff' : colors.textMuted }]}>
              {u === 'metric' ? 'Metric (km/L)' : 'Imperial (MPG)'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Distance */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.fieldLabel}>Distance ({distLabel})</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={distance}
          onChangeText={setDistance}
          placeholder={`e.g. 250 ${distLabel}`}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
      </View>

      {/* Mileage */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.fieldLabel}>Mileage ({mileageLabel})</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={mileage}
          onChangeText={setMileage}
          placeholder={`e.g. ${units === 'metric' ? '15' : '30'} ${mileageLabel}`}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
        <View style={styles.presetRow}>
          {presets.map(p => (
            <TouchableOpacity
              key={p.label}
              style={[styles.presetBtn, { backgroundColor: ACCENT + '15', borderColor: ACCENT + '40' }]}
              onPress={() => setMileage(p.val)}
            >
              <Text style={[styles.presetText, { color: ACCENT }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Fuel Price */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.fieldLabel}>Fuel Price ({priceLabel})</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
          value={fuelPrice}
          onChangeText={setFuelPrice}
          placeholder={`e.g. ${units === 'metric' ? '1.50' : '3.50'}`}
          placeholderTextColor={colors.textMuted}
          keyboardType="numeric"
        />
      </View>

      {/* Passengers */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={styles.fieldLabel}>Split Between (passengers)</Text>
        <View style={styles.paxRow}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity
              key={n}
              style={[styles.paxBtn, parseInt(passengers) === n && { backgroundColor: ACCENT, borderColor: ACCENT }]}
              onPress={() => setPassengers(String(n))}
            >
              <Ionicons name="person" size={14} color={parseInt(passengers) === n ? '#fff' : colors.textMuted} />
              <Text style={[styles.paxBtnText, { color: parseInt(passengers) === n ? '#fff' : colors.textMuted }]}>{n}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={[styles.paxInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={passengers}
            onChangeText={setPassengers}
            keyboardType="numeric"
            maxLength={2}
            textAlign="center"
          />
        </View>
      </View>

      {/* Result */}
      {result && (
        <View style={[styles.resultCard, { backgroundColor: ACCENT + '10', borderColor: ACCENT + '40' }]}>
          <View style={styles.resultMain}>
            <Text style={[styles.resultLabel, { color: colors.textMuted }]}>Total Fuel Cost</Text>
            <Text style={[styles.resultValue, { color: ACCENT }]}>{result.totalCost.toFixed(2)}</Text>
          </View>

          <View style={styles.resultGrid}>
            <View style={styles.resultItem}>
              <Text style={[styles.resultItemVal, { color: colors.text }]}>
                {result.fuelUsed.toFixed(1)} {units === 'metric' ? 'L' : 'gal'}
              </Text>
              <Text style={[styles.resultItemLabel, { color: colors.textMuted }]}>Fuel Needed</Text>
            </View>
            <View style={styles.resultItem}>
              <Text style={[styles.resultItemVal, { color: colors.text }]}>
                {result.costPerUnit.toFixed(2)}/{distLabel}
              </Text>
              <Text style={[styles.resultItemLabel, { color: colors.textMuted }]}>Cost per {distLabel}</Text>
            </View>
            {result.passengers > 1 && (
              <View style={styles.resultItem}>
                <Text style={[styles.resultItemVal, { color: '#10B981' }]}>
                  {result.costPerPerson.toFixed(2)}/person
                </Text>
                <Text style={[styles.resultItemLabel, { color: colors.textMuted }]}>Split {result.passengers} ways</Text>
              </View>
            )}
          </View>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    unitRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
    unitBtn: { flex: 1, paddingVertical: 10, borderRadius: Radii.lg, borderWidth: 1.5, borderColor: c.border, alignItems: 'center' },
    unitBtnText: { fontSize: 12, fontFamily: Fonts.semibold },
    card: { borderRadius: Radii.lg, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    fieldLabel: { fontSize: 11, fontFamily: Fonts.bold, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },
    input: { borderWidth: 1.5, borderRadius: Radii.md, padding: Spacing.md, fontSize: 18, fontFamily: Fonts.bold },
    presetRow: { flexDirection: 'row', gap: 6, marginTop: Spacing.sm, flexWrap: 'wrap' },
    presetBtn: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    presetText: { fontSize: 11, fontFamily: Fonts.semibold },
    paxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    paxBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radii.md, borderWidth: 1.5, borderColor: c.border },
    paxBtnText: { fontSize: 12, fontFamily: Fonts.bold },
    paxInput: { width: 48, borderWidth: 1.5, borderRadius: Radii.md, padding: 8, fontSize: 14, fontFamily: Fonts.bold },
    resultCard: { borderRadius: Radii.xl, borderWidth: 1.5, padding: Spacing.xl, marginTop: Spacing.sm },
    resultMain: { alignItems: 'center', marginBottom: Spacing.lg },
    resultLabel: { fontSize: 12, fontFamily: Fonts.medium, marginBottom: 4 },
    resultValue: { fontSize: 42, fontFamily: Fonts.bold },
    resultGrid: { gap: Spacing.md },
    resultItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    resultItemVal: { fontSize: 16, fontFamily: Fonts.bold },
    resultItemLabel: { fontSize: 12, fontFamily: Fonts.regular },
  });
