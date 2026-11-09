import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { SimpleCrudManager } from "@/components/admin/simple-crud-manager";

export default async function DepartmentsPage() {
  await requirePermission("departments.manage");
  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { staff: true, positions: true } } },
  });

  return (
    <>
      <Topbar title="Departments" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Organize staff into departments such as Primary, JHS, or Administration." />
        <SimpleCrudManager
          title="Departments"
          endpoint="/api/departments"
          items={departments.map((d) => ({
            id: d.id,
            name: d.name,
            description: d.description,
            isActive: d.isActive,
            meta: `${d._count.positions} positions · ${d._count.staff} staff`,
          }))}
        />
      </main>
    </>
  );
}
