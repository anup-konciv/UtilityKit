const MS_PER_DAY = 86_400_000;
const LEAP_YEAR_REFERENCE = 2024;

const MONTH_SHORT_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export type AgeBreakdown = {
  years: number;
  months: number;
  days: number;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  totalHours: number;
  birthWeekday: string;
  nextBirthdayDate: Date;
  nextBirthdayInDays: number;
  nextBirthdayAge: number;
};

export function sanitizeNumericInput(value: string, maxLength: number) {
  return value.replace(/\D/g, '').slice(0, maxLength);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function parseCalendarDate(day: number, month: number, year: number): Date | null {
  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    month < 1 ||
    month > 12 ||
    year < 1
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return startOfDay(date);
}

export function parseCalendarInput(day: string, month: string, year: string) {
  const parsedDay = Number.parseInt(day, 10);
  const parsedMonth = Number.parseInt(month, 10);
  const parsedYear = Number.parseInt(year, 10);

  if (
    Number.isNaN(parsedDay) ||
    Number.isNaN(parsedMonth) ||
    Number.isNaN(parsedYear)
  ) {
    return null;
  }

  return parseCalendarDate(parsedDay, parsedMonth, parsedYear);
}

export function isValidBirthday(day: number, month: number, year?: number) {
  return parseCalendarDate(day, month, year ?? LEAP_YEAR_REFERENCE) !== null;
}

export function daysBetween(a: Date, b: Date) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / MS_PER_DAY);
}

export function getBirthdayOccurrence(day: number, month: number, year: number) {
  const safeDay = Math.min(day, getDaysInMonth(year, month));
  return new Date(year, month - 1, safeDay);
}

export function getNextBirthday(day: number, month: number, from = new Date()) {
  const baseline = startOfDay(from);
  const currentYear = baseline.getFullYear();

  let date = getBirthdayOccurrence(day, month, currentYear);
  if (date < baseline) {
    date = getBirthdayOccurrence(day, month, currentYear + 1);
  }

  return {
    date,
    daysUntil: daysBetween(baseline, date),
  };
}

export function getAgeBreakdown(dob: Date, asOf: Date): AgeBreakdown | null {
  const birth = startOfDay(dob);
  const target = startOfDay(asOf);

  if (birth > target) {
    return null;
  }

  let years = target.getFullYear() - birth.getFullYear();
  let months = target.getMonth() - birth.getMonth();
  let days = target.getDate() - birth.getDate();

  if (days < 0) {
    months -= 1;
    const previousMonth = target.getMonth() === 0 ? 12 : target.getMonth();
    const previousYear = target.getMonth() === 0 ? target.getFullYear() - 1 : target.getFullYear();
    days += getDaysInMonth(previousYear, previousMonth);
  }

  if (months < 0) {
    years -= 1;
    months += 12;
  }

  const totalDays = daysBetween(birth, target);
  const nextBirthday = getNextBirthday(birth.getDate(), birth.getMonth() + 1, target);

  return {
    years,
    months,
    days,
    totalDays,
    totalWeeks: Math.floor(totalDays / 7),
    totalMonths: years * 12 + months,
    totalHours: totalDays * 24,
    birthWeekday: birth.toLocaleDateString(undefined, { weekday: 'long' }),
    nextBirthdayDate: nextBirthday.date,
    nextBirthdayInDays: nextBirthday.daysUntil,
    nextBirthdayAge: nextBirthday.date.getFullYear() - birth.getFullYear(),
  };
}

export function formatMonthName(month: number) {
  return MONTH_SHORT_NAMES[month - 1] ?? 'Month';
}

export function formatBirthdayLabel(day: number, month: number, year?: number) {
  const monthName = formatMonthName(month);
  return year ? `${day} ${monthName}, ${year}` : `${day} ${monthName}`;
}

export function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMonthDayDate(date: Date) {
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
