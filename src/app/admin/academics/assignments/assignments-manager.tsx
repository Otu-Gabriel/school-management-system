"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type Option = { id: string; label: string; academicYearId?: string };

type AssignmentItem = {
  id: string;
  staffId: string;
  subjectId: string;
  classSectionId: string;
  academicYearId: string;
  teacherName: string;
  subjectName: string;
  className: string;
  yearName: string;
};

export function AssignmentsManager({
  assignments,
  canWrite,
  total,
  years,
  classes,
  subjects,
  teachers,
  pagination,
}: {
  assignments: AssignmentItem[];
  canWrite: boolean;
  total: number;
  years: Option[];
  classes: Option[];
  subjects: Option[];
  teachers: Option[];
  pagination: React.ReactNode;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    academicYearId: years[0]?.id || "",
    classSectionId: "",
    subjectId: "",
    staffId: "",
  });

  const filteredClasses = useMemo(
    () =>
      classes.filter(
        (item) =>
          !form.academicYearId || item.academicYearId === form.academicYearId
      ),
    [classes, form.academicYearId]
  );

  function close() {
    setOpen(false);
    setEditingId(null);
    setForm({
      academicYearId: years[0]?.id || "",
      classSectionId: "",
      subjectId: "",
      staffId: "",
    });
  }

  function startCreate() {
    setEditingId(null);
    setForm({
      academicYearId: years[0]?.id || "",
      classSectionId: "",
      subjectId: "",
      staffId: "",
    });
    setOpen(true);
  }

  function startEdit(item: AssignmentItem) {
    setEditingId(item.id);
    setForm({
      academicYearId: item.academicYearId,
      classSectionId: item.classSectionId,
      subjectId: item.subjectId,
      staffId: item.staffId,
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(
      editingId
        ? `/api/academics/assignments/${editingId}`
        : "/api/academics/assignments",
      {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(
        "Could not save assignment",
        data.error || "Please try again."
      );
      return;
    }
    toast.success(editingId ? "Assignment updated" : "Assignment created");
    close();
    router.refresh();
  }

  async function onDelete(id: string) {
    if (!confirm("Remove this teaching assignment?")) return;
    const res = await fetch(`/api/academics/assignments/${id}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.warning(
        "Cannot remove assignment",
        data.error || "Please try again."
      );
      return;
    }
    toast.success("Assignment removed");
    router.refresh();
  }

  return (
    <>
      {canWrite ? (
        <div className="flex justify-end">
          <Button type="button" size="sm" onClick={startCreate}>
            <Plus className="h-3.5 w-3.5" />
            Add assignment
          </Button>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Teaching assignments ({total})</CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Teacher</th>
                  <th className="pb-2 font-medium">Subject</th>
                  <th className="pb-2 font-medium">Class</th>
                  <th className="pb-2 font-medium">Year</th>
                  {canWrite ? (
                    <th className="pb-2 font-medium text-right">Actions</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {assignments.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canWrite ? 5 : 4}
                      className="py-6 text-[var(--muted-foreground)]"
                    >
                      No teaching assignments match your filters.
                    </td>
                  </tr>
                ) : (
                  assignments.map((item) => (
                    <tr key={item.id} className="border-t border-[var(--border)]">
                      <td className="py-2 font-medium">{item.teacherName}</td>
                      <td className="py-2">{item.subjectName}</td>
                      <td className="py-2">{item.className}</td>
                      <td className="py-2">{item.yearName}</td>
                      {canWrite ? (
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
        title={editingId ? "Edit assignment" : "Add teaching assignment"}
        description="Teacher A teaches Subject in Class for the academic year."
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Academic year</label>
            <select
              className={selectClassName}
              value={form.academicYearId}
              onChange={(e) =>
                setForm({
                  ...form,
                  academicYearId: e.target.value,
                  classSectionId: "",
                })
              }
              required
            >
              <option value="">Select year</option>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Class</label>
            <select
              className={selectClassName}
              value={form.classSectionId}
              onChange={(e) =>
                setForm({ ...form, classSectionId: e.target.value })
              }
              required
            >
              <option value="">Select class</option>
              {filteredClasses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Subject</label>
            <select
              className={selectClassName}
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              required
            >
              <option value="">Select subject</option>
              {subjects.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Teacher</label>
            <select
              className={selectClassName}
              value={form.staffId}
              onChange={(e) => setForm({ ...form, staffId: e.target.value })}
              required
            >
              <option value="">Select teacher</option>
              {teachers.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" variant="secondary" size="sm" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Assign"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
