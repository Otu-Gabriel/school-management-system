"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Lock, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import {
  CalendarHoliday,
  RangeCalendar,
  TermTimeline,
} from "./calendar-grid";

type TermItem = {
  id: string;
  name: string;
  termNumber: number;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isLocked: boolean;
};

type YearItem = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  terms: TermItem[];
};

type HolidayItem = CalendarHoliday & {
  academicYearId: string | null;
};

function formatRange(start: string, end: string) {
  return `${start} → ${end}`;
}

function StatusPill({
  tone,
  children,
}: {
  tone: "current" | "muted" | "locked";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-wide",
        tone === "current" &&
          "bg-[var(--brand-primary)]/12 text-[var(--brand-primary)]",
        tone === "muted" &&
          "bg-[var(--muted)] text-[var(--muted-foreground)]",
        tone === "locked" && "bg-amber-500/12 text-amber-700"
      )}
    >
      {children}
    </span>
  );
}

export function YearsManager({
  years,
  holidays,
  canWrite,
  weekendClosed,
}: {
  years: YearItem[];
  holidays: HolidayItem[];
  canWrite: boolean;
  weekendClosed: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const defaultYearId =
    years.find((y) => y.isCurrent)?.id || years[0]?.id || "";

  const [selectedYearId, setSelectedYearId] = useState(defaultYearId);
  const [busyTermId, setBusyTermId] = useState<string | null>(null);
  const [confirmTerm, setConfirmTerm] = useState<{
    year: YearItem;
    term: TermItem;
  } | null>(null);
  const [holidayTerm, setHolidayTerm] = useState<{
    year: YearItem;
    term: TermItem;
  } | null>(null);
  const [termCalendar, setTermCalendar] = useState<{
    year: YearItem;
    term: TermItem;
  } | null>(null);
  const [yearCalendarOpen, setYearCalendarOpen] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    date: "",
    type: "CLOSED" as "CLOSED" | "OPEN",
    name: "",
  });
  const [savingHoliday, setSavingHoliday] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!years.length) {
      setSelectedYearId("");
      return;
    }
    if (!years.some((y) => y.id === selectedYearId)) {
      setSelectedYearId(
        years.find((y) => y.isCurrent)?.id || years[0].id
      );
    }
  }, [years, selectedYearId]);

  const selectedYear = useMemo(
    () => years.find((y) => y.id === selectedYearId) || null,
    [years, selectedYearId]
  );

  const yearHolidays = useMemo(() => {
    if (!selectedYear) return [];
    return holidays.filter(
      (h) =>
        h.academicYearId === selectedYear.id ||
        selectedYear.terms.some((t) => t.id === h.termId)
    );
  }, [holidays, selectedYear]);

  const holidaysByTerm = useMemo(() => {
    const map = new Map<string, HolidayItem[]>();
    for (const item of yearHolidays) {
      if (!item.termId) continue;
      const list = map.get(item.termId) || [];
      list.push(item);
      map.set(item.termId, list);
    }
    return map;
  }, [yearHolidays]);

  const currentTerm = selectedYear?.terms.find((t) => t.isCurrent) || null;

  function openHolidayModal(year: YearItem, term: TermItem) {
    setHolidayForm({ date: term.startDate, type: "CLOSED", name: "" });
    setHolidayTerm({ year, term });
  }

  async function confirmSetCurrent() {
    if (!canWrite || !confirmTerm) return;
    const termId = confirmTerm.term.id;
    setBusyTermId(termId);
    const res = await fetch(`/api/academics/terms/${termId}/current`, {
      method: "PUT",
    });
    const data = await res.json().catch(() => ({}));
    setBusyTermId(null);
    const yearId = confirmTerm.year.id;
    const yearName = confirmTerm.year.name;
    const termName = confirmTerm.term.name;
    setConfirmTerm(null);
    if (!res.ok) {
      toast.error("Could not set current term", data.error || "Please try again.");
      return;
    }
    toast.success(
      "Current term updated",
      `${yearName} · ${termName} is now active for attendance.`
    );
    setSelectedYearId(yearId);
    router.refresh();
  }

  async function saveHoliday(e: React.FormEvent) {
    e.preventDefault();
    if (!canWrite || !holidayTerm) return;
    setSavingHoliday(true);
    const res = await fetch("/api/academics/calendar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...holidayForm,
        termId: holidayTerm.term.id,
      }),
    });
    const data = await res.json();
    setSavingHoliday(false);
    if (!res.ok) {
      toast.error("Could not save calendar day", data.error || "Please try again.");
      return;
    }
    toast.success(
      holidayForm.type === "CLOSED"
        ? "Holiday/closed day saved"
        : "Special open day saved",
      `${holidayTerm.term.name} · ${holidayForm.date}`
    );
    setHolidayTerm(null);
    router.refresh();
  }

  async function deleteHoliday(id: string) {
    if (!canWrite) return;
    setDeleteId(id);
    const res = await fetch(`/api/academics/calendar/${id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setDeleteId(null);
    if (!res.ok) {
      toast.warning("Could not delete", data.error || "Please try again.");
      return;
    }
    toast.success("Calendar day removed");
    router.refresh();
  }

  if (years.length === 0) {
    return (
      <Card>
        <CardBody className="space-y-1 py-8 text-center">
          <p className="text-sm font-medium text-[var(--foreground)]">
            No academic years yet
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Create a year with term dates to start attendance and calendars.
          </p>
        </CardBody>
      </Card>
    );
  }

  if (!selectedYear) return null;

  return (
    <div className="space-y-3">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <label className={labelClassName}>Academic year</label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={cn(selectClassName, "min-w-[11rem] sm:min-w-[14rem]")}
                  value={selectedYearId}
                  onChange={(e) => setSelectedYearId(e.target.value)}
                >
                  {years.map((year) => (
                    <option key={year.id} value={year.id}>
                      {year.name}
                      {year.isCurrent ? " (current)" : ""}
                    </option>
                  ))}
                </select>
                {selectedYear.isCurrent ? (
                  <StatusPill tone="current">Active year</StatusPill>
                ) : (
                  <StatusPill tone="muted">Archived view</StatusPill>
                )}
              </div>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                Showing one year at a time. Switch above to review or edit another
                year.
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setYearCalendarOpen(true)}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Year calendar
              </Button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                Period
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--foreground)]">
                {formatRange(selectedYear.startDate, selectedYear.endDate)}
              </p>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                Current term
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--foreground)]">
                {currentTerm
                  ? `${currentTerm.name}`
                  : selectedYear.isCurrent
                    ? "Not set"
                    : "—"}
              </p>
            </div>
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/25 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-[var(--muted-foreground)]">
                School week
              </p>
              <p className="mt-0.5 text-xs font-medium text-[var(--foreground)]">
                Closed{" "}
                {weekendClosed === "0,6" ? "Sun & Sat" : `days ${weekendClosed}`}
                {" · "}
                {yearHolidays.length} special day
                {yearHolidays.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--brand-primary)_5%,var(--surface))] px-3.5 py-2.5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Year timeline
          </h3>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Visual map of terms and holidays across {selectedYear.name}.
          </p>
        </div>
        <CardBody className="pt-3">
          <TermTimeline
            yearStart={selectedYear.startDate}
            yearEnd={selectedYear.endDate}
            terms={selectedYear.terms}
            holidays={yearHolidays}
            currentTermId={currentTerm?.id}
          />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--brand-primary)_5%,var(--surface))] px-3.5 py-2.5">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">
            Terms
          </h3>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            Calendars, holidays, and the active term for attendance.
          </p>
        </div>
        <CardBody className="space-y-2.5 pt-3">
          {selectedYear.terms.map((term, index) => {
            const termDays = holidaysByTerm.get(term.id) || [];
            return (
              <div
                key={term.id}
                className={cn(
                  "relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]",
                  term.isCurrent &&
                    "border-[var(--brand-primary)]/45 bg-[color-mix(in_srgb,var(--brand-primary)_4%,var(--surface))]"
                )}
              >
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 w-1",
                    index % 4 === 0 && "bg-[var(--brand-primary)]",
                    index % 4 === 1 && "bg-sky-500",
                    index % 4 === 2 && "bg-amber-500",
                    index % 4 === 3 && "bg-teal-500"
                  )}
                />
                <div className="space-y-3 p-3 pl-3.5 sm:p-3.5 sm:pl-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex gap-2.5">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold",
                          term.isCurrent
                            ? "bg-[var(--brand-primary)] text-white"
                            : "bg-[var(--muted)] text-[var(--muted-foreground)]"
                        )}
                      >
                        T{term.termNumber}
                      </div>
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h4 className="text-sm font-semibold text-[var(--foreground)]">
                            {term.name}
                          </h4>
                          {term.isCurrent ? (
                            <StatusPill tone="current">Current</StatusPill>
                          ) : null}
                          {term.isLocked ? (
                            <StatusPill tone="locked">
                              <Lock className="mr-0.5 inline h-2.5 w-2.5" />
                              Locked
                            </StatusPill>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-[var(--muted-foreground)]">
                          <span className="tabular-nums">
                            {formatRange(term.startDate, term.endDate)}
                          </span>
                          <span>
                            {termDays.length} special day
                            {termDays.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setTermCalendar({ year: selectedYear, term })
                        }
                      >
                        <CalendarDays className="h-3.5 w-3.5" />
                        Calendar
                      </Button>
                      {canWrite ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() =>
                              openHolidayModal(selectedYear, term)
                            }
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add day
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={term.isCurrent ? "secondary" : "primary"}
                            disabled={
                              term.isCurrent || busyTermId === term.id
                            }
                            onClick={() =>
                              setConfirmTerm({ year: selectedYear, term })
                            }
                          >
                            {busyTermId === term.id
                              ? "Setting…"
                              : term.isCurrent
                                ? "Active"
                                : "Set current"}
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {termDays.length > 0 ? (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {termDays.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2.5 py-2"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium tabular-nums text-[var(--foreground)]">
                                {item.date}
                              </span>
                              <span
                                className={cn(
                                  "inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium",
                                  item.type === "CLOSED"
                                    ? "bg-rose-500/12 text-rose-700 dark:text-rose-300"
                                    : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                )}
                              >
                                {item.type === "CLOSED" ? "Closed" : "Open"}
                              </span>
                            </div>
                            <p className="truncate text-[11px] text-[var(--muted-foreground)]">
                              {item.name || "Untitled day"}
                            </p>
                          </div>
                          {canWrite ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              disabled={deleteId === item.id}
                              onClick={() => deleteHoliday(item.id)}
                            >
                              {deleteId === item.id ? "…" : "Remove"}
                            </Button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-2.5 text-[11px] text-[var(--muted-foreground)]">
                      No holidays in this term yet.
                      {canWrite ? " Use Add day to attach one." : ""}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Modal
        open={!!confirmTerm}
        onClose={() => setConfirmTerm(null)}
        title="Confirm current term"
        description="This changes the active academic year and term used for attendance and school activities."
        size="sm"
      >
        {confirmTerm ? (
          <div className="space-y-3">
            <div className="rounded-md border border-[var(--border)] bg-[var(--muted)]/30 px-3 py-2.5">
              <p className="text-xs font-semibold text-[var(--foreground)]">
                {confirmTerm.year.name} · {confirmTerm.term.name}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                {formatRange(
                  confirmTerm.term.startDate,
                  confirmTerm.term.endDate
                )}
              </p>
            </div>
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Any other current year/term will be cleared. Attendance can only be
              marked on school days inside this term.
            </p>
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setConfirmTerm(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={busyTermId === confirmTerm.term.id}
                onClick={confirmSetCurrent}
              >
                {busyTermId === confirmTerm.term.id
                  ? "Confirming…"
                  : "Yes, set current"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={!!holidayTerm}
        onClose={() => setHolidayTerm(null)}
        title={
          holidayTerm
            ? `Add day · ${holidayTerm.term.name}`
            : "Add holiday / special day"
        }
        description={
          holidayTerm
            ? `Date must fall within ${formatRange(holidayTerm.term.startDate, holidayTerm.term.endDate)}.`
            : undefined
        }
        size="md"
      >
        {holidayTerm ? (
          <form onSubmit={saveHoliday} className="space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClassName}>Date</label>
                <Input
                  type="date"
                  value={holidayForm.date}
                  min={holidayTerm.term.startDate}
                  max={holidayTerm.term.endDate}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, date: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>Type</label>
                <select
                  className={selectClassName}
                  value={holidayForm.type}
                  onChange={(e) =>
                    setHolidayForm({
                      ...holidayForm,
                      type: e.target.value as "CLOSED" | "OPEN",
                    })
                  }
                >
                  <option value="CLOSED">Closed / holiday</option>
                  <option value="OPEN">Special open day</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className={labelClassName}>Label</label>
                <Input
                  value={holidayForm.name}
                  onChange={(e) =>
                    setHolidayForm({ ...holidayForm, name: e.target.value })
                  }
                  placeholder="e.g. Founders’ Day"
                />
              </div>
            </div>
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setHolidayTerm(null)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={savingHoliday}>
                {savingHoliday ? "Saving…" : "Save day"}
              </Button>
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={!!termCalendar}
        onClose={() => setTermCalendar(null)}
        title={
          termCalendar
            ? `${termCalendar.year.name} · ${termCalendar.term.name}`
            : "Term calendar"
        }
        description={
          termCalendar
            ? `${formatRange(termCalendar.term.startDate, termCalendar.term.endDate)}. Holidays are highlighted.`
            : undefined
        }
        size="xl"
      >
        {termCalendar ? (
          <div className="space-y-3">
            {canWrite ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const ctx = termCalendar;
                  setTermCalendar(null);
                  openHolidayModal(ctx.year, ctx.term);
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add day in this term
              </Button>
            ) : null}
            <RangeCalendar
              startDate={termCalendar.term.startDate}
              endDate={termCalendar.term.endDate}
              terms={termCalendar.year.terms}
              holidays={holidaysByTerm.get(termCalendar.term.id) || []}
              weekendClosed={weekendClosed}
              highlightTermId={termCalendar.term.id}
            />
          </div>
        ) : null}
      </Modal>

      <Modal
        open={yearCalendarOpen}
        onClose={() => setYearCalendarOpen(false)}
        title={`${selectedYear.name} overview`}
        description={`Terms, start dates, and holidays for ${formatRange(selectedYear.startDate, selectedYear.endDate)}.`}
        size="xl"
      >
        <div className="space-y-3">
          <TermTimeline
            yearStart={selectedYear.startDate}
            yearEnd={selectedYear.endDate}
            terms={selectedYear.terms}
            holidays={yearHolidays}
            currentTermId={currentTerm?.id}
          />
          <RangeCalendar
            startDate={selectedYear.startDate}
            endDate={selectedYear.endDate}
            terms={selectedYear.terms}
            holidays={yearHolidays}
            weekendClosed={weekendClosed}
          />
        </div>
      </Modal>
    </div>
  );
}
