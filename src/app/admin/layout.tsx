import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCurrentAcademicContext, getSchoolSettings } from "@/lib/school";
import { AdminShell } from "@/components/layout/admin-shell";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  // Authenticated users may enter the portal even without dashboard.view.
  // Each page still enforces its own permission via requirePermission().

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
      permissions={session.user.permissions || []}
    >
      {children}
    </AdminShell>
  );
}
