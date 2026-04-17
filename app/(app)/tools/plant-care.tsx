import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#059669';
const STORAGE_KEY = 'uk_plants';

type Plant = { id: string; name: string; species: string; location: string; frequencyDays: number; notes: string; waterLog: string[]; createdAt: string };

const LOCATIONS = ['Indoor', 'Outdoor', 'Balcony', 'Kitchen', 'Bedroom'];
const FREQUENCIES = [
  { label: 'Daily', days: 1 },
  { label: 'Every 2 days', days: 2 },
  { label: 'Every 3 days', days: 3 },
  { label: 'Weekly', days: 7 },
  { label: 'Biweekly', days: 14 },
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDate(iso: string) { const [y,m,d] = iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
function daysBetween(a: string, b: string) { return Math.round((new Date(b+'T00:00:00').getTime()-new Date(a+'T00:00:00').getTime())/86400000); }

function getWaterStatus(plant: Plant): { status: 'ok'|'due'|'overdue'; daysAgo: number; nextIn: number } {
  const today = todayISO();
  if (plant.waterLog.length === 0) return { status: 'due', daysAgo: -1, nextIn: 0 };
  const last = plant.waterLog[plant.waterLog.length - 1];
  const ago = daysBetween(last, today);
  const next = plant.frequencyDays - ago;
  if (next < 0) return { status: 'overdue', daysAgo: ago, nextIn: next };
  if (next === 0) return { status: 'due', daysAgo: ago, nextIn: 0 };
  return { status: 'ok', daysAgo: ago, nextIn: next };
}

export default function PlantCareScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [plants, setPlants] = useState<Plant[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [species, setSpecies] = useState('');
  const [location, setLocation] = useState('Indoor');
  const [freqIdx, setFreqIdx] = useState(2);
  const [notes, setNotes] = useState('');

  useEffect(() => { loadJSON<Plant[]>(STORAGE_KEY, []).then(setPlants); }, []);
  const persist = useCallback((d: Plant[]) => { setPlants(d); saveJSON(STORAGE_KEY, d); }, []);

  const resetForm = () => { setName(''); setSpecies(''); setLocation('Indoor'); setFreqIdx(2); setNotes(''); setEditId(null); setShowForm(false); };

  const savePlant = () => {
    if (!name.trim()) return;
    const plant: Plant = {
      id: editId ?? uid(), name: name.trim(), species: species.trim(), location,
      frequencyDays: FREQUENCIES[freqIdx].days, notes: notes.trim(),
      waterLog: editId ? plants.find(p => p.id === editId)?.waterLog ?? [] : [],
      createdAt: editId ? plants.find(p => p.id === editId)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
    };
    persist(editId ? plants.map(p => p.id === editId ? plant : p) : [plant, ...plants]);
    resetForm();
  };

  const waterPlant = (id: string) => {
    const today = todayISO();
    persist(plants.map(p => {
      if (p.id !== id) return p;
      const log = p.waterLog.includes(today) ? p.waterLog : [...p.waterLog, today].slice(-30);
      return { ...p, waterLog: log };
    }));
  };

  const editPlant = (p: Plant) => {
    setEditId(p.id); setName(p.name); setSpecies(p.species); setLocation(p.location);
    setFreqIdx(FREQUENCIES.findIndex(f => f.days === p.frequencyDays) ?? 2);
    setNotes(p.notes); setShowForm(true);
  };

  const deletePlant = (id: string) => persist(plants.filter(p => p.id !== id));

  const needsWater = useMemo(() => plants.filter(p => { const s = getWaterStatus(p); return s.status !== 'ok'; }), [plants]);
  const sorted = useMemo(() => [...plants].sort((a, b) => {
    const sa = getWaterStatus(a); const sb = getWaterStatus(b);
    const order = { overdue: 0, due: 1, ok: 2 };
    return order[sa.status] - order[sb.status];
  }), [plants]);

  const statusColor = (s: 'ok'|'due'|'overdue') => s === 'ok' ? '#10B981' : s === 'due' ? '#F59E0B' : '#EF4444';
  const statusIcon = (s: 'ok'|'due'|'overdue') => s === 'ok' ? 'checkmark-circle' as const : s === 'due' ? 'alert-circle' as const : 'warning' as const;

  return (
    <ScreenShell title="Plant Care" accentColor={ACCENT}>
      {/* Summary */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: ACCENT }]}>{plants.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Plants</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: needsWater.length > 0 ? '#F59E0B' : '#10B981' }]}>{needsWater.length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Need Water</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryVal, { color: '#10B981' }]}>{plants.filter(p => getWaterStatus(p).status === 'ok').length}</Text>
            <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Healthy</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={[styles.addRow, { backgroundColor: ACCENT }]} onPress={() => { resetForm(); setShowForm(true); }}>
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={styles.addText}>Add Plant</Text>
      </TouchableOpacity>

      {/* Form */}
      {showForm && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{editId ? 'Edit Plant' : 'New Plant'}</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={name} onChangeText={setName} placeholder="Plant name" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={species} onChangeText={setSpecies} placeholder="Species/type (optional)" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Location</Text>
          <View style={styles.chipRow}>
            {LOCATIONS.map(l => (
              <TouchableOpacity key={l} style={[styles.chip, { backgroundColor: location === l ? ACCENT+'22' : colors.glass, borderColor: location === l ? ACCENT : colors.border }]} onPress={() => setLocation(l)}>
                <Text style={[styles.chipText, { color: location === l ? ACCENT : colors.textMuted }]}>{l}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Watering Frequency</Text>
          <View style={styles.chipRow}>
            {FREQUENCIES.map((f, i) => (
              <TouchableOpacity key={f.label} style={[styles.chip, { backgroundColor: freqIdx === i ? ACCENT+'22' : colors.glass, borderColor: freqIdx === i ? ACCENT : colors.border }]} onPress={() => setFreqIdx(i)}>
                <Text style={[styles.chipText, { color: freqIdx === i ? ACCENT : colors.textMuted }]}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.md }]} value={notes} onChangeText={setNotes} placeholder="Notes (optional)" placeholderTextColor={colors.textMuted} />
          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetForm}><Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={savePlant}><Text style={styles.saveText}>{editId ? 'Update' : 'Add'}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Plant list */}
      {sorted.map(plant => {
        const ws = getWaterStatus(plant);
        const sc = statusColor(ws.status);
        return (
          <View key={plant.id} style={[styles.plantCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.plantHeader}>
              <Ionicons name="leaf" size={20} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.plantName, { color: colors.text }]}>{plant.name}</Text>
                {plant.species ? <Text style={[styles.plantSpecies, { color: colors.textMuted }]}>{plant.species}</Text> : null}
              </View>
              <Ionicons name={statusIcon(ws.status)} size={20} color={sc} />
            </View>
            <View style={styles.plantMeta}>
              <View style={[styles.locBadge, { backgroundColor: ACCENT+'15' }]}><Text style={[styles.locText, { color: ACCENT }]}>{plant.location}</Text></View>
              <Text style={[styles.freqText, { color: colors.textMuted }]}>Every {plant.frequencyDays}d</Text>
              <Text style={[styles.statusText, { color: sc }]}>
                {ws.status === 'ok' ? `Next in ${ws.nextIn}d` : ws.status === 'due' ? 'Due today' : `Overdue by ${Math.abs(ws.nextIn)}d`}
              </Text>
            </View>
            {ws.daysAgo >= 0 && <Text style={[styles.lastWatered, { color: colors.textMuted }]}>Last watered: {ws.daysAgo === 0 ? 'today' : `${ws.daysAgo} day${ws.daysAgo > 1 ? 's' : ''} ago`}</Text>}
            <View style={styles.plantActions}>
              <TouchableOpacity style={[styles.waterBtn, { backgroundColor: ws.status === 'ok' ? colors.glass : ACCENT+'18', borderColor: ws.status === 'ok' ? colors.border : ACCENT }]} onPress={() => waterPlant(plant.id)}>
                <Ionicons name="water" size={16} color={ws.status === 'ok' ? colors.textMuted : ACCENT} />
                <Text style={[styles.waterText, { color: ws.status === 'ok' ? colors.textMuted : ACCENT }]}>Water Now</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => editPlant(plant)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deletePlant(plant.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {plants.length === 0 && !showForm && (
        <View style={styles.emptyState}>
          <Ionicons name="leaf-outline" size={48} color={ACCENT+'40'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No plants yet. Add your green friends!</Text>
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
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    summaryItem: { alignItems: 'center' },
    summaryVal: { fontSize: 22, fontFamily: Fonts.bold },
    summaryLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    divider: { width: 1, height: 30 },
    addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    addText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    chipText: { fontSize: 11, fontFamily: Fonts.medium },
    formBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, borderWidth: 1, alignItems: 'center' },
    cancelText: { fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, alignItems: 'center' },
    saveText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    plantCard: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.lg, marginBottom: Spacing.md },
    plantHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
    plantName: { fontSize: 15, fontFamily: Fonts.bold },
    plantSpecies: { fontSize: 12, fontFamily: Fonts.regular },
    plantMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'center' },
    locBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radii.sm },
    locText: { fontSize: 10, fontFamily: Fonts.bold },
    freqText: { fontSize: 11, fontFamily: Fonts.regular },
    statusText: { fontSize: 11, fontFamily: Fonts.semibold },
    lastWatered: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 4 },
    plantActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.md },
    waterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    waterText: { fontSize: 12, fontFamily: Fonts.semibold },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
