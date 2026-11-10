import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { todayAttendanceDateString } from "@/lib/attendance";
import {
  canAccessAllClasses,
  getAccessibleClassOptions,
  getStaffForUser,
} from "@/lib/access-scope";
import { getCurrentAcademicContext } from "@/lib/school";
import { formatDateOnly } from "@/lib/dates";
import { AttendanceRegister } from "../../attendance/attendance-register";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function TeacherAttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("attendance.write");
  const params = await searchParams;
  const requestedClassId = param(params.classSectionId) || "";

  const staff = await getStaffForUser(session.user.id);
  const schoolWide = canAccessAllClasses(session.user.permissions);

  const [classes, academic] = await Promise.all([
    getAccessibleClassOptions(session.user.id, session.user.permissions),
    getCurrentAcademicContext(),
  ]);

  const initialClassId =
    requestedClassId && classes.some((c) => c.id === requestedClassId)
      ? requestedClassId
      : classes[0]?.id || "";

  return (
    <>
      <Topbar
        title="Mark attendance"
        backHref="/admin/teacher"
        backLabel="My teaching"
      />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Take the register only for classes linked to you, on school days in the current term." />
        {!staff && !schoolWide ? (
          <Card>
            <CardBody className="text-xs text-[var(--muted-foreground)]">
              Your login is not linked to a staff profile.
            </CardBody>
          </Card>
        ) : classes.length === 0 ? (
          <Card>
            <CardBody className="text-xs text-[var(--muted-foreground)]">
              No assigned classes for the current year.
            </CardBody>
          </Card>
        ) : (
          <AttendanceRegister
            canWrite={can(session.user.permissions, "attendance.write")}
            initialClassId={initialClassId}
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
            classes={classes.map((c) => ({ id: c.id, label: c.label }))}
          />
        )}
      </main>
    </>
  );
}
