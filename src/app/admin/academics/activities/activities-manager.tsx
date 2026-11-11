"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type StageOption = { id: string; name: string; code: string };
type LevelOption = {
  id: string;
  code: string;
  name: string;
  stageId: string | null;
};

type ActivityItem = {
  id: string;
  code: string;
  name: string;
  stageId: string | null;
  stageName: string | null;
  slotCount: number;
  gradeLevelIds: string[];
  levelLabels: string[];
};

export function ActivitiesManager({
  activities,
  stages,
  levels,
  canWrite,
  total,
  pagination,
}: {
  activities: ActivityItem[];
  stages: StageOption[];
  levels: LevelOption[];
  canWrite: boolean;
  total: number;
  pagination: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    stageId: "",
    gradeLevelIds: [] as string[],
  });

  const selectableLevels = useMemo(() => {
    if (!form.stageId) return levels;
    const stage = stages.find((s) => s.id === form.stageId);
    if (!stage || stage.code === "ALL") return levels;
    return levels.filter((l) => l.stageId === form.stageId);
  }, [form.stageId, levels, stages]);

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm({ code: "", name: "", stageId: "", gradeLevelIds: [] });
  }

  function startCreate() {
    setEditingId(null);
    setForm({ code: "", name: "", stageId: "", gradeLevelIds: [] });
    setOpen(true);
  }

  function startEdit(activity: ActivityItem) {
    setEditingId(activity.id);
    setForm({
      code: activity.code,
      name: activity.name,
      stageId: activity.stageId || "",
      gradeLevelIds: activity.gradeLevelIds,
    });
    setOpen(true);
  }

  function toggleLevel(levelId: string) {
    setForm((prev) => ({
      ...prev,
      gradeLevelIds: prev.gradeLevelIds.includes(levelId)
        ? prev.gradeLevelIds.filter((id) => id !== levelId)
        : [...prev.gradeLevelIds, levelId],
    }));
  }

  function onStageChange(stageId: string) {
    const stage = stages.find((s) => s.id === stageId);
    const nextLevels =
      !stageId || !stage || stage.code === "ALL"
        ? levels
        : levels.filter((l) => l.stageId === stageId);
    const allowed = new Set(nextLevels.map((l) => l.id));
    setForm((prev) => ({
      ...prev,
      stageId,
      gradeLevelIds: prev.gradeLevelIds.filter((id) => allowed.has(id)),
    }));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(
      editingId
        ? `/api/academics/activities/${editingId}`
        : "/api/academics/activities",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          stageId: form.stageId || null,
          gradeLevelIds: form.gradeLevelIds,
        }),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save activity", data.error || "Please try again.");
      return;
    }
    toast.success(editingId ? "Activity updated" : "Activity created");
    close();
    router.refresh();
  }

  async function onDelete() {
    if (!deleteId) return;
    setDeleting(true);
    const res = await fetch(`/api/academics/activities/${deleteId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setDeleting(false);
    if (!res.ok) {
      toast.warning("Cannot delete activity", data.error || "Please try again.");
      setDeleteId(null);
      return;
    }
    toast.success("Activity deleted");
    setDeleteId(null);
    router.refresh();
  }

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add activity
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Activities ({total})</CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Stage</th>
                  <th className="pb-2 font-medium">Levels</th>
                  <th className="pb-2 font-medium">Timetable uses</th>
                  {canWrite ? (
                    <th className="pb-2 font-medium text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {activities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canWrite ? 6 : 5}
                      className="py-6 text-[var(--muted-foreground)]"
                    >
                      No activities match your filters.
                    </td>
                  </tr>
                ) : (
                  activities.map((activity) => (
                    <tr
                      key={activity.id}
                      className="border-t border-[var(--border)]"
                    >
                      <td className="py-2 font-medium">{activity.code}</td>
                      <td className="py-2">{activity.name}</td>
                      <td className="py-2">{activity.stageName || "—"}</td>
                      <td className="py-2">
                        {activity.levelLabels.length > 0
                          ? activity.levelLabels.join(", ")
                          : "All levels in stage"}
                      </td>
                      <td className="py-2">{activity.slotCount}</td>
                      {canWrite ? (
                        <td className="py-2">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => startEdit(activity)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteId(activity.id)}
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
        title={editingId ? "Edit activity" : "Add activity"}
        description="Break, lunch, worship, and similar blocks. Leave levels empty to include every level in the stage. Classes inherit matching activities automatically."
        size="md"
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelClassName}>Code</label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="LUNCH"
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Stage</label>
              <select
                className={selectClassName}
                value={form.stageId}
                onChange={(e) => onStageChange(e.target.value)}
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
              placeholder="Lunch"
              required
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label className={labelClassName}>Levels (multi-select)</label>
              <button
                type="button"
                className="text-[10px] font-medium text-[var(--brand-primary)]"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    gradeLevelIds:
                      prev.gradeLevelIds.length === selectableLevels.length
                        ? []
                        : selectableLevels.map((l) => l.id),
                  }))
                }
              >
                {form.gradeLevelIds.length === selectableLevels.length
                  ? "Clear all"
                  : "Select all"}
              </button>
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-[var(--border)] p-2">
              {selectableLevels.length === 0 ? (
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  No levels available for this stage.
                </p>
              ) : (
                selectableLevels.map((level) => {
                  const checked = form.gradeLevelIds.includes(level.id);
                  return (
                    <label
                      key={level.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-[var(--muted)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleLevel(level.id)}
                      />
                      <span>
                        {level.code} — {level.name}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
            <p className="text-[10px] text-[var(--muted-foreground)]">
              {form.gradeLevelIds.length === 0
                ? "No levels selected → applies to all levels in the chosen stage."
                : `${form.gradeLevelIds.length} level${form.gradeLevelIds.length === 1 ? "" : "s"} selected.`}
            </p>
          </div>
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

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => (deleting ? undefined : setDeleteId(null))}
        onConfirm={onDelete}
        title="Delete activity?"
        description="This permanently removes the activity from the catalog. Timetable slots must be cleared first."
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
      />
    </>
  );
}
