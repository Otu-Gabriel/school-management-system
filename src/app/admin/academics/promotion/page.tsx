import { redirect } from "next/navigation";
import { requireSession } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { PromotionManager } from "./promotion-manager";

export default async function PromotionPage() {
  const session = await requireSession();
  if (
    !can(session.user.permissions, "students.promote") &&
    !can(session.user.permissions, "students.write")
  ) {
    redirect("/admin");
  }

  return (
    <>
      <Topbar
        title="Promotion & repetition"
        backHref="/admin"
        backLabel="Dashboard"
      />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Year-end promotion and repetition. Available only when the current term is the last term of the academic year. Bulk moves go to one destination class; use exceptions for individuals." />
        <PromotionManager />
      </main>
    </>
  );
}
