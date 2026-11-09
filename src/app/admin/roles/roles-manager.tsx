"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName } from "@/lib/field-styles";

type PermissionOption = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  module: string;
};

type RoleItem = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissionIds: string[];
};

export function RolesManager({
  roles,
  permissions,
}: {
  roles: RoleItem[];
  permissions: PermissionOption[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionOption[]>();
    permissions.forEach((permission) => {
      const list = map.get(permission.module) || [];
      list.push(permission);
      map.set(permission.module, list);
    });
    return Array.from(map.entries());
  }, [permissions]);

  function reset() {
    setEditingId(null);
    setName("");
    setDescription("");
    setSelected([]);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function startCreate() {
    reset();
    setOpen(true);
  }

  function startEdit(role: RoleItem) {
    setEditingId(role.id);
    setName(role.name);
    setDescription(role.description || "");
    setSelected(role.permissionIds);
    setOpen(true);
  }

  function togglePermission(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      name,
      description,
      permissionIds: selected,
    };
    const res = await fetch(editingId ? `/api/roles/${editingId}` : "/api/roles", {
      method: editingId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save role", data.error || "Please try again.");
      return;
    }
    toast.success(editingId ? "Role updated" : "Role created");
    close();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this role?")) return;
    const res = await fetch(`/api/roles/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.warning("Cannot delete role", data.error || "Please try again.");
      return;
    }
    toast.success("Role deleted");
    if (editingId === id) close();
    router.refresh();
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button type="button" size="sm" onClick={startCreate}>
          <Plus className="h-3.5 w-3.5" />
          Create role
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Roles ({roles.length})</CardTitle>
        </CardHeader>
        <CardBody className="pt-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Permissions</th>
                  <th className="pb-2 font-medium">Users</th>
                  <th className="pb-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-t border-[var(--border)]">
                    <td className="py-2">
                      <p className="font-medium">
                        {role.name}
                        {role.isSystem ? (
                          <span className="ml-1.5 text-[10px] text-[var(--muted-foreground)]">
                            system
                          </span>
                        ) : null}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {role.description || "No description"}
                      </p>
                    </td>
                    <td className="py-2">{role.permissionIds.length}</td>
                    <td className="py-2">{role.userCount}</td>
                    <td className="py-2">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => startEdit(role)}
                        >
                          Edit
                        </Button>
                        {!role.isSystem ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(role.id)}
                          >
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={close}
        title={editingId ? "Edit role" : "Create role"}
        description="Select the permissions this role should grant."
        size="lg"
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClassName}>Role name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Description</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {grouped.map(([module, items]) => (
              <div key={module} className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  {module}
                </p>
                <div className="grid gap-1.5 rounded-md border border-[var(--border)] p-2 sm:grid-cols-2">
                  {items.map((permission) => (
                    <label
                      key={permission.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selected.includes(permission.id)}
                        onChange={() => togglePermission(permission.id)}
                      />
                      <span>
                        <span className="font-medium">{permission.name}</span>
                        <span className="block text-[10px] text-[var(--muted-foreground)]">
                          {permission.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving || selected.length === 0}>
              {saving ? "Saving…" : editingId ? "Update role" : "Create role"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
