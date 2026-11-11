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
import { ActivitiesManager } from "./activities-manager";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("activities.read");
  const canWrite = can(session.user.permissions, "activities.write");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const stageId = param(params.stageId) || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.ActivityWhereInput = {
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
    ],
  };

  const [total, activities, stages, levels] = await Promise.all([
    prisma.activity.count({ where }),
    prisma.activity.findMany({
      where,
      include: {
        stage: true,
        allowedLevels: {
          include: { gradeLevel: true },
          orderBy: { gradeLevel: { sortOrder: "asc" } },
        },
        _count: { select: { timetableSlots: true } },
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
      <Topbar title="Activities" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader description="Non-teaching blocks (break, lunch, worship, and more). Classes inherit matching activities by level — no per-class opt-out." />

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
            ]}
          />
        </Suspense>

        <ActivitiesManager
          canWrite={canWrite}
          total={total}
          stages={stages.map((s) => ({ id: s.id, name: s.name, code: s.code }))}
          levels={levels.map((l) => ({
            id: l.id,
            code: l.code,
            name: l.name,
            stageId: l.stageId,
          }))}
          activities={activities.map((a) => ({
            id: a.id,
            code: a.code,
            name: a.name,
            stageId: a.stageId,
            stageName: a.stage?.name || null,
            slotCount: a._count.timetableSlots,
            gradeLevelIds: a.allowedLevels.map((row) => row.gradeLevelId),
            levelLabels: a.allowedLevels.map((row) => row.gradeLevel.code),
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
