"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName } from "@/lib/field-styles";

type StageItem = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  levelCount: number;
  subjectCount: number;
};

export function StagesManager({
  stages,
  canWrite,
}: {
  stages: StageItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    description: "",
    sortOrder: 0,
    isActive: true,
  });

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm({
      code: "",
      name: "",
      description: "",
      sortOrder: stages.length + 1,
      isActive: true,
    });
  }

  function startCreate() {
    setEditingId(null);
    setForm({
      code: "",
      name: "",
      description: "",
      sortOrder: stages.length + 1,
      isActive: true,
    });
    setOpen(true);
  }

  function startEdit(stage: StageItem) {
    setEditingId(stage.id);
    setForm({
      code: stage.code,
      name: stage.name,
      description: stage.description || "",
      sortOrder: stage.sortOrder,
      isActive: stage.isActive,
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(
      editingId ? `/api/academics/stages/${editingId}` : "/api/academics/stages",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save stage", data.error || "Please try again.");
      return;
    }
    toast.success(
      editingId ? "Stage updated" : "Stage created",
      "Orders were rearranged so each stage has a unique position."
    );
    close();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this stage?")) return;
    const res = await fetch(`/api/academics/stages/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.warning("Cannot delete stage", data.error || "Please try again.");
      return;
    }
    toast.success("Stage deleted");
    router.refresh();
  }

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add stage
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Stages ({stages.length})</CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Order</th>
                  <th className="pb-2 font-medium">Levels</th>
                  <th className="pb-2 font-medium">Subjects</th>
                  <th className="pb-2 font-medium">Status</th>
                  {canWrite ? (
                    <th className="pb-2 font-medium text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {stages.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canWrite ? 7 : 6}
                      className="py-6 text-[var(--muted-foreground)]"
                    >
                      No stages yet.
                    </td>
                  </tr>
                ) : (
                  stages.map((stage) => (
                    <tr key={stage.id} className="border-t border-[var(--border)]">
                      <td className="py-2 font-medium">{stage.code}</td>
                      <td className="py-2">
                        <p>{stage.name}</p>
                        {stage.description ? (
                          <p className="text-[10px] text-[var(--muted-foreground)]">
                            {stage.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-2">{stage.sortOrder}</td>
                      <td className="py-2">{stage.levelCount}</td>
                      <td className="py-2">{stage.subjectCount}</td>
                      <td className="py-2">{stage.isActive ? "Active" : "Inactive"}</td>
                      {canWrite ? (
                        <td className="py-2">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => startEdit(stage)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(stage.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title={editingId ? "Edit stage" : "Add stage"}
        description="Stages group levels and subjects (e.g. Primary, JHS)."
        size="sm"
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelClassName}>Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="PRIMARY"
                required
              />
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
          <div className="space-y-1">
            <label className={labelClassName}>Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Primary"
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Active
          </label>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
