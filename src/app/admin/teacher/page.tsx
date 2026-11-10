import Link from "next/link";
import { requirePermission } from "@/lib/authz";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import {
  canAccessAllClasses,
  getAccessibleClassOptions,
  getStaffForUser,
} from "@/lib/access-scope";

export default async function TeacherPortalPage() {
  const session = await requirePermission("attendance.read");
  const staff = await getStaffForUser(session.user.id);
  const schoolWide = canAccessAllClasses(session.user.permissions);

  const classes = await getAccessibleClassOptions(
    session.user.id,
    session.user.permissions
  );

  const assignments = staff
    ? await prisma.teacherSubject.findMany({
        where: {
          staffId: staff.id,
          academicYear: { isCurrent: true },
        },
        include: {
          subject: true,
          classSection: { include: { gradeLevel: true } },
        },
        orderBy: [
          { classSection: { gradeLevel: { sortOrder: "asc" } } },
          { subject: { name: "asc" } },
        ],
      })
    : [];

  return (
    <>
      <Topbar title="My teaching" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Only classes linked to you as class teacher or subject teacher." />

        {!staff && !schoolWide ? (
          <Card>
            <CardBody className="text-xs text-[var(--muted-foreground)]">
              Your login is not linked to a staff profile yet. Ask an admin to
              connect your account to a staff record.
            </CardBody>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <CardTitle>
                  {schoolWide
                    ? `All current classes (${classes.length})`
                    : `My classes (${classes.length})`}
                </CardTitle>
              </CardHeader>
              <CardBody className="pt-1.5">
                {classes.length === 0 ? (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    No class teacher or subject assignments for the current year.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {classes.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] py-2 first:border-t-0 first:pt-0"
                      >
                        <p className="text-xs font-medium">{c.label}</p>
                        <Link
                          href={`/admin/teacher/attendance?classSectionId=${c.id}`}
                        >
                          <Button type="button" size="sm">
                            Mark attendance
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>

            {staff ? (
              <Card>
                <CardHeader>
                  <CardTitle>
                    Subject assignments ({assignments.length})
                  </CardTitle>
                </CardHeader>
                <CardBody className="pt-1.5">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[var(--muted-foreground)]">
                        <tr>
                          <th className="pb-2 font-medium">Class</th>
                          <th className="pb-2 font-medium">Subject</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.length === 0 ? (
                          <tr>
                            <td
                              colSpan={2}
                              className="py-6 text-[var(--muted-foreground)]"
                            >
                              No teaching assignments yet.
                            </td>
                          </tr>
                        ) : (
                          assignments.map((item) => (
                            <tr
                              key={item.id}
                              className="border-t border-[var(--border)]"
                            >
                              <td className="py-2">
                                {item.classSection.gradeLevel.code}{" "}
                                {item.classSection.name}
                              </td>
                              <td className="py-2">{item.subject.name}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardBody>
              </Card>
            ) : null}
          </>
        )}
      </main>
    </>
  );
}
