import { useState, useMemo, useEffect, useCallback } from 'react';
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
  Alert,
  Share,
  ScrollView,
} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { hashPin, verifyPin } from '@/lib/pin';
import { Fonts, Radii, Spacing } from '@/constants/theme';

// ── Types ─────────────────────────────────────────────────────────────────────
type Category = 'Personal' | 'Work' | 'Ideas' | 'Lists' | 'Journal' | 'Other';

type Note = {
  id: string;
  title: string;
  content: string;
  color: string;
  locked: boolean;
  /** SHA-256 hash of the 4-digit PIN. Empty when `locked` is false. */
  pinHash: string;
  updatedAt: number;
  createdAt: number;
  starred: boolean;
  category: Category;
};

/**
 * Backwards-compat shape: notes used to ship a plaintext `pin` field.
 * On hydration we migrate any such note to `pinHash` and persist back.
 */
type LegacyNote = Note & { pin?: string };

type SortMode = 'newest' | 'oldest' | 'az' | 'edited';

type AppColors = ReturnType<typeof useAppTheme>['colors'];

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = '#F59E0B';

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

const CATEGORIES: { label: Category; color: string; icon: string }[] = [
  { label: 'Personal',  color: '#6366F1', icon: 'person-outline' },
  { label: 'Work',      color: '#0EA5E9', icon: 'briefcase-outline' },
  { label: 'Ideas',     color: '#F59E0B', icon: 'bulb-outline' },
  { label: 'Lists',     color: '#10B981', icon: 'list-outline' },
  { label: 'Journal',   color: '#EC4899', icon: 'journal-outline' },
  { label: 'Other',     color: '#94A3B8', icon: 'ellipsis-horizontal-outline' },
];

const SORT_OPTIONS: { key: SortMode; label: string }[] = [
  { key: 'newest', label: 'Newest First' },
  { key: 'oldest', label: 'Oldest First' },
  { key: 'az',     label: 'A – Z' },
  { key: 'edited', label: 'Recently Edited' },
];

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

function getCategoryMeta(cat: Category) {
  return CATEGORIES.find((c) => c.label === cat) ?? CATEGORIES[5];
}

