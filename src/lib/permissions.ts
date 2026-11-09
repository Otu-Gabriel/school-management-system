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
