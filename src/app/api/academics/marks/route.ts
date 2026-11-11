import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { resolveMarkTotals } from "@/lib/marks";
import {
  getAccessibleClassIds,
  getStaffForUser,
  userCanAccessClass,
} from "@/lib/access-scope";

const upsertSchema = z.object({
  studentId: z.string().min(1),
  subjectId: z.string().min(1),
  classSectionId: z.string().min(1),
  academicYearId: z.string().min(1),
  termId: z.string().min(1),
  classScore: z.number().min(0).max(100).nullable().optional(),
  examScore: z.number().min(0).max(100).nullable().optional(),
  remark: z.string().optional().nullable(),
});

async function teacherOwnsSubject(
  userId: string,
  classSectionId: string,
  subjectId: string,
  academicYearId: string
) {
  const staff = await getStaffForUser(userId);
  if (!staff) return false;
  const row = await prisma.teacherSubject.findFirst({
    where: {
      staffId: staff.id,
      classSectionId,
      subjectId,
      academicYearId,
    },
  });
  return Boolean(row);
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "marks.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classSectionId = searchParams.get("classSectionId") || undefined;
  const termId = searchParams.get("termId") || undefined;
  const subjectId = searchParams.get("subjectId") || undefined;
  const studentId = searchParams.get("studentId") || undefined;

  if (classSectionId) {
    const ok = await userCanAccessClass(
      session.user.id,
      session.user.permissions,
      classSectionId
    );
    if (!ok) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const scopedClassIds = classSectionId
    ? null
    : await getAccessibleClassIds(session.user.id, session.user.permissions);
  if (scopedClassIds && scopedClassIds.length === 0) {
    return NextResponse.json([]);
  }

  const marks = await prisma.studentMark.findMany({
    where: {
      ...(classSectionId
        ? { classSectionId }
        : scopedClassIds
          ? { classSectionId: { in: scopedClassIds } }
          : {}),
      termId,
      subjectId,
      studentId,
    },
    include: {
      student: true,
      subject: true,
      classSection: { include: { gradeLevel: true } },
      term: true,
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
      { subject: { name: "asc" } },
    ],
  });

  return NextResponse.json(marks);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "marks.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = upsertSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid mark data" }, { status: 400 });
  }

  const data = parsed.data;
  const classSection = await prisma.classSection.findUnique({
    where: { id: data.classSectionId },
    include: { gradeLevel: true },
  });
  if (!classSection) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }
  if (classSection.academicYearId !== data.academicYearId) {
    return NextResponse.json(
      { error: "Class does not belong to that academic year" },
      { status: 400 }
    );
  }

  const canAll =
    can(session.user.permissions, "academics.write") ||
    can(session.user.permissions, "roles.manage") ||
    can(session.user.permissions, "students.write");

  if (!canAll) {
    const owns = await teacherOwnsSubject(
      session.user.id,
      data.classSectionId,
      data.subjectId,
      data.academicYearId
    );
    if (!owns) {
      return NextResponse.json(
        { error: "You can only enter marks for subjects you teach" },
        { status: 403 }
      );
    }
  }

  const term = await prisma.term.findUnique({ where: { id: data.termId } });
  if (!term || term.academicYearId !== data.academicYearId) {
    return NextResponse.json({ error: "Invalid term for year" }, { status: 400 });
  }

  const { total, gradeLabel } = await resolveMarkTotals({
    stageId: classSection.gradeLevel.stageId,
    classScore: data.classScore ?? null,
    examScore: data.examScore ?? null,
  });

  const existing = await prisma.studentMark.findUnique({
    where: {
      studentId_subjectId_classSectionId_termId: {
        studentId: data.studentId,
        subjectId: data.subjectId,
        classSectionId: data.classSectionId,
        termId: data.termId,
      },
    },
  });

  const mark = existing
    ? await prisma.studentMark.update({
        where: { id: existing.id },
        data: {
          classScore: data.classScore ?? null,
          examScore: data.examScore ?? null,
          total,
          gradeLabel,
          remark: data.remark ?? null,
        },
        include: { student: true, subject: true },
      })
    : await prisma.studentMark.create({
        data: {
          studentId: data.studentId,
          subjectId: data.subjectId,
          classSectionId: data.classSectionId,
          academicYearId: data.academicYearId,
          termId: data.termId,
          classScore: data.classScore ?? null,
          examScore: data.examScore ?? null,
          total,
          gradeLabel,
          remark: data.remark ?? null,
        },
        include: { student: true, subject: true },
      });

  return NextResponse.json(mark);
}