function wordCount(text: string): number {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
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
    <KeyboardAwareModal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={um.overlay}>
        <View style={[um.sheet, { backgroundColor: colors.card }]}>
          <Ionicons name="lock-closed" size={32} color={ACCENT} style={{ marginBottom: Spacing.md }} />
          <Text style={[um.title, { color: colors.text }]}>Locked Note</Text>
          <Text style={[um.sub, { color: colors.textMuted }]}>Enter your PIN to unlock</Text>
          <View style={um.dots}>
            {[0, 1, 2, 3].map((i) => (
              <View
                key={i}
                style={[
                  um.dot, { borderColor: colors.border },
                  pin.length > i && { backgroundColor: ACCENT, borderColor: ACCENT },
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
    </KeyboardAwareModal>
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
  // Plaintext draft PIN; only ever lives in component state. We hash on save.
  // When editing an already-locked note we leave this empty until the user
  // explicitly changes the PIN — `pinDirty` decides whether to overwrite the
  // existing hash.
  const [pin, setPin] = useState('');
  const [pinDirty, setPinDirty] = useState(false);
  const [category, setCategory] = useState<Category>(initial.category ?? 'Personal');
  const [showColors, setShowColors] = useState(false);
  const [showLock, setShowLock] = useState(false);
  const [showCategory, setShowCategory] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const dark = isDark(color);
  const textColor = dark ? '#F1F5F9' : '#0B1120';
  const mutedColor = dark ? '#94A3B8' : '#64748B';
  const placeholderColor = dark ? '#64748B' : '#94A3B8';
  const borderAlpha = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  const btnBg = dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)';

  const wc = wordCount(content);
  const cc = content.length;
  const catMeta = getCategoryMeta(category);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (event) => { setKeyboardHeight(event.endCoordinates.height); });
    const hideSub = Keyboard.addListener(hideEvent, () => { setKeyboardHeight(0); });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const toggleLock = () => {
    if (locked) {
      setLocked(false);
      setPin('');
      setPinDirty(true);
    } else {
      setLocked(true);
    }
  };
  // For a brand-new lock the user must enter 4 digits. For an existing
  // locked note we accept "no change" — the existing hash carries over.
  const needsNewPin = locked && (!initial.locked || pinDirty);
  const canSave = !locked || !needsNewPin || pin.length === 4;

  const handleSave = async () => {
    if (!canSave) return;
    let pinHash = initial.pinHash ?? '';
    if (!locked) {
      pinHash = '';
    } else if (needsNewPin) {
      pinHash = await hashPin(pin);
    }
    onSave({
      ...initial,
      title: title.trim(),
      content,
      color,
      locked,
      pinHash,
      category,
      updatedAt: Date.now(),
      createdAt: initial.createdAt ?? Date.now(),
      starred: initial.starred ?? false,
    });
  };

  const handleShare = async () => {
    const shareText = [title.trim(), content].filter(Boolean).join('\n\n');
    try {
      await Share.share({ message: shareText || 'Empty note' });
    } catch {
      // dismissed
    }
  };

  const openColors = () => { Keyboard.dismiss(); setShowLock(false); setShowCategory(false); setShowColors(true); };
  const openLock   = () => { Keyboard.dismiss(); setShowColors(false); setShowCategory(false); setShowLock(true); };
  const openCat    = () => { Keyboard.dismiss(); setShowColors(false); setShowLock(false); setShowCategory(true); };

  const androidKeyboardLift = Platform.OS === 'android' && keyboardHeight > 0 ? { marginBottom: keyboardHeight } : null;
  const popupKeyboardLift   = keyboardHeight > 0 ? { marginBottom: keyboardHeight } : null;
  const androidLockOverlayLift = Platform.OS === 'android' && keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : null;

  return (
    <KeyboardAwareModal visible animationType="slide" onRequestClose={onClose}>
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
            <TouchableOpacity onPress={handleShare} style={[es.iconBtn, { backgroundColor: btnBg }]}>
              <Ionicons name="share-outline" size={20} color={textColor} />
            </TouchableOpacity>
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

          {/* Word / char count */}
          <View style={[es.countBar, { backgroundColor: color, borderTopColor: borderAlpha }]}>
            <Text style={[es.countText, { color: mutedColor }]}>
              {wc} {wc === 1 ? 'word' : 'words'}  ·  {cc} {cc === 1 ? 'char' : 'chars'}
            </Text>
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
                color={locked ? ACCENT : mutedColor}
              />
              <Text style={[es.toolLabel, { color: locked ? ACCENT : mutedColor }]}>
                {locked ? 'Locked' : 'Lock'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={es.toolBtn} onPress={openCat}>
              <View style={[es.catDot, { backgroundColor: catMeta.color }]} />
              <Text style={[es.toolLabel, { color: mutedColor }]}>{category}</Text>
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

        {/* Category picker popup */}
        {showCategory && (
          <Pressable style={es.popupBackdrop} onPress={() => setShowCategory(false)}>
            <Pressable style={[es.popup, { backgroundColor: colors.card }, popupKeyboardLift]} onPress={() => {}}>
              <View style={[es.popupHandle, { backgroundColor: colors.border }]} />
              <Text style={[es.popupTitle, { color: colors.text }]}>Category</Text>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.label}
                  style={[es.catRow, { borderColor: colors.border }, category === cat.label && { borderColor: cat.color, backgroundColor: cat.color + '18' }]}
                  onPress={() => { setCategory(cat.label); setShowCategory(false); }}
                >
                  <View style={[es.catRowDot, { backgroundColor: cat.color }]} />
                  <Text style={[es.catRowLabel, { color: colors.text }, category === cat.label && { color: cat.color, fontFamily: Fonts.semibold }]}>
                    {cat.label}
                  </Text>
                  {category === cat.label && <Ionicons name="checkmark" size={16} color={cat.color} />}
                </TouchableOpacity>
              ))}
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
            <Pressable style={[es.popupBackdrop, androidLockOverlayLift]} onPress={() => setShowLock(false)}>
              <Pressable style={[es.popup, es.lockPopup, { backgroundColor: colors.card }, popupKeyboardLift]} onPress={() => {}}>
                <View style={[es.popupHandle, { backgroundColor: colors.border }]} />
                <Text style={[es.popupTitle, { color: colors.text }]}>Lock Note</Text>
                <View style={[es.lockRow, { borderBottomColor: 'rgba(0,0,0,0.07)' }]}>
                  <Ionicons name={locked ? 'lock-closed' : 'lock-open-outline'} size={18} color={locked ? ACCENT : '#64748B'} />
                  <Text style={[es.lockLabel, { color: colors.text }]}>Lock with PIN</Text>
                  <TouchableOpacity style={[es.toggle, locked && es.toggleOn]} onPress={toggleLock}>
                    <View style={[es.thumb, locked && es.thumbOn]} />
                  </TouchableOpacity>
                </View>
                {locked && (
                  <View style={es.pinSection}>
                    <Text style={es.pinLabel}>
                      {needsNewPin ? '4-digit PIN' : 'PIN already set — tap to change'}
                    </Text>
                    <TextInput
                      style={[es.pinInput, { color: colors.text, borderColor: pin.length === 4 ? '#10B981' : colors.border }]}
                      value={pin}
                      onChangeText={(t) => { setPin(t.replace(/\D/g, '').slice(0, 4)); setPinDirty(true); }}
                      placeholder={needsNewPin ? '_ _ _ _' : '••••'}
                      placeholderTextColor="#94A3B8"
                      keyboardType="number-pad"
                      secureTextEntry
                      maxLength={4}
                      autoFocus={needsNewPin}
                    />
                    {needsNewPin && pin.length > 0 && pin.length < 4 && (
                      <Text style={es.pinHint}>Enter all 4 digits</Text>
                    )}
                  </View>
                )}
                <TouchableOpacity
                  style={[es.doneBtn, canSave ? es.doneBtnActive : es.doneBtnDisabled]}
                  onPress={() => setShowLock(false)}
                  disabled={!canSave}
                >
                  <Text style={es.doneBtnText}>Done</Text>
                </TouchableOpacity>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </KeyboardAwareModal>
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
    alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT,
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: Fonts.semibold, fontSize: 14, color: '#fff' },
  textArea: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  titleInput: { fontFamily: Fonts.bold, fontSize: 22, paddingVertical: Spacing.sm },
  divider: { height: 1, marginBottom: Spacing.sm },
  contentInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, paddingVertical: Spacing.sm },
  countBar: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg, paddingVertical: 5,
    borderTopWidth: 1,
  },
  countText: { fontFamily: Fonts.regular, fontSize: 11 },
  toolbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
    borderTopWidth: 1, gap: Spacing.sm,
  },
  popupKeyboardWrap: { ...StyleSheet.absoluteFillObject },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 6 },
  colorDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5 },
  catDot: { width: 10, height: 10, borderRadius: 5 },
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
  catRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: Radii.md, borderWidth: 1.5, marginBottom: Spacing.sm,
  },
  catRowDot: { width: 12, height: 12, borderRadius: 6 },
  catRowLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: 15 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, borderBottomWidth: 1, marginBottom: Spacing.md },
  lockLabel: { flex: 1, fontFamily: Fonts.medium, fontSize: 15 },
  toggle: { width: 46, height: 26, borderRadius: 13, backgroundColor: '#CBD5E1', padding: 3 },
  toggleOn: { backgroundColor: ACCENT },
  thumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 },
  thumbOn: { alignSelf: 'flex-end' },
  pinSection: { marginBottom: Spacing.lg },
  pinLabel: { fontFamily: Fonts.semibold, fontSize: 11, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  pinInput: { borderWidth: 1.5, borderRadius: Radii.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 14, backgroundColor: 'rgba(0,0,0,0.04)', textAlign: 'center' },
  pinHint: { fontFamily: Fonts.regular, fontSize: 12, color: ACCENT, marginTop: 6 },
  doneBtn: { height: 46, borderRadius: Radii.lg, alignItems: 'center', justifyContent: 'center' },
  doneBtnActive: { backgroundColor: ACCENT },
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [showSort, setShowSort] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await loadJSON<LegacyNote[]>(KEYS.notes, []);
      // Migrate any plaintext `pin` to `pinHash`. Notes that already have a
      // hash are passed through untouched.
      let dirty = false;
      const migrated: Note[] = await Promise.all(
        raw.map(async (n) => {
          if (n.pinHash !== undefined && n.pin === undefined) return n as Note;
          dirty = true;
          const pinHash = n.locked && n.pin ? await hashPin(n.pin) : '';
          const { pin: _legacyPin, ...rest } = n;
          return { ...rest, pinHash } as Note;
        })
      );
      setNotes(migrated);
      if (dirty) saveJSON(KEYS.notes, migrated);
    })();
  }, []);

  const persist = (next: Note[]) => { setNotes(next); saveJSON(KEYS.notes, next); };

  const openNew = () =>
    setEditing({
      note: {
        id: Date.now().toString(36),
        title: '',
        content: '',
        color: NOTE_COLORS[1],
        locked: false,
        pinHash: '',
        updatedAt: Date.now(),
        createdAt: Date.now(),
        starred: false,
        category: categoryFilter ?? 'Personal',
      },
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

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Note',
      'Are you sure you want to delete this note? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive',
          onPress: () => { persist(notes.filter((n) => n.id !== id)); setEditing(null); },
        },
      ],
    );
  };

  const toggleStar = useCallback((id: string) => {
    const next = notes.map((n) => n.id === id ? { ...n, starred: !n.starred } : n);
    persist(next);
  }, [notes]);

  const handleDigit = (d: string) => {
    if (!unlocking) return;
    const next = unlockPin + d;
    setUnlockPin(next);
    setPinErr(false);
    if (next.length === 4) {
      const target = unlocking;
      verifyPin(next, target.pinHash).then((ok) => {
        if (ok) {
          setEditing({ note: { ...target }, isNew: false });
          setUnlocking(null);
          setUnlockPin('');
        } else {
          setPinErr(true);
          setUnlockPin('');
        }
      });
    }
  };

  const handleBackspace = () => { setUnlockPin((p) => p.slice(0, -1)); setPinErr(false); };

  const isGrid = viewMode === 'grid';

  // Filtered + sorted notes
  const displayedNotes = useMemo(() => {
    let result = [...notes];

    // Category filter
    if (categoryFilter) result = result.filter((n) => n.category === categoryFilter);

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) =>
        n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q),
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortMode) {
        case 'oldest': return (a.createdAt ?? 0) - (b.createdAt ?? 0);
        case 'az':     return a.title.localeCompare(b.title);
        case 'edited': return b.updatedAt - a.updatedAt;
        default:       return (b.createdAt ?? b.updatedAt) - (a.createdAt ?? a.updatedAt);
      }
    });

    // Starred always on top
    result.sort((a, b) => (b.starred ? 1 : 0) - (a.starred ? 1 : 0));

    return result;
  }, [notes, searchQuery, sortMode, categoryFilter]);

  const currentSortLabel = SORT_OPTIONS.find((s) => s.key === sortMode)?.label ?? 'Sort';

  const renderCard = ({ item }: { item: Note }) => {
    const dark = isDark(item.color);
    const cardText  = dark ? '#F1F5F9' : '#0B1120';
    const cardBody  = dark ? '#CBD5E1' : '#334155';
    const cardMuted = '#94A3B8';
    const borderColor = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)';
    const catMeta = getCategoryMeta(item.category ?? 'Other');

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
        {/* Star + lock row */}
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            {!!item.title && (
              <Text style={[styles.cardTitle, { color: cardText }]} numberOfLines={1}>{item.title}</Text>
            )}
          </View>
          <View style={styles.cardTopIcons}>
            {item.locked && <Ionicons name="lock-closed" size={12} color={cardMuted} />}
            <TouchableOpacity onPress={() => toggleStar(item.id)} hitSlop={8}>
              <Ionicons
                name={item.starred ? 'star' : 'star-outline'}
                size={14}
                color={item.starred ? ACCENT : cardMuted}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Body */}
        {item.locked ? (
          <Text style={[styles.lockedHint, { color: cardMuted }]}>Tap to unlock</Text>
        ) : (
          <Text style={[styles.cardBody, { color: cardBody }]} numberOfLines={isGrid ? 5 : 3}>
            {item.content}
          </Text>
        )}

        {/* Footer: category + date */}
        <View style={styles.cardFooter}>
          <View style={[styles.catBadge, { backgroundColor: catMeta.color + '28' }]}>
            <View style={[styles.catBadgeDot, { backgroundColor: catMeta.color }]} />
            <Text style={[styles.catBadgeText, { color: catMeta.color }]}>{item.category ?? 'Other'}</Text>
          </View>
          <Text style={[styles.cardDate, { color: cardMuted }]}>{fmtDate(item.updatedAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <View>
      {/* Search bar */}
      <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={17} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search notes…"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.catScroll}
        contentContainerStyle={styles.catScrollContent}
      >
        <TouchableOpacity
          style={[
            styles.catChip,
            { borderColor: colors.border, backgroundColor: categoryFilter === null ? ACCENT : colors.surface },
          ]}
          onPress={() => setCategoryFilter(null)}
        >
          <Text style={[styles.catChipText, { color: categoryFilter === null ? '#fff' : colors.textMuted }]}>
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => {
          const active = categoryFilter === cat.label;
          return (
            <TouchableOpacity
              key={cat.label}
              style={[
                styles.catChip,
                { borderColor: active ? cat.color : colors.border, backgroundColor: active ? cat.color + '22' : colors.surface },
              ]}
              onPress={() => setCategoryFilter(active ? null : cat.label)}
            >
              <View style={[styles.catChipDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.catChipText, { color: active ? cat.color : colors.textMuted }]}>
                {cat.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Results count + sort */}
      <View style={styles.metaRow}>
        <Text style={[styles.resultCount, { color: colors.textMuted }]}>
          {displayedNotes.length} {displayedNotes.length === 1 ? 'note' : 'notes'}
          {searchQuery.trim() ? ` for "${searchQuery.trim()}"` : ''}
        </Text>
        <TouchableOpacity
          style={[styles.sortBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setShowSort(true)}
        >
          <Ionicons name="funnel-outline" size={13} color={colors.textMuted} />
          <Text style={[styles.sortLabel, { color: colors.textMuted }]}>{currentSortLabel}</Text>
          <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <ScreenShell
      title="Note Cards"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.viewToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => setViewMode(isGrid ? 'list' : 'grid')}
          >
            <Ionicons name={isGrid ? 'list-outline' : 'grid-outline'} size={18} color={ACCENT} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.addBtn, { backgroundColor: ACCENT }]} onPress={openNew}>
            <Ionicons name="add" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      }
    >
      <FlatList
        key={viewMode}
        data={displayedNotes}
        keyExtractor={(n) => n.id}
        numColumns={isGrid ? 2 : 1}
        columnWrapperStyle={isGrid ? styles.row : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={() => (
          <View style={styles.empty}>
            {searchQuery.trim() ? (
              <>
                <View style={[styles.emptyIllustration, { backgroundColor: colors.surface }]}>
                  <Ionicons name="search" size={36} color={colors.textMuted} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No results found</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  No notes match "{searchQuery.trim()}".{'\n'}Try a different search term.
                </Text>
              </>
            ) : (
              <>
                <View style={[styles.emptyIllustration, { backgroundColor: colors.surface }]}>
                  <Ionicons name="document-text-outline" size={36} color={ACCENT} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No notes yet</Text>
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Tap the + button to create your first note.
                </Text>
                <View style={[styles.tipBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.tipTitle, { color: colors.text }]}>Quick tips</Text>
                  {[
                    'Choose a color to personalize each note',
                    'Lock sensitive notes with a 4-digit PIN',
                    'Star important notes to keep them on top',
                    'Categorize notes for easy filtering',
                    'Share any note with the share button',
                  ].map((tip, i) => (
                    <View key={i} style={styles.tipRow}>
                      <View style={[styles.tipDot, { backgroundColor: ACCENT }]} />
                      <Text style={[styles.tipText, { color: colors.textMuted }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
        )}
        renderItem={renderCard}
      />

      {/* Sort modal */}
      {showSort && (
        <KeyboardAwareModal visible transparent animationType="fade" onRequestClose={() => setShowSort(false)}>
          <Pressable style={sm.overlay} onPress={() => setShowSort(false)}>
            <Pressable style={[sm.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
              <Text style={[sm.title, { color: colors.text }]}>Sort Notes</Text>
              {SORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[sm.option, sortMode === opt.key && { backgroundColor: ACCENT + '18' }]}
                  onPress={() => { setSortMode(opt.key); setShowSort(false); }}
                >
                  <Text style={[sm.optionText, { color: colors.text }, sortMode === opt.key && { color: ACCENT, fontFamily: Fonts.semibold }]}>
                    {opt.label}
                  </Text>
                  {sortMode === opt.key && <Ionicons name="checkmark" size={18} color={ACCENT} />}
                </TouchableOpacity>
              ))}
            </Pressable>
          </Pressable>
        </KeyboardAwareModal>
      )}

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

// ── Sort modal styles ─────────────────────────────────────────────────────────
const sm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  sheet: { borderRadius: Radii.xl, padding: Spacing.lg, width: 280 },
  title: { fontFamily: Fonts.bold, fontSize: 16, marginBottom: Spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: Radii.md, marginBottom: 2 },
  optionText: { fontFamily: Fonts.medium, fontSize: 15 },
});

// ── Styles ────────────────────────────────────────────────────────────────────
const createStyles = (c: AppColors) =>
  StyleSheet.create({
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    viewToggle: {
      width: 34, height: 34, borderRadius: Radii.md,
      alignItems: 'center', justifyContent: 'center', borderWidth: 1,
    },
    addBtn: { width: 34, height: 34, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center' },

    // Search
    searchBar: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
      borderRadius: Radii.lg, borderWidth: 1,
      paddingHorizontal: Spacing.md, paddingVertical: 9,
      marginBottom: Spacing.sm,
    },
    searchInput: { flex: 1, fontFamily: Fonts.regular, fontSize: 14, padding: 0 },

    // Category filter
    catScroll: { marginBottom: Spacing.sm },
    catScrollContent: { gap: 8, paddingBottom: 2 },
    catChip: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: Radii.pill, borderWidth: 1.5,
      paddingHorizontal: 12, paddingVertical: 5,
    },
    catChipDot: { width: 8, height: 8, borderRadius: 4 },
    catChipText: { fontFamily: Fonts.medium, fontSize: 12 },

    // Meta row
    metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
    resultCount: { fontFamily: Fonts.regular, fontSize: 12 },
    sortBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 5,
      borderRadius: Radii.md, borderWidth: 1,
      paddingHorizontal: 10, paddingVertical: 5,
    },
    sortLabel: { fontFamily: Fonts.medium, fontSize: 12 },

    // Card list
    row: { gap: 10 },
    list: { paddingBottom: Spacing.huge },
    card: {
      borderRadius: Radii.lg, padding: Spacing.md, borderWidth: 1,
      shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
    },
    cardGrid: { flex: 1, minHeight: 130 },
    cardList: { minHeight: 80 },
    cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
    cardTopLeft: { flex: 1 },
    cardTopIcons: { flexDirection: 'row', alignItems: 'center', gap: 6, marginLeft: 4 },
    cardTitle: { fontFamily: Fonts.semibold, fontSize: 13 },
    lockedHint: { fontSize: 12, fontFamily: Fonts.regular, flex: 1 },
    cardBody: { fontSize: 12, fontFamily: Fonts.regular, lineHeight: 18, flex: 1 },
    cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    cardDate: { fontSize: 10, fontFamily: Fonts.regular },
    catBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: Radii.pill, paddingHorizontal: 7, paddingVertical: 2 },
    catBadgeDot: { width: 6, height: 6, borderRadius: 3 },
    catBadgeText: { fontFamily: Fonts.medium, fontSize: 9 },

    // Empty state
    empty: { alignItems: 'center', paddingTop: 48, paddingHorizontal: Spacing.lg, gap: 10 },
    emptyIllustration: {
      width: 80, height: 80, borderRadius: 40,
      alignItems: 'center', justifyContent: 'center',
      marginBottom: Spacing.sm,
    },
    emptyTitle: { fontFamily: Fonts.bold, fontSize: 18 },
    emptyText: { fontFamily: Fonts.regular, fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.md },
    tipBox: {
      width: '100%', borderRadius: Radii.lg, borderWidth: 1,
      padding: Spacing.md, gap: Spacing.sm,
    },
    tipTitle: { fontFamily: Fonts.semibold, fontSize: 13, marginBottom: 4 },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
    tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
    tipText: { flex: 1, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18 },
  });
