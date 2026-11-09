"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZE_STORAGE_KEY,
} from "@/lib/table";
import { selectClassName } from "@/lib/field-styles";

export function TablePagination({
  page,
  pageSize,
  total,
  totalPages,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const stored = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(DEFAULT_PAGE_SIZE));
    }
  }, []);

  function updateParams(next: { page?: number; perPage?: number }) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.page) params.set("page", String(next.page));
    if (next.perPage) {
      params.set("perPage", String(next.perPage));
      window.localStorage.setItem(PAGE_SIZE_STORAGE_KEY, String(next.perPage));
      params.set("page", "1");
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-[var(--border)] pt-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[11px] text-[var(--muted-foreground)]">
        Showing {from}–{to} of {total}
        {pending ? "…" : ""}
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 sm:justify-end">
        <label className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
          Rows
          <select
            className={`${selectClassName} w-auto min-w-14`}
            value={pageSize}
            onChange={(e) => updateParams({ perPage: Number(e.target.value) })}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => updateParams({ page: page - 1 })}
          >
            Prev
          </Button>
          <span className="min-w-10 text-center text-[11px] text-[var(--muted-foreground)]">
            {page}/{totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => updateParams({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
