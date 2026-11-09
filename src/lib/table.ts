export const PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_STORAGE_KEY = "sms.table.pageSize";

export function parsePage(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw || 1);
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
}

export function parsePageSize(value?: string | string[]) {
  const raw = Array.isArray(value) ? value[0] : value;
  const size = Number(raw || DEFAULT_PAGE_SIZE);
  if (!Number.isFinite(size) || size <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(100, Math.floor(size));
}

export function getTotalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}
