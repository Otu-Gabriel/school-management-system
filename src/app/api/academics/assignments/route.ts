import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  staffId: z.string().min(1),
  subjectId: z.string().min(1),
  classSectionId: z.string().min(1),
  academicYearId: z.string().min(1),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "assignments.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const academicYearId = searchParams.get("academicYearId") || undefined;
  const staffId = searchParams.get("staffId") || undefined;
  const classSectionId = searchParams.get("classSectionId") || undefined;
  const subjectId = searchParams.get("subjectId") || undefined;

  const assignments = await prisma.teacherSubject.findMany({
    where: {
      academicYearId,
      staffId,
      classSectionId,
      subjectId,
    },
    include: {
      staff: true,
      subject: true,
      classSection: { include: { gradeLevel: true } },
      academicYear: true,
    },
    orderBy: [
      { academicYear: { startDate: "desc" } },
      { classSection: { name: "asc" } },
      { subject: { name: "asc" } },
    ],
  });

  return NextResponse.json(assignments);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "assignments.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignment data" }, { status: 400 });
  }

  const data = parsed.data;

  const classSection = await prisma.classSection.findUnique({
    where: { id: data.classSectionId },
  });
  if (!classSection) {
    return NextResponse.json({ error: "Class not found" }, { status: 400 });
  }
  if (classSection.academicYearId !== data.academicYearId) {
    return NextResponse.json(
      { error: "Selected class does not belong to that academic year" },
      { status: 400 }
    );
  }

  try {
    const assignment = await prisma.teacherSubject.create({
      data: {
        staffId: data.staffId,
        subjectId: data.subjectId,
        classSectionId: data.classSectionId,
        academicYearId: data.academicYearId,
      },
      include: {
        staff: true,
        subject: true,
        classSection: { include: { gradeLevel: true } },
        academicYear: true,
      },
    });
    return NextResponse.json(assignment, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not create assignment. This teacher may already teach that subject in the class for the year.",
      },
      { status: 400 }
    );
  }
}
