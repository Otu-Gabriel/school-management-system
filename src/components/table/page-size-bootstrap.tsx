"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_STORAGE_KEY,
  parsePageSize,
} from "@/lib/table";

/** Applies saved default page size when URL has no perPage. */
export function PageSizeBootstrap() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.has("perPage")) return;

    const stored = window.localStorage.getItem(PAGE_SIZE_STORAGE_KEY);
    const size = parsePageSize(stored || String(DEFAULT_PAGE_SIZE));
    const params = new URLSearchParams(searchParams.toString());
    params.set("perPage", String(size));
    if (!params.has("page")) params.set("page", "1");
    router.replace(`${pathname}?${params.toString()}`);
  }, [pathname, router, searchParams]);

  return null;
}
