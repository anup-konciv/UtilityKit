import { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  FlatList,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
type Note = {
  id: string;
  title: string;
  content: string;
  color: string;
  locked: boolean;
  pin: string;
  updatedAt: number;
};

type AppColors = ReturnType<typeof useAppTheme>['colors'];

// ── Constants ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'uk_notes';

const NOTE_COLORS_LIGHT = [
  '#FFFFFF', '#FEF9C3', '#FEE2E2', '#DCFCE7',
  '#DBEAFE', '#EDE9FE', '#FEF3C7', '#FCE7F3',
  '#F1F5F9', '#FFF7ED',
];

const NOTE_COLORS_DARK = [
  '#1E293B', '#14532D', '#4C1D95', '#7F1D1D',
  '#0C4A6E', '#312E81', '#064E3B', '#713F12',
  '#881337', '#1C1917',
];

const NOTE_COLORS = [...NOTE_COLORS_LIGHT, ...NOTE_COLORS_DARK];

// ── Helpers ───────────────────────────────────────────────────────────────────
function isDark(hex: string): boolean {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Unlock Modal ──────────────────────────────────────────────────────────────
function UnlockModal({
  pin, error, onDigit, onBackspace, onClose, colors,
}: {
  pin: string; error: boolean;
  onDigit: (d: string) => void; onBackspace: () => void;
  onClose: () => void; colors: AppColors;
}) {
  const PAD_ROWS = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['', '0', '⌫']];

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={um.overlay}>
        <View style={[um.sheet, { backgroundColor: colors.card }]}>
          <Ionicons name="lock-closed" size={32} color={colors.accent} style={{ marginBottom: Spacing.md }} />
          <Text style={[um.title, { color: colors.text }]}>Locked Note</Text>
          <Text style={[um.sub, { color: colors.textMuted }]}>Enter your PIN to unlock</Text>
          <View style={um.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  um.dot, { borderColor: colors.border },
                  pin.length > i && { backgroundColor: colors.accent, borderColor: colors.accent },
                  error && { borderColor: '#EF4444' },
                ]}
              />
            ))}
          </View>
          {error && <Text style={[um.errText, { color: '#EF4444' }]}>Wrong PIN. Try again.</Text>}
          <View style={um.pad}>
            {PAD_ROWS.map((row, ri) => (
              <View key={ri} style={um.padRow}>
                {row.map((key, ki) => (
                  <TouchableOpacity
                    key={ki}
                    style={[
                      um.padKey,
                      { backgroundColor: key ? colors.surface : 'transparent', borderColor: colors.border },
                      !key && { borderWidth: 0 },
                    ]}
                    onPress={() => { if (!key) return; if (key === '⌫') onBackspace(); else onDigit(key); }}
                    disabled={!key}
                  >
                    {key === '⌫' ? (
                      <Ionicons name="backspace-outline" size={20} color={colors.text} />
                    ) : key ? (
                      <Text style={[um.padLabel, { color: colors.text }]}>{key}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
          <TouchableOpacity onPress={onClose} style={{ marginTop: Spacing.sm }}>
            <Text style={[um.cancel, { color: colors.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const um = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', alignItems: 'center' },
  sheet: { borderRadius: Radii.xl, padding: Spacing.xl, width: 288, alignItems: 'center' },
  title: { fontFamily: Fonts.bold, fontSize: 18, marginBottom: 4 },
  sub: { fontFamily: Fonts.regular, fontSize: 13, marginBottom: Spacing.xl },
  dots: { flexDirection: 'row', gap: 14, marginBottom: Spacing.sm },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 2 },
  errText: { fontFamily: Fonts.medium, fontSize: 12, marginBottom: Spacing.sm },
  pad: { width: '100%', marginTop: Spacing.sm },
  padRow: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 10 },
  padKey: { width: 72, height: 50, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  padLabel: { fontFamily: Fonts.medium, fontSize: 22 },
  cancel: { fontFamily: Fonts.medium, fontSize: 14, paddingVertical: Spacing.sm },
});

// ── Note Editor Modal ─────────────────────────────────────────────────────────
function NoteEditor({
  initial, isNew, colors, onSave, onDelete, onClose,
}: {
  initial: Note; isNew: boolean; colors: AppColors;
  onSave: (n: Note) => void; onDelete: (id: string) => void; onClose: () => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [content, setContent] = useState(initial.content);
  const [color, setColor] = useState(initial.color);
  const [locked, setLocked] = useState(initial.locked);
  const [pin, setPin] = useState(initial.pin);
  const [showColors, setShowColors] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const dark = isDark(color);
  const textColor = dark ? '#F1F5F9' : '#0B1120';
  const mutedColor = dark ? '#94A3B8' : '#64748B';
  const placeholderColor = dark ? '#64748B' : '#94A3B8';
  const borderAlpha = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const btnBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const toggleLock = () => { if (locked) { setLocked(false); setPin(''); } else setLocked(true); };
  const canSave = !locked || pin.length === 4;
  const handleSave = () => {
    if (!canSave) return;
    onSave({ ...initial, title: title.trim(), content, color, locked, pin, updatedAt: Date.now() });
  };
  const openColors = () => {
    Keyboard.dismiss();
    setShowLock(false);
    setShowColors(true);
  };
  const openLock = () => {
    Keyboard.dismiss();
    setShowColors(false);
    setShowLock(true);
  };
  const androidKeyboardLift = Platform.OS === 'android' && keyboardHeight > 0 ? { marginBottom: keyboardHeight } : null;
  const popupKeyboardLift = keyboardHeight > 0 ? { marginBottom: keyboardHeight } : null;
  const androidLockOverlayLift =
    Platform.OS === 'android' && keyboardHeight > 0
      ? { paddingBottom: keyboardHeight }
      : null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[es.root, { backgroundColor: color }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >

          {/* Header */}
          <View style={[es.header, { backgroundColor: color, borderBottomColor: borderAlpha }]}>
            <TouchableOpacity onPress={onClose} style={[es.iconBtn, { backgroundColor: btnBg }]}>
              <Ionicons name="close" size={22} color={textColor} />
            </TouchableOpacity>
            <Text style={[es.headerTitle, { color: textColor }]} numberOfLines={1}>
              {isNew ? 'New Note' : (title.trim() || 'Edit Note')}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[es.saveBtn, !canSave && es.saveBtnDisabled]}
              disabled={!canSave}
            >
              <Text style={es.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          {/* Text area */}
          <View style={es.textArea}>
            <TextInput
              style={[es.titleInput, { color: textColor }]}
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={placeholderColor}
              maxLength={60}
            />
            <View style={[es.divider, { backgroundColor: borderAlpha }]} />
            <TextInput
              style={[es.contentInput, { color: dark ? '#CBD5E1' : '#334155' }]}
              value={content}
              onChangeText={setContent}
              placeholder="Write your note…"
              placeholderTextColor={placeholderColor}
              multiline
              textAlignVertical="top"
            />
          </View>

          {/* Bottom toolbar */}
          <View style={[es.toolbar, { backgroundColor: color, borderTopColor: borderAlpha }, androidKeyboardLift]}>
            <TouchableOpacity style={es.toolBtn} onPress={openColors}>
              <View style={[es.colorDot, { backgroundColor: color, borderColor: borderAlpha }]} />
              <Text style={[es.toolLabel, { color: mutedColor }]}>Color</Text>
            </TouchableOpacity>
            <TouchableOpacity style={es.toolBtn} onPress={openLock}>
              <Ionicons
                name={locked ? 'lock-closed' : 'lock-open-outline'}
                size={18}
                color={locked ? '#F59E0B' : mutedColor}
              />
              <Text style={[es.toolLabel, { color: locked ? '#F59E0B' : mutedColor }]}>
                {locked ? 'Locked' : 'Lock'}
              </Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {!isNew && (
              <TouchableOpacity style={es.toolBtn} onPress={() => onDelete(initial.id)}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                <Text style={[es.toolLabel, { color: '#EF4444' }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>

        {/* Color picker popup */}
        {showColors && (
          <Pressable style={es.popupBackdrop} onPress={() => setShowColors(false)}>
            <Pressable style={[es.popup, { backgroundColor: colors.card }, popupKeyboardLift]} onPress={() => {}}>
              <View style={[es.popupHandle, { backgroundColor: colors.border }]} />
              <Text style={[es.popupTitle, { color: colors.text }]}>Note Color</Text>

              <Text style={[es.colorSectionLabel, { color: colors.textMuted }]}>Light</Text>
              <View style={es.colorGrid}>
                {NOTE_COLORS_LIGHT.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[es.swatch, { backgroundColor: c }, color === c && es.swatchActive]}
                    onPress={() => { setColor(c); setShowColors(false); }}
                  >
                    {color === c && <Ionicons name="checkmark" size={16} color="#334155" />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[es.colorSectionLabel, { color: colors.textMuted, marginTop: Spacing.md }]}>Dark</Text>
              <View style={es.colorGrid}>
                {NOTE_COLORS_DARK.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[es.swatch, { backgroundColor: c, borderColor: 'rgba(255,255,255,0.15)' }, color === c && es.swatchActiveDark]}
                    onPress={() => { setColor(c); setShowColors(false); }}
                  >
                    {color === c && <Ionicons name="checkmark" size={16} color="#F1F5F9" />}
                  </TouchableOpacity>
                ))}
              </View>
            </Pressable>
          </Pressable>
        )}

        {/* Lock popup */}
        {showLock && (
          <KeyboardAvoidingView
            style={es.popupKeyboardWrap}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
          >
            <Pressable
              style={[es.popupBackdrop, androidLockOverlayLift]}
              onPress={() => setShowLock(false)}
            >
              <Pressable
                style={[
                  es.popup,
                  es.lockPopup,
                  { backgroundColor: colors.card },
                  popupKeyboardLift,
                ]}
                onPress={() => {}}
              >
                <View style={[es.popupHandle, { backgroundColor: colors.border }]} />
                <Text style={[es.popupTitle, { color: colors.text }]}>Lock Note</Text>
                <View style={[es.lockRow, { borderBottomColor: 'rgba(0,0,0,0.07)' }]}>
                  <Ionicons name={locked ? 'lock-closed' : 'lock-open-outline'} size={18} color={locked ? '#F59E0B' : '#64748B'} />
                  <Text style={[es.lockLabel, { color: colors.text }]}>Lock with PIN</Text>
                  <TouchableOpacity style={[es.toggle, locked && es.toggleOn]} onPress={toggleLock}>
                    <View style={[es.thumb, locked && es.thumbOn]} />
                  </TouchableOpacity>
                </View>
                {locked && (
                  <View style={es.pinSection}>
                    <Text style={es.pinLabel}>4-digit PIN</Text>
                    <TextInput
                      style={[es.pinInput, { color: colors.text, borderColor: pin.length === 4 ? '#10B981' : colors.border }]}
                      value={pin}
                      onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 4))}
                      placeholder="_ _ _ _"
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      autoFocus
                    />
                    {pin.length > 0 && pin.length < 4 && (
                      <Text style={es.pinHint}>Enter all 4 digits</Text>
                    )}
                  </View>
                )}
                <TouchableOpacity
                  style={[es.doneBtn, (!locked || pin.length === 4) ? es.doneBtnActive : es.doneBtnDisabled]}
                  onPress={() => setShowLock(false)}
                  disabled={locked && pin.length < 4}
                >
                  <Text style={es.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const es = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, gap: Spacing.sm,
  },
  iconBtn: { width: 36, height: 36, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: Fonts.bold, fontSize: 16, textAlign: 'center' },
  saveBtn: {
    paddingHorizontal: 16, height: 36, borderRadius: Radii.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#F59E0B',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: Fonts.semibold, fontSize: 14, color: '#fff' },
  textArea: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  titleInput: { fontFamily: Fonts.bold, fontSize: 22, paddingVertical: Spacing.sm },
  divider: { height: 1, marginBottom: Spacing.sm },
  contentInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, paddingVertical: Spacing.sm },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: 1, gap: Spacing.sm,
  },
  popupKeyboardWrap: {
    ...StyleSheet.absoluteFillObject,
  },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 6 },
  colorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  toolLabel: { fontFamily: Fonts.medium, fontSize: 13 },
  popupBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  popup: { borderTopLeftRadius: Radii.xl, borderTopRightRadius: Radii.xl, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  lockPopup: { paddingBottom: Spacing.lg },
  popupHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  popupTitle: { fontFamily: Fonts.bold, fontSize: 16, marginBottom: Spacing.sm },
  colorSectionLabel: { fontFamily: Fonts.semibold, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: Spacing.sm },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingBottom: Spacing.xs },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.12)', alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 3, borderColor: '#334155' },
  swatchActiveDark: { borderWidth: 3, borderColor: '#F1F5F9' },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md },
  lockLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: 15 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#CBD5E1', padding: 3 },
  toggleOn: { backgroundColor: '#F59E0B' },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  thumbOn: { alignSelf: 'flex-end' },
  pinSection: { marginBottom: Spacing.lg },
  pinLabel: { fontFamily: Fonts.semibold, fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  pinInput: { borderWidth: 1.5, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 14, backgroundColor: 'rgba(0,0,0,0.04)', textAlign: 'center' },
  pinHint: { fontFamily: Fonts.regular, fontSize: 12, color: '#F59E0B', marginTop: 6 },
  doneBtn: { height: 46, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
  doneBtnActive: { backgroundColor: '#F59E0B' },
  doneBtnDisabled: { backgroundColor: '#CBD5E1' },
  doneBtnText: { fontFamily: Fonts.semibold, fontSize: 15, color: '#fff' },
});

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function NotesScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [notes, setNotes] = useState<Note[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editing, setEditing] = useState<{ note: Note; isNew: boolean } | null>(null);
  const [unlocking, setUnlocking] = useState<Note | null>(null);
  const [unlockPin, setUnlockPin] = useState('');
  const [pinErr, setPinErr] = useState(false);

  useEffect(() => {
    loadJSON<Note[]>(STORAGE_KEY, []).then(setNotes);
  }, []);

  const persist = (next: Note[]) => { setNotes(next); saveJSON(STORAGE_KEY, next); };

  const openNew = () =>
    setEditing({
      note: { id: Date.now().toString(36), title: '', content: '', color: NOTE_COLORS[1], locked: false, pin: '', updatedAt: Date.now() },
      isNew: true,
    });

  const openNote = (note: Note) => {
    if (note.locked) { setUnlocking(note); setUnlockPin(''); setPinErr(false); }
    else setEditing({ note: { ...note }, isNew: false });
  };

  const handleSave = (note: Note) => {
    const exists = notes.some((n) => n.id === note.id);
    persist(exists ? notes.map((n) => (n.id === note.id ? note : n)) : [note, ...notes]);
    setEditing(null);
  };

  const handleDelete = (id: string) => { persist(notes.filter((n) => n.id !== id)); setEditing(null); };

  const handleDigit = (d: string) => {
    if (!unlocking) return;
    const next = unlockPin + d;
    setUnlockPin(next);
    setPinErr(false);
    if (next.length === 4) {
      if (next === unlocking.pin) {
        setEditing({ note: { ...unlocking }, isNew: false });
        setUnlocking(null); setUnlockPin('');
      } else {
        setPinErr(true); setUnlockPin('');
      }
    }
  };

  const handleBackspace = () => { setUnlockPin((p) => p.slice(0, -1)); setPinErr(false); };

  const isGrid = viewMode === 'grid';

  const renderCard = ({ item }: { item: Note }) => {
    const dark = isDark(item.color);
    const cardText = dark ? '#F1F5F9' : '#0B1120';
    const cardBody = dark ? '#CBD5E1' : '#334155';
    const cardMuted = dark ? '#94A3B8' : '#94A3B8';
    const borderColor = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';

    return (
      <TouchableOpacity
        style={[
          styles.card,
          isGrid ? styles.cardGrid : styles.cardList,
          { backgroundColor: item.color, borderColor },
        ]}
        onPress={() => openNote(item)}
        activeOpacity={0.82}
      >
        <View style={styles.cardTop}>
          {!!item.title && (
            <Text style={[styles.cardTitle, { color: cardText }]} numberOfLines={1}>{item.title}</Text>
          )}
          {item.locked && <Ionicons name="lock-closed" size={13} color={cardMuted} />}
        </View>
        {item.locked ? (
          <Text style={[styles.lockedHint, { color: cardMuted }]}>Tap to unlock</Text>
        ) : (
          <Text style={[styles.cardBody, { color: cardBody }]} numberOfLines={isGrid ? 5 : 3}>
            {item.content}
          </Text>
        )}
        <Text style={[styles.cardDate, { color: cardMuted }]}>{fmtDate(item.updatedAt)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScreenShell
      title="Note Cards"
      accentColor="#F59E0B"
      scrollable={false}
      rightAction={
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.viewToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setViewMode(isGrid ? 'list' : 'grid')}
          >
            <Ionicons name={isGrid ? 'list-outline' : 'grid-outline'} size={18} color="#F59E0B" />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: '#F59E0B' }]} onPress={openNew}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      }
    >
      <FlatList
        key={viewMode}
        data={notes}
        keyExtractor={(n) => n.id}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? styles.row : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={52} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              No notes yet.{'\n'}Tap + to create one.
            </Text>
          </View>
        )}
        renderItem={renderCard}
      />

      {editing && (
        <NoteEditor
          initial={editing.note}
          isNew={editing.isNew}
          colors={colors}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditing(null)}
        />
      )}

      {unlocking && (
        <UnlockModal
          pin={unlockPin}
          error={pinErr}
          onDigit={handleDigit}
          onBackspace={handleBackspace}
          onClose={() => setUnlocking(null)}
          colors={colors}
        />
      )}
    </ScreenShell>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (c: AppColors) =>
  StyleSheet.create({
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    viewToggle: {
      width: 34, height: 34, borderRadius: Radii.md,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    },
    addBtn: { width: 34, height: 34, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },
    row: { gap: 10 },
    list: { paddingBottom: Spacing.huge },
    card: {
      borderRadius: Radii.lg,
      padding: Spacing.md,
      borderWidth: 1,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 2,
    },
    cardGrid: { flex: 1, minHeight: 130 },
    cardList: { minHeight: 80 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
    cardTitle: { flex: 1, fontFamily: Fonts.semibold, fontSize: 13, marginRight: 4 },
    lockedHint: { fontSize: 12, fontFamily: Fonts.regular, flex: 1 },
    cardBody: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 18, flex: 1 },
    cardDate: { fontSize: 10, fontFamily: Fonts.regular, color: '#94A3B8', marginTop: 8, textAlign: 'right' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 14 },
    emptyText: { fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 22 },
  });
