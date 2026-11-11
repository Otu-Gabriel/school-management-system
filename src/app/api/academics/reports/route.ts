import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { userCanAccessClass } from "@/lib/access-scope";

const upsertSchema = z.object({
  studentId: z.string().min(1),
  classSectionId: z.string().min(1),
  academicYearId: z.string().min(1),
  termId: z.string().min(1),
  teacherRemark: z.string().optional().nullable(),
  publish: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "marks.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classSectionId = searchParams.get("classSectionId") || undefined;
  const termId = searchParams.get("termId") || undefined;
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

  const cards = await prisma.reportCard.findMany({
    where: { classSectionId, termId, studentId },
    include: {
      student: true,
      classSection: { include: { gradeLevel: true, classTeacher: true } },
      term: true,
      academicYear: true,
    },
    orderBy: [
      { student: { lastName: "asc" } },
      { student: { firstName: "asc" } },
    ],
  });

  return NextResponse.json(cards);
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "marks.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = upsertSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report data" }, { status: 400 });
  }

  const data = parsed.data;
  const ok = await userCanAccessClass(
    session.user.id,
    session.user.permissions,
    data.classSectionId
  );
  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (data.publish && !can(session.user.permissions, "marks.publish")) {
    return NextResponse.json(
      { error: "You do not have permission to publish report cards" },
      { status: 403 }
    );
  }

  const existing = await prisma.reportCard.findUnique({
    where: {
      studentId_termId: {
        studentId: data.studentId,
        termId: data.termId,
      },
    },
  });

  const card = existing
    ? await prisma.reportCard.update({
        where: { id: existing.id },
        data: {
          teacherRemark: data.teacherRemark ?? existing.teacherRemark,
          publishedAt: data.publish
            ? new Date()
            : data.publish === false
              ? null
              : existing.publishedAt,
        },
        include: {
          student: true,
          classSection: { include: { gradeLevel: true } },
          term: true,
          academicYear: true,
        },
      })
    : await prisma.reportCard.create({
        data: {
          studentId: data.studentId,
          classSectionId: data.classSectionId,
          academicYearId: data.academicYearId,
          termId: data.termId,
          teacherRemark: data.teacherRemark ?? null,
          publishedAt: data.publish ? new Date() : null,
        },
        include: {
          student: true,
          classSection: { include: { gradeLevel: true } },
          term: true,
          academicYear: true,
        },
      });

  return NextResponse.json(card);
}
