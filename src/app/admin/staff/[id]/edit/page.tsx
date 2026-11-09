import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { StaffForm } from "../../staff-form";

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("staff.write");
  const { id } = await params;

  const [staff, roles, departments, positions] = await Promise.all([
    prisma.staff.findUnique({
      where: { id },
      include: { user: true },
    }),
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

  if (!staff) notFound();

  return (
    <>
      <Topbar
        title={`Edit ${staff.firstName} ${staff.lastName}`}
        backHref="/admin/staff"
        backLabel="Staff"
      />
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <StaffForm
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          departments={departments.map((d) => ({ id: d.id, name: d.name }))}
          positions={positions.map((p) => ({
            id: p.id,
            name: p.name,
            departmentId: p.departmentId,
          }))}
          initial={{
            id: staff.id,
            staffNo: staff.staffNo,
            firstName: staff.firstName,
            lastName: staff.lastName,
            email: staff.email,
            phone: staff.phone,
            departmentId: staff.departmentId,
            positionId: staff.positionId,
            photoUrl: staff.photoUrl,
            status: staff.status,
            roleId: staff.user?.roleId || null,
            hasLogin: Boolean(staff.userId),
          }}
        />
      </main>
    </>
  );
}
