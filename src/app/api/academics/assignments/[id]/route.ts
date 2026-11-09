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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "assignments.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
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
    const assignment = await prisma.teacherSubject.update({
      where: { id },
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
    return NextResponse.json(assignment);
  } catch {
    return NextResponse.json(
      {
        error:
          "Could not update assignment. This combination may already exist.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "assignments.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.teacherSubject.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }
}
