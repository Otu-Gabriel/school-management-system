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
import { SubjectsManager } from "./subjects-manager";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SubjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("subjects.read");
  const canWrite = can(session.user.permissions, "subjects.write");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const stageId = param(params.stageId) || "";
  const type = param(params.type) || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.SubjectWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      stageId ? { stageId } : {},
      type === "core" ? { isCore: true } : type === "elective" ? { isCore: false } : {},
    ],
  };

  const [total, subjects, stages, levels] = await Promise.all([
    prisma.subject.count({ where }),
    prisma.subject.findMany({
      where,
      include: {
        stage: true,
        allowedLevels: {
          include: { gradeLevel: true },
          orderBy: { gradeLevel: { sortOrder: "asc" } },
        },
        _count: { select: { teacherSubjects: true } },
      },
      orderBy: [{ name: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.stage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.gradeLevel.findMany({
      orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    }),
  ]);

  const totalPages = getTotalPages(total, pageSize);

  return (
    <>
      <Topbar title="Subjects" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader description="Subjects apply by grade level (multi-select). Classes inherit the matching set automatically — no per-class opt-out." />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Code or name…",
              },
              {
                key: "stageId",
                label: "Stage",
                type: "select",
                options: stages.map((s) => ({ value: s.id, label: s.name })),
              },
              {
                key: "type",
                label: "Type",
                type: "select",
                options: [
                  { value: "core", label: "Core" },
                  { value: "elective", label: "Elective" },
                ],
              },
            ]}
          />
        </Suspense>

        <SubjectsManager
          canWrite={canWrite}
          total={total}
          stages={stages.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          levels={levels.map((l) => ({
            id: l.id,
            code: l.code,
            name: l.name,
            stageId: l.stageId,
          }))}
          subjects={subjects.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            stageId: s.stageId,
            stageName: s.stage?.name || null,
            stageCode: s.stage?.code || null,
            isCore: s.isCore,
            assignmentCount: s._count.teacherSubjects,
            gradeLevelIds: s.allowedLevels.map((row) => row.gradeLevelId),
            levelLabels: s.allowedLevels.map((row) => row.gradeLevel.code),
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
