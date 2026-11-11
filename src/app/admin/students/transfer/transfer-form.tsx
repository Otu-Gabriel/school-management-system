"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

export function TransferForm({
  students,
  classes,
}: {
  students: {
    id: string;
    label: string;
    currentClassSectionId: string | null;
  }[];
  classes: { id: string; label: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    studentId: students[0]?.id || "",
    toClassSectionId: "",
    reason: "",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/students/transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Transfer failed", data.error || "Please try again.");
      return;
    }
    toast.success("Student transferred", "Previous placement kept in history.");
    setForm((f) => ({ ...f, reason: "", toClassSectionId: "" }));
    router.refresh();
  }

  return (
    <Card>
      <CardBody>
        <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Student</label>
            <select
              className={selectClassName}
              value={form.studentId}
              onChange={(e) =>
                setForm({ ...form, studentId: e.target.value })
              }
              required
            >
              {students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>New class</label>
            <select
              className={selectClassName}
              value={form.toClassSectionId}
              onChange={(e) =>
                setForm({ ...form, toClassSectionId: e.target.value })
              }
              required
            >
              <option value="">Select class…</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Reason</label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Stream balancing / parental request"
              required
              minLength={3}
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Transferring…" : "Transfer student"}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
