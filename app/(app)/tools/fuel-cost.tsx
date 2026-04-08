import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { withAlpha } from '@/lib/color-utils';
import { useToolHistory } from '@/lib/use-tool-history';
import { haptics } from '@/lib/haptics';

const ACCENT = '#EA580C';
const SUCCESS = '#10B981';

type UnitSystem = 'metric' | 'imperial';

export default function FuelCostScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [units, setUnits] = useState<UnitSystem>('metric');
  const [distance, setDistance] = useState('220');
  const [mileage, setMileage] = useState('16');
  const [fuelPrice, setFuelPrice] = useState('104');
  const [passengers, setPassengers] = useState('2');
  const [buffer, setBuffer] = useState('5');
  const [roundTrip, setRoundTrip] = useState(true);
  const history = useToolHistory<{
    units: UnitSystem;
    distance: string;
    mileage: string;
    fuelPrice: string;
    passengers: string;
    buffer: string;
    roundTrip: boolean;
  }>('fuel-cost', { max: 8 });

  const distLabel = units === 'metric' ? 'km' : 'mi';
  const mileageLabel = units === 'metric' ? 'km/L' : 'MPG';
  const volumeLabel = units === 'metric' ? 'L' : 'gal';
  const fuelPresets = units === 'metric'
    ? [
        { label: 'City Car', value: '14' },
        { label: 'Highway', value: '18' },
        { label: 'SUV', value: '10' },
      ]
    : [
        { label: 'City Car', value: '30' },
        { label: 'Highway', value: '38' },
        { label: 'SUV', value: '22' },
      ];

  const trip = useMemo(() => {
    const distanceValue = Math.max(0, Number.parseFloat(distance) || 0);
    const efficiencyValue = Math.max(0, Number.parseFloat(mileage) || 0);
    const fuelPriceValue = Math.max(0, Number.parseFloat(fuelPrice) || 0);
    const passengersCount = Math.max(1, Number.parseInt(passengers, 10) || 1);
    const bufferPct = Math.max(0, Number.parseFloat(buffer) || 0);
    const plannedDistance = roundTrip ? distanceValue * 2 : distanceValue;

    if (!plannedDistance || !efficiencyValue || !fuelPriceValue) {
      return null;
    }

    const baseFuel = plannedDistance / efficiencyValue;
    const reserveFuel = baseFuel * (bufferPct / 100);
    const fuelNeeded = baseFuel + reserveFuel;
    const totalCost = fuelNeeded * fuelPriceValue;

    return {
      plannedDistance,
      fuelNeeded,
      reserveFuel,
      totalCost,
      costPerPassenger: totalCost / passengersCount,
      costPerUnit: totalCost / plannedDistance,
      passengersCount,
    };
  }, [buffer, distance, fuelPrice, mileage, passengers, roundTrip]);

  return (
    <ScreenShell title="Fuel Cost" accentColor={ACCENT}>
      <LinearGradient
        colors={['#7C2D12', '#EA580C', '#FDBA74']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Trip Planner</Text>
        <Text style={styles.heroTitle}>{trip ? trip.totalCost.toFixed(2) : '--'}</Text>
        <Text style={styles.heroCopy}>
          Estimate fuel, reserve buffer, and split cost for solo drives or shared road trips.
        </Text>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{roundTrip ? 'Round' : 'One Way'}</Text>
            <Text style={styles.heroStatLabel}>Trip Type</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{buffer || '0'}%</Text>
            <Text style={styles.heroStatLabel}>Reserve</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{passengers || '1'}</Text>
            <Text style={styles.heroStatLabel}>Travelers</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.toggleRow}>
          {(['metric', 'imperial'] as UnitSystem[]).map((item) => {
            const active = units === item;
            return (
              <TouchableOpacity
                key={item}
                style={[
                  styles.toggleChip,
                  active
                    ? { backgroundColor: ACCENT, borderColor: ACCENT }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => setUnits(item)}
              >
                <Text style={[styles.toggleChipText, { color: active ? '#FFFFFF' : colors.textMuted }]}>
                  {item === 'metric' ? 'Metric' : 'Imperial'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <TouchableOpacity
            style={[
              styles.switchCard,
              roundTrip
                ? { backgroundColor: withAlpha(ACCENT, '16'), borderColor: withAlpha(ACCENT, '3A') }
                : { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={() => setRoundTrip((current) => !current)}
          >
            <Ionicons name="repeat-outline" size={18} color={roundTrip ? ACCENT : colors.textMuted} />
            <Text style={[styles.switchTitle, { color: colors.text }]}>Round Trip</Text>
            <Text style={[styles.switchCopy, { color: colors.textMuted }]}>
              {roundTrip ? 'Distance is doubled automatically.' : 'Estimate only one side of the trip.'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.fieldGrid}>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Distance ({distLabel})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={distance}
              onChangeText={setDistance}
              keyboardType="numeric"
              placeholder="Enter distance"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Fuel Price</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={fuelPrice}
              onChangeText={setFuelPrice}
              keyboardType="numeric"
              placeholder="Price per unit"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Mileage ({mileageLabel})</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={mileage}
              onChangeText={setMileage}
              keyboardType="numeric"
              placeholder="Efficiency"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Reserve Buffer</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={buffer}
              onChangeText={setBuffer}
              keyboardType="numeric"
              placeholder="Buffer %"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.presetRow}>
          {fuelPresets.map((preset) => (
            <TouchableOpacity
              key={preset.label}
              style={[styles.presetChip, { backgroundColor: withAlpha(ACCENT, '12'), borderColor: withAlpha(ACCENT, '2E') }]}
              onPress={() => setMileage(preset.value)}
            >
              <Text style={[styles.presetLabel, { color: ACCENT }]}>{preset.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.sectionRow}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Split Cost</Text>
          <Text style={[styles.inlineValue, { color: colors.text }]}>{Math.max(1, Number.parseInt(passengers, 10) || 1)} travelers</Text>
        </View>
        <View style={styles.passengerRow}>
          {[1, 2, 3, 4, 5, 6].map((value) => {
            const active = Number.parseInt(passengers, 10) === value;
            return (
              <TouchableOpacity
                key={value}
                style={[
                  styles.passengerChip,
                  active
                    ? { backgroundColor: SUCCESS, borderColor: SUCCESS }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                onPress={() => setPassengers(String(value))}
              >
                <Ionicons name="person-outline" size={14} color={active ? '#FFFFFF' : colors.textMuted} />
                <Text style={[styles.passengerText, { color: active ? '#FFFFFF' : colors.textMuted }]}>{value}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.summaryGrid}>
        {[
          {
            label: 'Fuel Needed',
            value: trip ? `${trip.fuelNeeded.toFixed(1)} ${volumeLabel}` : '--',
            tint: ACCENT,
            icon: 'water-outline' as const,
          },
          {
            label: `Cost / ${distLabel}`,
            value: trip ? trip.costPerUnit.toFixed(2) : '--',
            tint: '#8B5CF6',
            icon: 'speedometer-outline' as const,
          },
          {
            label: 'Per Traveler',
            value: trip ? trip.costPerPassenger.toFixed(2) : '--',
            tint: SUCCESS,
            icon: 'people-outline' as const,
          },
        ].map((item) => (
          <View key={item.label} style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.summaryIcon, { backgroundColor: withAlpha(item.tint, '18') }]}>
              <Ionicons name={item.icon} size={18} color={item.tint} />
            </View>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.summaryValue, { color: colors.text }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.reserveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Buffer Insight</Text>
        <Text style={[styles.reserveTitle, { color: colors.text }]}>
          {trip ? `${trip.reserveFuel.toFixed(1)} ${volumeLabel} of extra reserve fuel` : 'Add trip values to see reserve planning'}
        </Text>
        <Text style={[styles.reserveCopy, { color: colors.textMuted }]}>
          Buffer gives you a safer margin for traffic, weather, detours, and AC-heavy city driving.
        </Text>
        {trip && (
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: withAlpha(ACCENT, '20') }]}
            onPress={() => {
              haptics.success();
              history.push(
                { units, distance, mileage, fuelPrice, passengers, buffer, roundTrip },
                `${trip.plannedDistance.toFixed(0)} ${distLabel} • ${trip.fuelNeeded.toFixed(1)} ${volumeLabel} • ${trip.totalCost.toFixed(0)}`,
              );
            }}
          >
            <Ionicons name="bookmark-outline" size={14} color={ACCENT} />
            <Text style={[styles.saveBtnText, { color: ACCENT }]}>Save trip</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.entries.length > 0 && (
        <View style={[styles.reserveCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm }}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Saved Trips</Text>
            <TouchableOpacity onPress={() => { haptics.warning(); history.clear(); }}>
              <Text style={[{ color: ACCENT, fontFamily: Fonts.semibold, fontSize: 12 }]}>Clear</Text>
            </TouchableOpacity>
          </View>
          {history.entries.map((entry, idx) => (
            <TouchableOpacity
              key={entry.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: 10,
                borderBottomWidth: idx < history.entries.length - 1 ? 0.5 : 0,
                borderBottomColor: colors.border,
              }}
              onPress={() => {
                haptics.tap();
                const v = entry.value;
                setUnits(v.units);
                setDistance(v.distance);
                setMileage(v.mileage);
                setFuelPrice(v.fuelPrice);
                setPassengers(v.passengers);
                setBuffer(v.buffer);
                setRoundTrip(v.roundTrip);
              }}
            >
              <Text style={[{ color: colors.text, fontFamily: Fonts.semibold, fontSize: 13, flex: 1 }]} numberOfLines={1}>
                {entry.label}
              </Text>
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: '#FFEDD5',
    },
    heroTitle: {
      fontSize: 38,
      lineHeight: 42,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#FFF7ED',
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    heroStat: {
      flex: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    heroStatValue: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroStatLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: '#FFEDD5',
      marginTop: 3,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    panel: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    toggleRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    toggleChip: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingVertical: 10,
      alignItems: 'center',
    },
    toggleChipText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    switchRow: {
      gap: Spacing.sm,
    },
    switchCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.xs,
    },
    switchTitle: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
    },
    switchCopy: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.medium,
    },
    fieldGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    field: {
      flexGrow: 1,
      minWidth: 160,
      gap: Spacing.sm,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.md,
      fontSize: 20,
      fontFamily: Fonts.bold,
    },
    presetRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    presetChip: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    presetLabel: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    inlineValue: {
      fontSize: 14,
      fontFamily: Fonts.bold,
    },
    passengerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    passengerChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minWidth: 56,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: Radii.pill,
      borderWidth: 1,
      justifyContent: 'center',
    },
    passengerText: {
      fontSize: 13,
      fontFamily: Fonts.bold,
    },
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.md,
    },
    summaryCard: {
      flexGrow: 1,
      minWidth: 180,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    summaryIcon: {
      width: 40,
      height: 40,
      borderRadius: Radii.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    summaryLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    summaryValue: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    reserveCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    reserveTitle: {
      fontSize: 20,
      lineHeight: 26,
      fontFamily: Fonts.bold,
    },
    reserveCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: Radii.pill,
      marginTop: Spacing.md,
      alignSelf: 'flex-start',
    },
    saveBtnText: { fontSize: 12, fontFamily: Fonts.bold },
  });
