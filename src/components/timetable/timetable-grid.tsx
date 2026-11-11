"use client";

import { TIMETABLE_DAYS } from "@/lib/subjects-for-level";

export type TimetableSlotView = {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  kind: "subject" | "activity";
  title: string;
  subtitle?: string | null;
  classLabel?: string;
};

export function TimetableGrid({
  slots,
  onSlotClick,
  emptyLabel = "—",
}: {
  slots: TimetableSlotView[];
  onSlotClick?: (slot: TimetableSlotView) => void;
  emptyLabel?: string;
}) {
  const timeKeys = Array.from(
    new Set(slots.map((slot) => `${slot.startTime}-${slot.endTime}`))
  ).sort((a, b) => a.localeCompare(b));

  const byKey = new Map<string, TimetableSlotView>();
  for (const slot of slots) {
    byKey.set(`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`, slot);
  }

  if (timeKeys.length === 0) {
    return (
      <p className="text-xs text-[var(--muted-foreground)]">
        No timetable slots yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-left text-xs">
        <thead className="text-[var(--muted-foreground)]">
          <tr>
            <th className="border-b border-[var(--border)] pb-2 pr-2 font-medium">
              Time
            </th>
            {TIMETABLE_DAYS.map((day) => (
              <th
                key={day.value}
                className="border-b border-[var(--border)] pb-2 px-1 font-medium"
              >
                {day.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timeKeys.map((timeKey) => {
            const [startTime, endTime] = timeKey.split("-");
            return (
              <tr key={timeKey}>
                <td className="border-t border-[var(--border)] py-1.5 pr-2 font-medium text-[var(--muted-foreground)] whitespace-nowrap">
                  {startTime}–{endTime}
                </td>
                {TIMETABLE_DAYS.map((day) => {
                  const slot = byKey.get(`${day.value}-${timeKey}`);
                  return (
                    <td
                      key={`${day.value}-${timeKey}`}
                      className="border-t border-[var(--border)] p-1 align-top"
                    >
                      {slot ? (
                        <button
                          type="button"
                          disabled={!onSlotClick}
                          onClick={() => onSlotClick?.(slot)}
                          className={
                            slot.kind === "activity"
                              ? "block w-full rounded-md bg-[var(--muted)] px-1.5 py-1 text-left transition hover:opacity-90 disabled:cursor-default"
                              : "block w-full rounded-md bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)] px-1.5 py-1 text-left transition hover:bg-[color-mix(in_srgb,var(--brand-primary)_18%,transparent)] disabled:cursor-default"
                          }
                        >
                          <p
                            className={
                              slot.kind === "activity"
                                ? "font-semibold text-[var(--foreground)]"
                                : "font-semibold text-[var(--brand-primary)]"
                            }
                          >
                            {slot.title}
                          </p>
                          {slot.subtitle ? (
                            <p className="text-[10px] text-[var(--foreground)]">
                              {slot.subtitle}
                            </p>
                          ) : null}
                          {slot.classLabel ? (
                            <p className="text-[10px] text-[var(--muted-foreground)]">
                              {slot.classLabel}
                            </p>
                          ) : null}
                          {slot.room ? (
                            <p className="text-[10px] text-[var(--muted-foreground)]">
                              {slot.room}
                            </p>
                          ) : null}
                        </button>
                      ) : (
                        <span className="block px-1.5 py-2 text-[10px] text-[var(--muted-foreground)]">
                          {emptyLabel}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
