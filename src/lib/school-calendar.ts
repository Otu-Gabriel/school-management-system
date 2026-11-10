import { prisma } from "@/lib/prisma";
import { getSchoolSettings, getCurrentAcademicContext } from "@/lib/school";
import {
  addUtcDays,
  formatDateOnly,
  isDateWithinInclusive,
  parseDateOnly,
} from "@/lib/dates";

export function parseWeekendClosed(value?: string | null) {
  const raw = (value || "0,6").split(",").map((part) => Number(part.trim()));
  return new Set(raw.filter((n) => Number.isFinite(n) && n >= 0 && n <= 6));
}

export async function getWeekendClosedSet() {
  const settings = await getSchoolSettings();
  return parseWeekendClosed(settings.weekendClosed);
}

export async function getExceptionsMap(academicYearId?: string | null) {
  const exceptions = await prisma.calendarException.findMany({
    where: academicYearId
      ? {
          OR: [{ academicYearId }, { academicYearId: null }],
        }
      : undefined,
    orderBy: { date: "asc" },
  });

  return new Map(
    exceptions.map((item) => [formatDateOnly(item.date), item] as const)
  );
}

export function isSchoolDaySync(
  date: Date,
  weekendClosed: Set<number>,
  exceptions: Map<string, { type: "CLOSED" | "OPEN" }>
) {
  const key = formatDateOnly(parseDateOnly(date));
  const exception = exceptions.get(key);
  if (exception?.type === "CLOSED") return false;
  if (exception?.type === "OPEN") return true;
  const weekday = parseDateOnly(date).getUTCDay();
  return !weekendClosed.has(weekday);
}

export async function isSchoolDay(date: Date | string, academicYearId?: string) {
  const day = parseDateOnly(date);
  const [weekendClosed, exceptions] = await Promise.all([
    getWeekendClosedSet(),
    getExceptionsMap(academicYearId),
  ]);
  return isSchoolDaySync(day, weekendClosed, exceptions);
}

export async function listSchoolDays(start: Date | string, end: Date | string, academicYearId?: string) {
  const from = parseDateOnly(start);
  const to = parseDateOnly(end);
  if (from.getTime() > to.getTime()) return [];

  const [weekendClosed, exceptions] = await Promise.all([
    getWeekendClosedSet(),
    getExceptionsMap(academicYearId),
  ]);

  const days: Date[] = [];
  for (let cursor = from; cursor.getTime() <= to.getTime(); cursor = addUtcDays(cursor, 1)) {
    if (isSchoolDaySync(cursor, weekendClosed, exceptions)) {
      days.push(new Date(cursor));
    }
  }
  return days;
}

export async function countSchoolDays(
  start: Date | string,
  end: Date | string,
  academicYearId?: string
) {
  const days = await listSchoolDays(start, end, academicYearId);
  return days.length;
}

export async function resolveTermForDate(date: Date | string, academicYearId?: string) {
  const day = parseDateOnly(date);
  const year =
    academicYearId
      ? await prisma.academicYear.findUnique({
          where: { id: academicYearId },
          include: { terms: { orderBy: { termNumber: "asc" } } },
        })
      : (
          await getCurrentAcademicContext()
        ).year;

  if (!year) return null;

  const terms =
    "terms" in year && Array.isArray(year.terms)
      ? year.terms
      : await prisma.term.findMany({
          where: { academicYearId: year.id },
          orderBy: { termNumber: "asc" },
        });

  return (
    terms.find((term) => isDateWithinInclusive(day, term.startDate, term.endDate)) ||
    null
  );
}

export async function assertDateInCurrentTerm(date: Date | string) {
  const { year, term } = await getCurrentAcademicContext();
  if (!year || !term) {
    return {
      ok: false as const,
      error: "Set a current academic year and current term before taking attendance.",
    };
  }

  const day = parseDateOnly(date);
  if (!isDateWithinInclusive(day, term.startDate, term.endDate)) {
    return {
      ok: false as const,
      error: `Attendance date must fall within the current term (${term.name}: ${formatDateOnly(term.startDate)} to ${formatDateOnly(term.endDate)}).`,
      year,
      term,
    };
  }

  const schoolDay = await isSchoolDay(day, year.id);
  if (!schoolDay) {
    return {
      ok: false as const,
      error: "Selected date is not a school day (weekend or holiday).",
      year,
      term,
    };
  }

  return { ok: true as const, year, term, day };
}

export type TermAttendanceSummary = {
  termId: string;
  termName: string;
  schoolDaysInTerm: number;
  schoolDaysToDate: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  markedDays: number;
  attendancePercent: number | null;
};

export async function getStudentTermAttendanceSummary(options: {
  studentId: string;
  classSectionId: string;
  termId: string;
}) {
  const term = await prisma.term.findUnique({
    where: { id: options.termId },
  });
  if (!term) return null;

  const today = parseDateOnly(new Date());
  const endForCount =
    today.getTime() < parseDateOnly(term.endDate).getTime()
      ? today
      : term.endDate;

  const [schoolDaysInTerm, schoolDaysToDate, records] = await Promise.all([
    countSchoolDays(term.startDate, term.endDate, term.academicYearId),
    countSchoolDays(term.startDate, endForCount, term.academicYearId),
    prisma.attendanceRecord.findMany({
      where: {
        studentId: options.studentId,
        classSectionId: options.classSectionId,
        termId: options.termId,
      },
    }),
  ]);

  const present = records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;
  const absent = records.filter((r) => r.status === "ABSENT").length;
  const late = records.filter((r) => r.status === "LATE").length;
  const excused = records.filter((r) => r.status === "EXCUSED").length;
  const markedDays = records.length;
  const denominator = Math.max(schoolDaysToDate, 1);
  const attendancePercent =
    schoolDaysToDate === 0
      ? null
      : Math.round((present / denominator) * 1000) / 10;

  return {
    termId: term.id,
    termName: term.name,
    schoolDaysInTerm,
    schoolDaysToDate,
    present,
    absent,
    late,
    excused,
    markedDays,
    attendancePercent,
  } satisfies TermAttendanceSummary;
}
