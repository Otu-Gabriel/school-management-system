import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { todayAttendanceDateString } from "@/lib/attendance";
import { getAccessibleClassOptions } from "@/lib/access-scope";
import { getCurrentAcademicContext } from "@/lib/school";
import { formatDateOnly } from "@/lib/dates";
import { AttendanceRegister } from "./attendance-register";

export default async function AttendancePage() {
  const session = await requirePermission("attendance.read");
  const canWrite = can(session.user.permissions, "attendance.write");

  const [classes, academic] = await Promise.all([
    getAccessibleClassOptions(session.user.id, session.user.permissions),
    getCurrentAcademicContext(),
  ]);

  return (
    <>
      <Topbar title="Attendance" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Daily class register for school days in the current term — only for classes you are assigned to (unless you are admin/registrar)." />
        {classes.length === 0 ? (
          <Card>
            <CardBody className="text-xs text-[var(--muted-foreground)]">
              No classes are linked to your staff profile for the current year.
              Ask an admin to set you as class teacher or assign you to a class.
            </CardBody>
          </Card>
        ) : (
          <AttendanceRegister
            canWrite={canWrite}
            initialDate={todayAttendanceDateString()}
            termContext={{
              yearName: academic.year?.name || null,
              termId: academic.term?.id || null,
              termName: academic.term?.name || null,
              termStart: academic.term
                ? formatDateOnly(academic.term.startDate)
                : null,
              termEnd: academic.term
                ? formatDateOnly(academic.term.endDate)
                : null,
            }}
            classes={classes.map((c) => ({
              id: c.id,
              label: c.label,
            }))}
          />
        )}
      </main>
    </>
  );
}
