import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AcademicYearForm } from "./year-form";

export default async function AcademicYearsPage() {
  const session = await requirePermission("academics.read");
  const canWrite = can(session.user.permissions, "academics.write");

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });

  return (
    <>
      <Topbar title="Years & Terms" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description="Manage academic years and the terms within each year."
          actions={canWrite ? <AcademicYearForm /> : null}
        />

        <div className="grid gap-2.5">
          {years.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-xs text-[var(--muted-foreground)]">
                  No academic years yet.
                </p>
              </CardBody>
            </Card>
          ) : (
            years.map((year) => (
              <Card key={year.id}>
                <CardHeader>
                  <CardTitle>
                    {year.name}
                    {year.isCurrent ? (
                      <span className="ml-2 text-[10px] font-medium text-[var(--brand-primary)]">
                        Current
                      </span>
                    ) : null}
                  </CardTitle>
                </CardHeader>
                <CardBody className="pt-1.5">
                  <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
                    {year.startDate.toLocaleDateString()} –{" "}
                    {year.endDate.toLocaleDateString()}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {year.terms.map((term) => (
                      <span
                        key={term.id}
                        className="rounded-md border border-[var(--border)] px-2 py-0.5 text-[11px]"
                      >
                        {term.name}
                        {term.isCurrent ? " · current" : ""}
                      </span>
                    ))}
                  </div>
                </CardBody>
              </Card>
            ))
          )}
        </div>
      </main>
    </>
  );
}
