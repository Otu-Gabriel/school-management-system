import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { TableFilters } from "@/components/table/table-filters";
import { ClickableRow } from "@/components/table/clickable-row";
import { ReportsActions } from "./reports-actions";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("marks.read");
  const canWrite = can(session.user.permissions, "marks.write");
  const canPublish = can(session.user.permissions, "marks.publish");
  const params = await searchParams;
  const yearIdParam = param(params.yearId) || "";
  const termIdParam = param(params.termId) || "";
  const classSectionId = param(params.classSectionId) || "";

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });
  const selectedYear =
    years.find((y) => y.id === yearIdParam) ||
    years.find((y) => y.isCurrent) ||
    years[0] ||
    null;
  const terms = selectedYear?.terms || [];
  const selectedTerm =
    terms.find((t) => t.id === termIdParam) ||
    terms.find((t) => t.isCurrent) ||
    terms[0] ||
    null;

  const classes = selectedYear
    ? await prisma.classSection.findMany({
        where: { academicYearId: selectedYear.id, isActive: true },
        include: { gradeLevel: true },
        orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
      })
    : [];

  const selectedClass =
    classes.find((c) => c.id === classSectionId) || classes[0] || null;

  const enrollments =
    selectedClass && selectedTerm
      ? await prisma.enrollment.findMany({
          where: {
            classSectionId: selectedClass.id,
            academicYearId: selectedYear!.id,
            isCurrent: true,
          },
          include: { student: true },
          orderBy: [
            { student: { lastName: "asc" } },
            { student: { firstName: "asc" } },
          ],
        })
      : [];

  const studentIds = enrollments.map((e) => e.studentId);
  const [marks, cards] =
    selectedClass && selectedTerm && studentIds.length > 0
      ? await Promise.all([
          prisma.studentMark.findMany({
            where: {
              classSectionId: selectedClass.id,
              termId: selectedTerm.id,
              studentId: { in: studentIds },
            },
            include: { subject: true },
          }),
          prisma.reportCard.findMany({
            where: {
              classSectionId: selectedClass.id,
              termId: selectedTerm.id,
              studentId: { in: studentIds },
            },
          }),
        ])
      : [[], []];

  const cardByStudent = new Map(cards.map((c) => [c.studentId, c]));
  const marksByStudent = new Map<string, typeof marks>();
  for (const mark of marks) {
    const list = marksByStudent.get(mark.studentId) || [];
    list.push(mark);
    marksByStudent.set(mark.studentId, list);
  }

  return (
    <>
      <Topbar title="Report cards" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Generate and publish term report cards for a class." />

        <Suspense fallback={null}>
          <TableFilters
            defaultOpen
            defaults={{
              yearId: selectedYear?.id || "",
              termId: selectedTerm?.id || "",
              classSectionId: selectedClass?.id || "",
            }}
            fields={[
              {
                key: "yearId",
                label: "Year",
                type: "select",
                allowEmpty: false,
                options: years.map((y) => ({
                  value: y.id,
                  label: `${y.name}${y.isCurrent ? " (current)" : ""}`,
                })),
              },
              {
                key: "termId",
                label: "Term",
                type: "select",
                allowEmpty: false,
                options: terms.map((t) => ({
                  value: t.id,
                  label: `${t.name}${t.isCurrent ? " (current)" : ""}`,
                })),
              },
              {
                key: "classSectionId",
                label: "Class",
                type: "select",
                allowEmpty: false,
                options: classes.map((c) => ({
                  value: c.id,
                  label: `${c.gradeLevel.code} ${c.name}`,
                })),
              },
            ]}
          />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedClass
                ? `${selectedClass.gradeLevel.code} ${selectedClass.name}`
                : "Students"}{" "}
              ({enrollments.length})
              {selectedTerm ? ` · ${selectedTerm.name}` : ""}
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Admission</th>
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium">Subjects marked</th>
                    <th className="pb-2 font-medium">Average</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        Select year, term, and class to load students.
                      </td>
                    </tr>
                  ) : (
                    enrollments.map((row) => {
                      const studentMarks = marksByStudent.get(row.studentId) || [];
                      const card = cardByStudent.get(row.studentId);
                      const totals = studentMarks
                        .map((m) => m.total)
                        .filter((t): t is number => t != null);
                      const average =
                        totals.length > 0
                          ? totals.reduce((a, b) => a + b, 0) / totals.length
                          : null;
                      const href = `/admin/academics/reports/${row.studentId}?yearId=${selectedYear!.id}&termId=${selectedTerm!.id}&classSectionId=${selectedClass!.id}`;
                      return (
                        <ClickableRow key={row.studentId} href={href}>
                          <td className="py-2 text-[var(--brand-primary)]">
                            {row.student.admissionNo}
                          </td>
                          <td className="py-2 font-medium">
                            {row.student.firstName} {row.student.lastName}
                          </td>
                          <td className="py-2">{studentMarks.length}</td>
                          <td className="py-2">
                            {average == null ? "—" : average.toFixed(1)}
                          </td>
                          <td className="py-2">
                            {card?.publishedAt ? "Published" : "Draft"}
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-1.5">
                              <Link
                                href={href}
                                className="text-[11px] font-medium text-[var(--brand-primary)]"
                              >
                                Open
                              </Link>
                              {canWrite || canPublish ? (
                                <ReportsActions
                                  studentId={row.studentId}
                                  classSectionId={selectedClass!.id}
                                  academicYearId={selectedYear!.id}
                                  termId={selectedTerm!.id}
                                  published={Boolean(card?.publishedAt)}
                                  canWrite={canWrite}
                                  canPublish={canPublish}
                                />
                              ) : null}
                            </div>
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
