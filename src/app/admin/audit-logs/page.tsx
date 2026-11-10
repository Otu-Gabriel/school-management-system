import { Suspense } from "react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSizeBootstrap } from "@/components/table/page-size-bootstrap";
import { TableFilters } from "@/components/table/table-filters";
import { TablePagination } from "@/components/table/table-pagination";
import { getTotalPages, parsePage, parsePageSize } from "@/lib/table";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("audit.read");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
          { entityId: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            staff: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = getTotalPages(total, pageSize);

  return (
    <>
      <Topbar title="Audit logs" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader description="Important system actions for accountability." />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Action or entity…",
              },
            ]}
          />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>Activity ({total})</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">When</th>
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Action</th>
                    <th className="pb-2 font-medium">Entity</th>
                    <th className="pb-2 font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-[var(--muted-foreground)]">
                        No audit events yet.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const who =
                        log.user?.staff
                          ? `${log.user.staff.firstName} ${log.user.staff.lastName}`
                          : log.user?.email ||
                            log.user?.phone ||
                            "System";
                      const details = log.newValues
                        ? JSON.stringify(log.newValues)
                        : "—";
                      return (
                        <tr
                          key={log.id}
                          className="border-t border-[var(--border)]"
                        >
                          <td className="py-2 whitespace-nowrap">
                            {log.createdAt.toLocaleString()}
                          </td>
                          <td className="py-2">{who}</td>
                          <td className="py-2 font-medium">{log.action}</td>
                          <td className="py-2">
                            {log.entityType || "—"}
                            {log.entityId ? (
                              <span className="block text-[10px] text-[var(--muted-foreground)]">
                                {log.entityId}
                              </span>
                            ) : null}
                          </td>
                          <td className="max-w-xs truncate py-2" title={details}>
                            {details}
                          </td>
                        </tr>
                      );
                    })
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
