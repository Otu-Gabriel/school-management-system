import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/authz";
import { can, homePathForPermissions } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { OverviewCharts } from "@/components/dashboard/overview-charts";

export default async function AdminDashboardPage() {
  const session = await requireSession();
  if (!can(session.user.permissions, "dashboard.view")) {
    redirect(homePathForPermissions(session.user.permissions));
  }

  const [students, staff, guardians, classes, byLevel, male, female] =
    await Promise.all([
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.staff.count({ where: { status: "ACTIVE" } }),
      prisma.guardian.count(),
      prisma.classSection.count(),
      prisma.gradeLevel.findMany({
        orderBy: { sortOrder: "asc" },
        include: {
          classSections: {
            include: {
              _count: { select: { currentStudents: true } },
            },
          },
        },
      }),
      prisma.student.count({ where: { status: "ACTIVE", gender: "MALE" } }),
      prisma.student.count({ where: { status: "ACTIVE", gender: "FEMALE" } }),
    ]);

  const enrollmentByLevel = byLevel.map((level) => ({
    name: level.code,
    students: level.classSections.reduce(
      (sum, section) => sum + section._count.currentStudents,
      0
    ),
  }));

  const genderSplit = [
    { name: "Male", value: male },
    { name: "Female", value: female },
  ];

  const recentStudents = await prisma.student.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: { currentClassSection: { include: { gradeLevel: true } } },
  });

  const stats = [
    { label: "Students", value: students },
    { label: "Teachers & staff", value: staff },
    { label: "Parents", value: guardians },
    { label: "Classes", value: classes },
  ];

  return (
    <>
      <Topbar title="Admin Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardBody>
                <p className="text-[11px] text-[var(--muted-foreground)]">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
                  {stat.value}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>

        <OverviewCharts
          enrollmentByLevel={enrollmentByLevel}
          genderSplit={genderSplit}
        />

        <Card>
          <CardHeader>
            <CardTitle>Recently added students</CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Admission No</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentStudents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-5 text-[var(--muted-foreground)]">
                        No students yet. Add your first pupil from Students.
                      </td>
                    </tr>
                  ) : (
                    recentStudents.map((student) => (
                      <tr key={student.id} className="border-t border-[var(--border)]">
                        <td className="py-2">
                          {student.firstName} {student.lastName}
                        </td>
                        <td className="py-2">{student.admissionNo}</td>
                        <td className="py-2">
                          {student.currentClassSection
                            ? `${student.currentClassSection.gradeLevel.code}${student.currentClassSection.section || student.currentClassSection.name}`
                            : "—"}
                        </td>
                        <td className="py-2">{student.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      </main>
    </>
  );
}
