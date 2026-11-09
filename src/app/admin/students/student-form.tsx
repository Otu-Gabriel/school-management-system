"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUpload } from "@/components/forms/image-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type StudentInitial = {
  id: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  otherNames: string | null;
  gender: string | null;
  dateOfBirth: string;
  classSectionId: string | null;
  photoUrl: string | null;
  status: "ACTIVE" | "TRANSFERRED" | "WITHDRAWN" | "GRADUATED" | "ALUMNI";
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  relationship: string;
};

export function StudentForm({
  classes,
  academicYearId,
  initial,
}: {
  classes: { id: string; label: string }[];
  academicYearId: string | null;
  initial?: StudentInitial;
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(initial);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    admissionNo: initial?.admissionNo || "",
    firstName: initial?.firstName || "",
    lastName: initial?.lastName || "",
    otherNames: initial?.otherNames || "",
    gender: initial?.gender || "MALE",
    dateOfBirth: initial?.dateOfBirth || "",
    classSectionId: initial?.classSectionId || "",
    photoUrl: initial?.photoUrl || "",
    status: initial?.status || ("ACTIVE" as const),
    guardianName: initial?.guardianName || "",
    guardianPhone: initial?.guardianPhone || "",
    guardianEmail: initial?.guardianEmail || "",
    relationship: initial?.relationship || "FATHER",
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(
      editing ? `/api/students/${initial!.id}` : "/api/students",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, academicYearId }),
      }
    );
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error(
        editing ? "Could not update student" : "Could not create student",
        data.error || "Please try again."
      );
      return;
    }
    toast.success(editing ? "Student updated" : "Student created");
    router.push("/admin/students");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Student details</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <ImageUpload
            folder="students"
            value={form.photoUrl}
            onUploaded={(url) => setForm({ ...form, photoUrl: url })}
            label="Upload photo"
          />
          <div className="grid gap-2.5 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClassName}>Admission number</label>
              <Input
                value={form.admissionNo}
                onChange={(e) => setForm({ ...form, admissionNo: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Class</label>
              <select
                className={selectClassName}
                value={form.classSectionId}
                onChange={(e) => setForm({ ...form, classSectionId: e.target.value })}
              >
                <option value="">Select class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
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
              <label className={labelClassName}>Other names</label>
              <Input
                value={form.otherNames}
                onChange={(e) => setForm({ ...form, otherNames: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Gender</label>
              <select
                className={selectClassName}
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>Date of birth</label>
              <Input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              />
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
                  <option value="TRANSFERRED">Transferred</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="ALUMNI">Alumni</option>
                </select>
              </div>
            ) : null}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primary guardian</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-2.5 md:grid-cols-2">
          <div className="space-y-1 md:col-span-2">
            <label className={labelClassName}>Full name</label>
            <Input
              value={form.guardianName}
              onChange={(e) => setForm({ ...form, guardianName: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Phone</label>
            <Input
              value={form.guardianPhone}
              onChange={(e) => setForm({ ...form, guardianPhone: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Email</label>
            <Input
              value={form.guardianEmail}
              onChange={(e) => setForm({ ...form, guardianEmail: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Relationship</label>
            <select
              className={selectClassName}
              value={form.relationship}
              onChange={(e) => setForm({ ...form, relationship: e.target.value })}
            >
              <option value="FATHER">Father</option>
              <option value="MOTHER">Mother</option>
              <option value="UNCLE">Uncle</option>
              <option value="AUNT">Aunt</option>
              <option value="GUARDIAN">Guardian</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </CardBody>
      </Card>

      <Button type="submit" size="sm" disabled={saving}>
        {saving ? "Saving…" : editing ? "Update student" : "Create student"}
      </Button>
    </form>
  );
}
