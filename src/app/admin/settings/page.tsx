import { requirePermission } from "@/lib/authz";
import { getSchoolSettings } from "@/lib/school";
import { Topbar } from "@/components/layout/topbar";
import { SchoolSettingsForm } from "./settings-form";

export default async function SettingsPage() {
  await requirePermission("settings.write");
  const school = await getSchoolSettings();

  return (
    <>
      <Topbar title="School Settings" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <SchoolSettingsForm school={school} />
      </main>
    </>
  );
}
