"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName, textareaClassName } from "@/lib/field-styles";

export function AnnouncementForm() {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all" });

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not publish notice", data.error || "Please try again.");
      return;
    }
    toast.success("Notice published");
    setForm({ title: "", body: "", audience: "all" });
    close();
    router.refresh();
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" />
        Publish notice
      </Button>

      <Modal
        open={open}
        onClose={close}
        title="Publish notice"
        description="Send an update to staff, parents, or everyone."
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Message</label>
            <textarea
              className={textareaClassName}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Audience</label>
            <select
              className={selectClassName}
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
            >
              <option value="all">Everyone</option>
              <option value="staff">Staff only</option>
              <option value="parents">Parents only</option>
              <option value="students">Students only</option>
            </select>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
