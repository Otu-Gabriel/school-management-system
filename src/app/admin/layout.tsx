import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getCurrentAcademicContext, getSchoolSettings } from "@/lib/school";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  if (!can(session.user.permissions, "dashboard.view")) {
    redirect("/login?error=access");
  }

  const [school, academic] = await Promise.all([
    getSchoolSettings(),
    getCurrentAcademicContext(),
  ]);

  return (
    <AdminShell
      schoolName={school.shortName || school.name}
      logoUrl={school.logoUrl}
      academicYear={academic.year?.name}
      termName={academic.term?.name}
      permissions={session.user.permissions}
    >
      {children}
    </AdminShell>
  );
}
