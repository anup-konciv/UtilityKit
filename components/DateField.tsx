/**
 * DateField — a tappable input that opens a bottom-sheet calendar grid for
 * picking a date. Drop-in replacement for the YYYY-MM-DD `<TextInput>` pattern
 * used across the tools, with consistent styling and zero new dependencies.
 *
 * Why a custom picker (vs. @react-native-community/datetimepicker)?
 *   - Same look on iOS, Android, and web (RN Web).
 *   - Themeable via the existing accent-color contract.
 *   - No package install required — uses only React Native primitives.
 *
 * Props mirror the controlled `<TextInput>` API so callers can swap one for
 * the other in a single line: pass `value` (ISO YYYY-MM-DD or empty) and
 * `onChange` (called with the new ISO string).
 */
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from './ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';

type DateFieldProps = {
  /** Selected date as `YYYY-MM-DD`, or empty string for unset. */
  value: string;
  /** Called with the newly-picked ISO date string. */
  onChange: (iso: string) => void;
  /** Text shown in the field when `value` is empty. */
  placeholder?: string;
  /** Accent color for selection / highlights. Defaults to theme accent. */
  accent?: string;
  /** Earliest selectable date as `YYYY-MM-DD`. Days before are disabled. */
  minDate?: string;
  /** Latest selectable date as `YYYY-MM-DD`. Days after are disabled. */
  maxDate?: string;
  disabled?: boolean;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function parseISO(s: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { year: +m[1], month: +m[2], day: +m[3] };
}

function formatDateLong(s: string): string {
  const p = parseISO(s);
  if (!p) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${p.day} ${months[p.month - 1]} ${p.year}`;
}

function compareISO(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function buildMonthGrid(year: number, month: number): (number | null)[][] {
  // `month` is 1-indexed; JS Date wants 0-indexed.
  const m0 = month - 1;
  const firstDow = new Date(year, m0, 1).getDay();
  const total = new Date(year, m0 + 1, 0).getDate();
  const flat: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) flat.push(null);
  for (let d = 1; d <= total; d++) flat.push(d);
  while (flat.length % 7 !== 0) flat.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}

export default function DateField({
  value,
  onChange,
  placeholder = 'Select date',
  accent,
  minDate,
  maxDate,
  disabled = false,
}: DateFieldProps) {
  const { colors } = useAppTheme();
  const acc = accent ?? colors.accent;
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);

  // Track which month is being viewed in the calendar. Defaults to the
  // selected value's month, falling back to today.
  const seed = useMemo(() => parseISO(value) ?? parseISO(todayISO())!, [value]);
  const [viewYear, setViewYear] = useState(seed.year);
  const [viewMonth, setViewMonth] = useState(seed.month);

  // When the picker is reopened, jump back to the value's month so the user
  // doesn't have to navigate from wherever they last scrolled.
  useEffect(() => {
    if (open) {
      const s = parseISO(value) ?? parseISO(todayISO())!;
      setViewYear(s.year);
      setViewMonth(s.month);
    }
  }, [open, value]);

  const goPrev = useCallback(() => {
    setViewMonth(m => {
      if (m === 1) {
        setViewYear(y => y - 1);
        return 12;
      }
      return m - 1;
    });
  }, []);
  const goNext = useCallback(() => {
    setViewMonth(m => {
      if (m === 12) {
        setViewYear(y => y + 1);
        return 1;
      }
      return m + 1;
    });
  }, []);

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const today = todayISO();

  const handleSelect = useCallback((day: number) => {
    const iso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (minDate && compareISO(iso, minDate) < 0) return;
    if (maxDate && compareISO(iso, maxDate) > 0) return;
    onChange(iso);
    setOpen(false);
  }, [viewYear, viewMonth, minDate, maxDate, onChange]);

  const goToday = useCallback(() => {
    const t = todayISO();
    const p = parseISO(t)!;
    if (minDate && compareISO(t, minDate) < 0) return;
    if (maxDate && compareISO(t, maxDate) > 0) return;
    setViewYear(p.year);
    setViewMonth(p.month);
    onChange(t);
    setOpen(false);
  }, [minDate, maxDate, onChange]);

  const displayValue = value ? formatDateLong(value) : placeholder;

  return (
    <>
      <TouchableOpacity
        style={[
          styles.field,
          {
            backgroundColor: colors.inputBg,
            borderColor: colors.border,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.7}
        disabled={disabled}
      >
        <Ionicons name="calendar-outline" size={16} color={value ? acc : colors.textMuted} />
        <Text style={[styles.fieldText, { color: value ? colors.text : colors.textMuted }]}>
          {displayValue}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.overlay}>
          <TouchableOpacity activeOpacity={1} style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* Month navigator */}
            <View style={styles.navRow}>
              <TouchableOpacity onPress={goPrev} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-back" size={22} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.navLabel, { color: colors.text }]}>
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </Text>
              <TouchableOpacity onPress={goNext} style={styles.navBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="chevron-forward" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Weekday header */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map((d, i) => (
                <Text key={i} style={[styles.weekDay, { color: colors.textMuted }]}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Day grid */}
            {grid.map((week, wi) => (
              <View key={wi} style={styles.weekRow}>
                {week.map((day, di) => {
                  if (day == null) {
                    return <View key={di} style={styles.dayCell} />;
                  }
                  const cellIso = `${viewYear}-${String(viewMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = cellIso === value;
                  const isToday = cellIso === today;
                  const isDisabled = Boolean(
                    (minDate && compareISO(cellIso, minDate) < 0) ||
                    (maxDate && compareISO(cellIso, maxDate) > 0),
                  );
                  return (
                    <TouchableOpacity
                      key={di}
                      style={[
                        styles.dayCell,
                        isSelected && { backgroundColor: acc },
                        !isSelected && isToday && { borderWidth: 1.5, borderColor: acc },
                      ]}
                      onPress={() => handleSelect(day)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelected
                              ? '#fff'
                              : isDisabled
                                ? colors.textMuted
                                : colors.text,
                          },
                          isToday && !isSelected && { color: acc, fontFamily: Fonts.bold },
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Action row */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.todayBtn, { borderColor: colors.border }]}
                onPress={goToday}
              >
                <Text style={[styles.todayBtnText, { color: acc }]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: acc }]}
                onPress={() => setOpen(false)}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.md,
      height: 44,
      borderRadius: Radii.md,
      borderWidth: 1.5,
    },
    fieldText: {
      flex: 1,
      fontSize: 14,
      fontFamily: Fonts.regular,
    },
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    sheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: Spacing.lg,
      paddingBottom: 36,
    },
    handle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      alignSelf: 'center',
      marginTop: Spacing.md,
      marginBottom: Spacing.md,
    },
    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: Spacing.md,
      paddingHorizontal: Spacing.sm,
    },
    navBtn: { padding: 6 },
    navLabel: { fontSize: 16, fontFamily: Fonts.bold },
    weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    weekDay: {
      flex: 1,
      textAlign: 'center',
      fontSize: 11,
      fontFamily: Fonts.semibold,
      paddingVertical: 4,
    },
    dayCell: {
      flex: 1,
      aspectRatio: 1,
      maxHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: Radii.md,
      marginHorizontal: 1,
    },
    dayText: { fontSize: 14, fontFamily: Fonts.medium },
    actionRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.lg,
    },
    todayBtn: {
      flex: 1,
      height: 44,
      borderRadius: Radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
    },
    todayBtnText: { fontSize: 14, fontFamily: Fonts.semibold },
    doneBtn: {
      flex: 1,
      height: 44,
      borderRadius: Radii.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneBtnText: { fontSize: 14, fontFamily: Fonts.bold, color: '#fff' },
  });
