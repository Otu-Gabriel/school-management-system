import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  return session;
}

export async function requirePermission(permission: Permission) {
  const session = await requireSession();
  if (!can(session.user.permissions, permission)) {
    // Avoid redirect loops when the user cannot view the dashboard itself.
    redirect(permission === "dashboard.view" ? "/admin/account" : "/admin");
  }
  return session;
}

export function denyUnless(
  permissions: string[] | undefined,
  permission: Permission
) {
  return can(permissions, permission);
}
