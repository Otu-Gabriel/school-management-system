import { prisma } from "@/lib/prisma";

export function toAttendanceDate(value: string | Date) {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
    );
  }
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function todayAttendanceDateString() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Classes a staff member can mark attendance for in the current year. */
export async function getStaffAttendanceClasses(staffId: string) {
  const year = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
  });
  if (!year) return [];

  const [asClassTeacher, asSubjectTeacher] = await Promise.all([
    prisma.classSection.findMany({
      where: {
        academicYearId: year.id,
        classTeacherId: staffId,
      },
      include: { gradeLevel: true },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.teacherSubject.findMany({
      where: {
        staffId,
        academicYearId: year.id,
      },
      include: {
        classSection: { include: { gradeLevel: true } },
      },
    }),
  ]);

  const map = new Map<
    string,
    {
      id: string;
      name: string;
      label: string;
      academicYearId: string;
    }
  >();

  for (const c of asClassTeacher) {
    map.set(c.id, {
      id: c.id,
      name: c.name,
      label: `${c.gradeLevel.code} ${c.name}`,
      academicYearId: c.academicYearId,
    });
  }

  for (const link of asSubjectTeacher) {
    const c = link.classSection;
    if (!map.has(c.id)) {
      map.set(c.id, {
        id: c.id,
        name: c.name,
        label: `${c.gradeLevel.code} ${c.name}`,
        academicYearId: c.academicYearId,
      });
    }
  }

  return Array.from(map.values());
}

export async function staffCanMarkClass(staffId: string, classSectionId: string) {
  const classes = await getStaffAttendanceClasses(staffId);
  return classes.some((c) => c.id === classSectionId);
}
