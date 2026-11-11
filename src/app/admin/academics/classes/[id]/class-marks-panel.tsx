"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { selectClassName } from "@/lib/field-styles";
import { computeTotal, gradeForScore } from "@/lib/marks";

type StudentRow = {
  id: string;
  admissionNo: string;
  name: string;
};

type SubjectOption = {
  id: string;
  code: string;
  name: string;
};

type MarkRow = {
  studentId: string;
  subjectId: string;
  classScore: number | null;
  examScore: number | null;
  total: number | null;
  gradeLabel: string | null;
};

type Band = { label: string; minScore: number; maxScore: number };

export function ClassMarksPanel({
  classSectionId,
  academicYearId,
  termId,
  termName,
  students,
  subjects,
  marks,
  scheme,
  bands,
  canWrite,
}: {
  classSectionId: string;
  academicYearId: string;
  termId: string | null;
  termName: string | null;
  students: StudentRow[];
  subjects: SubjectOption[];
  marks: MarkRow[];
  scheme: { classScoreWeight: number; examWeight: number };
  bands: Band[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || "");
  const [drafts, setDrafts] = useState<
    Record<string, { classScore: string; examScore: string }>
  >(() => {
    const map: Record<string, { classScore: string; examScore: string }> = {};
    for (const mark of marks) {
      map[`${mark.studentId}:${mark.subjectId}`] = {
        classScore: mark.classScore == null ? "" : String(mark.classScore),
        examScore: mark.examScore == null ? "" : String(mark.examScore),
      };
    }
    return map;
  });
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const markMap = useMemo(() => {
    const map = new Map<string, MarkRow>();
    for (const mark of marks) {
      map.set(`${mark.studentId}:${mark.subjectId}`, mark);
    }
    return map;
  }, [marks]);

  function draftFor(studentId: string) {
    const key = `${studentId}:${subjectId}`;
    return (
      drafts[key] || {
        classScore: "",
        examScore: "",
      }
    );
  }

  function preview(studentId: string) {
    const d = draftFor(studentId);
    const classScore = d.classScore === "" ? null : Number(d.classScore);
    const examScore = d.examScore === "" ? null : Number(d.examScore);
    const total = computeTotal(classScore, examScore, scheme);
    const gradeLabel = gradeForScore(total, bands);
    return { total, gradeLabel };
  }

  async function saveStudent(studentId: string) {
    if (!termId || !subjectId) return;
    const key = `${studentId}:${subjectId}`;
    const d = draftFor(studentId);
    setSavingKey(key);
    const res = await fetch("/api/academics/marks", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        subjectId,
        classSectionId,
        academicYearId,
        termId,
        classScore: d.classScore === "" ? null : Number(d.classScore),
        examScore: d.examScore === "" ? null : Number(d.examScore),
      }),
    });
    const data = await res.json();
    setSavingKey(null);
    if (!res.ok) {
      toast.error("Could not save mark", data.error || "Please try again.");
      return;
    }
    toast.success("Mark saved");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>
          Marks{termName ? ` · ${termName}` : ""} ({students.length})
        </CardTitle>
        <select
          className={selectClassName}
          value={subjectId}
          onChange={(e) => setSubjectId(e.target.value)}
          disabled={subjects.length === 0}
        >
          {subjects.length === 0 ? (
            <option value="">No subjects</option>
          ) : (
            subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} — {s.name}
              </option>
            ))
          )}
        </select>
      </CardHeader>
      <CardBody className="pt-1.5">
        {!termId ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Open this class with a term selected to enter marks.
          </p>
        ) : subjects.length === 0 ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            No subjects apply to this class level yet.
          </p>
        ) : (
          <>
            <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
              Weights: CA {scheme.classScoreWeight}% · Exam {scheme.examWeight}%
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Admission</th>
                    <th className="pb-2 font-medium">Student</th>
                    <th className="pb-2 font-medium">CA</th>
                    <th className="pb-2 font-medium">Exam</th>
                    <th className="pb-2 font-medium">Total</th>
                    <th className="pb-2 font-medium">Grade</th>
                    {canWrite ? (
                      <th className="pb-2 font-medium text-right">Save</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => {
                    const key = `${student.id}:${subjectId}`;
                    const d = draftFor(student.id);
                    const saved = markMap.get(key);
                    const { total, gradeLabel } = preview(student.id);
                    return (
                      <tr
                        key={student.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="py-1.5">{student.admissionNo}</td>
                        <td className="py-1.5 font-medium">{student.name}</td>
                        <td className="py-1.5 pr-1">
                          {canWrite ? (
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={d.classScore}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draftFor(student.id),
                                    classScore: e.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            saved?.classScore ?? "—"
                          )}
                        </td>
                        <td className="py-1.5 pr-1">
                          {canWrite ? (
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              value={d.examScore}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [key]: {
                                    ...draftFor(student.id),
                                    examScore: e.target.value,
                                  },
                                }))
                              }
                            />
                          ) : (
                            saved?.examScore ?? "—"
                          )}
                        </td>
                        <td className="py-1.5">
                          {total == null ? "—" : total.toFixed(1)}
                        </td>
                        <td className="py-1.5">{gradeLabel || "—"}</td>
                        {canWrite ? (
                          <td className="py-1.5 text-right">
                            <Button
                              type="button"
                              size="sm"
                              disabled={savingKey === key}
                              onClick={() => void saveStudent(student.id)}
                            >
                              {savingKey === key ? "…" : "Save"}
                            </Button>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
