"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function ClickableRow({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();

  function go() {
    router.push(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={go}
      onKeyDown={onKeyDown}
      className={cn(
        "cursor-pointer border-t border-[var(--border)] hover:bg-[var(--muted)]/40 focus-visible:bg-[var(--muted)]/50 focus-visible:outline-none",
        className
      )}
    >
      {children}
    </tr>
  );
}
