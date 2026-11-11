"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { ClassForm, type ClassFormValues } from "./class-form";

export function ClassActions({
  classItem,
  canWrite,
  levels,
  staff,
  academicYearId,
}: {
  classItem: ClassFormValues & {
    id: string;
    isActive: boolean;
  };
  canWrite: boolean;
  levels: { id: string; label: string }[];
  staff: { id: string; label: string }[];
  academicYearId: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  if (!canWrite) return null;

  async function setActive(next: boolean) {
    setBusy(true);
    const res = await fetch(`/api/academics/classes/${classItem.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: next }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setArchiveOpen(false);
    setRestoreOpen(false);
    if (!res.ok) {
      toast.error("Could not update class", data.error || "Please try again.");
      return;
    }
    toast.success(next ? "Class restored" : "Class archived");
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    const res = await fetch(`/api/academics/classes/${classItem.id}`, {
      method: "DELETE",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setDeleteOpen(false);
    if (!res.ok) {
      toast.warning("Cannot delete", data.error || "Archive it instead.");
      return;
    }
    toast.success("Class deleted");
    router.refresh();
  }

  return (
    <>
      <div
        className="flex justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setEditOpen(true)}
        >
          Edit
        </Button>
        {classItem.isActive ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setArchiveOpen(true)}
          >
            Archive
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => setRestoreOpen(true)}
          >
            Restore
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setDeleteOpen(true)}
        >
          Delete
        </Button>
      </div>

      <ClassForm
        mode="edit"
        trigger={false}
        open={editOpen}
        onOpenChange={setEditOpen}
        academicYearId={academicYearId}
        levels={levels}
        staff={staff}
        initial={{
          id: classItem.id,
          gradeLevelId: classItem.gradeLevelId,
          name: classItem.name,
          section: classItem.section || "",
          classTeacherId: classItem.classTeacherId || "",
          room: classItem.room || "",
          isActive: classItem.isActive,
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onClose={() => setArchiveOpen(false)}
        onConfirm={() => setActive(false)}
        busy={busy}
        title="Archive this class?"
        description="The class will be hidden from active lists but kept for history. Students currently or previously in this class remain linked."
        confirmLabel="Yes, archive"
      />

      <ConfirmDialog
        open={restoreOpen}
        onClose={() => setRestoreOpen(false)}
        onConfirm={() => setActive(true)}
        busy={busy}
        title="Restore this class?"
        description="The class will appear again in active class lists for this academic year."
        confirmLabel="Yes, restore"
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={onDelete}
        busy={busy}
        tone="danger"
        title="Delete this class permanently?"
        description="This is only allowed if no current or historical students reference the class. Prefer Archive when the class was used."
        confirmLabel="Yes, delete"
      />
    </>
  );
}
