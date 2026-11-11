import type { EnrollmentStatus, Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function closeCurrentPlacements(
  tx: Tx,
  studentId: string,
  endedOn: Date = new Date()
) {
  await tx.enrollment.updateMany({
    where: { studentId, isCurrent: true, endedOn: null },
    data: {
      isCurrent: false,
      endedOn,
    },
  });
}

export async function openPlacement(
  tx: Tx,
  options: {
    studentId: string;
    classSectionId: string;
    academicYearId: string;
    termId?: string | null;
    status?: EnrollmentStatus;
    reason?: string | null;
    startedOn?: Date;
  }
) {
  const startedOn = options.startedOn || new Date();
  await closeCurrentPlacements(tx, options.studentId, startedOn);

  const placement = await tx.enrollment.create({
    data: {
      studentId: options.studentId,
      classSectionId: options.classSectionId,
      academicYearId: options.academicYearId,
      termId: options.termId || null,
      status: options.status || "ENROLLED",
      reason: options.reason || null,
      startedOn,
      enrolledOn: startedOn,
      endedOn: null,
      isCurrent: true,
    },
  });

  await tx.student.update({
    where: { id: options.studentId },
    data: { currentClassSectionId: options.classSectionId },
  });

  return placement;
}

/** Ensure student has a current placement for the given class/year (create or replace). */
export async function ensurePlacement(
  tx: Tx,
  options: {
    studentId: string;
    classSectionId: string;
    academicYearId: string;
    termId?: string | null;
    status?: EnrollmentStatus;
    reason?: string | null;
  }
) {
  const current = await tx.enrollment.findFirst({
    where: { studentId: options.studentId, isCurrent: true },
  });

  if (
    current &&
    current.classSectionId === options.classSectionId &&
    current.academicYearId === options.academicYearId
  ) {
    return current;
  }

  return openPlacement(tx, options);
}

export async function transferStudentPlacement(
  tx: Tx,
  options: {
    studentId: string;
    toClassSectionId: string;
    reason: string;
    status?: EnrollmentStatus;
    termId?: string | null;
  }
) {
  const targetClass = await tx.classSection.findUnique({
    where: { id: options.toClassSectionId },
  });
  if (!targetClass || !targetClass.isActive) {
    return { ok: false as const, error: "Destination class not found or inactive." };
  }

  const student = await tx.student.findUnique({ where: { id: options.studentId } });
  if (!student) {
    return { ok: false as const, error: "Student not found." };
  }

  if (student.currentClassSectionId === options.toClassSectionId) {
    return { ok: false as const, error: "Student is already in that class." };
  }

  const placement = await openPlacement(tx, {
    studentId: options.studentId,
    classSectionId: options.toClassSectionId,
    academicYearId: targetClass.academicYearId,
    termId: options.termId || null,
    status: options.status || "TRANSFERRED",
    reason: options.reason,
  });

  return { ok: true as const, placement };
}
