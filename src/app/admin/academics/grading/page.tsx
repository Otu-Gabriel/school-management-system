import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { DEFAULT_SCHEME, DEFAULT_GRADE_BANDS } from "@/lib/marks";
import { GradingManager } from "./grading-manager";

export default async function GradingPage() {
  const session = await requirePermission("marks.read");
  const canWrite =
    can(session.user.permissions, "marks.write") ||
    can(session.user.permissions, "academics.write");

  const stages = await prisma.stage.findMany({
    where: { isActive: true, NOT: { code: "ALL" } },
    orderBy: { sortOrder: "asc" },
    include: {
      assessmentScheme: true,
      gradeBands: { orderBy: { sortOrder: "asc" } },
    },
  });

  return (
    <>
      <Topbar title="Grading" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Set CA/exam weights and letter grade bands per stage. Defaults are 30% class score and 70% exam." />
        <GradingManager
          canWrite={canWrite}
          stages={stages.map((stage) => ({
            stageId: stage.id,
            stageCode: stage.code,
            stageName: stage.name,
            classScoreWeight:
              stage.assessmentScheme?.classScoreWeight ??
              DEFAULT_SCHEME.classScoreWeight,
            examWeight:
              stage.assessmentScheme?.examWeight ?? DEFAULT_SCHEME.examWeight,
            bands:
              stage.gradeBands.length > 0
                ? stage.gradeBands.map((b) => ({
                    label: b.label,
                    minScore: b.minScore,
                    maxScore: b.maxScore,
                    sortOrder: b.sortOrder,
                  }))
                : DEFAULT_GRADE_BANDS.map((b) => ({ ...b })),
          }))}
        />
      </main>
    </>
  );
}
