import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSizeBootstrap } from "@/components/table/page-size-bootstrap";
import { TableFilters } from "@/components/table/table-filters";
import { TablePagination } from "@/components/table/table-pagination";
import { getTotalPages, parsePage, parsePageSize } from "@/lib/table";
import { ClassForm } from "./class-form";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("academics.read");
  const canWrite = can(session.user.permissions, "academics.write");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const gradeLevelId = param(params.gradeLevelId) || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.ClassSectionWhereInput = {
    academicYear: { isCurrent: true },
    AND: [
      q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { room: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      gradeLevelId ? { gradeLevelId } : {},
    ],
  };

  const [year, levels, staff, total, classes] = await Promise.all([
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    prisma.gradeLevel.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.staff.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.classSection.count({ where }),
    prisma.classSection.findMany({
      where,
      include: {
        gradeLevel: true,
        classTeacher: true,
        _count: { select: { currentStudents: true, teacherSubjects: true } },
      },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = getTotalPages(total, pageSize);

  return (
    <>
      <Topbar title="Classes / Sections" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader
          description={`Class groups for the current year${year ? ` (${year.name})` : ""}.`}
          actions={
            canWrite ? (
              <ClassForm
                academicYearId={year?.id || null}
                levels={levels.map((l) => ({
                  id: l.id,
                  label: `${l.code} — ${l.name}`,
                }))}
                staff={staff.map((s) => ({
                  id: s.id,
                  label: `${s.firstName} ${s.lastName}`,
                }))}
              />
            ) : null
          }
        />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Class name or room…",
              },
              {
                key: "gradeLevelId",
                label: "Level",
                type: "select",
                options: levels.map((l) => ({
                  value: l.id,
                  label: `${l.code} — ${l.name}`,
                })),
              },
            ]}
          />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>Current year classes ({total})</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Level</th>
                    <th className="pb-2 font-medium">Class teacher</th>
                    <th className="pb-2 font-medium">Subject teachers</th>
                    <th className="pb-2 font-medium">Students</th>
                    <th className="pb-2 font-medium">Room</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-[var(--muted-foreground)]">
                        No classes match your filters.
                      </td>
                    </tr>
                  ) : (
                    classes.map((c) => (
                      <tr key={c.id} className="border-t border-[var(--border)]">
                        <td className="py-2">{c.name}</td>
                        <td className="py-2">{c.gradeLevel.code}</td>
                        <td className="py-2">
                          {c.classTeacher
                            ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}`
                            : "—"}
                        </td>
                        <td className="py-2">{c._count.teacherSubjects}</td>
                        <td className="py-2">{c._count.currentStudents}</td>
                        <td className="py-2">{c.room || "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <Suspense fallback={null}>
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
              />
            </Suspense>
          </CardBody>
        </Card>
      </main>
    </>
  );
}
