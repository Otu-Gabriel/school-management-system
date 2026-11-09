"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName } from "@/lib/field-styles";

export function AcademicYearForm() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    startDate: "",
    endDate: "",
    termCount: 3,
    setCurrent: true,
  });

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/academics/years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not create year", data.error || "Please try again.");
      return;
    }
    toast.success("Academic year created");
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      termCount: 3,
      setCurrent: true,
    });
    close();
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Add year
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Create academic year"
        description="Terms are generated automatically from the date range."
      >
        <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClassName}>Name</label>
            <Input
              placeholder="2026/2027"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Number of terms</label>
            <Input
              type="number"
              min={1}
              max={4}
              value={form.termCount}
              onChange={(e) =>
                setForm({ ...form, termCount: Number(e.target.value) || 3 })
              }
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Start date</label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>End date</label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>
          <label className="flex items-center gap-2 text-xs md:col-span-2">
            <input
              type="checkbox"
              checked={form.setCurrent}
              onChange={(e) => setForm({ ...form, setCurrent: e.target.checked })}
            />
            Set as current academic year
          </label>
          <div className="flex justify-end gap-1.5 md:col-span-2">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Creating…" : "Create year"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
