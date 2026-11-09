import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/layout/topbar";
import { AccountForm } from "./account-form";

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: true,
      staff: true,
      guardian: true,
      student: true,
    },
  });

  if (!user) redirect("/login");

  return (
    <>
      <Topbar title="My account" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <AccountForm
          account={{
            id: user.id,
            email: user.email,
            phone: user.phone,
            imageUrl: user.imageUrl,
            roleName: user.role?.name || null,
            staff: user.staff
              ? {
                  firstName: user.staff.firstName,
                  lastName: user.staff.lastName,
                }
              : null,
            guardian: user.guardian
              ? { fullName: user.guardian.fullName }
              : null,
            student: user.student
              ? {
                  firstName: user.student.firstName,
                  lastName: user.student.lastName,
                }
              : null,
          }}
        />
      </main>
    </>
  );
}
