"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type StageOption = { id: string; name: string };

export function LevelForm({ stages }: { stages: StageOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    stageId: stages[0]?.id || "",
    sortOrder: 1,
  });

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/academics/levels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        stageId: form.stageId || null,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not create level", data.error || "Please try again.");
      return;
    }
    toast.success(
      "Level created",
      "Orders were rearranged so each level has a unique position."
    );
    setForm({
      code: "",
      name: "",
      stageId: form.stageId || stages[0]?.id || "",
      sortOrder: form.sortOrder + 1,
    });
    close();
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add level
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Add grade level"
        description="Use the codes your school already knows."
        size="sm"
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Code</label>
            <Input
              placeholder="P1"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Name</label>
            <Input
              placeholder="Primary 1"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelClassName}>Stage</label>
              <select
                className={selectClassName}
                value={form.stageId}
                onChange={(e) => setForm({ ...form, stageId: e.target.value })}
              >
                <option value="">None</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Sort order</label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Add level"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
