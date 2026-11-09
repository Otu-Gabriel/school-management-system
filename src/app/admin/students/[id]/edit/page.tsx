import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { StudentForm } from "../../student-form";

export default async function EditStudentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("students.write");
  const { id } = await params;

  const [student, classes, year] = await Promise.all([
    prisma.student.findUnique({
      where: { id },
      include: {
        guardians: {
          include: { guardian: true },
          orderBy: { isPrimary: "desc" },
        },
      },
    }),
    prisma.classSection.findMany({
      where: { academicYear: { isCurrent: true } },
      include: { gradeLevel: true },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
    }),
    prisma.academicYear.findFirst({ where: { isCurrent: true } }),
  ]);

  if (!student) notFound();

  const primary =
    student.guardians.find((g) => g.isPrimary) || student.guardians[0];

  return (
    <>
      <Topbar
        title={`Edit ${student.firstName} ${student.lastName}`}
        backHref="/admin/students"
        backLabel="Students"
      />
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <StudentForm
          classes={classes.map((c) => ({
            id: c.id,
            label: `${c.gradeLevel.code} ${c.name}`,
          }))}
          academicYearId={year?.id || null}
          initial={{
            id: student.id,
            admissionNo: student.admissionNo,
            firstName: student.firstName,
            lastName: student.lastName,
            otherNames: student.otherNames,
            gender: student.gender,
            dateOfBirth: student.dateOfBirth
              ? student.dateOfBirth.toISOString().slice(0, 10)
              : "",
            classSectionId: student.currentClassSectionId,
            photoUrl: student.photoUrl,
            status: student.status,
            guardianName: primary?.guardian.fullName || "",
            guardianPhone: primary?.guardian.phone || "",
            guardianEmail: primary?.guardian.email || "",
            relationship: primary?.relationship || "GUARDIAN",
          }}
        />
      </main>
    </>
  );
}
