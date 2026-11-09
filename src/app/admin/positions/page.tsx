import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { SimpleCrudManager } from "@/components/admin/simple-crud-manager";

export default async function PositionsPage() {
  await requirePermission("positions.manage");

  const [positions, departments] = await Promise.all([
    prisma.position.findMany({
      orderBy: { name: "asc" },
      include: {
        department: true,
        _count: { select: { staff: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <Topbar title="Positions" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Job titles assigned to staff, optionally linked to a department." />
        <SimpleCrudManager
          title="Positions"
          endpoint="/api/positions"
          departmentOptions={departments.map((d) => ({ id: d.id, name: d.name }))}
          items={positions.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            isActive: p.isActive,
            departmentId: p.departmentId,
            meta: `${p.department?.name || "No department"} · ${p._count.staff} staff`,
          }))}
        />
      </main>
    </>
  );
}
