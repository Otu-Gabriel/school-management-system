import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateOnly, isDateWithinInclusive } from "@/lib/dates";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClassStudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("students.read");
  const { id: classId, studentId } = await params;
  const sp = await searchParams;
  const yearIdParam = param(sp.yearId) || "";
  const termId = param(sp.termId) || "";

  const [classSection, student] = await Promise.all([
    prisma.classSection.findUnique({
      where: { id: classId },
      include: { gradeLevel: true, academicYear: true },
    }),
    prisma.student.findUnique({
      where: { id: studentId },
      include: {
        guardians: {
          include: { guardian: true },
          orderBy: { isPrimary: "desc" },
        },
        currentClassSection: { include: { gradeLevel: true } },
      },
    }),
  ]);

  if (!classSection || !student) notFound();

  const year =
    (yearIdParam
      ? await prisma.academicYear.findUnique({
          where: { id: yearIdParam },
          include: { terms: { orderBy: { termNumber: "asc" } } },
        })
      : null) ||
    (await prisma.academicYear.findUnique({
      where: { id: classSection.academicYearId },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    }));

  if (!year) notFound();

  const term = termId
    ? year.terms.find((t) => t.id === termId) || null
    : year.terms.find((t) => t.isCurrent) || null;

  const placements = await prisma.enrollment.findMany({
    where: {
      studentId,
      academicYearId: year.id,
    },
    include: {
      classSection: { include: { gradeLevel: true } },
      term: true,
    },
    orderBy: { startedOn: "asc" },
  });

  const termPlacements = term
    ? placements.filter((row) => {
        if (row.termId === term.id) return true;
        const end = row.endedOn || term.endDate;
        return (
          isDateWithinInclusive(row.startedOn, term.startDate, term.endDate) ||
          isDateWithinInclusive(end, term.startDate, term.endDate) ||
          (row.startedOn.getTime() <= term.startDate.getTime() &&
            end.getTime() >= term.endDate.getTime())
        );
      })
    : placements;

  const classPlacement =
    termPlacements.find((p) => p.classSectionId === classId && p.isCurrent) ||
    termPlacements.find((p) => p.classSectionId === classId) ||
    placements.find((p) => p.classSectionId === classId) ||
    null;

  const attendance = await prisma.attendanceRecord.findMany({
    where: {
      studentId,
      academicYearId: year.id,
      ...(term ? { termId: term.id } : {}),
      ...(classPlacement ? { classSectionId: classId } : {}),
    },
    orderBy: { date: "desc" },
    take: 30,
  });

  const present = attendance.filter(
    (a) => a.status === "PRESENT" || a.status === "LATE"
  ).length;
  const absent = attendance.filter((a) => a.status === "ABSENT").length;
  const late = attendance.filter((a) => a.status === "LATE").length;

  const qs = new URLSearchParams();
  qs.set("yearId", year.id);
  if (term) qs.set("termId", term.id);
  const backHref = `/admin/academics/classes/${classId}?${qs.toString()}`;
  const primary =
    student.guardians.find((g) => g.isPrimary) || student.guardians[0];

  return (
    <>
      <Topbar
        title={`${student.firstName} ${student.lastName}`}
        backHref={backHref}
        backLabel={`${classSection.gradeLevel.code} ${classSection.name}`}
      />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description={`Student record for ${year.name}${term ? ` · ${term.name}` : ""}. History below is scoped to this year${term ? "/term" : ""}.`}
        />

        <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
          <Card>
            <CardBody className="space-y-3">
              <div className="mx-auto flex h-36 w-36 items-center justify-center overflow-hidden rounded-lg bg-[var(--muted)] text-2xl font-semibold text-[var(--muted-foreground)]">
                {student.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={student.photoUrl}
                    alt={`${student.firstName} ${student.lastName}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  `${student.firstName[0] || ""}${student.lastName[0] || ""}`.toUpperCase()
                )}
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold">
                  {student.firstName} {student.lastName}
                </p>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {student.admissionNo}
                </p>
              </div>
            </CardBody>
          </Card>

          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Profile</CardTitle>
              </CardHeader>
              <CardBody className="grid gap-2 sm:grid-cols-2 pt-1.5 text-xs">
                <Info label="Gender" value={student.gender || "—"} />
                <Info label="Status" value={student.status} />
                <Info
                  label="Date of birth"
                  value={
                    student.dateOfBirth
                      ? formatDateOnly(student.dateOfBirth)
                      : "—"
                  }
                />
                <Info
                  label="Admission date"
                  value={
                    student.admissionDate
                      ? formatDateOnly(student.admissionDate)
                      : "—"
                  }
                />
                <Info
                  label="Current class (live)"
                  value={
                    student.currentClassSection
                      ? `${student.currentClassSection.gradeLevel.code} ${student.currentClassSection.name}`
                      : "—"
                  }
                />
                <Info
                  label="Class in selected period"
                  value={
                    classPlacement
                      ? `${classPlacement.classSection.gradeLevel.code} ${classPlacement.classSection.name} (${classPlacement.status})`
                      : "Not placed in this class for the selected period"
                  }
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Primary guardian</CardTitle>
              </CardHeader>
              <CardBody className="grid gap-2 sm:grid-cols-2 pt-1.5 text-xs">
                <Info
                  label="Name"
                  value={primary?.guardian.fullName || "—"}
                />
                <Info
                  label="Relationship"
                  value={primary?.relationship || "—"}
                />
                <Info label="Phone" value={primary?.guardian.phone || "—"} />
                <Info label="Email" value={primary?.guardian.email || "—"} />
              </CardBody>
            </Card>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              Placements in {year.name}
              {term ? ` · ${term.name}` : ""}
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Started</th>
                    <th className="pb-2 font-medium">Ended</th>
                    <th className="pb-2 font-medium">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(term ? termPlacements : placements).length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No placements for this period.
                      </td>
                    </tr>
                  ) : (
                    (term ? termPlacements : placements).map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="py-2 font-medium">
                          {row.classSection.gradeLevel.code}{" "}
                          {row.classSection.name}
                          {row.classSectionId === classId ? " · this class" : ""}
                        </td>
                        <td className="py-2">
                          {row.status}
                          {row.isCurrent ? " · current" : ""}
                        </td>
                        <td className="py-2">
                          {formatDateOnly(row.startedOn)}
                        </td>
                        <td className="py-2">
                          {row.endedOn ? formatDateOnly(row.endedOn) : "—"}
                        </td>
                        <td className="py-2">{row.reason || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Attendance snapshot
              {term ? ` · ${term.name}` : ` · ${year.name}`}
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-2 pt-1.5">
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Present/Late {present} · Absent {absent} · Late {late} (last{" "}
              {attendance.length} marked days in this view)
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Date</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.length === 0 ? (
                    <tr>
                      <td
                        colSpan={3}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No attendance records for this period.
                      </td>
                    </tr>
                  ) : (
                    attendance.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="py-2">{formatDateOnly(row.date)}</td>
                        <td className="py-2">{row.status}</td>
                        <td className="py-2">{row.remark || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[11px]">
              <Link
                href={`/admin/students/${student.id}/edit`}
                className="text-[var(--brand-primary)] hover:underline"
              >
                Open full student edit
              </Link>
            </p>
          </CardBody>
        </Card>
      </main>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}
