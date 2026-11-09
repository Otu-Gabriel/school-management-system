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
import { LevelForm } from "./level-form";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LevelsPage({
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
  const stageId = param(params.stageId) || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.GradeLevelWhereInput = {
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

  const [total, levels, stages] = await Promise.all([
    prisma.gradeLevel.count({ where }),
    prisma.gradeLevel.findMany({
      where,
      include: { stage: true },
      orderBy: { sortOrder: "asc" },
      skip,
      take: pageSize,
    }),
    prisma.stage.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    }),
  ]);

  const totalPages = getTotalPages(total, pageSize);

  return (
    <>
      <Topbar title="Grade levels" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader
          description="Levels are dynamic — use the names your school already uses."
          actions={
            canWrite ? (
              <LevelForm stages={stages.map((s) => ({ id: s.id, name: s.name }))} />
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

        <Card>
          <CardHeader>
            <CardTitle>Levels ({total})</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Code</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Stage</th>
                    <th className="pb-2 font-medium">Order</th>
                  </tr>
                </thead>
                <tbody>
                  {levels.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-[var(--muted-foreground)]">
                        No levels match your filters.
                      </td>
                    </tr>
                  ) : (
                    levels.map((level) => (
                      <tr key={level.id} className="border-t border-[var(--border)]">
                        <td className="py-2">{level.code}</td>
                        <td className="py-2">{level.name}</td>
                        <td className="py-2">{level.stage?.name || "—"}</td>
                        <td className="py-2">{level.sortOrder}</td>
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
