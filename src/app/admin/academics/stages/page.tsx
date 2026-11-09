import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { StagesManager } from "./stages-manager";

export default async function StagesPage() {
  const session = await requirePermission("stages.manage");
  const canWrite = can(session.user.permissions, "stages.manage");

  const stages = await prisma.stage.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { gradeLevels: true, subjects: true } },
    },
  });

  return (
    <>
      <Topbar title="Stages" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Define school stages used by levels and subjects (Primary, JHS, etc.)." />
        <StagesManager
          canWrite={canWrite}
          stages={stages.map((s) => ({
            id: s.id,
            code: s.code,
            name: s.name,
            description: s.description,
            sortOrder: s.sortOrder,
            isActive: s.isActive,
            levelCount: s._count.gradeLevels,
            subjectCount: s._count.subjects,
          }))}
        />
      </main>
    </>
  );
}
