import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { StaffForm } from "../staff-form";

export default async function NewStaffPage() {
  await requirePermission("staff.write");

  const [roles, departments, positions] = await Promise.all([
    prisma.role.findMany({ orderBy: { name: "asc" } }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
    prisma.position.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <Topbar title="Add staff" backHref="/admin/staff" backLabel="Staff" />
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <StaffForm
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          positions={positions.map((p) => ({
            id: p.id,
            name: p.name,
            departmentId: p.departmentId,
          }))}
        />
      </main>
    </>
  );
}
