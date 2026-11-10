"use client";

import { useMemo } from "react";
import {
  addUtcDays,
  formatDateOnly,
  isDateWithinInclusive,
  parseDateOnly,
} from "@/lib/dates";
import { cn } from "@/lib/utils";

function parseWeekendClosed(value?: string | null) {
  const raw = (value || "0,6").split(",").map((part) => Number(part.trim()));
  return new Set(raw.filter((n) => Number.isFinite(n) && n >= 0 && n <= 6));
}

export type CalendarHoliday = {
  id: string;
  date: string;
  type: "CLOSED" | "OPEN";
  name: string | null;
  termId: string | null;
};

type TermBand = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function listMonthKeys(start: string, end: string) {
  const from = parseDateOnly(start);
  const to = parseDateOnly(end);
  const keys: string[] = [];
  let cursor = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
  );
  const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
  while (cursor.getTime() <= last.getTime()) {
    keys.push(monthKey(cursor));
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
    );
  }
  return keys;
}

function daysInMonthGrid(year: number, monthIndex: number) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const startPad = first.getUTCDay();
  const cells: (Date | null)[] = Array.from({ length: startPad }, () => null);
  let cursor = first;
  while (cursor.getUTCMonth() === monthIndex) {
    cells.push(new Date(cursor));
    cursor = addUtcDays(cursor, 1);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function findTerm(date: Date, terms: TermBand[]) {
  return (
    terms.find((term) =>
      isDateWithinInclusive(date, term.startDate, term.endDate)
    ) || null
  );
}

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--muted-foreground)]">
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--brand-primary)]/25" />
        Term day
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/80" />
        Closed / holiday
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500/80" />
        Special open
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="h-2.5 w-2.5 rounded-sm bg-[var(--muted)]" />
        Weekend / outside
      </span>
    </div>
  );
}

