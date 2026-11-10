import { prisma } from "@/lib/prisma";
import { can, type Permission } from "@/lib/permissions";
import { getStaffAttendanceClasses } from "@/lib/attendance";

/** Admins/registrars who may see all classes and students. */
export function canAccessAllClasses(permissions: string[] | undefined | null) {
  return (
    can(permissions, "students.write") ||
    can(permissions, "roles.manage") ||
    can(permissions, "academics.write")
  );
}

export async function getStaffForUser(userId: string) {
  return prisma.staff.findFirst({ where: { userId } });
}

/**
 * Classes the current user may use for attendance / class-scoped views.
 * School-wide staff get all current-year classes; teachers get only
 * classes they teach or are class teacher of.
 */
export async function getAccessibleClassOptions(
  userId: string,
  permissions: string[] | undefined | null
) {
  if (canAccessAllClasses(permissions)) {
    const classes = await prisma.classSection.findMany({
      where: { academicYear: { isCurrent: true } },
      include: { gradeLevel: true },
      orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
    });
    return classes.map((c) => ({
      id: c.id,
      name: c.name,
      label: `${c.gradeLevel.code} ${c.name}`,
      academicYearId: c.academicYearId,
    }));
  }

  const staff = await getStaffForUser(userId);
  if (!staff) return [];
  return getStaffAttendanceClasses(staff.id);
}

export async function userCanAccessClass(
  userId: string,
  permissions: string[] | undefined | null,
  classSectionId: string
) {
  if (canAccessAllClasses(permissions)) return true;
  const staff = await getStaffForUser(userId);
  if (!staff) return false;
  const classes = await getStaffAttendanceClasses(staff.id);
  return classes.some((c) => c.id === classSectionId);
}

/** Class IDs a scoped teacher may see students for. Empty = no access. */
export async function getAccessibleClassIds(
  userId: string,
  permissions: string[] | undefined | null
) {
  if (canAccessAllClasses(permissions)) return null; // null = unrestricted
  const options = await getAccessibleClassOptions(userId, permissions);
  return options.map((c) => c.id);
}

export function requirePermissionAny(
  permissions: string[] | undefined | null,
  required: Permission[]
) {
  return required.some((p) => can(permissions, p));
}
