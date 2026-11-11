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
        <Topbar title="My wards" />
        <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
          <PageHeader description="Parent view for linked children’s timetable, attendance, results, and fees." />
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
  const studentIds = wards.map((w) => w.id);

  const [slots, attendance, marks, reportCards, invoices] = await Promise.all([
    currentTerm && classIds.length > 0
      ? prisma.timetableSlot.findMany({
          where: {
            termId: currentTerm.id,
            classSectionId: { in: classIds },
          },
          include: {
            subject: true,
            activity: true,
            staff: true,
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
    currentTerm && classIds.length > 0
      ? prisma.attendanceRecord.findMany({
          where: {
            studentId: { in: studentIds },
            termId: currentTerm.id,
          },
        })
      : Promise.resolve([]),
    currentTerm
      ? prisma.studentMark.findMany({
          where: {
            studentId: { in: studentIds },
            termId: currentTerm.id,
          },
          include: { subject: true },
          orderBy: { subject: { name: "asc" } },
        })
      : Promise.resolve([]),
    currentTerm
      ? prisma.reportCard.findMany({
          where: {
            studentId: { in: studentIds },
            termId: currentTerm.id,
            publishedAt: { not: null },
          },
        })
      : Promise.resolve([]),
    prisma.feeInvoice.findMany({
      where: {
        studentId: { in: studentIds },
        ...(currentTerm ? { academicYearId: currentTerm.academicYearId } : {}),
      },
      include: { feeType: true, payments: true },
    }),
  ]);

  const slotsByClass = new Map<string, typeof slots>();
  for (const slot of slots) {
    const list = slotsByClass.get(slot.classSectionId) || [];
    list.push(slot);
    slotsByClass.set(slot.classSectionId, list);
  }

  const published = new Set(reportCards.map((c) => c.studentId));

  return (
    <>
      <Topbar title="My wards" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description={
            currentTerm
              ? `${currentTerm.academicYear.name} · ${currentTerm.name}`
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
            const wardAttendance = attendance.filter(
              (a) => a.studentId === ward.id
            );
            const present = wardAttendance.filter(
              (a) => a.status === "PRESENT" || a.status === "LATE"
            ).length;
            const absent = wardAttendance.filter(
              (a) => a.status === "ABSENT"
            ).length;
            const wardMarks = published.has(ward.id)
              ? marks.filter((m) => m.studentId === ward.id)
              : [];
            const wardInvoices = invoices.filter((i) => i.studentId === ward.id);
            const feeBalance = wardInvoices.reduce((sum, inv) => {
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
              return sum + Math.max(0, inv.amount - paid);
            }, 0);

            return (
              <Card key={ward.id}>
                <CardHeader>
                  <CardTitle>
                    {ward.firstName} {ward.lastName} · {classLabel}
                  </CardTitle>
                </CardHeader>
                <CardBody className="space-y-4 pt-1.5">
                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                      Attendance
                    </h3>
                    {!currentTerm ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        No current term.
                      </p>
                    ) : (
                      <p className="text-xs">
                        Present/Late: {present} · Absent: {absent} · Days
                        recorded: {wardAttendance.length}
                      </p>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                      Fees
                    </h3>
                    <p className="text-xs">
                      Outstanding balance: {feeBalance.toFixed(2)} · Invoices:{" "}
                      {wardInvoices.length}
                    </p>
                  </section>

                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                      Results
                    </h3>
                    {!currentTerm ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        No current term.
                      </p>
                    ) : !published.has(ward.id) ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Report card not published yet.
                      </p>
                    ) : wardMarks.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        No subject marks available.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="text-[var(--muted-foreground)]">
                            <tr>
                              <th className="pb-1 font-medium">Subject</th>
                              <th className="pb-1 font-medium">CA</th>
                              <th className="pb-1 font-medium">Exam</th>
                              <th className="pb-1 font-medium">Total</th>
                              <th className="pb-1 font-medium">Grade</th>
                            </tr>
                          </thead>
                          <tbody>
                            {wardMarks.map((mark) => (
                              <tr
                                key={mark.id}
                                className="border-t border-[var(--border)]"
                              >
                                <td className="py-1">{mark.subject.code}</td>
                                <td className="py-1">
                                  {mark.classScore ?? "—"}
                                </td>
                                <td className="py-1">
                                  {mark.examScore ?? "—"}
                                </td>
                                <td className="py-1">
                                  {mark.total == null
                                    ? "—"
                                    : mark.total.toFixed(1)}
                                </td>
                                <td className="py-1">
                                  {mark.gradeLabel || "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                      Timetable
                    </h3>
                    {!currentTerm ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        No current term.
                      </p>
                    ) : !ward.currentClassSectionId ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        No current class.
                      </p>
                    ) : wardSlots.length === 0 ? (
                      <p className="text-xs text-[var(--muted-foreground)]">
                        No timetable published yet.
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
                  </section>
                </CardBody>
              </Card>
            );
          })
        )}
      </main>
    </>
  );
}
