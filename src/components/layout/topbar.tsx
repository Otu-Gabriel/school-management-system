"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTheme } from "@/components/providers/theme-provider";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  UserRound,
} from "lucide-react";
import { useMobileNav } from "@/components/layout/mobile-nav";

export function Topbar({
  title,
  backHref,
  backLabel = "Back",
}: {
  title: string;
  backHref?: string;
  backLabel?: string;
}) {
  const { data } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { openNav } = useMobileNav();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const user = data?.user;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:gap-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] lg:hidden"
          onClick={openNav}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          {backHref ? (
            <Link
              href={backHref}
              className="mb-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-3 w-3" />
              <span className="truncate">{backLabel}</span>
            </Link>
          ) : null}
          <h1 className="truncate text-sm font-semibold text-[var(--foreground)]">
            {title}
          </h1>
          {!backHref ? (
            <p className="hidden text-[11px] text-[var(--muted-foreground)] sm:block">
              Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
            </p>
          ) : null}
        </div>
      </div>

      <div className="hidden max-w-sm flex-1 items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 md:flex">
        <Search className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
        <input
          className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--muted-foreground)]"
          placeholder="Search students, staff, classes..."
        />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          className="rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </button>
        <button
          type="button"
          className="hidden rounded-md p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] sm:inline-flex"
          aria-label="Notifications"
        >
          <Bell className="h-3.5 w-3.5" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md px-1 py-1 hover:bg-[var(--muted)] sm:px-1.5"
          >
            <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-[var(--brand-primary)] text-[10px] font-semibold text-white">
              {user?.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.image} alt="" className="h-full w-full object-cover" />
              ) : (
                (user?.name || "A").slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="hidden text-left md:block">
              <p className="text-xs font-medium leading-tight text-[var(--foreground)]">
                {user?.name || "User"}
              </p>
              <p className="text-[10px] leading-tight text-[var(--muted-foreground)]">
                {user?.roleName || "—"}
              </p>
            </div>
            <ChevronDown className="hidden h-3.5 w-3.5 text-[var(--muted-foreground)] sm:block" />
          </button>

          {open && (
            <div className="absolute right-0 z-20 mt-1.5 w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] shadow-sm">
              <Link
                href="/admin/account"
                className="flex w-full items-center gap-2 px-2.5 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => setOpen(false)}
              >
                <UserRound className="h-3.5 w-3.5" />
                My account
              </Link>
              <button
                type="button"
                className="flex w-full items-center gap-2 border-t border-[var(--border)] px-2.5 py-2 text-xs text-[var(--foreground)] hover:bg-[var(--muted)]"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
