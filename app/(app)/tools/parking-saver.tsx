import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#3B82F6';
const STORAGE_KEY = 'uk_parking';

type ParkingData = { floor: string; section: string; spot: string; notes: string; tag: string; parkedAt: number; meterMinutes: number };
type ParkingHistory = { floor: string; section: string; tag: string; date: string };

const TAGS = ['Mall', 'Airport', 'Street', 'Office', 'Hospital', 'Other'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

function formatCountdown(ms: number) {
  if (ms <= 0) return 'Expired!';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

export default function ParkingSaverScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [parking, setParking] = useState<ParkingData | null>(null);
  const [history, setHistory] = useState<ParkingHistory[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [meterRemaining, setMeterRemaining] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Form
  const [floor, setFloor] = useState('');
  const [section, setSection] = useState('');
  const [spot, setSpot] = useState('');
  const [notes, setNotes] = useState('');
  const [tag, setTag] = useState('Other');
  const [meterMin, setMeterMin] = useState('');

  useEffect(() => {
    loadJSON<{ parking: ParkingData | null; history: ParkingHistory[] }>(STORAGE_KEY, { parking: null, history: [] }).then(d => {
      setParking(d.parking);
      setHistory(d.history ?? []);
    });
  }, []);

  const persist = useCallback((p: ParkingData | null, h: ParkingHistory[]) => {
    setParking(p);
    setHistory(h);
    saveJSON(STORAGE_KEY, { parking: p, history: h });
  }, []);

  // Timer
  useEffect(() => {
    if (!parking) { setElapsed(0); setMeterRemaining(0); return; }
    const update = () => {
      const now = Date.now();
      setElapsed(now - parking.parkedAt);
      if (parking.meterMinutes > 0) {
        const end = parking.parkedAt + parking.meterMinutes * 60000;
        setMeterRemaining(end - now);
      }
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [parking]);

  const park = () => {
    const data: ParkingData = {
      floor: floor.trim(), section: section.trim(), spot: spot.trim(),
      notes: notes.trim(), tag, parkedAt: Date.now(),
      meterMinutes: parseInt(meterMin) || 0,
    };
    persist(data, history);
    setFloor(''); setSection(''); setSpot(''); setNotes(''); setMeterMin('');
  };

  const foundCar = () => {
    if (parking) {
      const entry: ParkingHistory = {
        floor: parking.floor, section: parking.section, tag: parking.tag,
        date: new Date(parking.parkedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      };
      persist(null, [entry, ...history].slice(0, 10));
    }
  };

  const meterWarning = parking && parking.meterMinutes > 0 && meterRemaining > 0 && meterRemaining < 15 * 60 * 1000;
  const meterExpired = parking && parking.meterMinutes > 0 && meterRemaining <= 0;

  return (
    <ScreenShell title="Parking Saver" accentColor={ACCENT}>
      {/* Active parking */}
      {parking ? (
        <>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.activeHeader}>
              <Ionicons name="car" size={32} color={ACCENT} />
              <Text style={[styles.activeTitle, { color: colors.text }]}>Your Car is Parked</Text>
            </View>

            <View style={styles.timerBox}>
              <Text style={[styles.timerLabel, { color: colors.textMuted }]}>Time Parked</Text>
              <Text style={[styles.timerValue, { color: colors.text }]}>{formatElapsed(elapsed)}</Text>
            </View>

            {parking.meterMinutes > 0 && (
              <View style={[styles.meterBox, { backgroundColor: meterExpired ? '#EF4444'+'15' : meterWarning ? '#F59E0B'+'15' : ACCENT+'10', borderColor: meterExpired ? '#EF4444'+'30' : meterWarning ? '#F59E0B'+'30' : ACCENT+'25' }]}>
                <Ionicons name="timer-outline" size={18} color={meterExpired ? '#EF4444' : meterWarning ? '#F59E0B' : ACCENT} />
                <View>
                  <Text style={[styles.meterLabel, { color: colors.textMuted }]}>Meter Time</Text>
                  <Text style={[styles.meterValue, { color: meterExpired ? '#EF4444' : meterWarning ? '#F59E0B' : ACCENT }]}>{formatCountdown(meterRemaining)}</Text>
                </View>
              </View>
            )}

            <View style={styles.detailGrid}>
              {parking.floor ? <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Floor</Text><Text style={[styles.detailVal, { color: colors.text }]}>{parking.floor}</Text></View> : null}
              {parking.section ? <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Section</Text><Text style={[styles.detailVal, { color: colors.text }]}>{parking.section}</Text></View> : null}
              {parking.spot ? <View style={styles.detailItem}><Text style={[styles.detailLabel, { color: colors.textMuted }]}>Spot</Text><Text style={[styles.detailVal, { color: colors.text }]}>{parking.spot}</Text></View> : null}
            </View>
            {parking.notes ? <Text style={[styles.notesText, { color: colors.textMuted }]}>{parking.notes}</Text> : null}
            <View style={[styles.tagBadge, { backgroundColor: ACCENT+'18' }]}><Text style={[styles.tagBadgeText, { color: ACCENT }]}>{parking.tag}</Text></View>
          </View>

          <TouchableOpacity style={[styles.foundBtn, { backgroundColor: '#10B981' }]} onPress={foundCar}>
            <Ionicons name="checkmark-circle" size={22} color="#fff" />
            <Text style={styles.foundBtnText}>Found My Car</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {/* Park form */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Save Parking Location</Text>
            <View style={styles.inputRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Floor/Level</Text>
                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={floor} onChangeText={setFloor} placeholder="B2" placeholderTextColor={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Section</Text>
                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={section} onChangeText={setSection} placeholder="Zone A" placeholderTextColor={colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Spot</Text>
                <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={spot} onChangeText={setSpot} placeholder="42" placeholderTextColor={colors.textMuted} />
              </View>
            </View>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={notes} onChangeText={setNotes} placeholder="Notes (e.g., near elevator)" placeholderTextColor={colors.textMuted} />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Location Type</Text>
            <View style={styles.tagRow}>
              {TAGS.map(t => (
                <TouchableOpacity key={t} style={[styles.tagChip, { backgroundColor: tag === t ? ACCENT+'22' : colors.glass, borderColor: tag === t ? ACCENT : colors.border }]} onPress={() => setTag(t)}>
                  <Text style={[styles.tagChipText, { color: tag === t ? ACCENT : colors.textMuted }]}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Meter Time (minutes, optional)</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={meterMin} onChangeText={setMeterMin} placeholder="120" keyboardType="number-pad" placeholderTextColor={colors.textMuted} />
          </View>

          <TouchableOpacity style={[styles.parkBtn, { backgroundColor: ACCENT }]} onPress={park}>
            <Ionicons name="car" size={22} color="#fff" />
            <Text style={styles.parkBtnText}>I'm Parked!</Text>
          </TouchableOpacity>
        </>
      )}

      {/* History */}
      {history.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Recent Parking</Text>
          {history.map((h, i) => (
            <View key={i} style={[styles.historyRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.historyLoc, { color: colors.text }]}>
                  {[h.floor, h.section].filter(Boolean).join(', ') || 'No details'}
                </Text>
                <Text style={[styles.historyDate, { color: colors.textMuted }]}>{h.date} - {h.tag}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (c: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    card: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.lg },
    sectionLabel: { fontSize: 10, fontFamily: Fonts.bold, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: Spacing.md },
    fieldLabel: { fontSize: 10, fontFamily: Fonts.semibold, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: Spacing.md, marginBottom: Spacing.sm },
    activeHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
    activeTitle: { fontSize: 18, fontFamily: Fonts.bold },
    timerBox: { alignItems: 'center', marginBottom: Spacing.lg },
    timerLabel: { fontSize: 11, fontFamily: Fonts.medium },
    timerValue: { fontSize: 42, fontFamily: Fonts.bold },
    meterBox: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, marginBottom: Spacing.lg },
    meterLabel: { fontSize: 10, fontFamily: Fonts.medium },
    meterValue: { fontSize: 20, fontFamily: Fonts.bold },
    detailGrid: { flexDirection: 'row', gap: Spacing.xl, justifyContent: 'center', marginBottom: Spacing.md },
    detailItem: { alignItems: 'center' },
    detailLabel: { fontSize: 10, fontFamily: Fonts.medium },
    detailVal: { fontSize: 18, fontFamily: Fonts.bold },
    notesText: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginBottom: Spacing.sm },
    tagBadge: { alignSelf: 'center', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radii.pill },
    tagBadgeText: { fontSize: 11, fontFamily: Fonts.semibold },
    foundBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: 16, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    foundBtnText: { fontSize: 18, fontFamily: Fonts.bold, color: '#fff' },
    inputRow: { flexDirection: 'row', gap: Spacing.sm },
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    tagChip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    tagChipText: { fontSize: 11, fontFamily: Fonts.medium },
    parkBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.md, paddingVertical: 18, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    parkBtnText: { fontSize: 20, fontFamily: Fonts.bold, color: '#fff' },
    historyRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 8, borderBottomWidth: 0.5 },
    historyLoc: { fontSize: 13, fontFamily: Fonts.semibold },
    historyDate: { fontSize: 11, fontFamily: Fonts.regular },
  });
