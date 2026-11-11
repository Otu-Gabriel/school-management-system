"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

export type ClassFormValues = {
  id?: string;
  gradeLevelId: string;
  name: string;
  section: string;
  classTeacherId: string;
  room: string;
  isActive?: boolean;
};

const emptyForm: ClassFormValues = {
  gradeLevelId: "",
  name: "",
  section: "",
  classTeacherId: "",
  room: "",
  isActive: true,
};

export function ClassForm({
  academicYearId,
  levels,
  staff,
  mode = "create",
  initial,
  open: controlledOpen,
  onOpenChange,
  trigger = true,
}: {
  academicYearId: string | null;
  levels: { id: string; label: string }[];
  staff: { id: string; label: string }[];
  mode?: "create" | "edit";
  initial?: ClassFormValues | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ClassFormValues>(initial || emptyForm);

  useEffect(() => {
    if (open) {
      setForm(initial || emptyForm);
    }
  }, [open, initial]);

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!academicYearId && mode === "create") {
      toast.warning(
        "No academic year",
        "Select or create an academic year first."
      );
      return;
    }
    setSaving(true);

    const res =
      mode === "edit" && form.id
        ? await fetch(`/api/academics/classes/${form.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gradeLevelId: form.gradeLevelId,
              name: form.name,
              section: form.section || null,
              classTeacherId: form.classTeacherId || null,
              room: form.room || null,
              isActive: form.isActive ?? true,
            }),
          })
        : await fetch("/api/academics/classes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...form,
              academicYearId,
              classTeacherId: form.classTeacherId || null,
              section: form.section || null,
              room: form.room || null,
            }),
          });

    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(
        mode === "edit" ? "Could not update class" : "Could not create class",
        data.error || "Please try again."
      );
      return;
    }
    toast.success(mode === "edit" ? "Class updated" : "Class created");
    if (mode === "create") {
      setForm({
        ...emptyForm,
        gradeLevelId: form.gradeLevelId,
      });
    }
    close();
    router.refresh();
  }

  return (
    <>
      {trigger && mode === "create" ? (
        <Button type="button" size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add class
        </Button>
      ) : null}

      <Modal
        open={open}
        onClose={close}
        title={mode === "edit" ? "Edit class" : "Add class / section"}
        description={
          mode === "edit"
            ? "Update class details for this academic year."
            : "Create a class under a level for the selected year."
        }
      >
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClassName}>Level</label>
            <select
              className={selectClassName}
              value={form.gradeLevelId}
              onChange={(e) =>
                setForm({ ...form, gradeLevelId: e.target.value })
              }
              required
            >
              <option value="">Select level</option>
              {levels.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Class name</label>
            <Input
              placeholder="A / Gold / Blue"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Section label</label>
            <Input
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Room</label>
            <Input
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className={labelClassName}>Class teacher</label>
            <select
              className={selectClassName}
              value={form.classTeacherId}
              onChange={(e) =>
                setForm({ ...form, classTeacherId: e.target.value })
              }
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          {mode === "edit" ? (
            <label className="flex items-center gap-2 text-xs md:col-span-2">
              <input
                type="checkbox"
                checked={form.isActive ?? true}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              Active (uncheck to archive)
            </label>
          ) : null}
          <div className="flex justify-end gap-1.5 md:col-span-2">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving
                ? "Saving…"
                : mode === "edit"
                  ? "Save changes"
                  : "Add class"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
