import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { RolesManager } from "./roles-manager";

export default async function RolesPage() {
  await requirePermission("roles.manage");

  const [roles, permissions] = await Promise.all([
    prisma.role.findMany({
      orderBy: { name: "asc" },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    }),
    prisma.permission.findMany({ orderBy: [{ module: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <>
      <Topbar title="Roles & permissions" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Create roles by selecting the permissions they grant." />
        <RolesManager
          roles={roles.map((role) => ({
            id: role.id,
            name: role.name,
            description: role.description,
            isSystem: role.isSystem,
            userCount: role._count.users,
            permissionIds: role.permissions.map((p) => p.permissionId),
          }))}
          permissions={permissions.map((p) => ({
            id: p.id,
            code: p.code,
            name: p.name,
            description: p.description,
            module: p.module,
          }))}
        />
      </main>
    </>
  );
}
