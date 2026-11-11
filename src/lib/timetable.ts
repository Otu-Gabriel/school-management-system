import { prisma } from "@/lib/prisma";
import { timesOverlap } from "@/lib/subjects-for-level";

export type TimetableCollision = {
  type: "class" | "teacher";
  message: string;
};

function slotLabel(slot: {
  subject: { code: string } | null;
  activity: { code: string; name: string } | null;
  staff: { firstName: string; lastName: string } | null;
}) {
  if (slot.subject) {
    const teacher = slot.staff
      ? ` with ${slot.staff.firstName} ${slot.staff.lastName}`
      : "";
    return `${slot.subject.code}${teacher}`;
  }
  if (slot.activity) {
    return slot.activity.name || slot.activity.code;
  }
  return "a slot";
}

export async function findTimetableCollisions(input: {
  termId: string;
  classSectionId: string;
  staffId: string | null;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
  excludeId?: string;
}): Promise<TimetableCollision[]> {
  const collisions: TimetableCollision[] = [];

  const classSlots = await prisma.timetableSlot.findMany({
    where: {
      termId: input.termId,
      classSectionId: input.classSectionId,
      dayOfWeek: input.dayOfWeek,
      ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
    },
    include: {
      subject: true,
      activity: true,
      staff: true,
    },
  });

  const classHit = classSlots.find((slot) =>
    timesOverlap(input.startTime, input.endTime, slot.startTime, slot.endTime)
  );
  if (classHit) {
    collisions.push({
      type: "class",
      message: `This class already has ${slotLabel(classHit)} overlapping that time.`,
    });
  }

  if (input.staffId) {
    const teacherSlots = await prisma.timetableSlot.findMany({
      where: {
        termId: input.termId,
        staffId: input.staffId,
        dayOfWeek: input.dayOfWeek,
        ...(input.excludeId ? { id: { not: input.excludeId } } : {}),
      },
      include: {
        subject: true,
        activity: true,
        staff: true,
        classSection: { include: { gradeLevel: true } },
      },
    });

    const teacherHit = teacherSlots.find((slot) =>
      timesOverlap(input.startTime, input.endTime, slot.startTime, slot.endTime)
    );
    if (teacherHit) {
      collisions.push({
        type: "teacher",
        message: `Teacher already has ${slotLabel(teacherHit)} in ${teacherHit.classSection.gradeLevel.code} ${teacherHit.classSection.name} overlapping that time.`,
      });
    }
  }

  return collisions;
}
