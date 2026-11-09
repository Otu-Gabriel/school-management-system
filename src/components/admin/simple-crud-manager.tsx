"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type Item = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  meta?: string;
  departmentId?: string | null;
};

export function SimpleCrudManager({
  title,
  endpoint,
  items,
  departmentOptions,
}: {
  title: string;
  endpoint: string;
  items: Item[];
  departmentOptions?: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const singular = title.endsWith("s")
    ? title.slice(0, -1).toLowerCase()
    : title.toLowerCase();

  function reset() {
    setEditingId(null);
    setName("");
    setDescription("");
    setDepartmentId("");
    setIsActive(true);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function startCreate() {
    reset();
    setOpen(true);
  }

  function startEdit(item: Item) {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description || "");
    setDepartmentId(item.departmentId || "");
    setIsActive(item.isActive);
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload: Record<string, unknown> = {
      name,
      description,
      isActive,
    };
    if (departmentOptions) {
      payload.departmentId = departmentId || null;
    }

    const res = await fetch(editingId ? `${endpoint}/${editingId}` : endpoint, {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(`Could not save ${singular}`, data.error || "Please try again.");
      return;
    }
    toast.success(editingId ? `${title.slice(0, -1) || title} updated` : `${singular.charAt(0).toUpperCase()}${singular.slice(1)} created`);
    close();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this item?")) return;
    const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.warning(`Cannot delete ${singular}`, data.error || "Please try again.");
      return;
    }
    toast.success(`${singular.charAt(0).toUpperCase()}${singular.slice(1)} deleted`);
    if (editingId === id) close();
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5" />
          Add {singular}
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>
            {title} ({items.length})
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-2">
          {items.length === 0 ? (
            <p className="py-6 text-xs text-[var(--muted-foreground)]">No records yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Details</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="py-2 font-medium">{item.name}</td>
                      <td className="py-2 text-[var(--muted-foreground)]">
                        {item.description || "—"}
                        {item.meta ? ` · ${item.meta}` : ""}
                      </td>
                      <td className="py-2">{item.isActive ? "Active" : "Inactive"}</td>
                      <td className="py-2">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(item.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title={
          editingId
            ? `Edit ${title.endsWith("s") ? title.slice(0, -1).toLowerCase() : title.toLowerCase()}`
            : `Add ${title.endsWith("s") ? title.slice(0, -1).toLowerCase() : title.toLowerCase()}`
        }
        size="sm"
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          {departmentOptions ? (
            <div className="space-y-1">
              <label className={labelClassName}>Department</label>
              <select
                className={selectClassName}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">None</option>
                {departmentOptions.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
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
