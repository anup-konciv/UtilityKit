import { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#2563EB';

type Participant = { id: string; name: string; offset: number };

const TIMEZONES = [
  { label: 'UTC-12 Baker Island', offset: -12 }, { label: 'UTC-11 Samoa', offset: -11 },
  { label: 'UTC-10 Hawaii', offset: -10 }, { label: 'UTC-9 Alaska', offset: -9 },
  { label: 'UTC-8 Pacific (LA)', offset: -8 }, { label: 'UTC-7 Mountain', offset: -7 },
  { label: 'UTC-6 Central (Chicago)', offset: -6 }, { label: 'UTC-5 Eastern (NY)', offset: -5 },
  { label: 'UTC-4 Atlantic', offset: -4 }, { label: 'UTC-3 Buenos Aires', offset: -3 },
  { label: 'UTC-2 Mid-Atlantic', offset: -2 }, { label: 'UTC-1 Azores', offset: -1 },
  { label: 'UTC+0 London', offset: 0 }, { label: 'UTC+1 Paris/Berlin', offset: 1 },
  { label: 'UTC+2 Cairo', offset: 2 }, { label: 'UTC+3 Moscow', offset: 3 },
  { label: 'UTC+3:30 Tehran', offset: 3.5 }, { label: 'UTC+4 Dubai', offset: 4 },
  { label: 'UTC+5 Karachi', offset: 5 }, { label: 'UTC+5:30 India (IST)', offset: 5.5 },
  { label: 'UTC+6 Dhaka', offset: 6 }, { label: 'UTC+7 Bangkok', offset: 7 },
  { label: 'UTC+8 Singapore/Beijing', offset: 8 }, { label: 'UTC+9 Tokyo', offset: 9 },
  { label: 'UTC+9:30 Adelaide', offset: 9.5 }, { label: 'UTC+10 Sydney', offset: 10 },
  { label: 'UTC+11 Solomon Islands', offset: 11 }, { label: 'UTC+12 Auckland', offset: 12 },
];

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function pad(n: number) { return String(n).padStart(2, '0'); }

function formatHour(h: number, offset: number): string {
  let local = h + offset;
  if (local < 0) local += 24;
  if (local >= 24) local -= 24;
  const hour = Math.floor(local);
  const min = (local % 1) * 60;
  return `${pad(hour)}:${pad(min)}`;
}

function isWorkHour(h: number, offset: number): boolean {
  let local = h + offset;
  if (local < 0) local += 24;
  if (local >= 24) local -= 24;
  return local >= 9 && local < 18;
}

export default function MeetingPlannerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [participants, setParticipants] = useState<Participant[]>([
    { id: uid(), name: 'You', offset: 5.5 },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedTz, setSelectedTz] = useState(0);
  const [searchTz, setSearchTz] = useState('');

  const addParticipant = () => {
    if (!newName.trim()) return;
    setParticipants([...participants, { id: uid(), name: newName.trim(), offset: TIMEZONES[selectedTz].offset }]);
    setNewName('');
    setShowAdd(false);
  };

  const removeParticipant = (id: string) => setParticipants(participants.filter(p => p.id !== id));

  const filteredTz = useMemo(() => {
    if (!searchTz.trim()) return TIMEZONES;
    const q = searchTz.toLowerCase();
    return TIMEZONES.filter(tz => tz.label.toLowerCase().includes(q));
  }, [searchTz]);

  // Find overlapping work hours (9 AM - 6 PM) for all participants
  const overlap = useMemo(() => {
    if (participants.length < 2) return [];
    const hours: { utcHour: number; good: boolean }[] = [];
    for (let h = 0; h < 24; h++) {
      const allWork = participants.every(p => isWorkHour(h, p.offset));
      hours.push({ utcHour: h, good: allWork });
    }
    return hours;
  }, [participants]);

  const goodSlots = overlap.filter(h => h.good);

  return (
    <ScreenShell title="Meeting Planner" accentColor={ACCENT}>
      {/* Participants */}
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Participants</Text>
        {participants.map(p => {
          const tz = TIMEZONES.find(t => t.offset === p.offset);
          return (
            <View key={p.id} style={[styles.participantRow, { borderBottomColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={24} color={ACCENT} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.pName, { color: colors.text }]}>{p.name}</Text>
                <Text style={[styles.pTz, { color: colors.textMuted }]}>UTC{p.offset >= 0 ? '+' : ''}{p.offset}</Text>
              </View>
              {participants.length > 1 && (
                <TouchableOpacity onPress={() => removeParticipant(p.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            </View>
          );
        })}
        <TouchableOpacity style={[styles.addBtn, { borderColor: ACCENT }]} onPress={() => setShowAdd(!showAdd)}>
          <Ionicons name="add" size={16} color={ACCENT} />
          <Text style={[styles.addBtnText, { color: ACCENT }]}>Add Participant</Text>
        </TouchableOpacity>
      </View>

      {/* Add form */}
      {showAdd && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg }]}
            value={newName}
            onChangeText={setNewName}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Timezone</Text>
          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.inputBg, marginBottom: Spacing.sm }]}
            value={searchTz}
            onChangeText={setSearchTz}
            placeholder="Search timezones..."
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.tzList}>
            {filteredTz.slice(0, 8).map((tz, i) => {
              const origIdx = TIMEZONES.indexOf(tz);
              return (
                <TouchableOpacity
                  key={tz.label}
                  style={[styles.tzChip, { backgroundColor: selectedTz === origIdx ? ACCENT + '22' : colors.glass, borderColor: selectedTz === origIdx ? ACCENT : colors.border }]}
                  onPress={() => setSelectedTz(origIdx)}
                >
                  <Text style={[styles.tzText, { color: selectedTz === origIdx ? ACCENT : colors.textMuted }]} numberOfLines={1}>{tz.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT }]} onPress={addParticipant}>
            <Text style={styles.saveBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Best times */}
      {participants.length >= 2 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
            {goodSlots.length > 0 ? 'Best Meeting Times' : 'No Overlapping Work Hours'}
          </Text>
          {goodSlots.length > 0 ? (
            <View style={styles.slotsGrid}>
              {goodSlots.map(slot => (
                <View key={slot.utcHour} style={[styles.slotCard, { backgroundColor: '#10B981' + '12', borderColor: '#10B981' + '30' }]}>
                  {participants.map(p => (
                    <View key={p.id} style={styles.slotRow}>
                      <Text style={[styles.slotName, { color: colors.textMuted }]}>{p.name}</Text>
                      <Text style={[styles.slotTime, { color: colors.text }]}>{formatHour(slot.utcHour, p.offset)}</Text>
                    </View>
                  ))}
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.noOverlapText, { color: colors.textMuted }]}>
              Try adjusting participants' timezones or consider async communication.
            </Text>
          )}
        </View>
      )}

      {/* 24-hour grid */}
      {participants.length >= 2 && (
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>24-Hour Overview</Text>
          <View style={styles.gridHeader}>
            <Text style={[styles.gridName, { color: colors.textMuted }]}>UTC</Text>
            {participants.map(p => (
              <Text key={p.id} style={[styles.gridName, { color: colors.textMuted }]} numberOfLines={1}>{p.name}</Text>
            ))}
          </View>
          {Array.from({ length: 24 }, (_, h) => {
            const allWork = participants.every(p => isWorkHour(h, p.offset));
            const someWork = participants.some(p => isWorkHour(h, p.offset));
            return (
              <View key={h} style={[styles.gridRow, { backgroundColor: allWork ? '#10B981' + '12' : 'transparent' }]}>
                <Text style={[styles.gridCell, { color: colors.textMuted }]}>{pad(h)}:00</Text>
                {participants.map(p => {
                  const work = isWorkHour(h, p.offset);
                  return (
                    <Text key={p.id} style={[styles.gridCell, { color: work ? '#10B981' : colors.textMuted, fontFamily: work ? Fonts.semibold : Fonts.regular }]}>
                      {formatHour(h, p.offset)}
                    </Text>
                  );
                })}
              </View>
            );
          })}
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' + '30' }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>All participants in work hours (9 AM - 6 PM)</Text>
          </View>
        </View>
      )}

      {participants.length < 2 && (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={ACCENT + '40'} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Add at least 2 participants to find overlapping meeting times.</Text>
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
    participantRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 10, borderBottomWidth: 0.5 },
    pName: { fontSize: 14, fontFamily: Fonts.semibold },
    pTz: { fontSize: 11, fontFamily: Fonts.regular },
    addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: Radii.xl, borderWidth: 1, marginTop: Spacing.md },
    addBtnText: { fontSize: 13, fontFamily: Fonts.semibold },
    input: { fontSize: 14, fontFamily: Fonts.regular, padding: Spacing.md, borderRadius: Radii.md, borderWidth: 1 },
    tzList: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
    tzChip: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radii.md, borderWidth: 1 },
    tzText: { fontSize: 11, fontFamily: Fonts.medium },
    saveBtn: { paddingVertical: 12, borderRadius: Radii.xl, alignItems: 'center' },
    saveBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
    slotsGrid: { gap: Spacing.sm },
    slotCard: { padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, gap: 4 },
    slotRow: { flexDirection: 'row', justifyContent: 'space-between' },
    slotName: { fontSize: 12, fontFamily: Fonts.medium },
    slotTime: { fontSize: 13, fontFamily: Fonts.bold },
    noOverlapText: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center' },
    gridHeader: { flexDirection: 'row', marginBottom: 4 },
    gridName: { flex: 1, fontSize: 10, fontFamily: Fonts.bold, textAlign: 'center' },
    gridRow: { flexDirection: 'row', paddingVertical: 3, borderRadius: 4 },
    gridCell: { flex: 1, fontSize: 10, fontFamily: Fonts.regular, textAlign: 'center' },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.md },
    legendDot: { width: 12, height: 12, borderRadius: 3 },
    legendText: { fontSize: 10, fontFamily: Fonts.regular },
    emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
    emptyText: { fontSize: 14, fontFamily: Fonts.medium, textAlign: 'center' },
  });
