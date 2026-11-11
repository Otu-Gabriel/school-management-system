import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { findTimetableCollisions } from "@/lib/timetable";
import {
  activityAppliesToGradeLevel,
  parseTimeOfDay,
  timeToMinutes,
} from "@/lib/subjects-for-level";

const createSchema = z
  .object({
    academicYearId: z.string().min(1),
    termId: z.string().min(1),
    classSectionId: z.string().min(1),
    subjectId: z.string().min(1).optional().nullable(),
    activityId: z.string().min(1).optional().nullable(),
    staffId: z.string().min(1).optional().nullable(),
    dayOfWeek: z.number().int().min(1).max(5),
    startTime: z.string().min(1),
    endTime: z.string().min(1),
    room: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const hasSubject = Boolean(data.subjectId);
    const hasActivity = Boolean(data.activityId);
    if (hasSubject === hasActivity) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Choose either a subject or an activity",
        path: ["subjectId"],
      });
    }
  });

function canReadTimetable(permissions: string[]) {
  return (
    can(permissions, "academics.read") ||
    can(permissions, "assignments.read") ||
    can(permissions, "attendance.read")
  );
}

function canWriteTimetable(permissions: string[]) {
  return (
    can(permissions, "assignments.write") || can(permissions, "academics.write")
  );
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canReadTimetable(session.user.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classSectionId = searchParams.get("classSectionId") || undefined;
  const termId = searchParams.get("termId") || undefined;
  const staffId = searchParams.get("staffId") || undefined;
  const academicYearId = searchParams.get("academicYearId") || undefined;

  const slots = await prisma.timetableSlot.findMany({
    where: { classSectionId, termId, staffId, academicYearId },
    include: {
      subject: true,
      activity: true,
      staff: true,
      classSection: { include: { gradeLevel: true } },
      term: true,
      academicYear: true,
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(slots);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canWriteTimetable(session.user.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid timetable slot" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const startTime = parseTimeOfDay(data.startTime);
  const endTime = parseTimeOfDay(data.endTime);
  if (!startTime || !endTime) {
    return NextResponse.json(
      { error: "Start and end time must be HH:mm" },
      { status: 400 }
    );
  }
  if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
    return NextResponse.json(
      { error: "End time must be after start time" },
      { status: 400 }
    );
  }

  const [term, classSection] = await Promise.all([
    prisma.term.findUnique({ where: { id: data.termId } }),
    prisma.classSection.findUnique({ where: { id: data.classSectionId } }),
  ]);

  if (!term || term.academicYearId !== data.academicYearId) {
    return NextResponse.json({ error: "Term does not belong to that year" }, { status: 400 });
  }
  if (!classSection || classSection.academicYearId !== data.academicYearId) {
    return NextResponse.json(
      { error: "Class does not belong to that academic year" },
      { status: 400 }
    );
  }

  let staffId: string | null = data.staffId || null;

  if (data.subjectId) {
    const assignment = await prisma.teacherSubject.findFirst({
      where: {
        classSectionId: data.classSectionId,
        subjectId: data.subjectId,
        academicYearId: data.academicYearId,
      },
    });
    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Assign a teacher to this class subject before adding timetable slots",
        },
        { status: 400 }
      );
    }
    staffId = assignment.staffId;
  } else if (data.activityId) {
    const applies = await activityAppliesToGradeLevel(
      data.activityId,
      classSection.gradeLevelId
    );
    if (!applies) {
      return NextResponse.json(
        { error: "This activity does not apply to the class level" },
        { status: 400 }
      );
    }
    if (staffId) {
      const staff = await prisma.staff.findUnique({ where: { id: staffId } });
      if (!staff || staff.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Staff member not found or inactive" },
          { status: 400 }
        );
      }
    }
  }

  const collisions = await findTimetableCollisions({
    termId: data.termId,
    classSectionId: data.classSectionId,
    staffId,
    dayOfWeek: data.dayOfWeek,
    startTime,
    endTime,
  });
  if (collisions.length > 0) {
    return NextResponse.json(
      { error: collisions.map((c) => c.message).join(" "), collisions },
      { status: 409 }
    );
  }

  try {
    const slot = await prisma.timetableSlot.create({
      data: {
        academicYearId: data.academicYearId,
        termId: data.termId,
        classSectionId: data.classSectionId,
        subjectId: data.subjectId || null,
        activityId: data.activityId || null,
        staffId,
        dayOfWeek: data.dayOfWeek,
        startTime,
        endTime,
        room: data.room?.trim() || null,
      },
      include: {
        subject: true,
        activity: true,
        staff: true,
        classSection: { include: { gradeLevel: true } },
      },
    });
    return NextResponse.json(slot, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create timetable slot" },
      { status: 400 }
    );
  }
}
