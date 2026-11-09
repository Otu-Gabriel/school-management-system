"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarCell } from "@/components/table/avatar-cell";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type GuardianItem = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  photoUrl: string | null;
  children: string;
};

type StudentOption = { id: string; label: string };

export function GuardiansManager({
  guardians,
  students,
  canWrite,
  total,
  pagination,
}: {
  guardians: GuardianItem[];
  students: StudentOption[];
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
    fullName: "",
    phone: "",
    email: "",
    occupation: "",
    address: "",
    photoUrl: "",
    studentId: "",
    relationship: "GUARDIAN",
    isPrimary: false,
  });

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm({
      fullName: "",
      phone: "",
      email: "",
      occupation: "",
      address: "",
      photoUrl: "",
      studentId: "",
      relationship: "GUARDIAN",
      isPrimary: false,
    });
  }

  function startCreate() {
    setEditingId(null);
    setForm({
      fullName: "",
      phone: "",
      email: "",
      occupation: "",
      address: "",
      photoUrl: "",
      studentId: "",
      relationship: "GUARDIAN",
      isPrimary: false,
    });
    setOpen(true);
  }

  function startEdit(item: GuardianItem) {
    setEditingId(item.id);
    setForm({
      fullName: item.fullName,
      phone: item.phone || "",
      email: item.email || "",
      occupation: item.occupation || "",
      address: item.address || "",
      photoUrl: item.photoUrl || "",
      studentId: "",
      relationship: "GUARDIAN",
      isPrimary: false,
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = editingId
      ? {
          fullName: form.fullName,
          phone: form.phone,
          email: form.email,
          occupation: form.occupation,
          address: form.address,
          photoUrl: form.photoUrl,
        }
      : {
          ...form,
          studentId: form.studentId || null,
        };

    const res = await fetch(
      editingId ? `/api/guardians/${editingId}` : "/api/guardians",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save parent", data.error || "Please try again.");
      return;
    }
    toast.success(editingId ? "Parent updated" : "Parent created");
    close();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Delete this parent? Links to students will be removed.")) return;
    const res = await fetch(`/api/guardians/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      toast.warning("Cannot delete parent", data.error || "Please try again.");
      return;
    }
    toast.success("Parent deleted");
    router.refresh();
  }

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add parent
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Parents / Guardians ({total})</CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Photo</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Phone</th>
                  <th className="pb-2 font-medium">Email</th>
                  <th className="pb-2 font-medium">Children</th>
                  {canWrite ? (
                    <th className="pb-2 font-medium text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {guardians.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canWrite ? 6 : 5}
                      className="py-6 text-[var(--muted-foreground)]"
                    >
                      No parents match your filters.
                    </td>
                  </tr>
                ) : (
                  guardians.map((g) => (
                    <tr key={g.id} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-2">
                        <AvatarCell src={g.photoUrl} name={g.fullName} />
                      </td>
                      <td className="py-2 font-medium">{g.fullName}</td>
                      <td className="py-2">{g.phone || "—"}</td>
                      <td className="py-2">{g.email || "—"}</td>
                      <td className="py-2">{g.children || "—"}</td>
                      {canWrite ? (
                        <td className="py-2">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => startEdit(g)}
                            >
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => onDelete(g.id)}
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
        title={editingId ? "Edit parent" : "Add parent"}
        description="Parents and guardians linked to enrolled students."
        size="md"
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Full name</label>
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelClassName}>Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Occupation</label>
            <Input
              value={form.occupation}
              onChange={(e) => setForm({ ...form, occupation: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Address</label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          {!editingId ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={labelClassName}>Link student (optional)</label>
                <select
                  className={selectClassName}
                  value={form.studentId}
                  onChange={(e) =>
                    setForm({ ...form, studentId: e.target.value })
                  }
                >
                  <option value="">None</option>
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>Relationship</label>
                <select
                  className={selectClassName}
                  value={form.relationship}
                  onChange={(e) =>
                    setForm({ ...form, relationship: e.target.value })
                  }
                  disabled={!form.studentId}
                >
                  <option value="FATHER">Father</option>
                  <option value="MOTHER">Mother</option>
                  <option value="UNCLE">Uncle</option>
                  <option value="AUNT">Aunt</option>
                  <option value="GUARDIAN">Guardian</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <label className="col-span-2 flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) =>
                    setForm({ ...form, isPrimary: e.target.checked })
                  }
                  disabled={!form.studentId}
                />
                Mark as primary guardian
              </label>
            </div>
          ) : null}
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
