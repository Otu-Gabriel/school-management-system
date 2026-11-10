"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type ClassOption = { id: string; label: string };

type TermContext = {
  yearName: string | null;
  termId: string | null;
  termName: string | null;
  termStart: string | null;
  termEnd: string | null;
};

type StudentRow = {
  id: string;
  admissionNo: string;
  name: string;
  status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
  remark: string;
};

type SummaryStudent = {
  studentId: string;
  admissionNo: string;
  name: string;
  present: number;
  absent: number;
  late: number;
  excused: number;
  markedDays: number;
  attendancePercent: number | null;
};

const STATUSES = [
  { value: "PRESENT", label: "Present" },
  { value: "ABSENT", label: "Absent" },
  { value: "LATE", label: "Late" },
  { value: "EXCUSED", label: "Excused" },
] as const;

export function AttendanceRegister({
  classes,
  initialClassId,
  initialDate,
  canWrite,
  termContext,
}: {
  classes: ClassOption[];
  initialClassId?: string;
  initialDate: string;
  canWrite: boolean;
  termContext: TermContext;
}) {
  const toast = useToast();
  const [classSectionId, setClassSectionId] = useState(
    initialClassId || classes[0]?.id || ""
  );
  const [date, setDate] = useState(initialDate);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [classLabel, setClassLabel] = useState("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [academic, setAcademic] = useState<TermContext>(termContext);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryMeta, setSummaryMeta] = useState<{
    schoolDaysInTerm: number;
    schoolDaysToDate: number;
    termName: string;
  } | null>(null);
  const [summaryRows, setSummaryRows] = useState<SummaryStudent[]>([]);

  const summary = useMemo(() => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of rows) counts[row.status] += 1;
    return counts;
  }, [rows]);

  async function loadRegister(nextClassId = classSectionId, nextDate = date) {
    if (!nextClassId || !nextDate) {
      setRows([]);
      return;
    }
    setLoading(true);
    const res = await fetch(
      `/api/attendance?classSectionId=${encodeURIComponent(nextClassId)}&date=${encodeURIComponent(nextDate)}`
    );
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load register", data.error || "Please try again.");
      setRows([]);
      return;
    }
    setClassLabel(data.classSection?.label || "");
    if (data.academic) {
      setAcademic({
        yearName: data.academic.yearName,
        termId: data.academic.termId,
        termName: data.academic.termName,
        termStart: data.academic.termStart,
        termEnd: data.academic.termEnd,
      });
    }
    setRows(
      (data.students || []).map(
        (s: {
          id: string;
          admissionNo: string;
          name: string;
          status: StudentRow["status"];
          remark?: string;
        }) => ({
          id: s.id,
          admissionNo: s.admissionNo,
          name: s.name,
          status: s.status || "PRESENT",
          remark: s.remark || "",
        })
      )
    );
  }

  async function loadTermSummary(nextClassId = classSectionId) {
    if (!nextClassId) return;
    setSummaryLoading(true);
    const res = await fetch(
      `/api/attendance/summary?classSectionId=${encodeURIComponent(nextClassId)}`
    );
    const data = await res.json();
    setSummaryLoading(false);
    if (!res.ok) {
      toast.error("Could not load term summary", data.error || "Please try again.");
      setSummaryRows([]);
      setSummaryMeta(null);
      return;
    }
    setSummaryMeta({
      schoolDaysInTerm: data.schoolDaysInTerm,
      schoolDaysToDate: data.schoolDaysToDate,
      termName: data.term?.name || academic.termName || "Current term",
    });
    setSummaryRows(
      (data.students || []).map(
        (s: SummaryStudent & { attendancePercent?: number | null }) => ({
          studentId: s.studentId,
          admissionNo: s.admissionNo,
          name: s.name,
          present: s.present || 0,
          absent: s.absent || 0,
          late: s.late || 0,
          excused: s.excused || 0,
          markedDays: s.markedDays || 0,
          attendancePercent: s.attendancePercent ?? null,
        })
      )
    );
  }

  useEffect(() => {
    void loadRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function markAllPresent() {
    setRows((prev) => prev.map((row) => ({ ...row, status: "PRESENT" })));
  }

  async function onSave() {
    if (!canWrite) return;
    setSaving(true);
    const res = await fetch("/api/attendance", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classSectionId,
        date,
        records: rows.map((row) => ({
          studentId: row.id,
          status: row.status,
          remark: row.remark || null,
        })),
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Could not save attendance", data.error || "Please try again.");
      return;
    }
    toast.success("Attendance saved", `${rows.length} students updated.`);
    if (showSummary) {
      void loadTermSummary(classSectionId);
    }
  }

  async function toggleSummary() {
    const next = !showSummary;
    setShowSummary(next);
    if (next) {
      await loadTermSummary(classSectionId);
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="text-[11px] text-[var(--muted-foreground)]">
          {academic.termName && academic.termStart && academic.termEnd ? (
            <>
              Current term:{" "}
              <span className="font-medium text-[var(--foreground)]">
                {academic.yearName ? `${academic.yearName} · ` : ""}
                {academic.termName}
              </span>{" "}
              ({academic.termStart} – {academic.termEnd}). Attendance can only be
              saved on school days inside this term.
            </>
          ) : (
            <>
              No current term is set. Configure Years & Terms before marking
              attendance.
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <label className={labelClassName}>Class</label>
            <select
              className={selectClassName}
              value={classSectionId}
              onChange={(e) => setClassSectionId(e.target.value)}
            >
              {classes.length === 0 ? (
                <option value="">No classes available</option>
              ) : (
                classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Date</label>
            <Input
              type="date"
              value={date}
              min={academic.termStart || undefined}
              max={academic.termEnd || undefined}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-end gap-1.5 sm:col-span-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => loadRegister(classSectionId, date)}
              disabled={loading || !classSectionId}
            >
              {loading ? "Loading…" : "Load register"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={toggleSummary}
              disabled={!classSectionId}
            >
              {showSummary ? "Hide term summary" : "Term summary"}
            </Button>
            {canWrite ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={markAllPresent}
                  disabled={rows.length === 0}
                >
                  Mark all present
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={onSave}
                  disabled={saving || rows.length === 0}
                >
                  {saving ? "Saving…" : "Save attendance"}
                </Button>
              </>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {showSummary ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Term summary
              {summaryMeta
                ? ` · ${summaryMeta.termName} (${summaryMeta.schoolDaysToDate}/${summaryMeta.schoolDaysInTerm} school days to date)`
                : ""}
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Admission</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Present*</th>
                    <th className="pb-2 font-medium">Absent</th>
                    <th className="pb-2 font-medium">Late</th>
                    <th className="pb-2 font-medium">Excused</th>
                    <th className="pb-2 font-medium">Marked</th>
                    <th className="pb-2 font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryLoading ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        Loading summary…
                      </td>
                    </tr>
                  ) : summaryRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No students in this class.
                      </td>
                    </tr>
                  ) : (
                    summaryRows.map((row) => (
                      <tr
                        key={row.studentId}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="py-2">{row.admissionNo}</td>
                        <td className="py-2 font-medium">{row.name}</td>
                        <td className="py-2">{row.present}</td>
                        <td className="py-2">{row.absent}</td>
                        <td className="py-2">{row.late}</td>
                        <td className="py-2">{row.excused}</td>
                        <td className="py-2">{row.markedDays}</td>
                        <td className="py-2">
                          {row.attendancePercent == null
                            ? "—"
                            : `${row.attendancePercent}%`}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">
              *Present includes Late. Rate = (Present + Late) ÷ school days to
              date in the term.
            </p>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            {classLabel
              ? `${classLabel} · ${date}`
              : "Daily attendance register"}{" "}
            ({rows.length})
          </CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          {rows.length > 0 ? (
            <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
              Present {summary.PRESENT} · Absent {summary.ABSENT} · Late{" "}
              {summary.LATE} · Excused {summary.EXCUSED}
            </p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Admission</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Remark</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-[var(--muted-foreground)]"
                    >
                      {loading
                        ? "Loading…"
                        : "Select a class and date, then load the register."}
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <tr key={row.id} className="border-t border-[var(--border)]">
                      <td className="py-2">{index + 1}</td>
                      <td className="py-2">{row.admissionNo}</td>
                      <td className="py-2 font-medium">{row.name}</td>
                      <td className="py-2">
                        <select
                          className={`${selectClassName} min-w-28`}
                          value={row.status}
                          disabled={!canWrite}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? {
                                      ...item,
                                      status: e.target
                                        .value as StudentRow["status"],
                                    }
                                  : item
                              )
                            )
                          }
                        >
                          {STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2">
                        <Input
                          value={row.remark}
                          disabled={!canWrite}
                          placeholder="Optional"
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((item) =>
                                item.id === row.id
                                  ? { ...item, remark: e.target.value }
                                  : item
                              )
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
