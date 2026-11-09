import { Suspense } from "react";
import { getSchoolSettings } from "@/lib/school";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  let school = {
    name: "School Portal",
    shortName: null as string | null,
    logoUrl: null as string | null,
  };

  try {
    const settings = await getSchoolSettings();
    school = {
      name: settings.name,
      shortName: settings.shortName,
      logoUrl: settings.logoUrl,
    };
  } catch {
    // DB may be unavailable
  }

  return (
    <Suspense fallback={null}>
      <LoginForm
        schoolName={school.name}
        shortName={school.shortName}
        logoUrl={school.logoUrl}
      />
    </Suspense>
  );
}
