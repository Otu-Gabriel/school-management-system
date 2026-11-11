"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";

export function RecordActions({
  editHref,
  deleteUrl,
  deleteLabel = "Delete this record?",
  successMessage = "Deleted",
}: {
  editHref: string;
  deleteUrl: string;
  deleteLabel?: string;
  successMessage?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  async function onDelete() {
    setBusy(true);
    const res = await fetch(deleteUrl, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setOpen(false);
    if (!res.ok) {
      toast.warning("Cannot delete", data.error || "Please try again.");
      return;
    }
    toast.success(successMessage);
    router.refresh();
  }

  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Link href={editHref}>
          <Button type="button" size="sm" variant="secondary">
            Edit
          </Button>
        </Link>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setOpen(true)}
        >
          {busy ? "…" : "Delete"}
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={onDelete}
        busy={busy}
        tone="danger"
        title="Confirm delete"
        description={deleteLabel}
        confirmLabel="Yes, delete"
      />
    </>
  );
}
