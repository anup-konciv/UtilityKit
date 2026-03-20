import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  TextInput,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { loadJSON, saveJSON, KEYS } from '@/lib/storage';
import { Fonts, Radii, Spacing } from '@/constants/theme';

const ACCENT = '#F43F5E';

type Birthday = {
  id: string;
  name: string;
  day: number;
  month: number;
  year?: number;
  note?: string;
};

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

function daysUntil(day: number, month: number): number {
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();

  if (month === todayM && day === todayD) return 0;

  let next = new Date(todayY, month - 1, day);
  if (
    next.getMonth() + 1 !== month ||
    next.getDate() !== day
  ) {
    // Invalid date for this year (e.g. Feb 29 in non-leap), push to next year
    next = new Date(todayY + 1, month - 1, day);
  }

  const todayMidnight = new Date(todayY, todayM - 1, todayD);
  if (next <= todayMidnight) {
    next = new Date(todayY + 1, month - 1, day);
  }

  const diff = next.getTime() - todayMidnight.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

function getAge(year: number, day: number, month: number): number {
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  const todayD = today.getDate();
  let age = todayY - year;
  if (todayM < month || (todayM === month && todayD < day)) {
    age -= 1;
  }
  return age;
}

function formatDate(day: number, month: number, year?: number): string {
  const m = MONTH_NAMES[month - 1] ?? '?';
  return year ? `${day} ${m}, ${year}` : `${day} ${m}`;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

type ModalState = {
  visible: boolean;
  editing: Birthday | null;
  name: string;
  day: string;
  month: string;
  year: string;
  note: string;
};

const emptyModal: ModalState = {
  visible: false,
  editing: null,
  name: '',
  day: '',
  month: '',
  year: '',
  note: '',
};

export default function BirthdayTrackerScreen() {
  const { colors } = useAppTheme();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [modal, setModal] = useState<ModalState>(emptyModal);

  useEffect(() => {
    loadJSON<Birthday[]>(KEYS.birthdays, []).then((data) => {
      setBirthdays(data);
    });
  }, []);

  function persist(next: Birthday[]) {
    setBirthdays(next);
    saveJSON(KEYS.birthdays, next);
  }

  function openAdd() {
    setModal({ ...emptyModal, visible: true });
  }

  function openEdit(b: Birthday) {
    setModal({
      visible: true,
      editing: b,
      name: b.name,
      day: String(b.day),
      month: String(b.month),
      year: b.year != null ? String(b.year) : '',
      note: b.note ?? '',
    });
  }

  function closeModal() {
    setModal(emptyModal);
  }

  function handleSave() {
    const name = modal.name.trim();
    const day = parseInt(modal.day, 10);
    const month = parseInt(modal.month, 10);
    const yearRaw = modal.year.trim();
    const year = yearRaw ? parseInt(yearRaw, 10) : undefined;
    const note = modal.note.trim();

    if (!name) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }
    if (!modal.day || isNaN(day) || day < 1 || day > 31) {
      Alert.alert('Validation', 'Day must be between 1 and 31.');
      return;
    }
    if (!modal.month || isNaN(month) || month < 1 || month > 12) {
      Alert.alert('Validation', 'Month must be between 1 and 12.');
      return;
    }

    if (modal.editing) {
      const next = birthdays.map((b) =>
        b.id === modal.editing!.id
          ? { ...b, name, day, month, year, note: note || undefined }
          : b,
      );
      persist(next);
    } else {
      const entry: Birthday = {
        id: generateId(),
        name,
        day,
        month,
        year,
        note: note || undefined,
      };
      persist([...birthdays, entry]);
    }
    closeModal();
  }

  function handleDelete(id: string) {
    Alert.alert('Delete', 'Remove this birthday?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => persist(birthdays.filter((b) => b.id !== id)),
      },
    ]);
  }

  const sorted = [...birthdays].sort(
    (a, b) => daysUntil(a.day, a.month) - daysUntil(b.day, b.month),
  );

  const upcoming = sorted.filter((b) => daysUntil(b.day, b.month) <= 30);
  const later = sorted.filter((b) => daysUntil(b.day, b.month) > 30);

  type ListItem =
    | { type: 'header'; label: string }
    | { type: 'item'; data: Birthday }
    | { type: 'empty'; message: string };

  const listData: ListItem[] = [];

  if (birthdays.length === 0) {
    listData.push({ type: 'empty', message: 'No birthdays yet.\nTap + to add one.' });
  } else {
    if (upcoming.length > 0) {
      listData.push({ type: 'header', label: `UPCOMING (${upcoming.length})` });
      upcoming.forEach((b) => listData.push({ type: 'item', data: b }));
    }
    if (later.length > 0) {
      listData.push({ type: 'header', label: `LATER (${later.length})` });
      later.forEach((b) => listData.push({ type: 'item', data: b }));
    }
    if (upcoming.length === 0 && later.length === 0) {
      listData.push({ type: 'empty', message: 'No birthdays yet.\nTap + to add one.' });
    }
  }

  const styles = makeStyles(colors);

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.label}</Text>
        </View>
      );
    }

    if (item.type === 'empty') {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="calendar-outline" size={52} color={colors.textMuted} />
          <Text style={styles.emptyText}>{item.message}</Text>
        </View>
      );
    }

    const b = item.data;
    const days = daysUntil(b.day, b.month);
    const isToday = days === 0;
    const age = b.year != null ? getAge(b.year, b.day, b.month) : null;
    const initial = b.name.charAt(0).toUpperCase();

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>

        <View style={styles.cardBody}>
          <Text style={[styles.cardName, { color: colors.text }]}>{b.name}</Text>
          <Text style={[styles.cardDate, { color: colors.textMuted }]}>
            {formatDate(b.day, b.month, b.year)}
          </Text>
          {b.note ? (
            <Text style={[styles.cardNote, { color: colors.textMuted }]} numberOfLines={1}>
              {b.note}
            </Text>
          ) : null}
        </View>

        <View style={styles.cardRight}>
          {isToday ? (
            <View style={[styles.badge, styles.badgeToday]}>
              <Text style={styles.badgeTodayText}>🎂 Today!</Text>
            </View>
          ) : (
            <View style={[styles.badge, { backgroundColor: colors.accentLight }]}>
              <Text style={[styles.badgeText, { color: ACCENT }]}>{days}d left</Text>
            </View>
          )}
          {age != null && (
            <Text style={[styles.turnsText, { color: colors.textMuted }]}>
              Turns {isToday ? age : age + 1}
            </Text>
          )}
          <View style={styles.cardActions}>
            <TouchableOpacity onPress={() => openEdit(b)} style={styles.iconBtn}>
              <Ionicons name="pencil-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(b.id)} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  const rightAction = (
    <TouchableOpacity onPress={openAdd} style={styles.addBtn}>
      <Ionicons name="add" size={26} color={ACCENT} />
    </TouchableOpacity>
  );

  return (
    <ScreenShell
      title="Birthday Tracker"
      accentColor={ACCENT}
      scrollable={false}
      rightAction={rightAction}
    >
      <FlatList
        data={listData}
        keyExtractor={(item, index) =>
          item.type === 'item' ? item.data.id : `${item.type}-${index}`
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={modal.visible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={closeModal}
        />
        <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.text }]}>
            {modal.editing ? 'Edit Birthday' : 'Add Birthday'}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            placeholder="Full name"
            placeholderTextColor={colors.textMuted}
            value={modal.name}
            onChangeText={(v) => setModal((s) => ({ ...s, name: v }))}
          />

          <View style={styles.row}>
            <View style={styles.rowField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Day *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="1–31"
                placeholderTextColor={colors.textMuted}
                value={modal.day}
                onChangeText={(v) => setModal((s) => ({ ...s, day: v }))}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            <View style={styles.rowField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Month *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="1–12"
                placeholderTextColor={colors.textMuted}
                value={modal.month}
                onChangeText={(v) => setModal((s) => ({ ...s, month: v }))}
                keyboardType="numeric"
                maxLength={2}
              />
            </View>
            <View style={styles.rowField}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Year</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="YYYY"
                placeholderTextColor={colors.textMuted}
                value={modal.year}
                onChangeText={(v) => setModal((s) => ({ ...s, year: v }))}
                keyboardType="numeric"
                maxLength={4}
              />
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
            placeholder="Optional note"
            placeholderTextColor={colors.textMuted}
            value={modal.note}
            onChangeText={(v) => setModal((s) => ({ ...s, note: v }))}
          />

          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>
              {modal.editing ? 'Save Changes' : 'Add Birthday'}
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </ScreenShell>
  );
}

