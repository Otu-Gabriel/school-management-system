"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function PasswordInput({
  className,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={cn(
        "flex h-8 w-full items-center overflow-hidden rounded-md border border-[var(--border)] bg-[var(--surface)] focus-within:ring-2 focus-within:ring-[var(--brand-primary)]",
        className
      )}
    >
      <input
        {...props}
        type={visible ? "text" : "password"}
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 text-xs text-[var(--foreground)] outline-none placeholder:text-[var(--muted-foreground)]"
      />
      <button
        type="button"
        className="inline-flex h-full w-8 shrink-0 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}
