"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "error" | "warning" | "info";

type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  tone: ToastTone;
  durationMs: number;
};

type ToastApi = {
  push: (toast: ToastInput) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const TONE_STYLES: Record<
  ToastTone,
  { icon: typeof CheckCircle2; bar: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle2,
    bar: "bg-emerald-500",
    iconClass: "text-emerald-600 dark:text-emerald-400",
  },
  error: {
    icon: XCircle,
    bar: "bg-red-500",
    iconClass: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    bar: "bg-amber-500",
    iconClass: "text-amber-600 dark:text-amber-400",
  },
  info: {
    icon: Info,
    bar: "bg-[var(--brand-primary)]",
    iconClass: "text-[var(--brand-primary)]",
  },
};

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  const tone = TONE_STYLES[toast.tone];
  const Icon = tone.icon;

  useEffect(() => {
    if (toast.durationMs <= 0) return;
    const timer = window.setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => window.clearTimeout(timer);
  }, [toast.durationMs, toast.id, onDismiss]);

  return (
    <div
      role="status"
      className={cn(
        "pointer-events-auto relative flex w-[min(100vw-1.5rem,22rem)] overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-[0_10px_30px_-12px_rgba(15,23,42,0.35)]",
        "animate-[toast-in-top_220ms_ease-out]"
      )}
    >
      <div className={cn("w-1 shrink-0", tone.bar)} />
      <div className="flex min-w-0 flex-1 gap-2.5 p-3">
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone.iconClass)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[var(--foreground)]">
            {toast.title}
          </p>
          {toast.description ? (
            <p className="mt-0.5 text-[11px] leading-snug text-[var(--muted-foreground)]">
              {toast.description}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => onDismiss(toast.id)}
          className="rounded p-0.5 text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {toast.durationMs > 0 ? (
        <span
          className={cn("absolute bottom-0 left-0 h-0.5 origin-left", tone.bar)}
          style={{
            animation: `toast-progress ${toast.durationMs}ms linear forwards`,
          }}
        />
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `toast-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setItems((prev) => [
      ...prev,
      {
        id,
        title: toast.title,
        description: toast.description,
        tone: toast.tone || "info",
        durationMs: toast.durationMs ?? 4200,
      },
    ].slice(-5));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (title, description) =>
        push({ title, description, tone: "success" }),
      error: (title, description) =>
        push({ title, description, tone: "error", durationMs: 5600 }),
      warning: (title, description) =>
        push({ title, description, tone: "warning", durationMs: 5000 }),
      info: (title, description) => push({ title, description, tone: "info" }),
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed top-3 right-3 z-[100] flex flex-col gap-2 sm:top-4 sm:right-4"
      >
        {items.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      push: () => {},
      dismiss: () => {},
      success: () => {},
      error: () => {},
      warning: () => {},
      info: () => {},
    } satisfies ToastApi;
  }
  return ctx;
}
