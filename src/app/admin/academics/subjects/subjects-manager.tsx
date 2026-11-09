"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type StageOption = { id: string; name: string };

type SubjectItem = {
  id: string;
  code: string;
  name: string;
  stageId: string | null;
  stageName: string | null;
  isCore: boolean;
  assignmentCount: number;
};

export function SubjectsManager({
  subjects,
  stages,
  canWrite,
  total,
  pagination,
}: {
  subjects: SubjectItem[];
  stages: StageOption[];
  canWrite: boolean;
  total: number;
  pagination: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    stageId: "",
    isCore: true,
  });

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm({ code: "", name: "", stageId: "", isCore: true });
  }

  function startCreate() {
    setEditingId(null);
    setForm({ code: "", name: "", stageId: "", isCore: true });
    setOpen(true);
  }

  function startEdit(subject: SubjectItem) {
    setEditingId(subject.id);
    setForm({
      code: subject.code,
      name: subject.name,
      stageId: subject.stageId || "",
      isCore: subject.isCore,
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(
      editingId ? `/api/academics/subjects/${editingId}` : "/api/academics/subjects",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          stageId: form.stageId || null,
        }),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save subject", data.error || "Please try again.");
      return;
    }
    toast.success(editingId ? "Subject updated" : "Subject created");
    close();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this subject?")) return;
    const res = await fetch(`/api/academics/subjects/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.warning("Cannot delete subject", data.error || "Please try again.");
      return;
    }
    toast.success("Subject deleted");
    router.refresh();
  }

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add subject
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Subjects ({total})</CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Type</th>
                  <th className="pb-2 font-medium">Assignments</th>
                  {canWrite ? (
                    <th className="pb-2 font-medium text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canWrite ? 6 : 5}
                      className="py-6 text-[var(--muted-foreground)]"
                    >
                      No subjects match your filters.
                    </td>
                  </tr>
                ) : (
                  subjects.map((subject) => (
                    <tr key={subject.id} className="border-t border-[var(--border)]">
                      <td className="py-2 font-medium">{subject.code}</td>
                      <td className="py-2">{subject.name}</td>
                      <td className="py-2">{subject.stageName || "—"}</td>
                      <td className="py-2">{subject.isCore ? "Core" : "Elective"}</td>
                      <td className="py-2">{subject.assignmentCount}</td>
                      {canWrite ? (
                        <td className="py-2">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => startEdit(subject)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(subject.id)}
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
          {pagination}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title={editingId ? "Edit subject" : "Add subject"}
        description="Subjects are assigned to teachers per class and year."
        size="sm"
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelClassName}>Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="MATH"
                required
              />
            </div>
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
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Mathematics"
              required
            />
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.isCore}
              onChange={(e) => setForm({ ...form, isCore: e.target.checked })}
            />
            Core subject
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