export function MonthCalendarGrid({
  month,
  rangeStart,
  rangeEnd,
  terms,
  holidays,
  weekendClosed,
  highlightTermId,
}: {
  month: string;
  rangeStart: string;
  rangeEnd: string;
  terms: TermBand[];
  holidays: CalendarHoliday[];
  weekendClosed: string;
  highlightTermId?: string;
}) {
  const [year, monthNum] = month.split("-").map(Number);
  const weekend = useMemo(
    () => parseWeekendClosed(weekendClosed),
    [weekendClosed]
  );
  const holidayMap = useMemo(
    () => new Map(holidays.map((h) => [h.date, h] as const)),
    [holidays]
  );
  const cells = daysInMonthGrid(year, monthNum - 1);

  return (
    <div className="rounded-md border border-[var(--border)] p-2">
      <p className="mb-1.5 text-[11px] font-semibold text-[var(--foreground)]">
        {monthLabel(month)}
      </p>
      <div className="grid grid-cols-7 gap-0.5 text-center text-[9px] text-[var(--muted-foreground)]">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-0.5 font-medium">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, index) => {
          if (!day) {
            return <div key={`empty-${index}`} className="aspect-square" />;
          }
          const key = formatDateOnly(day);
          const inRange = isDateWithinInclusive(day, rangeStart, rangeEnd);
          const term = findTerm(day, terms);
          const holiday = holidayMap.get(key);
          const isWeekend = weekend.has(day.getUTCDay());
          const matchesHighlight =
            !highlightTermId || term?.id === highlightTermId;

          let tone =
            "bg-[var(--muted)]/40 text-[var(--muted-foreground)]";
          if (holiday?.type === "CLOSED") {
            tone = "bg-rose-500/85 text-white font-semibold";
          } else if (holiday?.type === "OPEN") {
            tone = "bg-emerald-500/85 text-white font-semibold";
          } else if (inRange && term && matchesHighlight && !isWeekend) {
            tone =
              "bg-[var(--brand-primary)]/15 text-[var(--foreground)] font-medium";
          } else if (inRange && term && matchesHighlight && isWeekend) {
            tone = "bg-[var(--muted)] text-[var(--muted-foreground)]";
          } else if (!matchesHighlight) {
            tone = "bg-transparent text-[var(--muted-foreground)]/50";
          }

          const title = [
            key,
            term ? term.name : null,
            holiday
              ? `${holiday.type === "CLOSED" ? "Closed" : "Open"}${holiday.name ? `: ${holiday.name}` : ""}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ");

          return (
            <div
              key={key}
              title={title}
              className={cn(
                "flex aspect-square items-center justify-center rounded-sm text-[10px]",
                tone
              )}
            >
              {day.getUTCDate()}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function RangeCalendar({
  startDate,
  endDate,
  terms,
  holidays,
  weekendClosed,
  highlightTermId,
}: {
  startDate: string;
  endDate: string;
  terms: TermBand[];
  holidays: CalendarHoliday[];
  weekendClosed: string;
  highlightTermId?: string;
}) {
  const months = listMonthKeys(startDate, endDate);
  return (
    <div className="space-y-2">
      <CalendarLegend />
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {months.map((month) => (
          <MonthCalendarGrid
            key={month}
            month={month}
            rangeStart={startDate}
            rangeEnd={endDate}
            terms={terms}
            holidays={holidays}
            weekendClosed={weekendClosed}
            highlightTermId={highlightTermId}
          />
        ))}
      </div>
    </div>
  );
}

const TERM_LANE_STYLES = [
  {
    bar: "bg-[color-mix(in_srgb,var(--brand-primary)_55%,transparent)]",
    dot: "bg-[var(--brand-primary)]",
    soft: "bg-[color-mix(in_srgb,var(--brand-primary)_10%,var(--surface))]",
    text: "text-[var(--brand-primary)]",
  },
  {
    bar: "bg-sky-500/55",
    dot: "bg-sky-600",
    soft: "bg-sky-500/10",
    text: "text-sky-700 dark:text-sky-300",
  },
  {
    bar: "bg-amber-500/55",
    dot: "bg-amber-600",
    soft: "bg-amber-500/10",
    text: "text-amber-700 dark:text-amber-300",
  },
  {
    bar: "bg-teal-500/55",
    dot: "bg-teal-600",
    soft: "bg-teal-500/10",
    text: "text-teal-700 dark:text-teal-300",
  },
];

export function TermTimeline({
  yearStart,
  yearEnd,
  terms,
  holidays,
  currentTermId,
}: {
  yearStart: string;
  yearEnd: string;
  terms: TermBand[];
  holidays: CalendarHoliday[];
  currentTermId?: string | null;
}) {
  const start = parseDateOnly(yearStart).getTime();
  const end = parseDateOnly(yearEnd).getTime();
  const span = Math.max(end - start, 1);

  function pct(date: string) {
    const t = parseDateOnly(date).getTime();
    return Math.min(100, Math.max(0, ((t - start) / span) * 100));
  }

  const monthTicks = useMemo(() => {
    const from = parseDateOnly(yearStart);
    const to = parseDateOnly(yearEnd);
    const spanMs = Math.max(to.getTime() - from.getTime(), 1);
    const ticks: { key: string; label: string; left: number }[] = [];
    let cursor = new Date(
      Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), 1)
    );
    const last = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    while (cursor.getTime() <= last.getTime()) {
      const key = formatDateOnly(cursor);
      const left = Math.min(
        100,
        Math.max(0, ((cursor.getTime() - from.getTime()) / spanMs) * 100)
      );
      ticks.push({
        key,
        label: cursor.toLocaleString("en-GB", {
          month: "short",
          timeZone: "UTC",
        }),
        left,
      });
      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)
      );
    }
    return ticks;
  }, [yearStart, yearEnd]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-[var(--border)] bg-[linear-gradient(180deg,color-mix(in_srgb,var(--brand-primary)_4%,var(--surface)),var(--surface))] p-3 sm:p-3.5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--muted-foreground)]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-4 rounded-full bg-[var(--brand-primary)]/60" />
              Term span
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-0.5 rounded-full bg-rose-500" />
              Closed
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-0.5 rounded-full bg-emerald-500" />
              Special open
            </span>
          </div>
          <p className="text-[10px] tabular-nums text-[var(--muted-foreground)]">
            {yearStart} — {yearEnd}
          </p>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-full">
            {monthTicks.map((tick) => (
              <div
                key={tick.key}
                className="absolute top-0 bottom-0 border-l border-dashed border-[var(--border)]/80"
                style={{ left: `${tick.left}%` }}
              >
                <span className="absolute -top-0.5 translate-x-1 text-[9px] text-[var(--muted-foreground)]">
                  {tick.label}
                </span>
              </div>
            ))}
          </div>

          <div
            className="relative space-y-2 pt-4"
            style={{ minHeight: `${Math.max(terms.length, 1) * 34 + 8}px` }}
          >
            {terms.map((term, index) => {
              const left = pct(term.startDate);
              const right = pct(term.endDate);
              const width = Math.max(right - left, 2.5);
              const style = TERM_LANE_STYLES[index % TERM_LANE_STYLES.length];
              const isCurrent = currentTermId === term.id;
              return (
                <div key={term.id} className="relative h-7">
                  <div
                    className={cn(
                      "absolute top-0.5 flex h-6 items-center overflow-hidden rounded-md px-2 text-[10px] font-semibold shadow-[inset_0_0_0_1px_rgba(255,255,255,0.18)]",
                      style.bar,
                      isCurrent && "ring-2 ring-[var(--brand-primary)] ring-offset-1 ring-offset-[var(--surface)]"
                    )}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`${term.name}: ${term.startDate} – ${term.endDate}`}
                  >
                    <span className="truncate text-white drop-shadow-sm">
                      {term.name}
                    </span>
                  </div>
                </div>
              );
            })}

            {holidays.map((holiday) => {
              const left = pct(holiday.date);
              return (
                <span
                  key={holiday.id}
                  title={`${holiday.date}${holiday.name ? ` · ${holiday.name}` : ""}`}
                  className={cn(
                    "absolute top-4 bottom-1 w-[2px] rounded-full",
                    holiday.type === "CLOSED" ? "bg-rose-500" : "bg-emerald-500"
                  )}
                  style={{ left: `${left}%` }}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {terms.map((term, index) => {
          const termHolidays = holidays.filter((h) => h.termId === term.id);
          const style = TERM_LANE_STYLES[index % TERM_LANE_STYLES.length];
          const isCurrent = currentTermId === term.id;
          return (
            <div
              key={term.id}
              className={cn(
                "rounded-md border border-[var(--border)] px-2.5 py-2",
                style.soft,
                isCurrent && "border-[var(--brand-primary)]/40"
              )}
            >
              <div className="flex items-center gap-1.5">
                <span className={cn("h-2 w-2 rounded-full", style.dot)} />
                <p className={cn("text-xs font-semibold", style.text)}>
                  {term.name}
                </p>
                {isCurrent ? (
                  <span className="ml-auto text-[9px] font-medium uppercase tracking-wide text-[var(--brand-primary)]">
                    Active
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                {term.startDate} → {term.endDate}
              </p>
              <p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">
                {termHolidays.length
                  ? `${termHolidays.length} special day${termHolidays.length === 1 ? "" : "s"}`
                  : "No special days"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
