import { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F43F5E';
const STORAGE_KEY = 'uk_pets';

type VetVisit = { id: string; date: string; reason: string; vetName: string; cost: number; notes: string };
type Vaccine = { id: string; name: string; dateGiven: string; nextDue: string };
type FeedLog = { date: string; meals: number };
type Pet = { id: string; name: string; type: string; breed: string; dob: string; weight: string; vetVisits: VetVisit[]; vaccines: Vaccine[]; feedLog: FeedLog[]; createdAt: string };

const PET_TYPES = [
  { label: 'Dog', emoji: '🐕' }, { label: 'Cat', emoji: '🐈' }, { label: 'Bird', emoji: '🐦' },
  { label: 'Fish', emoji: '🐟' }, { label: 'Hamster', emoji: '🐹' }, { label: 'Rabbit', emoji: '🐰' }, { label: 'Other', emoji: '🐾' },
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function fmtDate(iso: string) { if (!iso) return ''; const [y,m,d] = iso.split('-').map(Number); return new Date(y,m-1,d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }

function calcAge(dob: string): string {
  if (!dob) return '';
  const [y,m,d] = dob.split('-').map(Number);
  const birth = new Date(y,m-1,d);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) { years--; months += 12; }
  if (now.getDate() < birth.getDate()) months--;
  if (years > 0) return `${years}y ${months}m`;
  return `${months}m`;
}

function getEmoji(type: string) { return PET_TYPES.find(t => t.label === type)?.emoji ?? '🐾'; }

export default function PetCareScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [tab, setTab] = useState<'info'|'vet'|'vaccines'|'feed'>('info');
  const [showForm, setShowForm] = useState(false);
  const [showVetForm, setShowVetForm] = useState(false);
  const [showVaxForm, setShowVaxForm] = useState(false);

  // Pet form
  const [name, setName] = useState('');
  const [petType, setPetType] = useState('Dog');
  const [breed, setBreed] = useState('');
  const [dob, setDob] = useState('');
  const [weight, setWeight] = useState('');
  const [editId, setEditId] = useState<string|null>(null);

  // Vet form
  const [vetDate, setVetDate] = useState(todayISO());
  const [vetReason, setVetReason] = useState('');
  const [vetName, setVetName] = useState('');
  const [vetCost, setVetCost] = useState('');
  const [vetNotes, setVetNotes] = useState('');

  // Vaccine form
  const [vaxName, setVaxName] = useState('');
  const [vaxDate, setVaxDate] = useState(todayISO());
  const [vaxNext, setVaxNext] = useState('');

  useEffect(() => { loadJSON<Pet[]>(STORAGE_KEY, []).then(d => { setPets(d); if (d.length > 0) setSelectedPetId(d[0].id); }); }, []);
  const persist = useCallback((d: Pet[]) => { setPets(d); saveJSON(STORAGE_KEY, d); }, []);

  const pet = pets.find(p => p.id === selectedPetId) ?? null;

  const resetPetForm = () => { setName(''); setPetType('Dog'); setBreed(''); setDob(''); setWeight(''); setEditId(null); setShowForm(false); };

  const savePet = () => {
    if (!name.trim()) return;
    const p: Pet = { id: editId ?? uid(), name: name.trim(), type: petType, breed: breed.trim(), dob, weight: weight.trim(), vetVisits: editId ? pet?.vetVisits ?? [] : [], vaccines: editId ? pet?.vaccines ?? [] : [], feedLog: editId ? pet?.feedLog ?? [] : [], createdAt: editId ? pet?.createdAt ?? new Date().toISOString() : new Date().toISOString() };
    const updated = editId ? pets.map(pp => pp.id === editId ? p : pp) : [p, ...pets];
    persist(updated);
    if (!editId) setSelectedPetId(p.id);
    resetPetForm();
  };

  const deletePet = (id: string) => {
    const updated = pets.filter(p => p.id !== id);
    persist(updated);
    setSelectedPetId(updated.length > 0 ? updated[0].id : null);
  };

  const addVetVisit = () => {
    if (!pet || !vetReason.trim()) return;
    const visit: VetVisit = { id: uid(), date: vetDate, reason: vetReason.trim(), vetName: vetName.trim(), cost: parseFloat(vetCost) || 0, notes: vetNotes.trim() };
    persist(pets.map(p => p.id === pet.id ? { ...p, vetVisits: [visit, ...p.vetVisits] } : p));
    setShowVetForm(false); setVetReason(''); setVetName(''); setVetCost(''); setVetNotes('');
  };

  const addVaccine = () => {
    if (!pet || !vaxName.trim()) return;
    const vax: Vaccine = { id: uid(), name: vaxName.trim(), dateGiven: vaxDate, nextDue: vaxNext };
    persist(pets.map(p => p.id === pet.id ? { ...p, vaccines: [vax, ...p.vaccines] } : p));
    setShowVaxForm(false); setVaxName(''); setVaxNext('');
  };

  const feedPet = () => {
    if (!pet) return;
    const today = todayISO();
    const existing = pet.feedLog.find(f => f.date === today);
    const updated = existing
      ? pet.feedLog.map(f => f.date === today ? { ...f, meals: f.meals + 1 } : f)
      : [...pet.feedLog, { date: today, meals: 1 }];
    persist(pets.map(p => p.id === pet.id ? { ...p, feedLog: updated.slice(-30) } : p));
  };

  const todayMeals = pet?.feedLog.find(f => f.date === todayISO())?.meals ?? 0;

  return (
    <ScreenShell title="Pet Care" accentColor={ACCENT}>
      {/* Pet selector */}
      <View style={styles.petSelector}>
        {pets.map(p => (
          <TouchableOpacity key={p.id} style={[styles.petChip, { backgroundColor: selectedPetId === p.id ? ACCENT+'22' : colors.glass, borderColor: selectedPetId === p.id ? ACCENT : colors.border }]} onPress={() => setSelectedPetId(p.id)}>
            <Text style={{ fontSize: 16 }}>{getEmoji(p.type)}</Text>
            <Text style={[styles.petChipText, { color: selectedPetId === p.id ? ACCENT : colors.textMuted }]}>{p.name}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={[styles.addPetBtn, { backgroundColor: ACCENT }]} onPress={() => { resetPetForm(); setShowForm(true); }}>
          <Ionicons name="add" size={16} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Add pet form */}
      {showForm && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{editId ? 'Edit Pet' : 'Add Pet'}</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={name} onChangeText={setName} placeholder="Pet name" placeholderTextColor={colors.textMuted} />
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Type</Text>
          <View style={styles.chipRow}>
            {PET_TYPES.map(t => (
              <TouchableOpacity key={t.label} style={[styles.chip, { backgroundColor: petType === t.label ? ACCENT+'22' : colors.glass, borderColor: petType === t.label ? ACCENT : colors.border }]} onPress={() => setPetType(t.label)}>
                <Text style={{ fontSize: 14 }}>{t.emoji}</Text>
                <Text style={[styles.chipText, { color: petType === t.label ? ACCENT : colors.textMuted }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={breed} onChangeText={setBreed} placeholder="Breed (optional)" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={dob} onChangeText={setDob} placeholder="Date of birth (YYYY-MM-DD)" placeholderTextColor={colors.textMuted} />
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={weight} onChangeText={setWeight} placeholder="Weight (e.g., 5 kg)" placeholderTextColor={colors.textMuted} />
          <View style={styles.formBtns}>
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={resetPetForm}><Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={savePet}><Text style={styles.saveText}>{editId ? 'Update' : 'Add'}</Text></TouchableOpacity>
          </View>
        </View>
      )}

      {/* Pet detail */}
      {pet && (
        <>
          {/* Tabs */}
          <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['info','vet','vaccines','feed'] as const).map(t => (
              <TouchableOpacity key={t} style={[styles.tabBtn, tab === t && { backgroundColor: ACCENT+'22', borderColor: ACCENT }]} onPress={() => setTab(t)}>
                <Text style={[styles.tabLabel, { color: tab === t ? ACCENT : colors.textMuted }]}>{t === 'info' ? 'Info' : t === 'vet' ? 'Vet' : t === 'vaccines' ? 'Vaccines' : 'Feed'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Info tab */}
          {tab === 'info' && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.infoHeader}>
                <Text style={{ fontSize: 40 }}>{getEmoji(pet.type)}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.petName, { color: colors.text }]}>{pet.name}</Text>
                  {pet.breed ? <Text style={[styles.petBreed, { color: colors.textMuted }]}>{pet.breed}</Text> : null}
                </View>
              </View>
              <View style={styles.infoGrid}>
                {pet.dob ? <View style={styles.infoItem}><Text style={[styles.infoVal, { color: ACCENT }]}>{calcAge(pet.dob)}</Text><Text style={[styles.infoLabel, { color: colors.textMuted }]}>Age</Text></View> : null}
                {pet.weight ? <View style={styles.infoItem}><Text style={[styles.infoVal, { color: ACCENT }]}>{pet.weight}</Text><Text style={[styles.infoLabel, { color: colors.textMuted }]}>Weight</Text></View> : null}
                <View style={styles.infoItem}><Text style={[styles.infoVal, { color: ACCENT }]}>{pet.vetVisits.length}</Text><Text style={[styles.infoLabel, { color: colors.textMuted }]}>Vet Visits</Text></View>
                <View style={styles.infoItem}><Text style={[styles.infoVal, { color: ACCENT }]}>{pet.vaccines.length}</Text><Text style={[styles.infoLabel, { color: colors.textMuted }]}>Vaccines</Text></View>
              </View>
              <View style={styles.infoActions}>
                <TouchableOpacity onPress={() => { setEditId(pet.id); setName(pet.name); setPetType(pet.type); setBreed(pet.breed); setDob(pet.dob); setWeight(pet.weight); setShowForm(true); }}>
                  <Ionicons name="create-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deletePet(pet.id)}>
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Vet tab */}
          {tab === 'vet' && (
            <>
              <TouchableOpacity style={[styles.addRow, { backgroundColor: ACCENT }]} onPress={() => setShowVetForm(true)}>
                <Ionicons name="add" size={16} color="#fff" /><Text style={styles.addRowText}>Add Vet Visit</Text>
              </TouchableOpacity>
              {showVetForm && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={vetReason} onChangeText={setVetReason} placeholder="Reason for visit" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={vetName} onChangeText={setVetName} placeholder="Vet name (optional)" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={vetCost} onChangeText={setVetCost} placeholder="Cost (optional)" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
                  <View style={styles.formBtns}>
                    <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowVetForm(false)}><Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={addVetVisit}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              {pet.vetVisits.map(v => (
                <View key={v.id} style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.listTitle, { color: colors.text }]}>{v.reason}</Text>
                  <View style={styles.listMeta}>
                    <Text style={[styles.listDate, { color: colors.textMuted }]}>{fmtDate(v.date)}</Text>
                    {v.vetName ? <Text style={[styles.listDate, { color: colors.textMuted }]}>{v.vetName}</Text> : null}
                    {v.cost > 0 ? <Text style={[styles.listDate, { color: ACCENT }]}>{v.cost}</Text> : null}
                  </View>
                </View>
              ))}
              {pet.vetVisits.length === 0 && !showVetForm && <Text style={[styles.emptyText, { color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xl }]}>No vet visits recorded.</Text>}
            </>
          )}

          {/* Vaccines tab */}
          {tab === 'vaccines' && (
            <>
              <TouchableOpacity style={[styles.addRow, { backgroundColor: ACCENT }]} onPress={() => setShowVaxForm(true)}>
                <Ionicons name="add" size={16} color="#fff" /><Text style={styles.addRowText}>Add Vaccine</Text>
              </TouchableOpacity>
              {showVaxForm && (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]} value={vaxName} onChangeText={setVaxName} placeholder="Vaccine name" placeholderTextColor={colors.textMuted} />
                  <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginTop: Spacing.sm }]} value={vaxNext} onChangeText={setVaxNext} placeholder="Next due (YYYY-MM-DD, optional)" placeholderTextColor={colors.textMuted} />
                  <View style={styles.formBtns}>
                    <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowVaxForm(false)}><Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={addVaccine}><Text style={styles.saveText}>Save</Text></TouchableOpacity>
                  </View>
                </View>
              )}
              {pet.vaccines.map(v => (
                <View key={v.id} style={[styles.listItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.listTitle, { color: colors.text }]}>{v.name}</Text>
                  <View style={styles.listMeta}>
                    <Text style={[styles.listDate, { color: colors.textMuted }]}>Given: {fmtDate(v.dateGiven)}</Text>
                    {v.nextDue ? <Text style={[styles.listDate, { color: ACCENT }]}>Next: {fmtDate(v.nextDue)}</Text> : null}
                  </View>
                </View>
              ))}
              {pet.vaccines.length === 0 && !showVaxForm && <Text style={[styles.emptyText, { color: colors.textMuted, textAlign: 'center', marginTop: Spacing.xl }]}>No vaccines recorded.</Text>}
            </>
          )}

          {/* Feed tab */}
          {tab === 'feed' && (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Today's Feeding</Text>
              <View style={styles.feedCenter}>
                <Text style={[styles.feedCount, { color: ACCENT }]}>{todayMeals}</Text>
                <Text style={[styles.feedLabel, { color: colors.textMuted }]}>meals today</Text>
              </View>
              <TouchableOpacity style={[styles.feedBtn, { backgroundColor: ACCENT }]} onPress={feedPet}>
                <Ionicons name="restaurant" size={18} color="#fff" />
                <Text style={styles.feedBtnText}>Fed Just Now</Text>
              </TouchableOpacity>
              {pet.feedLog.length > 0 && (
                <>
                  <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: Spacing.lg }]}>Recent Log</Text>
                  {[...pet.feedLog].reverse().slice(0, 7).map(f => (
                    <View key={f.date} style={styles.feedRow}>
                      <Text style={[styles.feedDate, { color: colors.text }]}>{fmtDate(f.date)}</Text>
                      <Text style={[styles.feedMeals, { color: ACCENT }]}>{f.meals} meal{f.meals > 1 ? 's' : ''}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}
        </>
      )}

      {pets.length === 0 && !showForm && (
        <View style={styles.emptyState}>
          <Text style={{ fontSize: 48 }}>🐾</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Add your first pet to get started!</Text>
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
    petSelector: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg, alignItems: 'center' },
    petChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.pill, borderWidth: 1 },
    petChipText: { fontSize: 12, fontFamily: Fonts.semibold },
    addPetBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radii.pill, borderWidth: 1 },
    chipText: { fontSize: 11, fontFamily: Fonts.medium },
    formBtns: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, borderWidth: 1, alignItems: 'center' },
    cancelText: { fontSize: 14, fontFamily: Fonts.semibold },
    saveBtn: { flex: 1, paddingVertical: 12, borderRadius: Radii.xl, alignItems: 'center' },
    saveText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    tabBar: { flexDirection: 'row', borderRadius: Radii.xl, borderWidth: 1, marginBottom: Spacing.lg, overflow: 'hidden' },
    tabBtn: { flex: 1, paddingVertical: 10, borderRadius: Radii.xl, borderWidth: 1.5, borderColor: 'transparent', margin: 3, alignItems: 'center' },
    tabLabel: { fontSize: 12, fontFamily: Fonts.semibold },
    infoHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
    petName: { fontSize: 22, fontFamily: Fonts.bold },
    petBreed: { fontSize: 14, fontFamily: Fonts.regular },
    infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', gap: Spacing.md },
    infoItem: { alignItems: 'center' },
    infoVal: { fontSize: 20, fontFamily: Fonts.bold },
    infoLabel: { fontSize: 10, fontFamily: Fonts.medium, marginTop: 2 },
    infoActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.lg, marginTop: Spacing.lg },
    addRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl, marginBottom: Spacing.lg },
    addRowText: { fontSize: 13, fontFamily: Fonts.bold, color: '#fff' },
    listItem: { borderRadius: Radii.xl, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.sm },
    listTitle: { fontSize: 14, fontFamily: Fonts.semibold },
    listMeta: { flexDirection: 'row', gap: Spacing.md, marginTop: 4 },
    listDate: { fontSize: 11, fontFamily: Fonts.regular },
    feedCenter: { alignItems: 'center', marginBottom: Spacing.lg },
    feedCount: { fontSize: 48, fontFamily: Fonts.bold },
    feedLabel: { fontSize: 13, fontFamily: Fonts.medium },
    feedBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radii.xl },
    feedBtnText: { fontSize: 15, fontFamily: Fonts.bold, color: '#fff' },
    feedRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
    feedDate: { fontSize: 13, fontFamily: Fonts.medium },
    feedMeals: { fontSize: 13, fontFamily: Fonts.semibold },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium },
  });
