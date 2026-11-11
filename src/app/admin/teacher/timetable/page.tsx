import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { prisma } from "@/lib/prisma";
import { getStaffForUser } from "@/lib/access-scope";
import { formatTimeOfDay } from "@/lib/subjects-for-level";

export default async function TeacherTimetablePage() {
  const session = await requirePermission("attendance.read");
  const staff = await getStaffForUser(session.user.id);

  const currentTerm = await prisma.term.findFirst({
    where: { isCurrent: true },
    include: { academicYear: true },
  });

  const slots =
    staff && currentTerm
      ? await prisma.timetableSlot.findMany({
          where: {
            staffId: staff.id,
            termId: currentTerm.id,
          },
          include: {
            subject: true,
            activity: true,
            classSection: { include: { gradeLevel: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : [];

  return (
    <>
      <Topbar
        title="My timetable"
        backHref="/admin/teacher"
        backLabel="My teaching"
      />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description={
            currentTerm
              ? `Your teaching times for ${currentTerm.academicYear.name} · ${currentTerm.name}.`
              : "No current term is set."
          }
        />

        {!staff ? (
          <Card>
            <CardBody className="text-xs text-[var(--muted-foreground)]">
              Your login is not linked to a staff profile yet.
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Weekly schedule ({slots.length})</CardTitle>
            </CardHeader>
            <CardBody className="pt-1.5">
              {!currentTerm ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  Ask an admin to mark a term as current.
                </p>
              ) : slots.length === 0 ? (
                <p className="text-xs text-[var(--muted-foreground)]">
                  No timetable slots assigned to you for the current term.
                </p>
              ) : (
                <TimetableGrid
                  slots={slots.map((slot) => {
                    const isActivity = Boolean(slot.activityId);
                    return {
                      id: slot.id,
                      dayOfWeek: slot.dayOfWeek,
                      startTime: formatTimeOfDay(slot.startTime),
                      endTime: formatTimeOfDay(slot.endTime),
                      room: slot.room,
                      kind: (isActivity ? "activity" : "subject") as
                        | "activity"
                        | "subject",
                      title: isActivity
                        ? slot.activity?.name || slot.activity?.code || "Activity"
                        : slot.subject?.code || "Subject",
                      subtitle: `${slot.classSection.gradeLevel.code} ${slot.classSection.name}`,
                      classLabel: slot.room || undefined,
                    };
                  })}
                />
              )}
            </CardBody>
          </Card>
        )}
      </main>
    </>
  );
}
