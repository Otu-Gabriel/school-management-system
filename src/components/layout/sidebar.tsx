"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookMarked,
  BookOpen,
  Briefcase,
  Building2,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Megaphone,
  Settings,
  Shield,
  Users,
  UserRound,
  Layers3,
  Milestone,
  ClipboardCheck,
  ScrollText,
  Presentation,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { can, type Permission } from "@/lib/permissions";
import { useMobileNav } from "@/components/layout/mobile-nav";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
};

const sections: { title: string; items: NavItem[] }[] = [
  {
    title: "Home",
    items: [
      {
        href: "/admin",
        label: "Overview",
        icon: LayoutDashboard,
        permission: "dashboard.view",
      },
    ],
  },
  {
    title: "People",
    items: [
      {
        href: "/admin/students",
        label: "Students",
        icon: GraduationCap,
        permission: "students.read",
      },
      {
        href: "/admin/staff",
        label: "Staff",
        icon: Users,
        permission: "staff.read",
      },
      {
        href: "/admin/guardians",
        label: "Parents",
        icon: UserRound,
        permission: "guardians.read",
      },
    ],
  },
  {
    title: "Academics",
    items: [
      {
        href: "/admin/academics/years",
        label: "Years & Terms",
        icon: CalendarDays,
        permission: "academics.read",
      },
      {
        href: "/admin/academics/stages",
        label: "Stages",
        icon: Milestone,
        permission: "stages.manage",
      },
      {
        href: "/admin/academics/levels",
        label: "Levels",
        icon: Layers3,
        permission: "academics.read",
      },
      {
        href: "/admin/academics/classes",
        label: "Classes",
        icon: BookOpen,
        permission: "academics.read",
      },
      {
        href: "/admin/academics/subjects",
        label: "Subjects",
        icon: BookMarked,
        permission: "subjects.read",
      },
      {
        href: "/admin/academics/assignments",
        label: "Teaching assignments",
        icon: ClipboardList,
        permission: "assignments.read",
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        href: "/admin/attendance",
        label: "Attendance",
        icon: ClipboardCheck,
        permission: "attendance.read",
      },
      {
        href: "/admin/teacher",
        label: "My teaching",
        icon: Presentation,
        permission: "attendance.read",
      },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        href: "/admin/announcements",
        label: "Notices",
        icon: Megaphone,
        permission: "announcements.read",
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        href: "/admin/roles",
        label: "Roles & permissions",
        icon: Shield,
        permission: "roles.manage",
      },
      {
        href: "/admin/audit-logs",
        label: "Audit logs",
        icon: ScrollText,
        permission: "audit.read",
      },
      {
        href: "/admin/departments",
        label: "Departments",
        icon: Building2,
        permission: "departments.manage",
      },
      {
        href: "/admin/positions",
        label: "Positions",
        icon: Briefcase,
        permission: "positions.manage",
      },
      {
        href: "/admin/settings",
        label: "School Settings",
        icon: Settings,
        permission: "settings.write",
      },
    ],
  },
];

export function Sidebar({
  schoolName,
  logoUrl,
  academicYear,
  termName,
  permissions = [],
}: {
  schoolName: string;
  logoUrl?: string | null;
  academicYear?: string | null;
  termName?: string | null;
  permissions?: string[];
}) {
  const pathname = usePathname();
  const { open, closeNav } = useMobileNav();

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={cn(
          "fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeNav}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[min(18rem,88vw)] flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 lg:static lg:z-auto lg:w-56 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-3 py-3">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-[var(--brand-primary)] text-[11px] font-bold text-white">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={schoolName} className="h-full w-full object-cover" />
            ) : (
              schoolName.slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[var(--foreground)]">
              {schoolName}
            </p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Admin portal</p>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] lg:hidden"
            onClick={closeNav}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
          {sections.map((section) => {
            const items = section.items.filter(
              (item) => !item.permission || can(permissions, item.permission)
            );
            if (items.length === 0) return null;

            return (
              <div key={section.title}>
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {section.title}
                </p>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== "/admin" && pathname.startsWith(item.href));
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeNav}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-2 text-xs transition-colors lg:py-1.5",
                          active
                            ? "bg-[color-mix(in_srgb,var(--brand-primary)_14%,transparent)] font-medium text-[var(--brand-primary)] dark:bg-[color-mix(in_srgb,var(--brand-primary)_30%,transparent)] dark:text-white"
                            : "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="border-t border-[var(--border)] p-2.5">
          <div className="rounded-md bg-[var(--muted)] px-2.5 py-2">
            <p className="text-[10px] text-[var(--muted-foreground)]">Academic term</p>
            <p className="mt-0.5 text-xs font-semibold text-[var(--foreground)]">
              {academicYear || "Not set"}
            </p>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {termName || "No current term"}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
