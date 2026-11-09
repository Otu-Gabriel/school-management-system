"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ImageUpload } from "@/components/forms/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName } from "@/lib/field-styles";

type AccountData = {
  id: string;
  email: string | null;
  phone: string | null;
  imageUrl: string | null;
  roleName: string | null;
  staff: { firstName: string; lastName: string } | null;
  guardian: { fullName: string } | null;
  student: { firstName: string; lastName: string } | null;
};

export function AccountForm({ account }: { account: AccountData }) {
  const router = useRouter();
  const toast = useToast();
  const { update } = useSession();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    email: account.email || "",
    phone: account.phone || "",
    imageUrl: account.imageUrl || "",
    firstName: account.staff?.firstName || account.student?.firstName || "",
    lastName: account.staff?.lastName || account.student?.lastName || "",
    fullName: account.guardian?.fullName || "",
    currentPassword: "",
    newPassword: "",
  });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const res = await fetch("/api/account", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);

    if (!res.ok) {
      const message = data.error || "Could not save account";
      setError(message);
      toast.error("Could not save account", message);
      return;
    }

    await update({
      name: data.name,
      email: data.email,
      image: data.image,
      phone: data.phone,
    });

    setForm((f) => ({ ...f, currentPassword: "", newPassword: "" }));
    setMessage("Account updated.");
    toast.success("Account updated");
    router.refresh();
  }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-3xl space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <p className="text-xs text-[var(--muted-foreground)]">
            Role: {account.roleName || "—"}
          </p>
          <ImageUpload
            folder="staff"
            value={form.imageUrl}
            label="Upload profile photo"
            onUploaded={(url) => setForm({ ...form, imageUrl: url })}
          />

          {account.guardian ? (
            <div className="space-y-1">
              <label className={labelClassName}>Full name</label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                required
              />
            </div>
          ) : (
            <div className="grid gap-2.5 md:grid-cols-2">
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
            </div>
          )}

          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClassName}>Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="Optional if you use phone"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Phone</label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="Optional if you use email"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-2.5 md:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClassName}>Current password</label>
            <PasswordInput
              value={form.currentPassword}
              onChange={(e) =>
                setForm({ ...form, currentPassword: e.target.value })
              }
              autoComplete="current-password"
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>New password</label>
            <PasswordInput
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              autoComplete="new-password"
              placeholder="Leave blank to keep current"
            />
          </div>
        </CardBody>
      </Card>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {message && (
        <p className="text-xs text-[var(--brand-primary)]">{message}</p>
      )}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
