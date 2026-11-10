import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { getSchoolSettings } from "@/lib/school";
import { formatDateOnly } from "@/lib/dates";
import { AcademicYearForm } from "./year-form";
import { YearsManager } from "./years-manager";

export default async function AcademicYearsPage() {
  const session = await requirePermission("academics.read");
  const canWrite = can(session.user.permissions, "academics.write");

  const [years, holidays, settings] = await Promise.all([
    prisma.academicYear.findMany({
      orderBy: { startDate: "desc" },
      include: { terms: { orderBy: { termNumber: "asc" } } },
    }),
    prisma.calendarException.findMany({
      orderBy: { date: "asc" },
      include: { term: { select: { id: true, name: true } } },
    }),
    getSchoolSettings(),
  ]);

  return (
    <>
      <Topbar title="Years & Terms" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader
          description="Work in the current academic year by default. Switch years to review calendars, terms, and holidays."
          actions={canWrite ? <AcademicYearForm /> : null}
        />

        <YearsManager
          canWrite={canWrite}
          weekendClosed={settings.weekendClosed}
          years={years.map((year) => ({
            id: year.id,
            name: year.name,
            startDate: formatDateOnly(year.startDate),
            endDate: formatDateOnly(year.endDate),
            isCurrent: year.isCurrent,
            terms: year.terms.map((term) => ({
              id: term.id,
              name: term.name,
              termNumber: term.termNumber,
              startDate: formatDateOnly(term.startDate),
              endDate: formatDateOnly(term.endDate),
              isCurrent: term.isCurrent,
              isLocked: term.isLocked,
            })),
          }))}
          holidays={holidays.map((item) => ({
            id: item.id,
            date: formatDateOnly(item.date),
            type: item.type,
            name: item.name,
            termId: item.termId,
            academicYearId: item.academicYearId,
          }))}
        />
      </main>
    </>
  );
}
