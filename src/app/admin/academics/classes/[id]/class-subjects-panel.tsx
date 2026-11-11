"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { selectClassName } from "@/lib/field-styles";

type StaffOption = { id: string; label: string };

type SubjectRow = {
  id: string;
  code: string;
  name: string;
  isCore: boolean;
  assignmentId: string | null;
  staffId: string | null;
  staffLabel: string | null;
};

export function ClassSubjectsPanel({
  classSectionId,
  subjects,
  staff,
  canWrite,
}: {
  classSectionId: string;
  subjects: SubjectRow[];
  staff: StaffOption[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(subjects.map((s) => [s.id, s.staffId || ""]))
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  async function save(subjectId: string) {
    setSavingId(subjectId);
    const staffId = drafts[subjectId] || null;
    const res = await fetch(`/api/academics/classes/${classSectionId}/assignments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subjectId, staffId }),
    });
    const data = await res.json();
    setSavingId(null);
    if (!res.ok) {
      toast.error("Could not save teacher", data.error || "Please try again.");
      return;
    }
    toast.success(staffId ? "Teacher assigned" : "Teacher unassigned");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subjects ({subjects.length})</CardTitle>
      </CardHeader>
      <CardBody className="pt-1.5">
        <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
          Inherited from the class level. Teachers are assigned per subject —
          subjects cannot be removed from the class.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--muted-foreground)]">
              <tr>
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Subject</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Teacher</th>
                {canWrite ? (
                  <th className="pb-2 font-medium text-right">Save</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {subjects.length === 0 ? (
                <tr>
                  <td
                    colSpan={canWrite ? 5 : 4}
                    className="py-6 text-[var(--muted-foreground)]"
                  >
                    No subjects apply to this class level yet.
                  </td>
                </tr>
              ) : (
                subjects.map((subject) => {
                  const dirty =
                    (drafts[subject.id] || "") !== (subject.staffId || "");
                  return (
                    <tr
                      key={subject.id}
                      className="border-t border-[var(--border)]"
                    >
                      <td className="py-2 font-medium">{subject.code}</td>
                      <td className="py-2">{subject.name}</td>
                      <td className="py-2">
                        {subject.isCore ? "Core" : "Elective"}
                      </td>
                      <td className="py-2">
                        {canWrite ? (
                          <select
                            className={selectClassName}
                            value={drafts[subject.id] || ""}
                            onChange={(e) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [subject.id]: e.target.value,
                              }))
                            }
                          >
                            <option value="">Unassigned</option>
                            {staff.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          subject.staffLabel || "Unassigned"
                        )}
                      </td>
                      {canWrite ? (
                        <td className="py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={dirty ? "primary" : "secondary"}
                            disabled={!dirty || savingId === subject.id}
                            onClick={() => void save(subject.id)}
                          >
                            {savingId === subject.id ? "Saving…" : "Save"}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardBody>
    </Card>
  );
}
