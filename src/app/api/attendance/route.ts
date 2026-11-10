import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import {
  getStaffForUser,
  userCanAccessClass,
} from "@/lib/access-scope";
import { assertDateInCurrentTerm } from "@/lib/school-calendar";
import { formatDateOnly, parseDateOnly } from "@/lib/dates";
import { getCurrentAcademicContext } from "@/lib/school";

const saveSchema = z.object({
  classSectionId: z.string().min(1),
  date: z.string().min(8),
  records: z.array(
    z.object({
      studentId: z.string().min(1),
      status: z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]),
      remark: z.string().optional().nullable(),
    })
  ),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "attendance.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classSectionId = searchParams.get("classSectionId") || "";
  const date = searchParams.get("date") || "";
  if (!classSectionId || !date) {
    return NextResponse.json(
      { error: "classSectionId and date are required" },
      { status: 400 }
    );
  }

  const allowed = await userCanAccessClass(
    session.user.id,
    session.user.permissions,
    classSectionId
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only view attendance for your assigned classes" },
      { status: 403 }
    );
  }

  const context = await getCurrentAcademicContext();
  const day = parseDateOnly(date);
  const classSection = await prisma.classSection.findUnique({
    where: { id: classSectionId },
    include: { gradeLevel: true, academicYear: true },
  });
  if (!classSection) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const students = await prisma.student.findMany({
    where: {
      currentClassSectionId: classSectionId,
      status: "ACTIVE",
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const existing = await prisma.attendanceRecord.findMany({
    where: { classSectionId, date: day },
  });
  const byStudent = Object.fromEntries(existing.map((r) => [r.studentId, r]));

  return NextResponse.json({
    classSection: {
      id: classSection.id,
      label: `${classSection.gradeLevel.code} ${classSection.name}`,
      academicYearId: classSection.academicYearId,
    },
    academic: {
      yearName: context.year?.name || null,
      termId: context.term?.id || null,
      termName: context.term?.name || null,
      termStart: context.term ? formatDateOnly(context.term.startDate) : null,
      termEnd: context.term ? formatDateOnly(context.term.endDate) : null,
    },
    date,
    students: students.map((s) => ({
      id: s.id,
      admissionNo: s.admissionNo,
      name: `${s.firstName} ${s.lastName}`,
      status: byStudent[s.id]?.status || "PRESENT",
      remark: byStudent[s.id]?.remark || "",
      recordId: byStudent[s.id]?.id || null,
    })),
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "attendance.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = saveSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid attendance data" }, { status: 400 });
  }

  const { classSectionId, date, records } = parsed.data;

  const termCheck = await assertDateInCurrentTerm(date);
  if (!termCheck.ok) {
    return NextResponse.json({ error: termCheck.error }, { status: 400 });
  }

  if (termCheck.term.isLocked) {
    return NextResponse.json(
      { error: "This term is locked. Ask an admin to unlock it before editing attendance." },
      { status: 400 }
    );
  }

  const allowed = await userCanAccessClass(
    session.user.id,
    session.user.permissions,
    classSectionId
  );
  if (!allowed) {
    return NextResponse.json(
      { error: "You can only mark attendance for your assigned classes" },
      { status: 403 }
    );
  }

  const classSection = await prisma.classSection.findUnique({
    where: { id: classSectionId },
  });
  if (!classSection) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  if (classSection.academicYearId !== termCheck.year.id) {
    return NextResponse.json(
      { error: "Class does not belong to the current academic year." },
      { status: 400 }
    );
  }

  const staff = await getStaffForUser(session.user.id);
  const day = termCheck.day;

  const classStudentIds = new Set(
    (
      await prisma.student.findMany({
        where: {
          currentClassSectionId: classSectionId,
          status: "ACTIVE",
        },
        select: { id: true },
      })
    ).map((s) => s.id)
  );

  const invalid = records.find((r) => !classStudentIds.has(r.studentId));
  if (invalid) {
    return NextResponse.json(
      { error: "One or more students are not in this class" },
      { status: 400 }
    );
  }

  await prisma.$transaction(
    records.map((record) =>
      prisma.attendanceRecord.upsert({
        where: {
          studentId_classSectionId_date: {
            studentId: record.studentId,
            classSectionId,
            date: day,
          },
        },
        create: {
          studentId: record.studentId,
          classSectionId,
          academicYearId: classSection.academicYearId,
          termId: termCheck.term.id,
          date: day,
          status: record.status,
          remark: record.remark || null,
          markedById: staff?.id || null,
        },
        update: {
          status: record.status,
          remark: record.remark || null,
          markedById: staff?.id || null,
          termId: termCheck.term.id,
          academicYearId: classSection.academicYearId,
        },
      })
    )
  );

  await writeAuditLog({
    userId: session.user.id,
    action: "attendance.mark",
    entityType: "ClassSection",
    entityId: classSectionId,
    newValues: {
      date,
      termId: termCheck.term.id,
      term: termCheck.term.name,
      count: records.length,
      absent: records.filter((r) => r.status === "ABSENT").length,
      late: records.filter((r) => r.status === "LATE").length,
    },
  });

  return NextResponse.json({ ok: true });
}
