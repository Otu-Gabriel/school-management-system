"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type TermDraft = {
  name: string;
  termNumber: number;
  startDate: string;
  endDate: string;
};

function emptyTerms(count: number): TermDraft[] {
  return Array.from({ length: count }, (_, i) => ({
    name: `Term ${i + 1}`,
    termNumber: i + 1,
    startDate: "",
    endDate: "",
  }));
}

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
    currentTermNumber: 1,
    setCurrent: true,
  });
  const [terms, setTerms] = useState<TermDraft[]>(emptyTerms(3));

  useEffect(() => {
    setTerms((prev) => {
      const next = emptyTerms(form.termCount).map((term, index) => ({
        ...term,
        startDate: prev[index]?.startDate || "",
        endDate: prev[index]?.endDate || "",
        name: prev[index]?.name || term.name,
      }));
      return next;
    });
    if (form.currentTermNumber > form.termCount) {
      setForm((f) => ({ ...f, currentTermNumber: 1 }));
    }
  }, [form.termCount, form.currentTermNumber]);

  const termOptions = useMemo(
    () => terms.map((t) => ({ value: t.termNumber, label: t.name || `Term ${t.termNumber}` })),
    [terms]
  );

  function close() {
    setOpen(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/academics/years", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        terms,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not create year", data.error || "Please try again.");
      return;
    }
    toast.success(
      "Academic year created",
      data.classesCopied
        ? `Year saved. Copied ${data.classesCopied} active class${data.classesCopied === 1 ? "" : "es"} from last year.`
        : "Year, terms, and current term saved."
    );
    setForm({
      name: "",
      startDate: "",
      endDate: "",
      termCount: 3,
      currentTermNumber: 1,
      setCurrent: true,
    });
    setTerms(emptyTerms(3));
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
        description="Set year dates, each term’s start/end, and the current term used for attendance and school activities."
        size="lg"
      >
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClassName}>Year name</label>
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
                  setForm({
                    ...form,
                    termCount: Math.min(4, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Year start</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Year end</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="rounded-md border border-[var(--border)] p-2.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Term dates
            </p>
            <div className="space-y-2">
              {terms.map((term, index) => (
                <div
                  key={term.termNumber}
                  className="grid gap-2 md:grid-cols-4"
                >
                  <div className="space-y-1">
                    <label className={labelClassName}>Name</label>
                    <Input
                      value={term.name}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, name: e.target.value } : item
                          )
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClassName}>Start</label>
                    <Input
                      type="date"
                      value={term.startDate}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, startDate: e.target.value }
                              : item
                          )
                        )
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className={labelClassName}>End</label>
                    <Input
                      type="date"
                      value={term.endDate}
                      onChange={(e) =>
                        setTerms((prev) =>
                          prev.map((item, i) =>
                            i === index
                              ? { ...item, endDate: e.target.value }
                              : item
                          )
                        )
                      }
                      required
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClassName}>Current term</label>
              <select
                className={selectClassName}
                value={form.currentTermNumber}
                onChange={(e) =>
                  setForm({
                    ...form,
                    currentTermNumber: Number(e.target.value),
                  })
                }
              >
                {termOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-end gap-2 pb-1 text-xs">
              <input
                type="checkbox"
                checked={form.setCurrent}
                onChange={(e) =>
                  setForm({ ...form, setCurrent: e.target.checked })
                }
              />
              Set as current academic year
            </label>
          </div>

          <div className="flex justify-end gap-1.5">
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
