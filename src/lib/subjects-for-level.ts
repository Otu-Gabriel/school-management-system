import { prisma } from "@/lib/prisma";

/**
 * Subjects that apply to a grade level.
 * Empty SubjectLevel rows = all levels in the subject's stage (or every level if stage is null / ALL).
 * No class-level opt-out: classes inherit this set for their grade level.
 */
export async function subjectsForGradeLevel(gradeLevelId: string) {
  const gradeLevel = await prisma.gradeLevel.findUnique({
    where: { id: gradeLevelId },
    include: { stage: true },
  });
  if (!gradeLevel) return [];

  const subjects = await prisma.subject.findMany({
    include: {
      stage: true,
      allowedLevels: true,
    },
    orderBy: [{ name: "asc" }],
  });

  return subjects.filter((subject) => {
    if (subject.allowedLevels.length > 0) {
      return subject.allowedLevels.some((row) => row.gradeLevelId === gradeLevelId);
    }

    if (!subject.stageId || subject.stage?.code === "ALL") {
      return true;
    }

    return subject.stageId === gradeLevel.stageId;
  });
}

export async function subjectAppliesToGradeLevel(
  subjectId: string,
  gradeLevelId: string
) {
  const list = await subjectsForGradeLevel(gradeLevelId);
  return list.some((s) => s.id === subjectId);
}

/**
 * Activities that apply to a grade level (same inheritance rules as subjects).
 */
export async function activitiesForGradeLevel(gradeLevelId: string) {
  const gradeLevel = await prisma.gradeLevel.findUnique({
    where: { id: gradeLevelId },
    include: { stage: true },
  });
  if (!gradeLevel) return [];

  const activities = await prisma.activity.findMany({
    include: {
      stage: true,
      allowedLevels: true,
    },
    orderBy: [{ name: "asc" }],
  });

  return activities.filter((activity) => {
    if (activity.allowedLevels.length > 0) {
      return activity.allowedLevels.some((row) => row.gradeLevelId === gradeLevelId);
    }

    if (!activity.stageId || activity.stage?.code === "ALL") {
      return true;
    }

    return activity.stageId === gradeLevel.stageId;
  });
}

export async function activityAppliesToGradeLevel(
  activityId: string,
  gradeLevelId: string
) {
  const list = await activitiesForGradeLevel(gradeLevelId);
  return list.some((a) => a.id === activityId);
}

export const TIMETABLE_DAYS = [
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
] as const;

/** Parse "HH:mm" or "HH:mm:ss" into a Date usable with Prisma @db.Time. */
export function parseTimeOfDay(value: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || "0");
  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59 ||
    seconds < 0 ||
    seconds > 59
  ) {
    return null;
  }
  return new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds));
}

export function formatTimeOfDay(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const hours = date.getUTCHours();
  const minutes = date.getUTCMinutes();
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function timeToMinutes(value: Date | string): number {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

export function timesOverlap(
  startA: Date | string,
  endA: Date | string,
  startB: Date | string,
  endB: Date | string
) {
  const a0 = timeToMinutes(startA);
  const a1 = timeToMinutes(endA);
  const b0 = timeToMinutes(startB);
  const b1 = timeToMinutes(endB);
  return a0 < b1 && b0 < a1;
}
