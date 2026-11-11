import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { findTimetableCollisions } from "@/lib/timetable";
import {
  activityAppliesToGradeLevel,
  formatTimeOfDay,
  parseTimeOfDay,
  timeToMinutes,
} from "@/lib/subjects-for-level";

const updateSchema = z
  .object({
    subjectId: z.string().min(1).optional().nullable(),
    activityId: z.string().min(1).optional().nullable(),
    staffId: z.string().min(1).optional().nullable(),
    dayOfWeek: z.number().int().min(1).max(5).optional(),
    startTime: z.string().min(1).optional(),
    endTime: z.string().min(1).optional(),
    room: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (data.subjectId !== undefined || data.activityId !== undefined) {
      const hasSubject = Boolean(data.subjectId);
      const hasActivity = Boolean(data.activityId);
      if (hasSubject === hasActivity) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Choose either a subject or an activity",
          path: ["subjectId"],
        });
      }
    }
  });

function canWriteTimetable(permissions: string[]) {
  return (
    can(permissions, "assignments.write") || can(permissions, "academics.write")
  );
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canWriteTimetable(session.user.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid timetable slot" },
      { status: 400 }
    );
  }

  const existing = await prisma.timetableSlot.findUnique({
    where: { id },
    include: { classSection: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const nextSubjectId =
    parsed.data.subjectId !== undefined
      ? parsed.data.subjectId
      : existing.subjectId;
  const nextActivityId =
    parsed.data.activityId !== undefined
      ? parsed.data.activityId
      : existing.activityId;

  if (Boolean(nextSubjectId) === Boolean(nextActivityId)) {
    return NextResponse.json(
      { error: "Choose either a subject or an activity" },
      { status: 400 }
    );
  }

  const startTime = parsed.data.startTime
    ? parseTimeOfDay(parsed.data.startTime)
    : existing.startTime;
  const endTime = parsed.data.endTime
    ? parseTimeOfDay(parsed.data.endTime)
    : existing.endTime;
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

  let staffId: string | null =
    parsed.data.staffId !== undefined ? parsed.data.staffId : existing.staffId;

  if (nextSubjectId) {
    const assignment = await prisma.teacherSubject.findFirst({
      where: {
        classSectionId: existing.classSectionId,
        subjectId: nextSubjectId,
        academicYearId: existing.academicYearId,
      },
    });
    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Assign a teacher to this class subject before updating the timetable slot",
        },
        { status: 400 }
      );
    }
    staffId = assignment.staffId;
  } else if (nextActivityId) {
    const applies = await activityAppliesToGradeLevel(
      nextActivityId,
      existing.classSection.gradeLevelId
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

  const dayOfWeek = parsed.data.dayOfWeek ?? existing.dayOfWeek;

  const collisions = await findTimetableCollisions({
    termId: existing.termId,
    classSectionId: existing.classSectionId,
    staffId,
    dayOfWeek,
    startTime,
    endTime,
    excludeId: id,
  });
  if (collisions.length > 0) {
    return NextResponse.json(
      { error: collisions.map((c) => c.message).join(" "), collisions },
      { status: 409 }
    );
  }

  try {
    const slot = await prisma.timetableSlot.update({
      where: { id },
      data: {
        subjectId: nextSubjectId,
        activityId: nextActivityId,
        staffId,
        dayOfWeek,
        startTime,
        endTime,
        room:
          parsed.data.room === undefined
            ? existing.room
            : parsed.data.room?.trim() || null,
      },
      include: {
        subject: true,
        activity: true,
        staff: true,
        classSection: { include: { gradeLevel: true } },
      },
    });
    return NextResponse.json({
      ...slot,
      startTimeLabel: formatTimeOfDay(slot.startTime),
      endTimeLabel: formatTimeOfDay(slot.endTime),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not update timetable slot" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canWriteTimetable(session.user.permissions)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  try {
    await prisma.timetableSlot.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Slot not found" }, { status: 404 });
  }
}
