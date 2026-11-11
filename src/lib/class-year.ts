import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

/** Copy active classes from the previous year into a new academic year. */
export async function copyActiveClassesToYear(
  tx: Tx,
  options: {
    targetYearId: string;
    sourceYearId?: string | null;
  }
) {
  const sourceYearId =
    options.sourceYearId ||
    (
      await tx.academicYear.findFirst({
        where: {
          id: { not: options.targetYearId },
          OR: [{ isCurrent: true }, { classSections: { some: {} } }],
        },
        orderBy: [{ isCurrent: "desc" }, { endDate: "desc" }],
        select: { id: true },
      })
    )?.id;

  if (!sourceYearId) {
    return { copied: 0, sourceYearId: null as string | null };
  }

  const sourceClasses = await tx.classSection.findMany({
    where: {
      academicYearId: sourceYearId,
      isActive: true,
    },
    orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
  });

  let copied = 0;
  for (const source of sourceClasses) {
    const existing = await tx.classSection.findFirst({
      where: {
        academicYearId: options.targetYearId,
        gradeLevelId: source.gradeLevelId,
        name: source.name,
      },
    });
    if (existing) continue;

    await tx.classSection.create({
      data: {
        academicYearId: options.targetYearId,
        gradeLevelId: source.gradeLevelId,
        name: source.name,
        section: source.section,
        room: source.room,
        capacity: source.capacity,
        // Class teacher is year-specific; start blank for the new year.
        classTeacherId: null,
        isActive: true,
        copiedFromId: source.id,
      },
    });
    copied += 1;
  }

  return { copied, sourceYearId };
}

/** Find the equivalent class in another year (same level + name). */
export async function findEquivalentClass(
  tx: Tx,
  options: {
    fromClassId: string;
    targetYearId: string;
    createIfMissing?: boolean;
  }
) {
  const source = await tx.classSection.findUnique({
    where: { id: options.fromClassId },
  });
  if (!source) return null;

  const existing = await tx.classSection.findFirst({
    where: {
      academicYearId: options.targetYearId,
      gradeLevelId: source.gradeLevelId,
      name: source.name,
    },
  });
  if (existing) return existing;

  if (!options.createIfMissing) return null;

  return tx.classSection.create({
    data: {
      academicYearId: options.targetYearId,
      gradeLevelId: source.gradeLevelId,
      name: source.name,
      section: source.section,
      room: source.room,
      capacity: source.capacity,
      classTeacherId: null,
      isActive: true,
      copiedFromId: source.id,
    },
  });
}

export async function classHasStudentReferences(classSectionId: string) {
  const [current, historical, attendance] = await Promise.all([
    prisma.student.count({ where: { currentClassSectionId: classSectionId } }),
    prisma.enrollment.count({ where: { classSectionId } }),
    prisma.attendanceRecord.count({ where: { classSectionId } }),
  ]);
  return current + historical + attendance > 0;
}

export function isLastTermOfYear(terms: { termNumber: number; isCurrent: boolean }[]) {
  if (!terms.length) return false;
  const maxTerm = Math.max(...terms.map((t) => t.termNumber));
  const current = terms.find((t) => t.isCurrent);
  return !!current && current.termNumber === maxTerm;
}
