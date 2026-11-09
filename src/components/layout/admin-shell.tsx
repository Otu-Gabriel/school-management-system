"use client";

import type { ReactNode } from "react";
import { MobileNavProvider } from "@/components/layout/mobile-nav";
import { Sidebar } from "@/components/layout/sidebar";

export function AdminShell({
  schoolName,
  logoUrl,
  academicYear,
  termName,
  permissions,
  children,
}: {
  schoolName: string;
  logoUrl?: string | null;
  academicYear?: string | null;
  termName?: string | null;
  permissions?: string[];
  children: ReactNode;
}) {
  return (
    <MobileNavProvider>
      <div className="flex h-[100dvh] overflow-hidden bg-[var(--background)]">
        <Sidebar
          schoolName={schoolName}
          logoUrl={logoUrl}
          academicYear={academicYear}
          termName={termName}
          permissions={permissions}
        />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </MobileNavProvider>
  );
}
