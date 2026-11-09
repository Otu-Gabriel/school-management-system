"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

export function ClassForm({
  academicYearId,
  levels,
  staff,
}: {
  academicYearId: string | null;
  levels: { id: string; label: string }[];
  staff: { id: string; label: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    gradeLevelId: "",
    name: "",
    section: "",
    classTeacherId: "",
    room: "",
  });

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!academicYearId) {
      toast.warning(
        "No current year",
        "Create and set a current academic year first."
      );
      return;
    }
    setSaving(true);
    const res = await fetch("/api/academics/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, academicYearId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not create class", data.error || "Please try again.");
      return;
    }
    toast.success("Class created");
    setForm({
      gradeLevelId: form.gradeLevelId,
      name: "",
      section: "",
      classTeacherId: "",
      room: "",
    });
    close();
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add class
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Add class / section"
        description="Create a class under a level for the current year."
      >
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClassName}>Level</label>
            <select
              className={selectClassName}
              value={form.gradeLevelId}
              onChange={(e) => setForm({ ...form, gradeLevelId: e.target.value })}
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
              onChange={(e) => setForm({ ...form, classTeacherId: e.target.value })}
            >
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-1.5 md:col-span-2">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Add class"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
