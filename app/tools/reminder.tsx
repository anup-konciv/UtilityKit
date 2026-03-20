import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StyleSheet, Modal, Alert, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#A855F7';
const ITEM_H  = 48;

// ── Types ─────────────────────────────────────────────────────────────────────
type RepeatMode = 'none' | 'daily' | 'weekly' | 'monthly';
type Priority   = 'low' | 'medium' | 'high';
type Filter     = 'all' | 'today' | 'upcoming' | 'overdue' | 'done';
type Colors     = ReturnType<typeof useAppTheme>['colors'];

type Reminder = {
  id: string;
  title: string;
  note: string;
  datetime: string; // "YYYY-MM-DDTHH:MM"
  repeat: RepeatMode;
  priority: Priority;
  done: boolean;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const PRIORITY_COLOR: Record<Priority, string> = {
  low: '#10B981', medium: '#F59E0B', high: '#EF4444',
};
const PRIORITY_LABELS: Priority[]   = ['low', 'medium', 'high'];
const REPEAT_OPTIONS: { id: RepeatMode; label: string }[] = [
  { id: 'none', label: 'Once' }, { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' }, { id: 'monthly', label: 'Monthly' },
];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// ── Helpers ───────────────────────────────────────────────────────────────────
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function nowISO() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
}
function p2(n: number) { return String(n).padStart(2, '0'); }

function todayDate() {
  const d = new Date();
  return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`;
}

function dtToDate(dt: string) { return new Date(dt.replace('T', ' ')); }

function fmtDatetime(dt: string): string {
  const [date, time] = dt.split('T');
  const [y, m, d] = date.split('-').map(Number);
  const [h, min]  = time.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  const today = todayDate();
  const tmr   = (() => { const t = new Date(); t.setDate(t.getDate()+1); return `${t.getFullYear()}-${p2(t.getMonth()+1)}-${p2(t.getDate())}`; })();
  const prefix = date === today ? 'Today' : date === tmr ? 'Tomorrow' : `${d} ${MONTHS[m-1]}`;
  return `${prefix}, ${h12}:${p2(min)} ${ampm}`;
}

function timeUntilLabel(dt: string): { label: string; overdue: boolean } {
  const diff = dtToDate(dt).getTime() - Date.now();
  const overdue = diff < 0;
  const abs     = Math.abs(diff);
  const mins    = Math.floor(abs / 60000);
  const hrs     = Math.floor(mins / 60);
  const days    = Math.floor(hrs  / 24);
  let label: string;
  if (days > 0)      label = `${days}d ${hrs % 24}h`;
  else if (hrs > 0)  label = `${hrs}h ${mins % 60}m`;
  else if (mins > 0) label = `${mins}m`;
  else               label = overdue ? 'just now' : 'now';
  return { label: overdue ? `${label} ago` : `in ${label}`, overdue };
}

function getStatus(r: Reminder): 'done' | 'overdue' | 'today' | 'upcoming' {
  if (r.done) return 'done';
  const d = dtToDate(r.datetime);
  const now = new Date();
  if (d < now) return 'overdue';
  if (r.datetime.startsWith(todayDate())) return 'today';
  return 'upcoming';
}

function daysInMonth(month: number, year: number) {
  return new Date(year, month, 0).getDate();
}

// ── Scroll-Wheel Picker ───────────────────────────────────────────────────────
function PickerCol({ items, value, onChange, width = 72, colors }: {
  items: string[]; value: string; onChange: (v: string) => void;
  width?: number; colors: Colors;
}) {
  const ref = useRef<ScrollView>(null);
  const idx = Math.max(0, items.indexOf(value));

  useEffect(() => {
    const t = setTimeout(() => ref.current?.scrollTo({ y: idx * ITEM_H, animated: false }), 80);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ height: ITEM_H * 3, width, overflow: 'hidden' }}>
      <View style={[pc.indicator, { borderColor: ACCENT }]} />
      <ScrollView
        ref={ref}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        contentContainerStyle={{ paddingVertical: ITEM_H }}
        onMomentumScrollEnd={e => {
          const newIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(newIdx, items.length - 1));
          if (items[clamped] !== value) onChange(items[clamped]);
        }}
        onScrollEndDrag={e => {
          const newIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
          const clamped = Math.max(0, Math.min(newIdx, items.length - 1));
          if (items[clamped] !== value) onChange(items[clamped]);
        }}
      >
        {items.map((item) => (
          <View key={item} style={{ height: ITEM_H, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={[
              pc.itemTxt,
              { color: item === value ? colors.text : colors.textMuted },
              item === value && { fontFamily: Fonts.bold, fontSize: 20 },
            ]}>
              {item}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
const pc = StyleSheet.create({
  indicator: {
    position: 'absolute', top: ITEM_H, height: ITEM_H,
    left: 4, right: 4, borderTopWidth: 1.5, borderBottomWidth: 1.5,
    pointerEvents: 'none',
  } as any,
  itemTxt: { fontFamily: Fonts.medium, fontSize: 17 },
});

// ── Date-Time Picker Modal ────────────────────────────────────────────────────
function DateTimeModal({ value, onConfirm, onClose, colors }: {
  value: string; onConfirm: (v: string) => void; onClose: () => void; colors: Colors;
}) {
  const [date, time] = value.split('T');
  const [vy, vm, vd] = date.split('-').map(Number);
  const [vh, vmin]   = time.split(':').map(Number);

  const [day,    setDay]    = useState(p2(vd));
  const [month,  setMonth]  = useState(MONTHS[vm - 1]);
  const [year,   setYear]   = useState(String(vy));
  const [hour,   setHour]   = useState(p2(vh));
  const [minute, setMinute] = useState(p2(vmin));

  const currentYear = new Date().getFullYear();
  const years   = Array.from({ length: 11 }, (_, i) => String(currentYear - 1 + i));
  const monthIdx = MONTHS.indexOf(month) + 1;
  const maxDay   = daysInMonth(monthIdx, parseInt(year));
  const days     = Array.from({ length: maxDay }, (_, i) => p2(i + 1));
  const hours    = Array.from({ length: 24 }, (_, i) => p2(i));
  const minutes  = Array.from({ length: 60 }, (_, i) => p2(i));

  // Clamp day if month changes
  const safeDay = parseInt(day) > maxDay ? p2(maxDay) : day;

  const confirm = () => {
    const m = MONTHS.indexOf(month) + 1;
    onConfirm(`${year}-${p2(m)}-${safeDay}T${hour}:${minute}`);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={dt.overlay}>
        <TouchableOpacity style={dt.dismiss} activeOpacity={1} onPress={onClose} />
        <View style={[dt.sheet, { backgroundColor: colors.surface }]}>
          <View style={[dt.handle, { backgroundColor: colors.border }]} />
          <Text style={[dt.title, { color: colors.text }]}>Set Date & Time</Text>

          {/* Date row */}
          <Text style={[dt.rowLabel, { color: colors.textMuted }]}>Date</Text>
          <View style={[dt.pickerRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <PickerCol items={days}   value={safeDay} onChange={setDay}   width={56}  colors={colors} />
            <View style={[dt.sep, { backgroundColor: colors.border }]} />
            <PickerCol items={MONTHS} value={month}   onChange={setMonth} width={72}  colors={colors} />
            <View style={[dt.sep, { backgroundColor: colors.border }]} />
            <PickerCol items={years}  value={year}    onChange={setYear}  width={80}  colors={colors} />
          </View>

          {/* Time row */}
          <Text style={[dt.rowLabel, { color: colors.textMuted, marginTop: Spacing.md }]}>Time</Text>
          <View style={[dt.pickerRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
            <PickerCol items={hours}   value={hour}   onChange={setHour}   width={72} colors={colors} />
            <Text style={[dt.colon, { color: colors.textMuted }]}>:</Text>
            <PickerCol items={minutes} value={minute} onChange={setMinute} width={72} colors={colors} />
          </View>

          <TouchableOpacity style={[dt.confirmBtn, { backgroundColor: ACCENT }]} onPress={confirm}>
            <Text style={dt.confirmTxt}>Confirm</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
const dt = StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  dismiss:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 40 },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  title:      { fontFamily: Fonts.bold, fontSize: 18, marginBottom: Spacing.lg },
  rowLabel:   { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  pickerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: Radii.lg, borderWidth: 1, paddingHorizontal: Spacing.lg, paddingVertical: 4 },
  sep:        { width: 1, height: ITEM_H * 2, marginHorizontal: Spacing.sm },
  colon:      { fontFamily: Fonts.bold, fontSize: 22, marginHorizontal: Spacing.sm },
  confirmBtn: { height: 48, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.lg },
  confirmTxt: { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
});

// ── Add / Edit Sheet ──────────────────────────────────────────────────────────
function AddReminderSheet({ initial, onSave, onDelete, onClose, colors }: {
  initial: Reminder | null;
  onSave: (r: Reminder) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  colors: Colors;
}) {
  const isEdit = initial !== null;
  const defaultDt = (() => {
    const d = new Date(Date.now() + 60 * 60 * 1000); // +1h
    return `${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  })();

  const [title,    setTitle]    = useState(initial?.title    ?? '');
  const [note,     setNote]     = useState(initial?.note     ?? '');
  const [datetime, setDatetime] = useState(initial?.datetime ?? defaultDt);
  const [repeat,   setRepeat]   = useState<RepeatMode>(initial?.repeat   ?? 'none');
  const [priority, setPriority] = useState<Priority>(initial?.priority ?? 'medium');
  const [showDt,   setShowDt]   = useState(false);

  const handleSave = () => {
    if (!title.trim()) { Alert.alert('Title required', 'Please add a title.'); return; }
    onSave({ id: initial?.id ?? uid(), title: title.trim(), note: note.trim(), datetime, repeat, priority, done: initial?.done ?? false });
  };

  const s = useMemo(() => ss(colors), [colors]);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.overlay}>
        <TouchableOpacity style={s.dismiss} activeOpacity={1} onPress={onClose} />
        <ScrollView style={[s.sheet, { backgroundColor: colors.surface }]} keyboardShouldPersistTaps="handled" bounces={false}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />
          <Text style={[s.sheetTitle, { color: colors.text }]}>{isEdit ? 'Edit Reminder' : 'New Reminder'}</Text>

          {/* Title */}
          <Text style={[s.label, { color: colors.textMuted }]}>Title *</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Take medicine"
            placeholderTextColor={colors.textMuted}
            autoFocus={!isEdit}
          />

          {/* Note */}
          <Text style={[s.label, { color: colors.textMuted }]}>Note</Text>
          <TextInput
            style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text, height: 72, textAlignVertical: 'top', paddingTop: 10 }]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional details…"
            placeholderTextColor={colors.textMuted}
            multiline
          />

          {/* Date & Time */}
          <Text style={[s.label, { color: colors.textMuted }]}>Date & Time</Text>
          <TouchableOpacity
            style={[s.dtBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
            onPress={() => setShowDt(true)}
          >
            <Ionicons name="calendar-outline" size={18} color={ACCENT} />
            <Text style={[s.dtTxt, { color: colors.text }]}>{fmtDatetime(datetime)}</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          {/* Repeat */}
          <Text style={[s.label, { color: colors.textMuted }]}>Repeat</Text>
          <View style={s.pillRow}>
            {REPEAT_OPTIONS.map(o => {
              const active = repeat === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[s.pill, { borderColor: active ? ACCENT : colors.border, backgroundColor: active ? ACCENT + '18' : colors.inputBg }]}
                  onPress={() => setRepeat(o.id)}
                >
                  <Text style={[s.pillTxt, { color: active ? ACCENT : colors.textMuted }]}>{o.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Priority */}
          <Text style={[s.label, { color: colors.textMuted }]}>Priority</Text>
          <View style={s.pillRow}>
            {PRIORITY_LABELS.map(p => {
              const active   = priority === p;
              const color    = PRIORITY_COLOR[p];
              return (
                <TouchableOpacity
                  key={p}
                  style={[s.pill, { borderColor: active ? color : colors.border, backgroundColor: active ? color + '20' : colors.inputBg }]}
                  onPress={() => setPriority(p)}
                >
                  <View style={[s.priorityDot, { backgroundColor: color }]} />
                  <Text style={[s.pillTxt, { color: active ? color : colors.textMuted }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Actions */}
          <View style={[s.btnRow, { paddingBottom: 40 }]}>
            {isEdit && onDelete && (
              <TouchableOpacity
                style={[s.delBtn, { borderColor: '#EF4444' }]}
                onPress={() => Alert.alert('Delete', 'Remove this reminder?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => { onDelete(initial!.id); onClose(); } },
                ])}
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.saveBtn, { backgroundColor: ACCENT }]} onPress={handleSave}>
              <Text style={s.saveTxt}>{isEdit ? 'Save Changes' : 'Add Reminder'}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>

      {showDt && (
        <DateTimeModal
          value={datetime}
          onConfirm={v => { setDatetime(v); setShowDt(false); }}
          onClose={() => setShowDt(false)}
          colors={colors}
        />
      )}
    </Modal>
  );
}

const ss = (c: Colors) => StyleSheet.create({
  overlay:    { flex: 1, justifyContent: 'flex-end' },
  dismiss:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet:      { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '92%' },
  handle:     { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: Spacing.md, marginBottom: Spacing.md },
  sheetTitle: { fontFamily: Fonts.bold, fontSize: 18, marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  label:      { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 7, paddingHorizontal: Spacing.lg },
  input:      { borderRadius: Radii.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: 10, fontFamily: Fonts.regular, fontSize: 15, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  dtBtn:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: Radii.md, borderWidth: 1.5, paddingHorizontal: Spacing.md, paddingVertical: 14, marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  dtTxt:      { flex: 1, fontFamily: Fonts.semibold, fontSize: 15 },
  pillRow:    { flexDirection: 'row', gap: 8, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, flexWrap: 'wrap' },
  pill:       { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: Radii.pill, borderWidth: 1.5 },
  pillTxt:    { fontFamily: Fonts.medium, fontSize: 13 },
  priorityDot:{ width: 8, height: 8, borderRadius: 4 },
  btnRow:     { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, marginTop: Spacing.sm },
  delBtn:     { width: 48, height: 48, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  saveBtn:    { flex: 1, height: 48, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
  saveTxt:    { fontFamily: Fonts.bold, fontSize: 15, color: '#fff' },
});

// ── Reminder Card ─────────────────────────────────────────────────────────────
function ReminderCard({ item, onPress, onToggleDone, colors }: {
  item: Reminder; onPress: () => void; onToggleDone: () => void; colors: Colors;
}) {
  const status   = getStatus(item);
  const priColor = PRIORITY_COLOR[item.priority];
  const { label: timeLabel, overdue } = item.done ? { label: fmtDatetime(item.datetime), overdue: false } : timeUntilLabel(item.datetime);

  return (
    <TouchableOpacity
      style={[rc.card, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: item.done ? colors.border : priColor }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {/* Check button */}
      <TouchableOpacity style={[rc.check, { borderColor: item.done ? '#10B981' : colors.border, backgroundColor: item.done ? '#10B981' : 'transparent' }]} onPress={onToggleDone}>
        {item.done && <Ionicons name="checkmark" size={14} color="#fff" />}
      </TouchableOpacity>

      {/* Content */}
      <View style={{ flex: 1 }}>
        <Text style={[rc.title, { color: item.done ? colors.textMuted : colors.text }, item.done && rc.titleDone]} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.note && (
          <Text style={[rc.note, { color: colors.textMuted }]} numberOfLines={1}>{item.note}</Text>
        )}
        <View style={rc.metaRow}>
          <Ionicons name="time-outline" size={12} color={overdue && !item.done ? '#EF4444' : colors.textMuted} />
          <Text style={[rc.metaTxt, { color: overdue && !item.done ? '#EF4444' : colors.textMuted }]}>{timeLabel}</Text>
          {item.repeat !== 'none' && (
            <>
              <View style={[rc.dot, { backgroundColor: colors.border }]} />
              <Ionicons name="repeat-outline" size={12} color={colors.textMuted} />
              <Text style={[rc.metaTxt, { color: colors.textMuted }]}>
                {REPEAT_OPTIONS.find(r => r.id === item.repeat)?.label}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Priority badge */}
      <View style={[rc.priBadge, { backgroundColor: priColor + '20' }]}>
        <Text style={[rc.priTxt, { color: priColor }]}>
          {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const rc = StyleSheet.create({
  card:      { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, borderLeftWidth: 4, marginBottom: Spacing.sm },
  check:     { width: 26, height: 26, borderRadius: 13, borderWidth: 2, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title:     { fontFamily: Fonts.semibold, fontSize: 15, marginBottom: 2 },
  titleDone: { textDecorationLine: 'line-through' } as any,
  note:      { fontFamily: Fonts.regular, fontSize: 12, marginBottom: 4 },
  metaRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt:   { fontFamily: Fonts.regular, fontSize: 11 },
  dot:       { width: 3, height: 3, borderRadius: 2 },
  priBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radii.pill, flexShrink: 0 },
  priTxt:    { fontFamily: Fonts.semibold, fontSize: 10 },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all',      label: 'All'      },
  { id: 'today',    label: 'Today'    },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'overdue',  label: 'Overdue'  },
  { id: 'done',     label: 'Done'     },
];

export default function ReminderScreen() {
  const { colors } = useAppTheme();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [filter,    setFilter]    = useState<Filter>('all');
  const [sheet,     setSheet]     = useState<{ visible: boolean; editing: Reminder | null }>({ visible: false, editing: null });

  useEffect(() => {
    loadJSON<Reminder[]>(KEYS.reminders, []).then(setReminders);
  }, []);

  const persist = useCallback((next: Reminder[]) => {
    setReminders(next);
    saveJSON(KEYS.reminders, next);
  }, []);

  const handleSave = (r: Reminder) => {
    const exists = reminders.some(x => x.id === r.id);
    persist(exists ? reminders.map(x => x.id === r.id ? r : x) : [r, ...reminders]);
    setSheet({ visible: false, editing: null });
  };

  const handleDelete = (id: string) => persist(reminders.filter(r => r.id !== id));

  const handleToggle = (id: string) => {
    persist(reminders.map(r => r.id === id ? { ...r, done: !r.done } : r));
  };

  // Filter + sort
  const filtered = useMemo(() => {
    const list = reminders.filter(r => {
      const s = getStatus(r);
      if (filter === 'all')      return true;
      if (filter === 'today')    return s === 'today';
      if (filter === 'upcoming') return s === 'upcoming' || s === 'today';
      if (filter === 'overdue')  return s === 'overdue';
      if (filter === 'done')     return s === 'done';
      return true;
    });
    return list.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.datetime.localeCompare(b.datetime);
    });
  }, [reminders, filter]);

  // Stats
  const stats = useMemo(() => ({
    total:    reminders.filter(r => !r.done).length,
    today:    reminders.filter(r => getStatus(r) === 'today').length,
    overdue:  reminders.filter(r => getStatus(r) === 'overdue').length,
  }), [reminders]);

  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <ScreenShell
      title="Reminders"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: ACCENT }]} onPress={() => setSheet({ visible: true, editing: null })}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      }
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.huge }}>

        {/* Stats row */}
        {reminders.length > 0 && (
          <View style={styles.statsRow}>
            <View style={[styles.statTile, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statVal, { color: colors.text }]}>{stats.total}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: stats.today > 0 ? ACCENT + '18' : colors.card, borderColor: stats.today > 0 ? ACCENT : colors.border }]}>
              <Text style={[styles.statVal, { color: stats.today > 0 ? ACCENT : colors.text }]}>{stats.today}</Text>
              <Text style={[styles.statLabel, { color: stats.today > 0 ? ACCENT : colors.textMuted }]}>Today</Text>
            </View>
            <View style={[styles.statTile, { backgroundColor: stats.overdue > 0 ? '#EF444418' : colors.card, borderColor: stats.overdue > 0 ? '#EF4444' : colors.border }]}>
              <Text style={[styles.statVal, { color: stats.overdue > 0 ? '#EF4444' : colors.text }]}>{stats.overdue}</Text>
              <Text style={[styles.statLabel, { color: stats.overdue > 0 ? '#EF4444' : colors.textMuted }]}>Overdue</Text>
            </View>
          </View>
        )}

        {/* Filter chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar} style={{ flexGrow: 0, marginBottom: Spacing.md }}>
          {FILTERS.map(f => {
            const active = filter === f.id;
            const isOverdueFilter = f.id === 'overdue' && stats.overdue > 0;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.filterPill,
                  { borderColor: active ? ACCENT : colors.border, backgroundColor: active ? ACCENT : colors.surface },
                  isOverdueFilter && !active && { borderColor: '#EF4444' },
                ]}
                onPress={() => setFilter(f.id)}
              >
                <Text style={[styles.filterTxt, { color: active ? '#fff' : isOverdueFilter ? '#EF4444' : colors.textMuted }]}>
                  {f.label}
                  {f.id === 'overdue' && stats.overdue > 0 ? ` (${stats.overdue})` : ''}
                  {f.id === 'today'   && stats.today > 0   ? ` (${stats.today})`   : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List */}
        {filtered.map(r => (
          <ReminderCard
            key={r.id}
            item={r}
            onPress={() => setSheet({ visible: true, editing: r })}
            onToggleDone={() => handleToggle(r.id)}
            colors={colors}
          />
        ))}

        {/* Empty state */}
        {filtered.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {filter === 'all' ? 'No reminders yet' : `No ${filter} reminders`}
            </Text>
            <Text style={[styles.emptySub, { color: colors.textMuted }]}>
              {filter === 'all' ? 'Tap + to set your first reminder' : 'Change the filter to see others'}
            </Text>
          </View>
        )}
      </ScrollView>

      {sheet.visible && (
        <AddReminderSheet
          initial={sheet.editing}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setSheet({ visible: false, editing: null })}
          colors={colors}
        />
      )}
    </ScreenShell>
  );
}

const createStyles = (c: Colors) => StyleSheet.create({
  addBtn:      { width: 34, height: 34, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  statsRow:    { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  statTile:    { flex: 1, alignItems: 'center', padding: Spacing.md, borderRadius: Radii.lg, borderWidth: 1, gap: 3 },
  statVal:     { fontFamily: Fonts.bold, fontSize: 22 },
  statLabel:   { fontFamily: Fonts.regular, fontSize: 11 },
  filterBar:   { gap: 8 },
  filterPill:  { paddingHorizontal: 14, paddingVertical: 7, borderRadius: Radii.pill, borderWidth: 1.5 },
  filterTxt:   { fontFamily: Fonts.semibold, fontSize: 13 },
  empty:       { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  emptyTitle:  { fontFamily: Fonts.semibold, fontSize: 16 },
  emptySub:    { fontFamily: Fonts.regular, fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
