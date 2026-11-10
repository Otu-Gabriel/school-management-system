import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { userCanAccessClass } from "@/lib/access-scope";
import { getCurrentAcademicContext } from "@/lib/school";
import {
  countSchoolDays,
  getStudentTermAttendanceSummary,
} from "@/lib/school-calendar";
import { formatDateOnly, parseDateOnly } from "@/lib/dates";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "attendance.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classSectionId = searchParams.get("classSectionId") || "";
  const termIdParam = searchParams.get("termId") || "";
  if (!classSectionId) {
    return NextResponse.json(
      { error: "classSectionId is required" },
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
  const term =
    (termIdParam
      ? await prisma.term.findUnique({ where: { id: termIdParam } })
      : null) || context.term;

  if (!term) {
    return NextResponse.json(
      { error: "No current term set. Configure Years & Terms first." },
      { status: 400 }
    );
  }

  const students = await prisma.student.findMany({
    where: {
      currentClassSectionId: classSectionId,
      status: "ACTIVE",
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const today = parseDateOnly(new Date());
  const endForCount =
    today.getTime() < parseDateOnly(term.endDate).getTime()
      ? today
      : term.endDate;

  const [schoolDaysInTerm, schoolDaysToDate, summaries] = await Promise.all([
    countSchoolDays(term.startDate, term.endDate, term.academicYearId),
    countSchoolDays(term.startDate, endForCount, term.academicYearId),
    Promise.all(
      students.map(async (student) => {
        const summary = await getStudentTermAttendanceSummary({
          studentId: student.id,
          classSectionId,
          termId: term.id,
        });
        return {
          studentId: student.id,
          admissionNo: student.admissionNo,
          name: `${student.firstName} ${student.lastName}`,
          ...summary,
        };
      })
    ),
  ]);

  return NextResponse.json({
    term: {
      id: term.id,
      name: term.name,
      startDate: formatDateOnly(term.startDate),
      endDate: formatDateOnly(term.endDate),
      isCurrent: term.isCurrent,
    },
    schoolDaysInTerm,
    schoolDaysToDate,
    students: summaries,
  });
}
