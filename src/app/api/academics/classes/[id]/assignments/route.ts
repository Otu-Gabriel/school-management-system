import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  subjectAppliesToGradeLevel,
  timesOverlap,
} from "@/lib/subjects-for-level";

const schema = z.object({
  subjectId: z.string().min(1),
  staffId: z.string().min(1).nullable(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "assignments.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: classSectionId } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignment data" }, { status: 400 });
  }

  const classSection = await prisma.classSection.findUnique({
    where: { id: classSectionId },
  });
  if (!classSection) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const applies = await subjectAppliesToGradeLevel(
    parsed.data.subjectId,
    classSection.gradeLevelId
  );
  if (!applies) {
    return NextResponse.json(
      { error: "This subject does not apply to the class level" },
      { status: 400 }
    );
  }

  const existing = await prisma.teacherSubject.findFirst({
    where: {
      classSectionId,
      subjectId: parsed.data.subjectId,
      academicYearId: classSection.academicYearId,
    },
  });

  // Unassign teacher for this class-subject (subject still applies; no opt-out).
  if (!parsed.data.staffId) {
    if (existing) {
      const slotCount = await prisma.timetableSlot.count({
        where: {
          classSectionId,
          subjectId: parsed.data.subjectId,
          academicYearId: classSection.academicYearId,
        },
      });
      if (slotCount > 0) {
        return NextResponse.json(
          {
            error:
              "Clear timetable slots for this subject in the class before unassigning the teacher",
          },
          { status: 400 }
        );
      }
      await prisma.teacherSubject.delete({ where: { id: existing.id } });
    }
    return NextResponse.json({ ok: true, assignment: null });
  }

  const staff = await prisma.staff.findUnique({
    where: { id: parsed.data.staffId },
  });
  if (!staff || staff.status !== "ACTIVE") {
    return NextResponse.json({ error: "Staff member not found or inactive" }, { status: 400 });
  }

  const existingSlots = await prisma.timetableSlot.findMany({
    where: {
      classSectionId,
      subjectId: parsed.data.subjectId,
      academicYearId: classSection.academicYearId,
    },
  });

  for (const slot of existingSlots) {
    const teacherSlots = await prisma.timetableSlot.findMany({
      where: {
        termId: slot.termId,
        staffId: parsed.data.staffId,
        dayOfWeek: slot.dayOfWeek,
        id: { not: slot.id },
      },
      include: {
        subject: true,
        activity: true,
        classSection: { include: { gradeLevel: true } },
      },
    });
    const teacherHit = teacherSlots.find((other) =>
      timesOverlap(slot.startTime, slot.endTime, other.startTime, other.endTime)
    );
    if (teacherHit) {
      const label =
        teacherHit.subject?.code ||
        teacherHit.activity?.name ||
        teacherHit.activity?.code ||
        "a slot";
      return NextResponse.json(
        {
          error: `Cannot assign this teacher: they already have ${label} in ${teacherHit.classSection.gradeLevel.code} ${teacherHit.classSection.name} overlapping that time.`,
        },
        { status: 409 }
      );
    }
  }

  try {
    const assignment = existing
      ? await prisma.teacherSubject.update({
          where: { id: existing.id },
          data: { staffId: parsed.data.staffId },
          include: {
            staff: true,
            subject: true,
          },
        })
      : await prisma.teacherSubject.create({
          data: {
            staffId: parsed.data.staffId,
            subjectId: parsed.data.subjectId,
            classSectionId,
            academicYearId: classSection.academicYearId,
          },
          include: {
            staff: true,
            subject: true,
          },
        });

    // Keep timetable slots aligned with the assigned teacher.
    await prisma.timetableSlot.updateMany({
      where: {
        classSectionId,
        subjectId: parsed.data.subjectId,
        academicYearId: classSection.academicYearId,
      },
      data: { staffId: parsed.data.staffId },
    });

    return NextResponse.json({ ok: true, assignment });
  } catch {
    return NextResponse.json(
      { error: "Could not save teaching assignment" },
      { status: 400 }
    );
  }
}
