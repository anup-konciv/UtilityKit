import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import KeyboardAwareModal from '@/components/KeyboardAwareModal';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import { pickSeededValue, withAlpha } from '@/lib/color-utils';
import { KEYS, loadJSON, saveJSON } from '@/lib/storage';
import { schedule, cancel, ensureNotificationPermission } from '@/lib/notifications';
import { haptics } from '@/lib/haptics';
import {
  formatBirthdayLabel,
  formatLongDate,
  getAgeBreakdown,
  getNextBirthday,
  isValidBirthday,
  parseCalendarDate,
  sanitizeNumericInput,
  startOfDay,
} from '@/lib/date-utils';

const ACCENT = '#F43F5E';

type BirthdayPalette = {
  primary: string;
  deep: string;
  soft: string;
  contrast: string;
};

type Gender = 'male' | 'female' | 'other';

type Birthday = {
  id: string;
  name: string;
  day: number;
  month: number;
  year?: number;
  note?: string;
  /**
   * Days of advance notice for the reminder. 0 = on the day, 1 = a day
   * ahead, 7 = a week ahead. Optional so existing entries default to
   * same-day (matching the previous behaviour).
   */
  leadDays?: 0 | 1 | 7;
  /**
   * Optional gender — surfaces a small icon on the card so the list is
   * easier to scan. Existing entries default to undefined which renders no
   * icon (no implied default).
   */
  gender?: Gender;
};

const LEAD_OPTIONS: { value: 0 | 1 | 7; label: string }[] = [
  { value: 0, label: 'On the day' },
  { value: 1, label: '1 day before' },
  { value: 7, label: '1 week before' },
];

const GENDER_OPTIONS: { value: Gender; label: string; icon: keyof typeof Ionicons.glyphMap; color: string }[] = [
  { value: 'male',   label: 'Male',   icon: 'male',           color: '#3B82F6' },
  { value: 'female', label: 'Female', icon: 'female',         color: '#EC4899' },
  { value: 'other',  label: 'Other',  icon: 'person-outline', color: '#6366F1' },
];

function getGenderMeta(g?: Gender) {
  if (!g) return null;
  return GENDER_OPTIONS.find(o => o.value === g) ?? null;
}

type FilterMode = 'all' | 'soon' | 'month';

type BirthdayForm = {
  visible: boolean;
  editing: Birthday | null;
  name: string;
  day: string;
  month: string;
  year: string;
  note: string;
  leadDays: 0 | 1 | 7;
  gender: Gender | null;
};

type BirthdayCard = Birthday & {
  initials: string;
  daysUntil: number;
  nextDate: Date;
  nextDateLabel: string;
  displayDate: string;
  turningAge: number | null;
  currentAge: number | null;
  searchBlob: string;
  palette: BirthdayPalette;
};

type ListItem =
  | { type: 'header'; label: string }
  | { type: 'item'; data: BirthdayCard }
  | { type: 'empty'; title: string; message: string; cta?: string };

const EMPTY_FORM: BirthdayForm = {
  visible: false,
  editing: null,
  name: '',
  day: '',
  month: '',
  year: '',
  note: '',
  leadDays: 0,
  gender: null,
};

const FILTERS: { key: FilterMode; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'soon', label: 'Next 30 Days' },
  { key: 'month', label: 'This Month' },
];

const BIRTHDAY_PALETTES: BirthdayPalette[] = [
  { primary: '#F43F5E', deep: '#9F1239', soft: '#FFF1F2', contrast: '#FFFFFF' },
  { primary: '#8B5CF6', deep: '#5B21B6', soft: '#F5F3FF', contrast: '#FFFFFF' },
  { primary: '#0EA5E9', deep: '#0C4A6E', soft: '#F0F9FF', contrast: '#FFFFFF' },
  { primary: '#14B8A6', deep: '#115E59', soft: '#F0FDFA', contrast: '#FFFFFF' },
  { primary: '#F59E0B', deep: '#92400E', soft: '#FFFBEB', contrast: '#FFFFFF' },
  { primary: '#EC4899', deep: '#9D174D', soft: '#FDF2F8', contrast: '#FFFFFF' },
];

function generateId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

