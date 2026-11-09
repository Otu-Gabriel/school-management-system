"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { FormEvent, useMemo, useState, useTransition } from "react";
import { ChevronDown, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { labelClassName, selectClassName } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

export type FilterField =
  | {
      key: string;
      label: string;
      type: "text";
      placeholder?: string;
    }
  | {
      key: string;
      label: string;
      type: "select";
      options: Array<{ value: string; label: string }>;
    };

export function TableFilters({ fields }: { fields: FilterField[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach((field) => {
      initial[field.key] = searchParams.get(field.key) || "";
    });
    return initial;
  });

  const activeCount = useMemo(
    () => fields.filter((field) => Boolean(searchParams.get(field.key)?.trim())).length,
    [fields, searchParams]
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    fields.forEach((field) => {
      const value = values[field.key]?.trim();
      if (value) params.set(field.key, value);
      else params.delete(field.key);
    });
    params.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function onReset() {
    const params = new URLSearchParams(searchParams.toString());
    fields.forEach((field) => params.delete(field.key));
    params.set("page", "1");
    const cleared: Record<string, string> = {};
    fields.forEach((field) => {
      cleared[field.key] = "";
    });
    setValues(cleared);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--foreground)]">
          <Filter className="h-3.5 w-3.5 text-[var(--muted-foreground)]" />
          Filters
          {activeCount > 0 ? (
            <span className="rounded-full bg-[color-mix(in_srgb,var(--brand-primary)_14%,transparent)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--brand-primary)] dark:text-white">
              {activeCount}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-[var(--muted-foreground)] transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open ? (
        <form
          onSubmit={onSubmit}
          className="grid gap-2 border-t border-[var(--border)] p-2.5 sm:grid-cols-2 lg:grid-cols-4"
        >
          {fields.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className={labelClassName}>{field.label}</label>
              {field.type === "text" ? (
                <Input
                  value={values[field.key] || ""}
                  placeholder={field.placeholder}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                />
              ) : (
                <select
                  className={selectClassName}
                  value={values[field.key] || ""}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                >
                  <option value="">All</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
          <div className="flex flex-wrap items-end gap-1.5 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Filtering…" : "Apply"}
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onReset}>
              Reset
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