function makeStyles(colors: ReturnType<typeof useAppTheme>['colors']) {
  return StyleSheet.create({
    listContent: {
      padding: Spacing.md,
      paddingBottom: Spacing.huge,
    },
    sectionHeader: {
      marginTop: Spacing.md,
      marginBottom: Spacing.xs,
    },
    sectionHeaderText: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: colors.textMuted,
      letterSpacing: 1.1,
      textTransform: 'uppercase',
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: Radii.lg,
      padding: Spacing.md,
      marginBottom: Spacing.sm,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: ACCENT,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: Spacing.md,
      flexShrink: 0,
    },
    avatarText: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      color: '#fff',
    },
    cardBody: {
      flex: 1,
      gap: 2,
    },
    cardName: {
      fontSize: 15,
      fontFamily: Fonts.semibold,
    },
    cardDate: {
      fontSize: 13,
      fontFamily: Fonts.regular,
    },
    cardNote: {
      fontSize: 12,
      fontFamily: Fonts.regular,
    },
    cardRight: {
      alignItems: 'flex-end',
      gap: 4,
      marginLeft: Spacing.sm,
      flexShrink: 0,
    },
    badge: {
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 3,
    },
    badgeToday: {
      backgroundColor: '#FFF1F2',
    },
    badgeTodayText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: ACCENT,
    },
    badgeText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    turnsText: {
      fontSize: 11,
      fontFamily: Fonts.regular,
    },
    cardActions: {
      flexDirection: 'row',
      gap: 4,
    },
    iconBtn: {
      padding: 4,
    },
    emptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: Spacing.huge,
      gap: Spacing.md,
    },
    emptyText: {
      fontSize: 15,
      fontFamily: Fonts.regular,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 22,
    },
    addBtn: {
      padding: Spacing.xs,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    modalSheet: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      padding: Spacing.lg,
      paddingBottom: Spacing.huge,
      gap: Spacing.xs,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: Radii.pill,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: Spacing.sm,
    },
    modalTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      marginBottom: Spacing.sm,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: Fonts.medium,
      marginBottom: 4,
      marginTop: Spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radii.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      fontSize: 15,
      fontFamily: Fonts.regular,
    },
    row: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    rowField: {
      flex: 1,
    },
    saveBtn: {
      backgroundColor: ACCENT,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.md,
      alignItems: 'center',
      marginTop: Spacing.md,
    },
    saveBtnText: {
      fontSize: 16,
      fontFamily: Fonts.semibold,
      color: '#fff',
    },
  });
}
