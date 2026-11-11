import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import { formatTimeOfDay } from "@/lib/subjects-for-level";

export default async function ParentPortalPage() {
  const session = await requirePermission("wards.read");

  const guardian = await prisma.guardian.findFirst({
    where: { userId: session.user.id },
    include: {
      students: {
        include: {
          student: {
            include: {
              currentClassSection: { include: { gradeLevel: true } },
            },
          },
        },
      },
    },
  });

  if (!guardian) {
    return (
      <>
        <Topbar title="My wards" backHref="/admin" backLabel="Dashboard" />
        <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
          <PageHeader description="Parent timetable view for linked children." />
          <Card>
            <CardBody className="text-xs text-[var(--muted-foreground)]">
              Your login is not linked to a parent/guardian profile yet. Ask the
              school office to connect your account.
            </CardBody>
          </Card>
        </main>
      </>
    );
  }

  const currentTerm = await prisma.term.findFirst({
    where: { isCurrent: true },
    include: { academicYear: true },
  });

  const wards = guardian.students.map((link) => link.student);

  const classIds = wards
    .map((w) => w.currentClassSectionId)
    .filter((id): id is string => Boolean(id));

  const slots =
    currentTerm && classIds.length > 0
      ? await prisma.timetableSlot.findMany({
          where: {
            termId: currentTerm.id,
            classSectionId: { in: classIds },
          },
          include: {
            subject: true,
            activity: true,
            staff: true,
            classSection: { include: { gradeLevel: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : [];

  const slotsByClass = new Map<string, typeof slots>();
  for (const slot of slots) {
    const list = slotsByClass.get(slot.classSectionId) || [];
    list.push(slot);
    slotsByClass.set(slot.classSectionId, list);
  }

  return (
    <>
      <Topbar title="My wards" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description={
            currentTerm
              ? `Class timetables for ${currentTerm.academicYear.name} · ${currentTerm.name}.`
              : "No current term is set."
          }
        />

        {wards.length === 0 ? (
          <Card>
            <CardBody className="text-xs text-[var(--muted-foreground)]">
              No students are linked to your parent profile.
            </CardBody>
          </Card>
        ) : (
          wards.map((ward) => {
            const classLabel = ward.currentClassSection
              ? `${ward.currentClassSection.gradeLevel.code} ${ward.currentClassSection.name}`
              : "No current class";
            const wardSlots = ward.currentClassSectionId
              ? slotsByClass.get(ward.currentClassSectionId) || []
              : [];

            return (
              <Card key={ward.id}>
                <CardHeader>
                  <CardTitle>
                    {ward.firstName} {ward.lastName} · {classLabel}
                  </CardTitle>
                </CardHeader>
                <CardBody className="pt-1.5">
                  {!currentTerm ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      Ask the school to set a current term.
                    </p>
                  ) : !ward.currentClassSectionId ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      This student has no current class placement.
                    </p>
                  ) : wardSlots.length === 0 ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      No timetable published for this class yet.
                    </p>
                  ) : (
                    <TimetableGrid
                      slots={wardSlots.map((slot) => {
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
                            ? slot.activity?.name ||
                              slot.activity?.code ||
                              "Activity"
                            : slot.subject?.code || "Subject",
                          subtitle: slot.staff
                            ? `${slot.staff.firstName} ${slot.staff.lastName}`
                            : null,
                        };
                      })}
                    />
                  )}
                </CardBody>
              </Card>
            );
          })
        )}
      </main>
    </>
  );
}
