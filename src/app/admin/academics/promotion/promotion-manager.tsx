"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type SourceClass = {
  id: string;
  name: string;
  gradeLevel: { code: string; name: string };
  _count: { currentStudents: number };
};

type YearOption = {
  id: string;
  name: string;
  isCurrent: boolean;
  classes: {
    id: string;
    name: string;
    gradeLevelId: string;
    gradeLevelCode: string;
    label: string;
  }[];
};

type StudentRow = {
  id: string;
  admissionNo: string;
  name: string;
  selected: boolean;
  exceptionClassId: string;
  exceptionAction: "PROMOTE" | "REPEAT" | "CONTINUE";
};

export function PromotionManager() {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [windowOpen, setWindowOpen] = useState(false);
  const [canCreateClass, setCanCreateClass] = useState(false);
  const [currentLabel, setCurrentLabel] = useState("");
  const [sourceClasses, setSourceClasses] = useState<SourceClass[]>([]);
  const [years, setYears] = useState<YearOption[]>([]);
  const [sourceClassId, setSourceClassId] = useState("");
  const [destinationYearId, setDestinationYearId] = useState("");
  const [destinationClassId, setDestinationClassId] = useState("");
  const [action, setAction] = useState<"PROMOTE" | "REPEAT">("PROMOTE");
  const [continueRemaining, setContinueRemaining] = useState(true);
  const [createMissingClass, setCreateMissingClass] = useState(false);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const destinationYear = years.find((y) => y.id === destinationYearId) || null;
  const destinationClasses = destinationYear?.classes || [];

  async function loadContext() {
    setLoading(true);
    const res = await fetch("/api/academics/promotion");
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error("Could not load promotion", data.error || "Forbidden");
      return;
    }
    setWindowOpen(!!data.windowOpen);
    setCanCreateClass(!!data.canCreateClass);
    setCurrentLabel(
      data.currentYear
        ? `${data.currentYear.name}${data.currentYear.termName ? ` · ${data.currentYear.termName}` : ""}`
        : "No current year"
    );
    setSourceClasses(data.sourceClasses || []);
    setYears(data.years || []);
    const nextYear =
      (data.years || []).find(
        (y: YearOption) => !y.isCurrent && y.id !== data.currentYear?.id
      ) || (data.years || []).find((y: YearOption) => !y.isCurrent);
    if (nextYear) setDestinationYearId(nextYear.id);
    if (data.sourceClasses?.[0]) setSourceClassId(data.sourceClasses[0].id);
  }

  async function loadStudents(classId: string) {
    if (!classId) {
      setStudents([]);
      return;
    }
    setLoadingStudents(true);
    const res = await fetch(
      `/api/students?classSectionId=${encodeURIComponent(classId)}&status=ACTIVE&lite=1`
    );
    const data = await res.json();
    setLoadingStudents(false);
    if (!res.ok) {
      // fallback: load via attendance-style list not available; show empty
      toast.warning("Could not load students", data.error || "Try again.");
      setStudents([]);
      return;
    }
    const rows = (data.students || data || []).map(
      (s: {
        id: string;
        admissionNo: string;
        firstName?: string;
        lastName?: string;
        name?: string;
      }) => ({
        id: s.id,
        admissionNo: s.admissionNo,
        name:
          s.name ||
          `${s.firstName || ""} ${s.lastName || ""}`.trim() ||
          s.admissionNo,
        selected: true,
        exceptionClassId: "",
        exceptionAction: "PROMOTE" as const,
      })
    );
    setStudents(rows);
  }

  useEffect(() => {
    void loadContext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadStudents(sourceClassId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceClassId]);

  useEffect(() => {
    if (!destinationYear) {
      setDestinationClassId("");
      return;
    }
    if (
      destinationClassId &&
      !destinationYear.classes.some((c) => c.id === destinationClassId)
    ) {
      setDestinationClassId("");
    }
  }, [destinationYear, destinationClassId]);

  const selectedCount = useMemo(
    () => students.filter((s) => s.selected && !s.exceptionClassId).length,
    [students]
  );
  const exceptionCount = useMemo(
    () => students.filter((s) => s.exceptionClassId).length,
    [students]
  );

  async function runPromotion() {
    if (!windowOpen) {
      toast.warning(
        "Window closed",
        "Promotion is only allowed in the last term of the year."
      );
      return;
    }
    if (!sourceClassId || !destinationYearId || !destinationClassId) {
      toast.warning(
        "Missing selection",
        "Choose source class, destination year, and one destination class."
      );
      return;
    }

    const bulkIds = students
      .filter((s) => s.selected && !s.exceptionClassId)
      .map((s) => s.id);
    const exceptions = students
      .filter((s) => !!s.exceptionClassId)
      .map((s) => ({
        studentId: s.id,
        destinationClassSectionId: s.exceptionClassId,
        action: s.exceptionAction,
      }));

    if (bulkIds.length === 0 && exceptions.length === 0) {
      toast.warning(
        "Select students",
        "Select students for bulk action or set exceptions."
      );
      return;
    }

    // API requires studentIds min 1 — use bulk ids, or if only exceptions use first exception id list as studentIds empty workaround:
    // Update: send studentIds as bulkIds, and if empty send a placeholder by including exception students only in exceptions
    // and studentIds as the exception student ids BUT then they'd be double-processed.
    // Better: require bulk OR change API. I'll change API to allow empty studentIds when exceptions exist.

    setSaving(true);
    const res = await fetch("/api/academics/promotion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceClassSectionId: sourceClassId,
        destinationYearId,
        destinationClassSectionId: destinationClassId,
        action,
        studentIds: bulkIds,
        exceptions,
        continueRemaining,
        createMissingClass: canCreateClass && createMissingClass,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      toast.error("Promotion failed", data.error || "Please try again.");
      return;
    }
    toast.success(
      "Year-end movement saved",
      `Promoted ${data.promoted || 0} · Repeated ${data.repeated || 0} · Continued ${data.continued || 0}`
    );
    router.refresh();
    void loadStudents(sourceClassId);
  }

  if (loading) {
    return (
      <Card>
        <CardBody className="text-xs text-[var(--muted-foreground)]">
          Loading promotion workspace…
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">
              {currentLabel}
            </p>
            <span
              className={
                windowOpen
                  ? "rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                  : "rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
              }
            >
              {windowOpen
                ? "Promotion window open (last term)"
                : "Window closed — wait until last term"}
            </span>
          </div>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Bulk move one source class into exactly one destination class.
            Use exceptions for individuals going elsewhere. Students not
            selected can remain via Continue remaining (same class in the new
            year).
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Movement setup</CardTitle>
        </CardHeader>
        <CardBody className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <label className={labelClassName}>Source class (current year)</label>
            <select
              className={selectClassName}
              value={sourceClassId}
              onChange={(e) => setSourceClassId(e.target.value)}
            >
              {sourceClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.gradeLevel.code} {c.name} ({c._count.currentStudents})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Action</label>
            <select
              className={selectClassName}
              value={action}
              onChange={(e) =>
                setAction(e.target.value as "PROMOTE" | "REPEAT")
              }
            >
              <option value="PROMOTE">Promote</option>
              <option value="REPEAT">Repeat</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Destination year</label>
            <select
              className={selectClassName}
              value={destinationYearId}
              onChange={(e) => setDestinationYearId(e.target.value)}
            >
              <option value="">Select year…</option>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                  {y.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label className={labelClassName}>
              Bulk destination class (one only)
            </label>
            <select
              className={selectClassName}
              value={destinationClassId}
              onChange={(e) => setDestinationClassId(e.target.value)}
            >
              <option value="">Select class…</option>
              {destinationClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-end gap-2 pb-1 text-xs">
            <input
              type="checkbox"
              checked={continueRemaining}
              onChange={(e) => setContinueRemaining(e.target.checked)}
            />
            Continue remaining students into equivalent class
          </label>
          {canCreateClass ? (
            <label className="flex items-end gap-2 pb-1 text-xs">
              <input
                type="checkbox"
                checked={createMissingClass}
                onChange={(e) => setCreateMissingClass(e.target.checked)}
              />
              Create missing equivalent class if needed
            </label>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            Students ({students.length}) · bulk {selectedCount} · exceptions{" "}
            {exceptionCount}
          </CardTitle>
          <div className="flex gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setStudents((prev) => prev.map((s) => ({ ...s, selected: true })))
              }
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() =>
                setStudents((prev) =>
                  prev.map((s) => ({ ...s, selected: false }))
                )
              }
            >
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardBody className="pt-1.5">
          {loadingStudents ? (
            <p className="text-xs text-[var(--muted-foreground)]">Loading…</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Bulk</th>
                    <th className="pb-2 font-medium">Admission</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Exception class</th>
                    <th className="pb-2 font-medium">Exception action</th>
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No active students in this class.
                      </td>
                    </tr>
                  ) : (
                    students.map((row) => (
                      <tr
                        key={row.id}
                        className="border-t border-[var(--border)]"
                      >
                        <td className="py-2">
                          <input
                            type="checkbox"
                            checked={row.selected && !row.exceptionClassId}
                            disabled={!!row.exceptionClassId}
                            onChange={(e) =>
                              setStudents((prev) =>
                                prev.map((s) =>
                                  s.id === row.id
                                    ? { ...s, selected: e.target.checked }
                                    : s
                                )
                              )
                            }
                          />
                        </td>
                        <td className="py-2">{row.admissionNo}</td>
                        <td className="py-2 font-medium">{row.name}</td>
                        <td className="py-2">
                          <select
                            className={selectClassName}
                            value={row.exceptionClassId}
                            onChange={(e) =>
                              setStudents((prev) =>
                                prev.map((s) =>
                                  s.id === row.id
                                    ? {
                                        ...s,
                                        exceptionClassId: e.target.value,
                                        selected: e.target.value
                                          ? false
                                          : s.selected,
                                      }
                                    : s
                                )
                              )
                            }
                          >
                            <option value="">None (use bulk)</option>
                            {destinationClasses.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2">
                          <select
                            className={selectClassName}
                            value={row.exceptionAction}
                            disabled={!row.exceptionClassId}
                            onChange={(e) =>
                              setStudents((prev) =>
                                prev.map((s) =>
                                  s.id === row.id
                                    ? {
                                        ...s,
                                        exceptionAction: e.target
                                          .value as StudentRow["exceptionAction"],
                                      }
                                    : s
                                )
                              )
                            }
                          >
                            <option value="PROMOTE">Promote</option>
                            <option value="REPEAT">Repeat</option>
                            <option value="CONTINUE">Continue</option>
                          </select>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={saving || !windowOpen}
              onClick={runPromotion}
            >
              {saving ? "Saving…" : "Run year-end movement"}
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
