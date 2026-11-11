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
import { ClickableRow } from "@/components/table/clickable-row";
import { getTotalPages, parsePage, parsePageSize } from "@/lib/table";
import { ClassForm } from "./class-form";
import { ClassActions } from "./class-actions";

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
  const showArchived = param(params.archived) === "1";
  const yearIdParam = param(params.yearId) || "";
  const termId = param(params.termId) || "";
  const skip = (page - 1) * pageSize;

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });
  const currentYear = years.find((y) => y.isCurrent) || years[0] || null;
  const selectedYear =
    years.find((y) => y.id === yearIdParam) || currentYear;
  const selectedYearId = selectedYear?.id || "";
  const terms = selectedYear?.terms || [];
  // Keep year/term filters visually selected even when URL omits them.
  const yearFilterValue = yearIdParam || selectedYearId;
  const selectedTerm =
    terms.find((t) => t.id === termId) ||
    terms.find((t) => t.isCurrent) ||
    terms[0] ||
    null;
  const termFilterValue = selectedTerm?.id || "";

  const where: Prisma.ClassSectionWhereInput = {
    ...(selectedYearId ? { academicYearId: selectedYearId } : {}),
    ...(showArchived ? {} : { isActive: true }),
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

  const [levels, staff, total, classes] = await Promise.all([
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
        academicYear: true,
        _count: {
          select: {
            currentStudents: true,
            teacherSubjects: true,
            enrollments: true,
          },
        },
      },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
      skip,
      take: pageSize,
    }),
  ]);

  const levelOptions = levels.map((l) => ({
    id: l.id,
    label: `${l.code} — ${l.name}`,
  }));
  const staffOptions = staff.map((s) => ({
    id: s.id,
    label: `${s.firstName} ${s.lastName}`,
  }));
  const totalPages = getTotalPages(total, pageSize);

  function detailHref(classId: string) {
    const qs = new URLSearchParams();
    if (selectedYearId) qs.set("yearId", selectedYearId);
    if (termFilterValue) qs.set("termId", termFilterValue);
    const query = qs.toString();
    return `/admin/academics/classes/${classId}${query ? `?${query}` : ""}`;
  }

  return (
    <>
      <Topbar title="Classes / Sections" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader
          description="Filter by academic year and term, then open a class to view students. New years auto-copy active classes."
          actions={
            canWrite ? (
              <ClassForm
                academicYearId={selectedYearId || null}
                levels={levelOptions}
                staff={staffOptions}
              />
            ) : null
          }
        />

        <Suspense fallback={null}>
          <TableFilters
            defaultOpen
            defaults={{ yearId: yearFilterValue, termId: termFilterValue }}
            fields={[
              {
                key: "yearId",
                label: "Academic year",
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
              {
                key: "archived",
                label: "Status",
                type: "select",
                options: [
                  { value: "", label: "Active only" },
                  { value: "1", label: "Include archived" },
                ],
              },
            ]}
          />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedYear ? selectedYear.name : "Classes"} ({total})
              {selectedTerm ? ` · ${selectedTerm.name}` : ""}
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Level</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Class teacher</th>
                    <th className="pb-2 font-medium">Teachers</th>
                    <th className="pb-2 font-medium">Students</th>
                    <th className="pb-2 font-medium">Room</th>
                    {canWrite ? (
                      <th className="pb-2 font-medium text-right">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canWrite ? 8 : 7}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No classes match your filters.
                      </td>
                    </tr>
                  ) : (
                    classes.map((c) => (
                      <ClickableRow key={c.id} href={detailHref(c.id)}>
                        <td className="py-2 font-medium text-[var(--brand-primary)]">
                          {c.name}
                        </td>
                        <td className="py-2">{c.gradeLevel.code}</td>
                        <td className="py-2">
                          {c.isActive ? "Active" : "Archived"}
                        </td>
                        <td className="py-2">
                          {c.classTeacher
                            ? `${c.classTeacher.firstName} ${c.classTeacher.lastName}`
                            : "—"}
                        </td>
                        <td className="py-2">{c._count.teacherSubjects}</td>
                        <td className="py-2">
                          {selectedYear?.isCurrent
                            ? c._count.currentStudents
                            : c._count.enrollments}
                        </td>
                        <td className="py-2">{c.room || "—"}</td>
                        {canWrite ? (
                          <td className="py-2">
                            <ClassActions
                              canWrite={canWrite}
                              academicYearId={selectedYearId || null}
                              levels={levelOptions}
                              staff={staffOptions}
                              classItem={{
                                id: c.id,
                                gradeLevelId: c.gradeLevelId,
                                name: c.name,
                                section: c.section || "",
                                classTeacherId: c.classTeacherId || "",
                                room: c.room || "",
                                isActive: c.isActive,
                              }}
                            />
                          </td>
                        ) : null}
                      </ClickableRow>
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
