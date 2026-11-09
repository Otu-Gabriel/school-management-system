import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarCell } from "@/components/table/avatar-cell";
import { ImportExportButtons } from "@/components/table/import-export";
import { PageSizeBootstrap } from "@/components/table/page-size-bootstrap";
import { TableFilters } from "@/components/table/table-filters";
import { TablePagination } from "@/components/table/table-pagination";
import { RecordActions } from "@/components/table/record-actions";
import { getTotalPages, parsePage, parsePageSize } from "@/lib/table";

const STAFF_TEMPLATE = [
  "staffNo,firstName,lastName,email,phone,department,position",
  "STF-010,Kofi,Asante,kofi@school.local,0241111111,Primary,Class Teacher",
].join("\n");

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("staff.read");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const status = param(params.status) || "";
  const departmentId = param(params.departmentId) || "";
  const positionId = param(params.positionId) || "";
  const roleId = param(params.roleId) || "";
  const skip = (page - 1) * pageSize;

  const where: Prisma.StaffWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { staffNo: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      status ? { status: status as never } : {},
      departmentId ? { departmentId } : {},
      positionId ? { positionId } : {},
      roleId ? { user: { roleId } } : {},
    ],
  };

  const [total, staff, departments, positions, roles] = await Promise.all([
    prisma.staff.count({ where }),
    prisma.staff.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        user: { include: { role: true } },
        department: true,
        position: true,
      },
      skip,
      take: pageSize,
    }),
    prisma.department.findMany({ orderBy: { name: "asc" } }),
    prisma.position.findMany({ orderBy: { name: "asc" } }),
    prisma.role.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalPages = getTotalPages(total, pageSize);
  const canWrite = can(session.user.permissions, "staff.write");
  const canImport = can(session.user.permissions, "staff.import");
  const canExport = can(session.user.permissions, "staff.export");

  return (
    <>
      <Topbar title="Staff" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader
          description="Administrators, teachers, bursars and other school employees."
          actions={
            <>
              {canWrite ? (
                <Link href="/admin/staff/new">
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Add staff
                  </Button>
                </Link>
              ) : null}
              {(canImport || canExport) && (
                <ImportExportButtons
                  resource="staff"
                  exportPath="/api/staff/export"
                  importPath="/api/staff/import"
                  templateCsv={STAFF_TEMPLATE}
                  templateName="staff-template.csv"
                  canImport={canImport}
                  canExport={canExport}
                />
              )}
            </>
          }
        />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Name, staff no, phone…",
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  { value: "ACTIVE", label: "Active" },
                  { value: "ON_LEAVE", label: "On leave" },
                  { value: "LEFT", label: "Left" },
                ],
              },
              {
                key: "departmentId",
                label: "Department",
                type: "select",
                options: departments.map((d) => ({ value: d.id, label: d.name })),
              },
              {
                key: "positionId",
                label: "Position",
                type: "select",
                options: positions.map((p) => ({ value: p.id, label: p.name })),
              },
              {
                key: "roleId",
                label: "Role",
                type: "select",
                options: roles.map((r) => ({ value: r.id, label: r.name })),
              },
            ]}
          />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>Staff directory ({total})</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Photo</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Staff No</th>
                    <th className="pb-2 font-medium">Department</th>
                    <th className="pb-2 font-medium">Position</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Status</th>
                    {canWrite ? (
                      <th className="pb-2 font-medium text-right">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {staff.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canWrite ? 8 : 7}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No staff match your filters.
                      </td>
                    </tr>
                  ) : (
                    staff.map((member) => {
                      const fullName = `${member.firstName} ${member.lastName}`;
                      return (
                        <tr
                          key={member.id}
                          className="border-t border-[var(--border)]"
                        >
                          <td className="py-2 pr-2">
                            <AvatarCell
                              src={member.photoUrl || member.user?.imageUrl}
                              name={fullName}
                            />
                          </td>
                          <td className="py-2 font-medium">{fullName}</td>
                          <td className="py-2">{member.staffNo}</td>
                          <td className="py-2">{member.department?.name || "—"}</td>
                          <td className="py-2">{member.position?.name || "—"}</td>
                          <td className="py-2">
                            {member.user?.role?.name || "No login"}
                          </td>
                          <td className="py-2">{member.status}</td>
                          {canWrite ? (
                            <td className="py-2">
                              <RecordActions
                                editHref={`/admin/staff/${member.id}/edit`}
                                deleteUrl={`/api/staff/${member.id}`}
                                deleteLabel={`Delete ${fullName}? Their login will also be removed.`}
                                successMessage="Staff deleted"
                              />
                            </td>
                          ) : null}
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
