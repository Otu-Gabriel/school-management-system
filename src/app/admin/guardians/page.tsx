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
import { GuardiansManager } from "./guardians-manager";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function GuardiansPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("guardians.read");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.GuardianWhereInput = q
    ? {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  const [total, guardians, students, roles] = await Promise.all([
    prisma.guardian.count({ where }),
    prisma.guardian.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        students: {
          include: { student: true },
        },
        user: { include: { role: true } },
      },
      skip,
      take: pageSize,
    }),
    prisma.student.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.role.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const defaultParentRoleId =
    roles.find((r) => r.name === "Parent")?.id || null;

  const totalPages = getTotalPages(total, pageSize);
  const canWrite = can(session.user.permissions, "guardians.write");

  return (
    <>
      <Topbar title="Parents / Guardians" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader description="Create a parent login (email/phone + password) so they can open My wards after signing in at /login." />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Name, phone, or email…",
              },
            ]}
          />
        </Suspense>

        <GuardiansManager
          canWrite={canWrite}
          total={total}
          roles={roles}
          defaultParentRoleId={defaultParentRoleId}
          students={students.map((s) => ({
            id: s.id,
            label: `${s.firstName} ${s.lastName} (${s.admissionNo})`,
          }))}
          guardians={guardians.map((g) => ({
            id: g.id,
            fullName: g.fullName,
            phone: g.phone,
            email: g.email,
            occupation: g.occupation,
            address: g.address,
            photoUrl: g.photoUrl,
            hasLogin: Boolean(g.userId),
            roleId: g.user?.roleId || null,
            roleName: g.user?.role?.name || null,
            children: g.students
              .map(
                (link) =>
                  `${link.student.firstName} ${link.student.lastName}`
              )
              .join(", "),
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
