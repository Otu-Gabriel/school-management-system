import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { TransferForm } from "./transfer-form";

export default async function TransferPage() {
  const session = await requireSession();
  if (
    !can(session.user.permissions, "students.transfer") &&
    !can(session.user.permissions, "students.write")
  ) {
    redirect("/admin");
  }

  const [students, classes] = await Promise.all([
    prisma.student.findMany({
      where: { status: "ACTIVE" },
      include: {
        currentClassSection: { include: { gradeLevel: true } },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: 500,
    }),
    prisma.classSection.findMany({
      where: { isActive: true, academicYear: { isCurrent: true } },
      include: { gradeLevel: true },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
    }),
  ]);

  return (
    <>
      <Topbar title="Transfer student" backHref="/admin/students" backLabel="Students" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Move a student to another class anytime. Previous class placement is archived in history." />
        <TransferForm
          students={students.map((s) => ({
            id: s.id,
            label: `${s.admissionNo} — ${s.firstName} ${s.lastName}${
              s.currentClassSection
                ? ` (${s.currentClassSection.gradeLevel.code} ${s.currentClassSection.name})`
                : ""
            }`,
            currentClassSectionId: s.currentClassSectionId,
          }))}
          classes={classes.map((c) => ({
            id: c.id,
            label: `${c.gradeLevel.code} ${c.name}`,
          }))}
        />
      </main>
    </>
  );
}
