import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { StudentForm } from "../student-form";

export default async function NewStudentPage() {
  await requirePermission("students.write");

  const [classes, year] = await Promise.all([
    prisma.classSection.findMany({
      where: { academicYear: { isCurrent: true }, isActive: true },
      include: { gradeLevel: true },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
  ]);

  return (
    <>
      <Topbar title="Add student" backHref="/admin/students" backLabel="Students" />
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <StudentForm
          classes={classes.map((c) => ({
            id: c.id,
            label: `${c.gradeLevel.code} ${c.name}`,
          }))}
          academicYearId={year?.id || null}
        />
      </main>
    </>
  );
}
