import type { ReactNode } from "react";

export function PageHeader({
  description,
  actions,
}: {
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      {description ? (
        <p className="max-w-2xl text-xs text-[var(--muted-foreground)]">
          {description}
        </p>
      ) : (
        <span className="hidden sm:block" />
      )}
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
