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
import { AnnouncementForm } from "./announcement-form";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("announcements.read");
  const canWrite = can(session.user.permissions, "announcements.write");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const audience = param(params.audience) || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.AnnouncementWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { body: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      audience ? { audience } : {},
    ],
  };

  const [total, notices] = await Promise.all([
    prisma.announcement.count({ where }),
    prisma.announcement.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      include: { createdBy: true },
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = getTotalPages(total, pageSize);

  return (
    <>
      <Topbar title="Notices" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader
          description="School-wide notices for staff, parents, and students."
          actions={canWrite ? <AnnouncementForm /> : null}
        />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Title or content…",
              },
              {
                key: "audience",
                label: "Audience",
                type: "select",
                options: [
                  { value: "all", label: "All" },
                  { value: "staff", label: "Staff" },
                  { value: "parents", label: "Parents" },
                  { value: "students", label: "Students" },
                ],
              },
            ]}
          />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>Published notices ({total})</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2.5 pt-1.5">
            {notices.length === 0 ? (
              <p className="py-4 text-xs text-[var(--muted-foreground)]">
                No notices match your filters.
              </p>
            ) : (
              notices.map((notice) => (
                <div
                  key={notice.id}
                  className="rounded-md border border-[var(--border)] p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-semibold">{notice.title}</h3>
                      <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                        Audience: {notice.audience}
                      </p>
                    </div>
                    <span className="text-[10px] text-[var(--muted-foreground)]">
                      {notice.publishedAt.toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-xs text-[var(--muted-foreground)]">
                    {notice.body}
                  </p>
                </div>
              ))
            )}

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