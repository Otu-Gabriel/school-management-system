import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, homePathForPermissions, type Permission } from "@/lib/permissions";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!can(session.user.permissions, permission)) {
    redirect(homePathForPermissions(session.user.permissions));
  }
  return session;
}

export function denyUnless(
  permissions: string[] | undefined,
  permission: Permission
) {
  return can(permissions, permission);
}
