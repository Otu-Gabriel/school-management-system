"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  busy = false,
  tone = "default",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <Modal open={open} onClose={busy ? () => undefined : onClose} title={title} size="sm">
      <div className="space-y-3">
        <p className="text-xs text-[var(--muted-foreground)]">{description}</p>
        <div className="flex justify-end gap-1.5">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            size="sm"
            variant={tone === "danger" ? "secondary" : "primary"}
            disabled={busy}
            className={
              tone === "danger"
                ? "bg-rose-600 text-white hover:bg-rose-700"
                : undefined
            }
            onClick={() => void onConfirm()}
          >
            {busy ? "Please wait…" : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
