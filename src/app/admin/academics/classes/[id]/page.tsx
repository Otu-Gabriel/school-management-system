import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ClickableRow } from "@/components/table/clickable-row";
import { formatDateOnly, isDateWithinInclusive } from "@/lib/dates";
import {
  activitiesForGradeLevel,
  formatTimeOfDay,
  subjectsForGradeLevel,
} from "@/lib/subjects-for-level";
import { ClassActions } from "../class-actions";
import { ClassSubjectsPanel } from "./class-subjects-panel";
import { ClassTimetablePanel } from "./class-timetable-panel";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClassDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("academics.read");
  const canWrite = can(session.user.permissions, "academics.write");
  const canAssign = can(session.user.permissions, "assignments.write");
  const canWriteTimetable =
    canAssign || can(session.user.permissions, "academics.write");
  const { id } = await params;
  const sp = await searchParams;
  const yearIdParam = param(sp.yearId) || "";
  const termId = param(sp.termId) || "";

  const classSection = await prisma.classSection.findUnique({
    where: { id },
    include: {
      gradeLevel: true,
      classTeacher: true,
      academicYear: { include: { terms: { orderBy: { termNumber: "asc" } } } },
    },
  });
  if (!classSection) notFound();

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });
  const selectedYear =
    years.find((y) => y.id === yearIdParam) ||
    years.find((y) => y.id === classSection.academicYearId) ||
    years.find((y) => y.isCurrent) ||
    null;
  const selectedYearId = selectedYear?.id || classSection.academicYearId;
  // Term comes from the classes list filter (URL). Fall back to current/first
  // term of the year — no second term picker on this page.
  const selectedTerm =
    selectedYear?.terms.find((t) => t.id === termId) ||
    selectedYear?.terms.find((t) => t.isCurrent) ||
    selectedYear?.terms[0] ||
    null;

  const [
    levels,
    staff,
    enrollments,
    levelSubjects,
    levelActivities,
    teacherSubjects,
    timetableSlots,
  ] = await Promise.all([
    prisma.gradeLevel.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.staff.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.enrollment.findMany({
      where: {
        classSectionId: id,
        academicYearId: selectedYearId,
      },
      include: {
        student: true,
      },
      orderBy: [
        { student: { lastName: "asc" } },
        { student: { firstName: "asc" } },
      ],
    }),
    subjectsForGradeLevel(classSection.gradeLevelId),
    activitiesForGradeLevel(classSection.gradeLevelId),
    prisma.teacherSubject.findMany({
      where: {
        classSectionId: id,
        academicYearId: classSection.academicYearId,
      },
      include: { staff: true, subject: true },
    }),
    selectedTerm
      ? prisma.timetableSlot.findMany({
          where: {
            classSectionId: id,
            termId: selectedTerm.id,
          },
          include: { subject: true, activity: true, staff: true },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  const assignmentBySubject = new Map(
    teacherSubjects.map((row) => [row.subjectId, row] as const)
  );

  const filtered = selectedTerm
    ? enrollments.filter((row) => {
        if (row.termId === selectedTerm.id) return true;
        const start = row.startedOn;
        const end = row.endedOn || selectedTerm.endDate;
        return (
          isDateWithinInclusive(start, selectedTerm.startDate, selectedTerm.endDate) ||
          isDateWithinInclusive(end, selectedTerm.startDate, selectedTerm.endDate) ||
          (start.getTime() <= selectedTerm.startDate.getTime() &&
            end.getTime() >= selectedTerm.endDate.getTime())
        );
      })
    : enrollments;

  // Prefer current placement rows; de-dupe by student.
  const byStudent = new Map<
    string,
    (typeof filtered)[number]
  >();
  for (const row of filtered) {
    const existing = byStudent.get(row.studentId);
    if (!existing || row.isCurrent || (!existing.isCurrent && row.startedOn > existing.startedOn)) {
      byStudent.set(row.studentId, row);
    }
  }
  const students = Array.from(byStudent.values());

  const qs = new URLSearchParams();
  qs.set("yearId", selectedYearId);
  if (selectedTerm) qs.set("termId", selectedTerm.id);
  const query = qs.toString();

  const levelOptions = levels.map((l) => ({
    id: l.id,
    label: `${l.code} — ${l.name}`,
  }));
  const staffOptions = staff.map((s) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName}`,
  }));

  return (
    <>
      <Topbar
        title={`${classSection.gradeLevel.code} ${classSection.name}`}
        backHref={`/admin/academics/classes?${query}`}
        backLabel="Classes"
      />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description={`Class details and students for ${selectedYear?.name || "selected year"}${selectedTerm ? ` · ${selectedTerm.name}` : ""}.`}
          actions={
            canWrite ? (
              <ClassActions
                canWrite={canWrite}
                academicYearId={selectedYearId}
                levels={levelOptions}
                staff={staffOptions}
                classItem={{
                  id: classSection.id,
                  gradeLevelId: classSection.gradeLevelId,
                  name: classSection.name,
                  section: classSection.section || "",
                  classTeacherId: classSection.classTeacherId || "",
                  room: classSection.room || "",
                  isActive: classSection.isActive,
                }}
              />
            ) : null
          }
        />

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardBody className="py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                Level
              </p>
              <p className="text-xs font-semibold">
                {classSection.gradeLevel.code} — {classSection.gradeLevel.name}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                Class teacher
              </p>
              <p className="text-xs font-semibold">
                {classSection.classTeacher
                  ? `${classSection.classTeacher.firstName} ${classSection.classTeacher.lastName}`
                  : "Unassigned"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                Room / status
              </p>
              <p className="text-xs font-semibold">
                {classSection.room || "No room"} ·{" "}
                {classSection.isActive ? "Active" : "Archived"}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                Students in view
              </p>
              <p className="text-xs font-semibold">{students.length}</p>
            </CardBody>
          </Card>
        </div>

        <ClassSubjectsPanel
          classSectionId={id}
          canWrite={canAssign}
          staff={staffOptions}
          subjects={levelSubjects.map((subject) => {
            const assignment = assignmentBySubject.get(subject.id);
            return {
              id: subject.id,
              code: subject.code,
              name: subject.name,
              isCore: subject.isCore,
              assignmentId: assignment?.id || null,
              staffId: assignment?.staffId || null,
              staffLabel: assignment
                ? `${assignment.staff.firstName} ${assignment.staff.lastName}`
                : null,
            };
          })}
        />

        <ClassTimetablePanel
          classSectionId={id}
          academicYearId={classSection.academicYearId}
          termId={selectedTerm?.id || null}
          termName={selectedTerm?.name || null}
          canWrite={canWriteTimetable}
          staff={staffOptions}
          assignedSubjects={teacherSubjects.map((row) => ({
            subjectId: row.subjectId,
            code: row.subject.code,
            name: row.subject.name,
            staffId: row.staffId,
            staffLabel: `${row.staff.firstName} ${row.staff.lastName}`,
          }))}
          activities={levelActivities.map((activity) => ({
            id: activity.id,
            code: activity.code,
            name: activity.name,
          }))}
          slots={timetableSlots.map((slot) => {
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
              subtitle: slot.staff
                ? `${slot.staff.firstName} ${slot.staff.lastName}`
                : null,
              subjectId: slot.subjectId,
              activityId: slot.activityId,
              staffId: slot.staffId,
            };
          })}
        />

        <Card>
          <CardHeader>
            <CardTitle>Students ({students.length})</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Photo</th>
                    <th className="pb-2 font-medium">Admission</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Gender</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Placement</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No students found for this class in the selected year
                        {selectedTerm ? "/term" : ""}.
                      </td>
                    </tr>
                  ) : (
                    students.map((row) => {
                      const s = row.student;
                      const href = `/admin/academics/classes/${id}/students/${s.id}?${query}`;
                      return (
                        <ClickableRow key={s.id} href={href}>
                          <td className="py-2">
                            <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-md bg-[var(--muted)] text-[10px] font-semibold text-[var(--muted-foreground)]">
                              {s.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={s.photoUrl}
                                  alt={`${s.firstName} ${s.lastName}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                `${s.firstName[0] || ""}${s.lastName[0] || ""}`.toUpperCase()
                              )}
                            </div>
                          </td>
                          <td className="py-2 text-[var(--brand-primary)]">
                            {s.admissionNo}
                          </td>
                          <td className="py-2 font-medium">
                            {s.firstName} {s.lastName}
                          </td>
                          <td className="py-2">{s.gender || "—"}</td>
                          <td className="py-2">{s.status}</td>
                          <td className="py-2 text-[var(--muted-foreground)]">
                            {row.status}
                            {row.isCurrent ? " · current" : ""}
                            {" · "}
                            {formatDateOnly(row.startedOn)}
                          </td>
                        </ClickableRow>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </main>
    </>
  );
}
