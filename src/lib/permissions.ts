import type { PermissionCode } from "@/lib/permission-catalog";

export type Permission = PermissionCode;

export function can(
  permissions: string[] | undefined | null,
  permission: Permission
) {
  return Boolean(permissions?.includes(permission));
}

export function canAny(
  permissions: string[] | undefined | null,
  required: Permission[]
) {
  return required.some((permission) => can(permissions, permission));
}

/** First usable portal page for a role (order matches main nav priority). */
const LANDING_ROUTES: Array<{ permission: Permission; href: string }> = [
  { permission: "wards.read", href: "/admin/parent" },
  { permission: "dashboard.view", href: "/admin" },
  { permission: "attendance.read", href: "/admin/teacher" },
  { permission: "marks.write", href: "/admin/teacher/marks" },
  { permission: "marks.read", href: "/admin/academics/reports" },
  { permission: "fees.read", href: "/admin/fees" },
  { permission: "students.read", href: "/admin/students" },
  { permission: "staff.read", href: "/admin/staff" },
  { permission: "guardians.read", href: "/admin/guardians" },
  { permission: "academics.read", href: "/admin/academics/classes" },
  { permission: "subjects.read", href: "/admin/academics/subjects" },
  { permission: "activities.read", href: "/admin/academics/activities" },
  { permission: "assignments.read", href: "/admin/academics/assignments" },
  { permission: "announcements.read", href: "/admin/announcements" },
  { permission: "roles.manage", href: "/admin/roles" },
  { permission: "settings.write", href: "/admin/settings" },
];

export function homePathForPermissions(
  permissions: string[] | undefined | null
) {
  for (const route of LANDING_ROUTES) {
    if (can(permissions, route.permission)) return route.href;
  }
  return "/admin/account";
}
