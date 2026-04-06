import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenShell from '@/components/ScreenShell';
import { useAppTheme } from '@/components/ThemeProvider';
import { Fonts, Radii, Spacing } from '@/constants/theme';
import {
  formatLongDate,
  formatMonthDayDate,
  getAgeBreakdown,
  parseCalendarInput,
  sanitizeNumericInput,
  startOfDay,
} from '@/lib/date-utils';

const ACCENT = '#84CC16';

type DateDraft = {
  day: string;
  month: string;
  year: string;
};

function dateToDraft(date: Date): DateDraft {
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear()),
  };
}

function emptyDraft(): DateDraft {
  return { day: '', month: '', year: '' };
}

type DateFieldCardProps = {
  title: string;
  hint: string;
  value: DateDraft;
  onChange: (field: keyof DateDraft, next: string) => void;
  actionLabel?: string;
  onActionPress?: () => void;
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
};

function DateFieldCard({
  title,
  hint,
  value,
  onChange,
  actionLabel,
  onActionPress,
  colors,
  styles,
}: DateFieldCardProps) {
  return (
    <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.inputCardHeader}>
        <View>
          <Text style={[styles.inputEyebrow, { color: colors.textMuted }]}>{title}</Text>
          <Text style={[styles.inputHint, { color: colors.textSub }]}>{hint}</Text>
        </View>
        {actionLabel && onActionPress ? (
          <TouchableOpacity
            onPress={onActionPress}
            style={[styles.ghostAction, { borderColor: colors.borderStrong, backgroundColor: colors.inputBg }]}
          >
            <Text style={[styles.ghostActionText, { color: colors.text }]}>{actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.inputRow}>
        {[
          { key: 'day' as const, label: 'Day', placeholder: 'DD', maxLength: 2 },
          { key: 'month' as const, label: 'Month', placeholder: 'MM', maxLength: 2 },
          { key: 'year' as const, label: 'Year', placeholder: 'YYYY', maxLength: 4 },
        ].map((field) => (
          <View
            key={field.key}
            style={[
              styles.fieldWrap,
              field.key === 'year' ? styles.fieldWrapWide : null,
            ]}
          >
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{field.label}</Text>
            <TextInput
              style={[
                styles.dateInput,
                {
                  backgroundColor: colors.inputBg,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={value[field.key]}
              onChangeText={(next) => onChange(field.key, sanitizeNumericInput(next, field.maxLength))}
              placeholder={field.placeholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              maxLength={field.maxLength}
              textAlign="center"
              selectionColor={ACCENT}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

type InsightCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  colors: ReturnType<typeof useAppTheme>['colors'];
  styles: ReturnType<typeof createStyles>;
};

function InsightCard({ icon, label, value, colors, styles }: InsightCardProps) {
  return (
    <View style={[styles.insightCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.insightIconWrap, { backgroundColor: colors.accentLight }]}>
        <Ionicons name={icon} size={16} color={ACCENT} />
      </View>
      <Text style={[styles.insightLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.insightValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function AgeCalculatorScreen() {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = startOfDay(new Date());

  const [dob, setDob] = useState<DateDraft>(emptyDraft);
  const [asOf, setAsOf] = useState<DateDraft>(() => dateToDraft(today));

  const calculation = useMemo(() => {
    const hasDob = Object.values(dob).some(Boolean);
    const parsedDob = parseCalendarInput(dob.day, dob.month, dob.year);
    const parsedAsOf = parseCalendarInput(asOf.day, asOf.month, asOf.year);

    if (!hasDob) {
      return {
        result: null,
        message: 'Add a birth date to unlock a full age snapshot, life totals, and your next birthday countdown.',
        parsedDob,
        parsedAsOf,
      };
    }

    if (!parsedDob) {
      return {
        result: null,
        message: 'Enter a real birth date using day, month, and year.',
        parsedDob,
        parsedAsOf,
      };
    }

    if (!parsedAsOf) {
      return {
        result: null,
        message: 'Enter a valid comparison date to calculate the exact age.',
        parsedDob,
        parsedAsOf,
      };
    }

    if (parsedDob > parsedAsOf) {
      return {
        result: null,
        message: 'The birth date cannot be after the comparison date.',
        parsedDob,
        parsedAsOf,
      };
    }

    return {
      result: getAgeBreakdown(parsedDob, parsedAsOf),
      message: null,
      parsedDob,
      parsedAsOf,
    };
  }, [asOf, dob]);

  const quickStats = calculation.result
    ? [
        { label: 'Total Months', value: calculation.result.totalMonths.toLocaleString() },
        { label: 'Total Weeks', value: calculation.result.totalWeeks.toLocaleString() },
        { label: 'Total Days', value: calculation.result.totalDays.toLocaleString() },
        { label: 'Total Hours', value: calculation.result.totalHours.toLocaleString() },
      ]
    : [];

  function updateDraft(
    setter: Dispatch<SetStateAction<DateDraft>>,
    field: keyof DateDraft,
    next: string,
  ) {
    setter((current) => ({ ...current, [field]: next }));
  }

  function resetForm() {
    setDob(emptyDraft());
    setAsOf(dateToDraft(today));
  }

  return (
    <ScreenShell title="Age Calculator" accentColor={ACCENT}>
      <LinearGradient
        colors={['#365314', '#65A30D', '#A3E635']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.heroCard}
      >
        <Text style={styles.heroEyebrow}>Age Snapshot</Text>
        {calculation.result ? (
          <>
            <View style={styles.heroHeadlineRow}>
              <Text style={styles.heroValue}>{calculation.result.years}</Text>
              <View style={styles.heroCopyWrap}>
                <Text style={styles.heroTitle}>years old</Text>
                <Text style={styles.heroSubtitle}>
                  {calculation.result.months} months and {calculation.result.days} days beyond the last birthday
                </Text>
              </View>
            </View>

            <View style={styles.heroPillRow}>
              <View style={styles.heroPill}>
                <Ionicons name="calendar-outline" size={14} color="#F7FEE7" />
                <Text style={styles.heroPillText}>
                  As of {formatLongDate(calculation.parsedAsOf ?? today)}
                </Text>
              </View>
              <View style={styles.heroPill}>
                <Ionicons name="gift-outline" size={14} color="#F7FEE7" />
                <Text style={styles.heroPillText}>
                  {calculation.result.nextBirthdayInDays === 0
                    ? `Birthday today, turning ${calculation.result.nextBirthdayAge}`
                    : `${calculation.result.nextBirthdayInDays} days until ${calculation.result.nextBirthdayAge}`}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.heroTitle}>A cleaner, richer age calculator</Text>
            <Text style={styles.heroSubtitle}>
              Compare any birth date against today or another day and instantly see exact age details, totals, and the next birthday.
            </Text>
          </>
        )}
      </LinearGradient>

      <View style={styles.quickActionRow}>
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => setAsOf(dateToDraft(today))}
        >
          <Ionicons name="today-outline" size={16} color={ACCENT} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>Use Today</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.quickAction, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={resetForm}
        >
          <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.quickActionText, { color: colors.text }]}>Reset</Text>
        </TouchableOpacity>
      </View>

      <DateFieldCard
        title="Date of birth"
        hint="Enter the birth date in day / month / year format."
        value={dob}
        onChange={(field, next) => updateDraft(setDob, field, next)}
        actionLabel="Clear"
        onActionPress={() => setDob(emptyDraft())}
        colors={colors}
        styles={styles}
      />

      <DateFieldCard
        title="Compare against"
        hint="Keep this on today, or pick another date for backdated or future age checks."
        value={asOf}
        onChange={(field, next) => updateDraft(setAsOf, field, next)}
        actionLabel="Today"
        onActionPress={() => setAsOf(dateToDraft(today))}
        colors={colors}
        styles={styles}
      />

      {calculation.result ? (
        <>
          <View style={styles.primaryGrid}>
            {[
              { label: 'Years', value: calculation.result.years },
              { label: 'Months', value: calculation.result.months },
              { label: 'Days', value: calculation.result.days },
            ].map((item) => (
              <View
                key={item.label}
                style={[styles.primaryStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={styles.primaryStatValue}>{item.value}</Text>
                <Text style={[styles.primaryStatLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.storyTitle, { color: colors.text }]}>Life timeline</Text>
            <Text style={[styles.storyCopy, { color: colors.textSub }]}>
              Born on {calculation.result.birthWeekday}. The next birthday lands on{' '}
              {formatMonthDayDate(calculation.result.nextBirthdayDate)} and marks age{' '}
              {calculation.result.nextBirthdayAge}.
            </Text>
          </View>

          <View style={styles.statsGrid}>
            {quickStats.map((item) => (
              <View
                key={item.label}
                style={[styles.secondaryStatCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryStatValue, { color: colors.text }]}>{item.value}</Text>
                <Text style={[styles.secondaryStatLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.insightGrid}>
            <InsightCard
              icon="sparkles-outline"
              label="Born On"
              value={calculation.result.birthWeekday}
              colors={colors}
              styles={styles}
            />
            <InsightCard
              icon="gift-outline"
              label="Next Birthday"
              value={
                calculation.result.nextBirthdayInDays === 0
                  ? 'Today'
                  : `${calculation.result.nextBirthdayInDays} day${calculation.result.nextBirthdayInDays === 1 ? '' : 's'}`
              }
              colors={colors}
              styles={styles}
            />
            <InsightCard
              icon="trending-up-outline"
              label="Turning"
              value={`${calculation.result.nextBirthdayAge}`}
              colors={colors}
              styles={styles}
            />
          </View>
        </>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.emptyIconWrap, { backgroundColor: colors.accentLight }]}>
            <Ionicons name="hourglass-outline" size={22} color={ACCENT} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Waiting for a valid date</Text>
          <Text style={[styles.emptyCopy, { color: colors.textMuted }]}>{calculation.message}</Text>
        </View>
      )}
    </ScreenShell>
  );
}

const createStyles = (colors: ReturnType<typeof useAppTheme>['colors']) =>
  StyleSheet.create({
    heroCard: {
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      marginBottom: Spacing.lg,
      gap: Spacing.md,
    },
    heroEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      color: '#ECFCCB',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    heroHeadlineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    heroValue: {
      fontSize: 64,
      lineHeight: 64,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroCopyWrap: {
      flex: 1,
      gap: 4,
    },
    heroTitle: {
      fontSize: 28,
      lineHeight: 34,
      fontFamily: Fonts.bold,
      color: '#FFFFFF',
    },
    heroSubtitle: {
      fontSize: 14,
      lineHeight: 20,
      fontFamily: Fonts.medium,
      color: '#F7FEE7',
    },
    heroPillRow: {
      gap: Spacing.sm,
    },
    heroPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingHorizontal: Spacing.md,
      paddingVertical: 10,
      borderRadius: Radii.lg,
      backgroundColor: 'rgba(255,255,255,0.16)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
    },
    heroPillText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      fontFamily: Fonts.medium,
      color: '#F7FEE7',
    },
    quickActionRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    quickAction: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderRadius: Radii.lg,
      paddingVertical: 12,
    },
    quickActionText: {
      fontSize: 14,
      fontFamily: Fonts.semibold,
    },
    inputCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      gap: Spacing.md,
    },
    inputCardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: Spacing.md,
    },
    inputEyebrow: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    inputHint: {
      fontSize: 13,
      lineHeight: 19,
      fontFamily: Fonts.regular,
    },
    ghostAction: {
      borderWidth: 1,
      borderRadius: Radii.pill,
      paddingHorizontal: Spacing.md,
      paddingVertical: 8,
    },
    ghostActionText: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
    },
    inputRow: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    fieldWrap: {
      flex: 1,
      gap: 6,
    },
    fieldWrapWide: {
      flex: 1.4,
    },
    fieldLabel: {
      fontSize: 11,
      fontFamily: Fonts.medium,
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    dateInput: {
      borderWidth: 1.5,
      borderRadius: Radii.lg,
      paddingVertical: 14,
      fontSize: 18,
      fontFamily: Fonts.bold,
    },
    primaryGrid: {
      flexDirection: 'row',
      gap: Spacing.sm,
      marginTop: Spacing.sm,
      marginBottom: Spacing.md,
    },
    primaryStatCard: {
      flex: 1,
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      alignItems: 'center',
      gap: 4,
    },
    primaryStatValue: {
      fontSize: 34,
      lineHeight: 38,
      fontFamily: Fonts.bold,
      color: ACCENT,
    },
    primaryStatLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    storyCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      marginBottom: Spacing.md,
      gap: 6,
    },
    storyTitle: {
      fontSize: 16,
      fontFamily: Fonts.bold,
    },
    storyCopy: {
      fontSize: 14,
      lineHeight: 21,
      fontFamily: Fonts.regular,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: Spacing.sm,
      marginBottom: Spacing.md,
    },
    secondaryStatCard: {
      width: '48.5%',
      borderWidth: 1,
      borderRadius: Radii.lg,
      padding: Spacing.md,
      gap: 4,
    },
    secondaryStatValue: {
      fontSize: 22,
      lineHeight: 26,
      fontFamily: Fonts.bold,
    },
    secondaryStatLabel: {
      fontSize: 12,
      fontFamily: Fonts.medium,
    },
    insightGrid: {
      gap: Spacing.sm,
    },
    insightCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.lg,
      gap: Spacing.sm,
    },
    insightIconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
    },
    insightLabel: {
      fontSize: 12,
      fontFamily: Fonts.semibold,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    insightValue: {
      fontSize: 20,
      lineHeight: 24,
      fontFamily: Fonts.bold,
    },
    emptyCard: {
      borderWidth: 1,
      borderRadius: Radii.xl,
      padding: Spacing.xl,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    emptyIconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: Fonts.bold,
      textAlign: 'center',
    },
    emptyCopy: {
      fontSize: 14,
      lineHeight: 21,
      fontFamily: Fonts.regular,
      textAlign: 'center',
    },
  });