export default function BirthdayTrackerScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = startOfDay(new Date());

  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [form, setForm] = useState<BirthdayForm>(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');

  // Refs for auto-jumping Day → Month → Year text inputs.
  const dayInputRef = useRef<TextInput>(null);
  const monthInputRef = useRef<TextInput>(null);
  const yearInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadJSON<Birthday[]>(KEYS.birthdays, []).then((saved) => {
      setBirthdays(Array.isArray(saved) ? saved : []);
    });
  }, []);

  function persist(next: Birthday[]) {
    setBirthdays(next);
    saveJSON(KEYS.birthdays, next);
  }

  function closeModal() {
    setForm(EMPTY_FORM);
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, visible: true });
  }

  function openEdit(item: Birthday) {
    setForm({
      visible: true,
      editing: item,
      name: item.name,
      day: String(item.day),
      month: String(item.month),
      year: item.year != null ? String(item.year) : '',
      note: item.note ?? '',
      leadDays: item.leadDays ?? 0,
      gender: item.gender ?? null,
    });
  }

  const computedBirthdays = useMemo(() => {
    return birthdays
      .filter((item) => isValidBirthday(item.day, item.month, item.year))
      .map((item) => {
        const palette = pickSeededValue(BIRTHDAY_PALETTES, `${item.id}-${item.name}`);
        const nextBirthday = getNextBirthday(item.day, item.month, today);
        const birthDate =
          item.year != null ? parseCalendarDate(item.day, item.month, item.year) : null;
        const ageBreakdown = birthDate ? getAgeBreakdown(birthDate, today) : null;
        const searchBlob = `${item.name} ${item.note ?? ''} ${formatBirthdayLabel(
          item.day,
          item.month,
          item.year,
        )}`.toLowerCase();

        return {
          ...item,
          initials: getInitials(item.name),
          daysUntil: nextBirthday.daysUntil,
          nextDate: nextBirthday.date,
          nextDateLabel: formatLongDate(nextBirthday.date),
          displayDate: formatBirthdayLabel(item.day, item.month, item.year),
          turningAge: item.year != null ? nextBirthday.date.getFullYear() - item.year : null,
          currentAge: ageBreakdown?.years ?? null,
          searchBlob,
          palette,
        };
      })
      .sort((a, b) => {
        if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
        return a.name.localeCompare(b.name);
      });
  }, [birthdays, today]);

  const stats = useMemo(() => {
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return {
      total: computedBirthdays.length,
      today: computedBirthdays.filter((item) => item.daysUntil === 0).length,
      soon: computedBirthdays.filter((item) => item.daysUntil > 0 && item.daysUntil <= 30).length,
      month: computedBirthdays.filter(
        (item) =>
          item.nextDate.getMonth() === currentMonth && item.nextDate.getFullYear() === currentYear,
      ).length,
    };
  }, [computedBirthdays, today]);

  const featured = computedBirthdays[0] ?? null;

  const visibleBirthdays = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    return computedBirthdays.filter((item) => {
      const matchesQuery =
        normalizedQuery.length === 0 || item.searchBlob.includes(normalizedQuery);

      if (!matchesQuery) return false;
      if (filter === 'soon') return item.daysUntil <= 30;
      if (filter === 'month') {
        return item.nextDate.getMonth() === currentMonth && item.nextDate.getFullYear() === currentYear;
      }
      return true;
    });
  }, [computedBirthdays, filter, query, today]);

  const listData = useMemo(() => {
    const todayItems = visibleBirthdays.filter((item) => item.daysUntil === 0);
    const soonItems = visibleBirthdays.filter(
      (item) => item.daysUntil > 0 && (filter === 'month' || item.daysUntil <= 30),
    );
    const laterItems =
      filter === 'all' ? visibleBirthdays.filter((item) => item.daysUntil > 30) : [];

    const next: ListItem[] = [];

    if (visibleBirthdays.length === 0) {
      if (birthdays.length === 0) {
        next.push({
          type: 'empty',
          title: 'No birthdays yet',
          message: 'Build a private birthday list with notes, age previews, and upcoming reminders.',
          cta: 'Add first birthday',
        });
      } else {
        next.push({
          type: 'empty',
          title: 'Nothing matches this view',
          message:
            query.trim().length > 0
              ? 'Try a different search term or switch filters.'
              : 'There are no birthdays in this filter right now.',
        });
      }

      return next;
    }

    if (todayItems.length > 0) {
      next.push({ type: 'header', label: 'Today' });
      todayItems.forEach((item) => next.push({ type: 'item', data: item }));
    }

    if (soonItems.length > 0) {
      next.push({
        type: 'header',
        label: filter === 'month' ? 'Later This Month' : 'Coming Up',
      });
      soonItems.forEach((item) => next.push({ type: 'item', data: item }));
    }

    if (laterItems.length > 0) {
      next.push({ type: 'header', label: 'Later' });
      laterItems.forEach((item) => next.push({ type: 'item', data: item }));
    }

    return next;
  }, [birthdays.length, filter, query, visibleBirthdays]);

  const formPreview = useMemo(() => {
    const name = form.name.trim();
    const day = Number.parseInt(form.day, 10);
    const month = Number.parseInt(form.month, 10);
    const parsedYear = Number.parseInt(form.year, 10);
    const year = Number.isNaN(parsedYear) ? undefined : parsedYear;

    if (!name || Number.isNaN(day) || Number.isNaN(month) || !isValidBirthday(day, month, year)) {
      return null;
    }

    if (year != null) {
      const birthDate = parseCalendarDate(day, month, year);
      if (!birthDate || birthDate > today) {
        return null;
      }
    }

    const nextBirthday = getNextBirthday(day, month, today);
    const palette = pickSeededValue(BIRTHDAY_PALETTES, name);

    return {
      name,
      nextDateLabel: formatLongDate(nextBirthday.date),
      daysUntil: nextBirthday.daysUntil,
      turningAge: year != null ? nextBirthday.date.getFullYear() - year : null,
      palette,
    };
  }, [form.day, form.month, form.name, form.year, today]);

  function updateFormField(field: keyof BirthdayForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSave() {
    const name = form.name.trim();
    const day = Number.parseInt(form.day, 10);
    const month = Number.parseInt(form.month, 10);
    const parsedYear = Number.parseInt(form.year, 10);
    const year = Number.isNaN(parsedYear) ? undefined : parsedYear;
    const note = form.note.trim();

    if (!name) {
      Alert.alert('Validation', 'Name is required.');
      return;
    }

    if (Number.isNaN(day) || Number.isNaN(month)) {
      Alert.alert('Validation', 'Day and month are required.');
      return;
    }

    if (!isValidBirthday(day, month, year)) {
      Alert.alert('Validation', 'Enter a real calendar date.');
      return;
    }

    if (year != null) {
      const birthDate = parseCalendarDate(day, month, year);
      if (!birthDate || birthDate > today) {
        Alert.alert('Validation', 'Birth year cannot be in the future.');
        return;
      }
    }

    let saved: Birthday;
    if (form.editing) {
      saved = {
        ...form.editing,
        name, day, month, year,
        note: note || undefined,
        leadDays: form.leadDays,
        gender: form.gender ?? undefined,
      };
      persist(
        birthdays.map((item) => (item.id === form.editing?.id ? saved : item)),
      );
    } else {
      saved = {
        id: generateId(),
        name,
        day,
        month,
        year,
        note: note || undefined,
        leadDays: form.leadDays,
        gender: form.gender ?? undefined,
      };
      persist([...birthdays, saved]);
    }

    haptics.success();
    void scheduleBirthdayReminder(saved);
    closeModal();
  }

  /**
   * Schedule a yearly notification at 9 AM on the birthday. We use the
   * notification layer's "weekly" trigger as the closest available repeat;
   * the wrapper falls back to a one-shot if not supported. Past dates this
   * year will skip to next year automatically.
   */
  async function scheduleBirthdayReminder(b: Birthday) {
    await ensureNotificationPermission();
    const now = new Date();
    const year = now.getFullYear();
    const lead = b.leadDays ?? 0;
    let target = new Date(year, b.month - 1, b.day, 9, 0, 0);
    target.setDate(target.getDate() - lead);
    // If the lead-adjusted target is in the past, jump to next year's
    // birthday so the reminder still fires once per year.
    if (target.getTime() < now.getTime()) {
      target = new Date(year + 1, b.month - 1, b.day, 9, 0, 0);
      target.setDate(target.getDate() - lead);
    }
    if (Number.isNaN(target.getTime())) return;
    const titleByLead =
      lead === 0 ? `🎂 ${b.name}'s birthday today`
      : lead === 1 ? `🎂 ${b.name}'s birthday tomorrow`
      : `🎂 ${b.name}'s birthday in 1 week`;
    await schedule({
      id: b.id,
      namespace: 'birthday',
      title: titleByLead,
      body: b.note ? `Don't forget: ${b.note}` : 'Send a message or call to wish them.',
      date: target,
      repeat: 'none',
      data: { birthdayId: b.id },
    });
  }

  function handleDelete(id: string) {
    Alert.alert('Delete birthday', 'Remove this birthday from the tracker?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          haptics.warning();
          persist(birthdays.filter((item) => item.id !== id));
          void cancel('birthday', id);
        },
      },
    ]);
  }

  function renderItem({ item }: { item: ListItem }) {
    if (item.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionHeaderText, { color: colors.textMuted }]}>{item.label}</Text>
        </View>
      );
    }

    if (item.type === 'empty') {
      return (
        <View style={[styles.emptyState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="gift-outline" size={24} color={ACCENT} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{item.title}</Text>
          <Text style={[styles.emptyMessage, { color: colors.textMuted }]}>{item.message}</Text>
          {item.cta ? (
            <TouchableOpacity style={styles.emptyCta} onPress={openAdd}>
              <Text style={styles.emptyCtaText}>{item.cta}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      );
    }

    const entry = item.data;
    const isToday = entry.daysUntil === 0;
    const isSoon = entry.daysUntil > 0 && entry.daysUntil <= 7;
    const cardBorder = isToday || isSoon ? withAlpha(entry.palette.primary, '42') : withAlpha(entry.palette.primary, '20');
    const badgeBackground = isToday ? entry.palette.primary : withAlpha(entry.palette.primary, '12');
    const badgeTextColor = isToday ? entry.palette.contrast : entry.palette.primary;
    const cardColors: readonly [string, string] = isToday
      ? [withAlpha(entry.palette.primary, '24'), withAlpha(entry.palette.deep, '12')]
      : isSoon
        ? [withAlpha(entry.palette.primary, '16'), withAlpha(entry.palette.deep, '08')]
        : [withAlpha(entry.palette.primary, '10'), colors.card];

    return (
      <LinearGradient
        colors={cardColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.birthdayCard, { borderColor: cardBorder }]}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.cardIdentityRow}>
            <View style={[styles.avatarRing, { backgroundColor: withAlpha(entry.palette.primary, '14') }]}>
              <LinearGradient
                colors={[entry.palette.primary, entry.palette.deep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.avatar}
              >
                <Text style={styles.avatarText}>{entry.initials}</Text>
              </LinearGradient>
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardNameRow}>
                <View style={styles.cardNameInner}>
                  {(() => {
                    const g = getGenderMeta(entry.gender);
                    return g ? (
                      <View style={[styles.genderChip, { backgroundColor: withAlpha(g.color, '18') }]}>
                        <Ionicons name={g.icon} size={11} color={g.color} />
                      </View>
                    ) : null;
                  })()}
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                    {entry.name}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: badgeBackground }]}>
                  <Text style={[styles.statusBadgeText, { color: badgeTextColor }]}>
                    {isToday
                      ? 'Today'
                      : `${entry.daysUntil} day${entry.daysUntil === 1 ? '' : 's'}`}
                  </Text>
                </View>
              </View>
              <Text style={[styles.cardDate, { color: colors.textSub }]}>{entry.displayDate}</Text>
              <Text style={[styles.cardNextDate, { color: colors.textMuted }]}>
                {isToday ? 'Celebrate today' : `Next on ${entry.nextDateLabel}`}
              </Text>
            </View>
          </View>
        </View>

        {entry.note ? (
          <Text style={[styles.cardNote, { color: colors.textMuted }]} numberOfLines={2}>
            {entry.note}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          {entry.turningAge != null ? (
            <View style={[styles.metaPill, { backgroundColor: withAlpha(entry.palette.primary, '10'), borderColor: withAlpha(entry.palette.primary, '22') }]}>
              <Ionicons name="sparkles-outline" size={14} color={entry.palette.primary} />
              <Text style={[styles.metaPillText, { color: colors.text }]}>Turns {entry.turningAge}</Text>
            </View>
          ) : null}
          {entry.currentAge != null ? (
            <View style={[styles.metaPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="time-outline" size={14} color={colors.textMuted} />
              <Text style={[styles.metaPillText, { color: colors.text }]}>Now {entry.currentAge}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => openEdit(entry)}
            style={[styles.actionButton, { backgroundColor: withAlpha(entry.palette.primary, '10'), borderColor: withAlpha(entry.palette.primary, '22') }]}
          >
            <Ionicons name="create-outline" size={16} color={entry.palette.primary} />
            <Text style={[styles.actionButtonText, { color: entry.palette.primary }]}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(entry.id)}
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="trash-outline" size={16} color="#EF4444" />
            <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    );
  }

  const rightAction = (
    <TouchableOpacity
      onPress={openAdd}
      style={[styles.headerAddButton, { backgroundColor: `${ACCENT}12`, borderColor: `${ACCENT}40` }]}
    >
      <Ionicons name="add" size={20} color={ACCENT} />
    </TouchableOpacity>
  );

  const header = (
    <View style={styles.listHeader}>
      <LinearGradient
        colors={['#881337', '#E11D48', '#FB7185']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Birthday Radar</Text>
        {featured ? (
          <>
            <Text style={styles.heroTitle}>
              {featured.daysUntil === 0 ? `${featured.name} celebrates today` : `${featured.name} is next up`}
            </Text>
            <Text style={styles.heroCopy}>
              {featured.daysUntil === 0
                ? featured.turningAge != null
                  ? `They turn ${featured.turningAge} today.`
                  : 'Time to send wishes now.'
                : `Coming up in ${featured.daysUntil} days on ${featured.nextDateLabel}.`}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>Keep every birthday in one warm, searchable place</Text>
            <Text style={styles.heroCopy}>
              Save dates, add notes, and instantly see who is coming up next.
            </Text>
          </>
        )}

        <View style={styles.heroStatsRow}>
          {[
            { label: 'Total', value: stats.total },
            { label: 'Today', value: stats.today },
            { label: 'This Month', value: stats.month },
          ].map((stat) => (
            <View key={stat.label} style={styles.heroStatPill}>
              <Text style={styles.heroStatValue}>{stat.value}</Text>
              <Text style={styles.heroStatLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search names or notes"
            placeholderTextColor={colors.textMuted}
            selectionColor={ACCENT}
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.filterRow}>
          {FILTERS.map((item) => {
            const active = filter === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setFilter(item.key)}
                style={[
                  styles.filterChip,
                  active
                    ? { backgroundColor: ACCENT, borderColor: ACCENT }
                    : { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    { color: active ? '#FFFFFF' : colors.textMuted },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.searchHint, { color: colors.textMuted }]}>
          {stats.soon} birthday{stats.soon === 1 ? '' : 's'} arriving in the next 30 days.
        </Text>
      </View>
    </View>
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
        ListHeaderComponent={header}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <KeyboardAwareModal visible={form.visible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalRoot}>
          <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={closeModal} />
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.borderStrong }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {form.editing ? 'Edit birthday' : 'Add birthday'}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              Save the date, an optional birth year, and a note you want to remember.
            </Text>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={form.name}
              onChangeText={(value) => updateFormField('name', value)}
              placeholder="Full name"
              placeholderTextColor={colors.textMuted}
              selectionColor={ACCENT}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Gender (optional)</Text>
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map(opt => {
                const active = form.gender === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.genderPill,
                      {
                        borderColor: active ? opt.color : colors.border,
                        backgroundColor: active ? withAlpha(opt.color, '18') : colors.inputBg,
                      },
                    ]}
                    // Tap a second time to clear the selection — this is the
                    // only way to remove gender once set.
                    onPress={() => setForm(c => ({ ...c, gender: active ? null : opt.value }))}
                  >
                    <Ionicons name={opt.icon} size={14} color={active ? opt.color : colors.textMuted} />
                    <Text style={[styles.genderPillText, { color: active ? opt.color : colors.textMuted }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.dateFieldRow}>
              <View style={styles.dateField}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Day</Text>
                <TextInput
                  ref={dayInputRef}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={form.day}
                  onChangeText={(value) => {
                    const sanitized = sanitizeNumericInput(value, 2);
                    updateFormField('day', sanitized);
                    // Auto-jump to month once the day looks complete: either
                    // a 2-digit value or a 1-digit value > 3 (no valid 2-digit
                    // day starts with 4-9 anyway).
                    if (sanitized.length === 2 || (sanitized.length === 1 && parseInt(sanitized, 10) > 3)) {
                      monthInputRef.current?.focus();
                    }
                  }}
                  placeholder="DD"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                  selectionColor={ACCENT}
                  returnKeyType="next"
                  onSubmitEditing={() => monthInputRef.current?.focus()}
                />
              </View>
              <View style={styles.dateField}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Month</Text>
                <TextInput
                  ref={monthInputRef}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={form.month}
                  onChangeText={(value) => {
                    const sanitized = sanitizeNumericInput(value, 2);
                    updateFormField('month', sanitized);
                    // Auto-jump to year once the month looks complete.
                    if (sanitized.length === 2 || (sanitized.length === 1 && parseInt(sanitized, 10) > 1)) {
                      yearInputRef.current?.focus();
                    }
                  }}
                  placeholder="MM"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={2}
                  textAlign="center"
                  selectionColor={ACCENT}
                  returnKeyType="next"
                  onSubmitEditing={() => yearInputRef.current?.focus()}
                />
              </View>
              <View style={[styles.dateField, styles.yearField]}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Year</Text>
                <TextInput
                  ref={yearInputRef}
                  style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                  value={form.year}
                  onChangeText={(value) => updateFormField('year', sanitizeNumericInput(value, 4))}
                  placeholder="YYYY"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={4}
                  textAlign="center"
                  selectionColor={ACCENT}
                  returnKeyType="done"
                />
              </View>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Note</Text>
            <TextInput
              style={[
                styles.input,
                styles.noteInput,
                { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
              ]}
              value={form.note}
              onChangeText={(value) => updateFormField('note', value)}
              placeholder="Gift idea, relation, or reminder"
              placeholderTextColor={colors.textMuted}
              selectionColor={ACCENT}
              multiline
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Reminder</Text>
            <View style={styles.leadRow}>
              {LEAD_OPTIONS.map(opt => {
                const active = form.leadDays === opt.value;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.leadPill,
                      {
                        borderColor: active ? ACCENT : colors.border,
                        backgroundColor: active ? withAlpha(ACCENT, '18') : colors.inputBg,
                      },
                    ]}
                    onPress={() => setForm(current => ({ ...current, leadDays: opt.value }))}
                  >
                    <Text style={[styles.leadPillText, { color: active ? ACCENT : colors.textMuted }]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {formPreview ? (
              <LinearGradient
                colors={[withAlpha(formPreview.palette.primary, '14'), withAlpha(formPreview.palette.primary, '06')]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.previewCard}
              >
                <Text style={[styles.previewEyebrow, { color: formPreview.palette.primary }]}>Preview</Text>
                <Text style={[styles.previewTitle, { color: formPreview.palette.deep }]}>{formPreview.name}</Text>
                <Text style={[styles.previewCopy, { color: formPreview.palette.deep }]}>
                  {formPreview.daysUntil === 0
                    ? 'Celebration day is today.'
                    : `Next celebration in ${formPreview.daysUntil} day${formPreview.daysUntil === 1 ? '' : 's'}.`}
                </Text>
                <Text style={[styles.previewMeta, { color: formPreview.palette.deep }]}>
                  {formPreview.nextDateLabel}
                  {formPreview.turningAge != null ? ` - Turns ${formPreview.turningAge}` : ''}
                </Text>
              </LinearGradient>
            ) : (
              <Text style={[styles.helperText, { color: colors.textMuted }]}>
                Year is optional. Leap-day birthdays roll to Feb 28 on non-leap years.
              </Text>
            )}

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={closeModal}
                style={[styles.secondaryButton, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>
                  {form.editing ? 'Save changes' : 'Add birthday'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAwareModal>
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    listContent: {
      paddingBottom: Spacing.huge,
    },
    listHeader: {
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      gap: Spacing.md,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#FFE4E6',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopy: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#FFF1F2',
    },
    heroStatsRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    heroStatPill: {
      flex: 1,
      borderRadius: Radii.lg,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      alignItems: 'center',
      gap: 2,
    },
    heroStatValue: {
      fontSize: 24,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroStatLabel: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      color: '#FFE4E6',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    searchCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      minHeight: 46,
    },
    searchInput: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.regular,
      paddingVertical: 10,
    },
    filterRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    filterChip: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    filterChipText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    searchHint: {
      fontSize: 12,
      fontFamily: Fonts.regular,
    },
    sectionHeader: {
      marginTop: Spacing.sm,
      marginBottom: Spacing.xs,
    },
    sectionHeaderText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    birthdayCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    cardTopRow: {
      gap: Spacing.sm,
    },
    cardIdentityRow: {
      flexDirection: 'row',
      gap: Spacing.md,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarRing: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    avatarText: {
      fontSize: 16,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    cardBody: {
      flex: 1,
      gap: 3,
    },
    cardNameRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.sm,
    },
    cardName: {
      flex: 1,
      fontSize: 18,
      lineHeight: 22,
      fontFamily: Fonts.bold,
    },
    statusBadge: {
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 6,
    },
    statusBadgeText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    cardDate: {
      fontSize: 13,
      fontFamily: Fonts.medium,
    },
    cardNextDate: {
      fontSize: 13,
      fontFamily: Fonts.regular,
    },
    cardNote: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: Fonts.regular,
    },
    metaRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
    },
    metaPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    metaPillText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    cardActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingVertical: 12,
    },
    actionButtonText: {
      fontSize: 13,
      fontFamily: Fonts.semibold,
    },
    emptyState: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
    },
    emptyIconWrap: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    emptyMessage: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },
    emptyCta: {
      marginTop: Spacing.sm,
      backgroundColor: ACCENT,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.lg,
      paddingVertical: 12,
    },
    emptyCtaText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
      color: '#FFFFFF',
    },
    headerAddButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    modalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    modalSheet: {
      borderTopLeftRadius: Radii.xl,
      borderTopRightRadius: Radii.xl,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.md,
      paddingBottom: Spacing.xl,
      gap: Spacing.sm,
    },
    modalHandle: {
      width: 42,
      height: 5,
      borderRadius: Radii.pill,
      alignSelf: 'center',
      marginBottom: Spacing.sm,
    },
    modalTitle: {
      fontSize: 22,
      fontFamily: Fonts.bold,
    },
    modalSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.regular,
      marginBottom: Spacing.xs,
    },
    fieldLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      marginTop: Spacing.xs,
    },
    input: {
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: 12,
      fontSize: 15,
      fontFamily: Fonts.regular,
    },
    noteInput: {
      minHeight: 88,
      textAlignVertical: 'top',
    },
    leadRow: {
      flexDirection: 'row',
      gap: 8,
      flexWrap: 'wrap',
    },
    leadPill: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: Radii.pill,
      borderWidth: 1.5,
    },
    leadPillText: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
    },
    genderRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: Spacing.sm,
    },
    genderPill: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 8,
      borderRadius: Radii.pill,
      borderWidth: 1.5,
    },
    genderPillText: {
      fontFamily: Fonts.semibold,
      fontSize: 12,
    },
    // Gender icon on the card — sits inline with the name
    cardNameInner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      flex: 1,
      minWidth: 0,
    },
    genderChip: {
      width: 20,
      height: 20,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dateFieldRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    dateField: {
      flex: 1,
      gap: 6,
    },
    yearField: {
      flex: 1.35,
    },
    previewCard: {
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: 4,
      marginTop: Spacing.sm,
    },
    previewEyebrow: {
      fontSize: 11,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    previewTitle: {
      fontSize: 20,
      fontFamily: Fonts.bold,
    },
    previewCopy: {
      fontSize: 14,
      fontFamily: Fonts.medium,
    },
    previewMeta: {
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.regular,
    },
    helperText: {
      fontSize: 12,
      lineHeight: 18,
      fontFamily: Fonts.regular,
      marginTop: Spacing.xs,
    },
    modalActionRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.md,
    },
    secondaryButton: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    secondaryButtonText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    primaryButton: {
      flex: 1.2,
      backgroundColor: ACCENT,
      borderRadius: Radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 14,
    },
    primaryButtonText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
      color: '#FFFFFF',
    },
  });
