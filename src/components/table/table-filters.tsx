"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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
      /** Hide the empty "All" option (useful for required filters like year). */
      allowEmpty?: boolean;
      emptyLabel?: string;
    };

function buildValues(
  fields: FilterField[],
  searchParams: URLSearchParams,
  defaults: Record<string, string>
) {
  const next: Record<string, string> = {};
  for (const field of fields) {
    next[field.key] =
      searchParams.get(field.key) || defaults[field.key] || "";
  }
  return next;
}

function valuesEqual(a: Record<string, string>, b: Record<string, string>) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if ((a[key] || "") !== (b[key] || "")) return false;
  }
  return true;
}

export function TableFilters({
  fields,
  defaultOpen = true,
  defaults,
}: {
  fields: FilterField[];
  defaultOpen?: boolean;
  /** Fallback values when the URL does not include the key yet. */
  defaults?: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState<boolean>(defaultOpen);
  const defaultsRef = useRef(defaults || {});
  defaultsRef.current = defaults || {};

  const searchKey = searchParams.toString();
  const fieldKeys = fields.map((f) => f.key).join("|");

  const [values, setValues] = useState<Record<string, string>>(() =>
    buildValues(fields, searchParams, defaultsRef.current)
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fieldsRef = useRef(fields);
  fieldsRef.current = fields;

  const selectFields = useMemo(
    () => fields.filter((f) => f.type === "select"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldKeys, fields]
  );
  const textFields = useMemo(
    () => fields.filter((f) => f.type === "text"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fieldKeys, fields]
  );

  const activeCount = useMemo(() => {
    const params = new URLSearchParams(searchKey);
    return fieldsRef.current.filter((field) =>
      Boolean(
        (params.get(field.key) || defaultsRef.current[field.key] || "").trim()
      )
    ).length;
  }, [searchKey, fieldKeys]);

  // Sync from URL only when the query string (or field keys) actually change.
  useEffect(() => {
    const params = new URLSearchParams(searchKey);
    const next = buildValues(fieldsRef.current, params, defaultsRef.current);
    setValues((prev) => (valuesEqual(prev, next) ? prev : next));
  }, [searchKey, fieldKeys]);

  function applyValues(nextValues: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    fieldsRef.current.forEach((field) => {
      const value = nextValues[field.key]?.trim();
      if (value) params.set(field.key, value);
      else params.delete(field.key);
    });
    params.set("page", "1");
    const nextQuery = params.toString();
    if (nextQuery === searchParams.toString()) return;
    startTransition(() => {
      router.push(`${pathname}?${nextQuery}`);
    });
  }

  function updateField(key: string, value: string, immediate = false) {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (immediate) {
        applyValues(next);
      } else {
        debounceRef.current = setTimeout(() => applyValues(next), 350);
      }
      return next;
    });
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function onReset() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const params = new URLSearchParams(searchParams.toString());
    fieldsRef.current.forEach((field) => params.delete(field.key));
    params.set("page", "1");
    const cleared: Record<string, string> = {};
    fieldsRef.current.forEach((field) => {
      cleared[field.key] = "";
    });
    setValues(cleared);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function renderField(field: FilterField, className?: string) {
    return (
      <div key={field.key} className={cn("min-w-0 space-y-1", className)}>
        <label className={labelClassName}>{field.label}</label>
        {field.type === "text" ? (
          <Input
            value={values[field.key] || ""}
            placeholder={field.placeholder}
            onChange={(e) => updateField(field.key, e.target.value)}
          />
        ) : (
          <select
            className={selectClassName}
            value={values[field.key] || ""}
            onChange={(e) => updateField(field.key, e.target.value, true)}
          >
            {field.allowEmpty === false ? null : (
              <option value="">{field.emptyLabel || "All"}</option>
            )}
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        )}
      </div>
    );
  }

  const manySelects = selectFields.length >= 3;

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
          {pending ? (
            <span className="text-[10px] text-[var(--muted-foreground)]">
              Updating…
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
        <div className="space-y-2.5 border-t border-[var(--border)] p-2.5">
          {manySelects ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end lg:grid lg:grid-cols-4 xl:grid-cols-5">
                {selectFields.map((field) =>
                  renderField(field, "sm:min-w-[10rem] sm:flex-1 lg:min-w-0")
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                {textFields.map((field) =>
                  renderField(field, "sm:min-w-[14rem] sm:flex-1")
                )}
                <div className="flex shrink-0 items-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={onReset}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end lg:flex-nowrap">
              {selectFields.map((field) =>
                renderField(field, "sm:min-w-[9.5rem] sm:flex-1")
              )}
              {textFields.map((field) =>
                renderField(field, "sm:min-w-[12rem] sm:flex-1")
              )}
              <div className="flex shrink-0 items-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onReset}
                >
                  Reset
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
