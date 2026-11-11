import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { getSchoolSettings } from "@/lib/school";
import { ReportCardEditor } from "./report-card-editor";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ studentId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("marks.read");
  const canWrite = can(session.user.permissions, "marks.write");
  const canPublish = can(session.user.permissions, "marks.publish");
  const { studentId } = await params;
  const sp = await searchParams;
  const yearId = param(sp.yearId) || "";
  const termId = param(sp.termId) || "";
  const classSectionId = param(sp.classSectionId) || "";

  const [student, term, classSection, school] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId } }),
    prisma.term.findUnique({
      where: { id: termId },
      include: { academicYear: true },
    }),
    prisma.classSection.findUnique({
      where: { id: classSectionId },
      include: { gradeLevel: true, classTeacher: true },
    }),
    getSchoolSettings(),
  ]);

  if (!student || !term || !classSection) notFound();

  const [marks, card] = await Promise.all([
    prisma.studentMark.findMany({
      where: {
        studentId,
        termId,
        classSectionId,
      },
      include: { subject: true },
      orderBy: { subject: { name: "asc" } },
    }),
    prisma.reportCard.findUnique({
      where: { studentId_termId: { studentId, termId } },
    }),
  ]);

  const totals = marks
    .map((m) => m.total)
    .filter((t): t is number => t != null);
  const average =
    totals.length > 0
      ? totals.reduce((a, b) => a + b, 0) / totals.length
      : null;

  const backQs = new URLSearchParams({
    yearId: yearId || term.academicYearId,
    termId,
    classSectionId,
  });

  return (
    <>
      <Topbar
        title={`${student.firstName} ${student.lastName}`}
        backHref={`/admin/academics/reports?${backQs.toString()}`}
        backLabel="Reports"
      />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4 print:p-6">
        <PageHeader
          description={`${school.name} · ${term.academicYear.name} · ${term.name} · ${classSection.gradeLevel.code} ${classSection.name}`}
          actions={
            <ReportCardEditor
              studentId={studentId}
              classSectionId={classSectionId}
              academicYearId={term.academicYearId}
              termId={termId}
              teacherRemark={card?.teacherRemark || ""}
              published={Boolean(card?.publishedAt)}
              canWrite={canWrite}
              canPublish={canPublish}
            />
          }
        />

        <Card className="print:border-0 print:shadow-none">
          <CardHeader>
            <CardTitle>Subject results</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Subject</th>
                    <th className="pb-2 font-medium">CA</th>
                    <th className="pb-2 font-medium">Exam</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {marks.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No marks entered for this term yet.
                      </td>
                    </tr>
                  ) : (
                    marks.map((mark) => (
                      <tr
                        key={mark.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="py-2">
                          {mark.subject.code} — {mark.subject.name}
                        </td>
                        <td className="py-2">{mark.classScore ?? "—"}</td>
                        <td className="py-2">{mark.examScore ?? "—"}</td>
                        <td className="py-2">
                          {mark.total == null ? "—" : mark.total.toFixed(1)}
                        </td>
                        <td className="py-2">{mark.gradeLabel || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs font-medium">
              Average: {average == null ? "—" : average.toFixed(1)}
            </p>
            {card?.teacherRemark ? (
              <p className="mt-2 text-xs text-[var(--muted-foreground)]">
                Class teacher remark: {card.teacherRemark}
              </p>
            ) : null}
          </CardBody>
        </Card>
      </main>
    </>
  );
}
