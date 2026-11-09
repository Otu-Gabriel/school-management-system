"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/forms/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type Option = { id: string; name: string; departmentId?: string | null };

type StaffInitial = {
  id: string;
  staffNo: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  departmentId: string | null;
  positionId: string | null;
  photoUrl: string | null;
  status: "ACTIVE" | "ON_LEAVE" | "LEFT";
  roleId: string | null;
  hasLogin: boolean;
};

export function StaffForm({
  roles,
  departments,
  positions,
  initial,
}: {
  roles: Option[];
  departments: Option[];
  positions: Option[];
  initial?: StaffInitial;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    staffNo: initial?.staffNo || "",
    firstName: initial?.firstName || "",
    lastName: initial?.lastName || "",
    email: initial?.email || "",
    phone: initial?.phone || "",
    departmentId: initial?.departmentId || "",
    positionId: initial?.positionId || "",
    roleId: initial?.roleId || "",
    password: "",
    createLogin: initial ? initial.hasLogin : true,
    photoUrl: initial?.photoUrl || "",
    status: initial?.status || ("ACTIVE" as const),
  });

  const filteredPositions = useMemo(() => {
    if (!form.departmentId) return positions;
    return positions.filter(
      (position) =>
        !position.departmentId || position.departmentId === form.departmentId
    );
  }, [form.departmentId, positions]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(
      editing ? `/api/staff/${initial!.id}` : "/api/staff",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(
        editing ? "Could not update staff" : "Could not create staff",
        data.error || "Please try again."
      );
      return;
    }
    toast.success(editing ? "Staff updated" : "Staff member created");
    router.push("/admin/staff");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Staff profile</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ImageUpload
            folder="staff"
            value={form.photoUrl}
            onUploaded={(url) => setForm({ ...form, photoUrl: url })}
          />
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClassName}>Staff number</label>
              <Input
                value={form.staffNo}
                onChange={(e) => setForm({ ...form, staffNo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Department</label>
              <select
                className={selectClassName}
                value={form.departmentId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    departmentId: e.target.value,
                    positionId: "",
                  })
                }
                required
              >
                <option value="">Select department</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>First name</label>
              <Input
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Last name</label>
              <Input
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Email</label>
              <Input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Position</label>
              <select
                className={selectClassName}
                value={form.positionId}
                onChange={(e) => setForm({ ...form, positionId: e.target.value })}
                required
              >
                <option value="">Select position</option>
                {filteredPositions.map((position) => (
                  <option key={position.id} value={position.id}>
                    {position.name}
                  </option>
                ))}
              </select>
            </div>
            {editing ? (
              <div className="space-y-1">
                <label className={labelClassName}>Status</label>
                <select
                  className={selectClassName}
                  value={form.status}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      status: e.target.value as typeof form.status,
                    })
                  }
                >
                  <option value="ACTIVE">Active</option>
                  <option value="ON_LEAVE">On leave</option>
                  <option value="LEFT">Left</option>
                </select>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Login access</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={form.createLogin}
              onChange={(e) => setForm({ ...form, createLogin: e.target.checked })}
              disabled={editing && initial?.hasLogin}
            />
            {editing && initial?.hasLogin
              ? "Login account is linked"
              : "Create login account for this staff member"}
          </label>
          {form.createLogin && (
            <div className="grid gap-2.5 md:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClassName}>Role</label>
                <select
                  className={selectClassName}
                  value={form.roleId}
                  onChange={(e) => setForm({ ...form, roleId: e.target.value })}
                  required={form.createLogin}
                >
                  <option value="">Select role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>
                  {editing && initial?.hasLogin
                    ? "New password (optional)"
                    : "Temporary password"}
                </label>
                <PasswordInput
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required={form.createLogin && !(editing && initial?.hasLogin)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving…" : editing ? "Update staff" : "Create staff"}
      </Button>
    </form>
  );
}
