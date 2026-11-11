import Link from "next/link";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getStaffForUser } from "@/lib/access-scope";

export default async function TeacherMarksPage() {
  const session = await requirePermission("marks.write");
  const staff = await getStaffForUser(session.user.id);

  const currentTerm = await prisma.term.findFirst({
    where: { isCurrent: true },
    include: { academicYear: true },
  });

  const assignments = staff
    ? await prisma.teacherSubject.findMany({
        where: {
          staffId: staff.id,
          academicYear: { isCurrent: true },
        },
        include: {
          subject: true,
          classSection: { include: { gradeLevel: true } },
          academicYear: true,
        },
        orderBy: [
          { classSection: { gradeLevel: { sortOrder: "asc" } } },
          { subject: { name: "asc" } },
        ],
      })
    : [];

  return (
    <>
      <Topbar
        title="Enter marks"
        backHref="/admin/teacher"
        backLabel="My teaching"
      />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description={
            currentTerm
              ? `Open a class-subject for ${currentTerm.academicYear.name} · ${currentTerm.name}.`
              : "No current term is set."
          }
        />

        <Card>
          <CardHeader>
            <CardTitle>My subjects ({assignments.length})</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            {assignments.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                No teaching assignments for the current year.
              </p>
            ) : (
              <div className="space-y-2">
                {assignments.map((row) => {
                  const qs = new URLSearchParams({
                    yearId: row.academicYearId,
                    ...(currentTerm ? { termId: currentTerm.id } : {}),
                  });
                  return (
                    <div
                      key={row.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-2 first:border-t-0 first:pt-0"
                    >
                      <p className="text-xs font-medium">
                        {row.classSection.gradeLevel.code} {row.classSection.name}{" "}
                        · {row.subject.code}
                      </p>
                      <Link
                        href={`/admin/academics/classes/${row.classSectionId}?${qs.toString()}`}
                      >
                        <Button type="button" size="sm">
                          Enter marks
                        </Button>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </main>
    </>
  );
}
