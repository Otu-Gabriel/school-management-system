"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/forms/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName } from "@/lib/field-styles";

type School = {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
};

export function SchoolSettingsForm({ school }: { school: School }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState(school);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/school", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      setMessage("Could not save settings.");
      toast.error("Could not save settings");
      return;
    }
    setMessage("Settings saved.");
    toast.success("Settings saved");
    router.refresh();
  }

  return (
    <form onSubmit={onSave} className="mx-auto max-w-3xl space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Identity & branding</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ImageUpload
            folder="logos"
            value={form.logoUrl}
            label="Upload school logo"
            onUploaded={(url) => setForm((f) => ({ ...f, logoUrl: url }))}
          />
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClassName}>School name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Short name</label>
              <Input
                value={form.shortName || ""}
                onChange={(e) => setForm({ ...form, shortName: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-2.5 md:grid-cols-3">
            <div className="space-y-1">
              <label className={labelClassName}>Primary color</label>
              <Input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Secondary color</label>
              <Input
                type="color"
                value={form.secondaryColor}
                onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Accent color</label>
              <Input
                type="color"
                value={form.accentColor}
                onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-2.5 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label className={labelClassName}>Address</label>
            <Input
              value={form.address || ""}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Phone</label>
            <Input
              value={form.phone || ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Email</label>
            <Input
              value={form.email || ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
        </CardBody>
      </Card>

      {message && <p className="text-xs text-[var(--muted-foreground)]">{message}</p>}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}
