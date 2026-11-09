import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { PageSizeBootstrap } from "@/components/table/page-size-bootstrap";
import { TableFilters } from "@/components/table/table-filters";
import { TablePagination } from "@/components/table/table-pagination";
import { getTotalPages, parsePage, parsePageSize } from "@/lib/table";
import { AssignmentsManager } from "./assignments-manager";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AssignmentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("assignments.read");
  const canWrite = can(session.user.permissions, "assignments.write");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const academicYearId = param(params.academicYearId) || "";
  const staffId = param(params.staffId) || "";
  const subjectId = param(params.subjectId) || "";
  const classSectionId = param(params.classSectionId) || "";
  const skip = (page - 1) * pageSize;

  const currentYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
  });
  const effectiveYearId = academicYearId || currentYear?.id || "";

  const where: Prisma.TeacherSubjectWhereInput = {
    AND: [
      effectiveYearId ? { academicYearId: effectiveYearId } : {},
      staffId ? { staffId } : {},
      subjectId ? { subjectId } : {},
      classSectionId ? { classSectionId } : {},
      q
        ? {
            OR: [
              { staff: { firstName: { contains: q, mode: "insensitive" } } },
              { staff: { lastName: { contains: q, mode: "insensitive" } } },
              { subject: { name: { contains: q, mode: "insensitive" } } },
              { subject: { code: { contains: q, mode: "insensitive" } } },
              { classSection: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {},
    ],
  };

  const [total, assignments, years, classes, subjects, teachers] =
    await Promise.all([
      prisma.teacherSubject.count({ where }),
      prisma.teacherSubject.findMany({
        where,
        include: {
          staff: true,
          subject: true,
          classSection: { include: { gradeLevel: true } },
          academicYear: true,
        },
        orderBy: [
          { classSection: { gradeLevel: { sortOrder: "asc" } } },
          { classSection: { name: "asc" } },
          { subject: { name: "asc" } },
        ],
        skip,
        take: pageSize,
      }),
      prisma.academicYear.findMany({ orderBy: { startDate: "desc" } }),
      prisma.classSection.findMany({
        include: { gradeLevel: true, academicYear: true },
        orderBy: [
          { academicYear: { startDate: "desc" } },
          { gradeLevel: { sortOrder: "asc" } },
          { name: "asc" },
        ],
      }),
      prisma.subject.findMany({ orderBy: { name: "asc" } }),
      prisma.staff.findMany({
        where: { status: "ACTIVE" },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      }),
    ]);

  const totalPages = getTotalPages(total, pageSize);

  return (
    <>
      <Topbar title="Teaching assignments" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader description="Assign teachers to subjects and classes for each academic year." />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Teacher, subject, class…",
              },
              {
                key: "academicYearId",
                label: "Year",
                type: "select",
                options: years.map((y) => ({
                  value: y.id,
                  label: `${y.name}${y.isCurrent ? " (current)" : ""}`,
                })),
              },
              {
                key: "staffId",
                label: "Teacher",
                type: "select",
                options: teachers.map((t) => ({
                  value: t.id,
                  label: `${t.firstName} ${t.lastName}`,
                })),
              },
              {
                key: "subjectId",
                label: "Subject",
                type: "select",
                options: subjects.map((s) => ({
                  value: s.id,
                  label: `${s.code} — ${s.name}`,
                })),
              },
              {
                key: "classSectionId",
                label: "Class",
                type: "select",
                options: classes
                  .filter((c) => !effectiveYearId || c.academicYearId === effectiveYearId)
                  .map((c) => ({
                    value: c.id,
                    label: `${c.gradeLevel.code} ${c.name}`,
                  })),
              },
            ]}
          />
        </Suspense>

        <AssignmentsManager
          canWrite={canWrite}
          total={total}
          years={years.map((y) => ({
            id: y.id,
            label: `${y.name}${y.isCurrent ? " (current)" : ""}`,
          }))}
          classes={classes.map((c) => ({
            id: c.id,
            label: `${c.gradeLevel.code} ${c.name} · ${c.academicYear.name}`,
            academicYearId: c.academicYearId,
          }))}
          subjects={subjects.map((s) => ({
            id: s.id,
            label: `${s.code} — ${s.name}`,
          }))}
          teachers={teachers.map((t) => ({
            id: t.id,
            label: `${t.firstName} ${t.lastName}`,
          }))}
          assignments={assignments.map((a) => ({
            id: a.id,
            staffId: a.staffId,
            subjectId: a.subjectId,
            classSectionId: a.classSectionId,
            academicYearId: a.academicYearId,
            teacherName: `${a.staff.firstName} ${a.staff.lastName}`,
            subjectName: `${a.subject.code} — ${a.subject.name}`,
            className: `${a.classSection.gradeLevel.code} ${a.classSection.name}`,
            yearName: a.academicYear.name,
          }))}
          pagination={
            <Suspense fallback={null}>
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
              />
            </Suspense>
          }
        />
      </main>
    </>
  );
}
