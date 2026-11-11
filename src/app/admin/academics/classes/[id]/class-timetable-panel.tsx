"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  TimetableGrid,
  type TimetableSlotView,
} from "@/components/timetable/timetable-grid";
import { labelClassName, selectClassName } from "@/lib/field-styles";
import { TIMETABLE_DAYS } from "@/lib/subjects-for-level";

type AssignedSubject = {
  subjectId: string;
  code: string;
  name: string;
  staffId: string;
  staffLabel: string;
};

type ActivityOption = {
  id: string;
  code: string;
  name: string;
};

type StaffOption = { id: string; label: string };

type SlotItem = TimetableSlotView & {
  subjectId: string | null;
  activityId: string | null;
  staffId: string | null;
};

const DEFAULT_DAY_START = "08:00";
const DEFAULT_DURATION_MINUTES = 60;

function timeToMinutes(value: string) {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(total: number) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, total));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function addMinutes(time: string, minutes: number) {
  return minutesToTime(timeToMinutes(time) + minutes);
}

function nextWindowForDay(
  dayOfWeek: number,
  existing: SlotItem[],
  durationMinutes = DEFAULT_DURATION_MINUTES
) {
  const daySlots = existing.filter((slot) => slot.dayOfWeek === dayOfWeek);
  if (daySlots.length === 0) {
    return {
      startTime: DEFAULT_DAY_START,
      endTime: addMinutes(DEFAULT_DAY_START, durationMinutes),
    };
  }

  const latestEnd = daySlots
    .map((slot) => timeToMinutes(slot.endTime))
    .reduce((max, mins) => Math.max(max, mins), 0);

  const startTime = minutesToTime(latestEnd);
  return {
    startTime,
    endTime: addMinutes(startTime, durationMinutes),
  };
}

export function ClassTimetablePanel({
  classSectionId,
  academicYearId,
  termId,
  termName,
  assignedSubjects,
  activities,
  staff,
  slots,
  canWrite,
}: {
  classSectionId: string;
  academicYearId: string;
  termId: string | null;
  termName: string | null;
  assignedSubjects: AssignedSubject[];
  activities: ActivityOption[];
  staff: StaffOption[];
  slots: SlotItem[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SlotItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    kind: "subject" as "subject" | "activity",
    subjectId: "",
    activityId: "",
    staffId: "",
    dayOfWeek: "1",
    startTime: DEFAULT_DAY_START,
    endTime: addMinutes(DEFAULT_DAY_START, DEFAULT_DURATION_MINUTES),
    room: "",
  });

  const subjectMap = useMemo(
    () => new Map(assignedSubjects.map((s) => [s.subjectId, s])),
    [assignedSubjects]
  );

  function close() {
    setOpen(false);
    setEditing(null);
    setForm({
      kind: "subject",
      subjectId: "",
      activityId: "",
      staffId: "",
      dayOfWeek: "1",
      startTime: DEFAULT_DAY_START,
      endTime: addMinutes(DEFAULT_DAY_START, DEFAULT_DURATION_MINUTES),
      room: "",
    });
  }

  function startCreate() {
    const dayOfWeek = "1";
    const window = nextWindowForDay(Number(dayOfWeek), slots);
    setEditing(null);
    setForm({
      kind: assignedSubjects.length > 0 ? "subject" : "activity",
      subjectId: assignedSubjects[0]?.subjectId || "",
      activityId: activities[0]?.id || "",
      staffId: "",
      dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
      room: "",
    });
    setOpen(true);
  }

  function onDayChange(dayOfWeek: string) {
    if (editing) {
      setForm((prev) => ({ ...prev, dayOfWeek }));
      return;
    }
    const window = nextWindowForDay(Number(dayOfWeek), slots);
    setForm((prev) => ({
      ...prev,
      dayOfWeek,
      startTime: window.startTime,
      endTime: window.endTime,
    }));
  }

  function onStartTimeChange(startTime: string) {
    setForm((prev) => ({
      ...prev,
      startTime,
      endTime: addMinutes(startTime, DEFAULT_DURATION_MINUTES),
    }));
  }

  function startEdit(slot: SlotItem) {
    setEditing(slot);
    setForm({
      kind: slot.kind,
      subjectId: slot.subjectId || "",
      activityId: slot.activityId || "",
      staffId: slot.staffId || "",
      dayOfWeek: String(slot.dayOfWeek),
      startTime: slot.startTime,
      endTime: slot.endTime,
      room: slot.room || "",
    });
    setOpen(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!termId) return;

    if (form.kind === "subject") {
      if (!subjectMap.get(form.subjectId)) {
        toast.error("Pick an assigned subject", "Assign a teacher first.");
        return;
      }
    } else if (!form.activityId) {
      toast.error("Pick an activity", "Create activities under Academics first.");
      return;
    }

    setBusy(true);
    const payload =
      form.kind === "subject"
        ? {
            academicYearId,
            termId,
            classSectionId,
            subjectId: form.subjectId,
            activityId: null,
            staffId: subjectMap.get(form.subjectId)?.staffId || null,
            dayOfWeek: Number(form.dayOfWeek),
            startTime: form.startTime,
            endTime: form.endTime,
            room: form.room || null,
          }
        : {
            academicYearId,
            termId,
            classSectionId,
            subjectId: null,
            activityId: form.activityId,
            staffId: form.staffId || null,
            dayOfWeek: Number(form.dayOfWeek),
            startTime: form.startTime,
            endTime: form.endTime,
            room: form.room || null,
          };

    const res = await fetch(
      editing ? `/api/academics/timetable/${editing.id}` : "/api/academics/timetable",
      {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? {
                subjectId: payload.subjectId,
                activityId: payload.activityId,
                staffId: payload.staffId,
                dayOfWeek: payload.dayOfWeek,
                startTime: payload.startTime,
                endTime: payload.endTime,
                room: payload.room,
              }
            : payload
        ),
      }
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not save slot", data.error || "Please try again.");
      return;
    }
    toast.success(editing ? "Slot updated" : "Slot added");
    close();
    router.refresh();
  }

  async function onDelete() {
    if (!deleteId) return;
    setBusy(true);
    const res = await fetch(`/api/academics/timetable/${deleteId}`, {
      method: "DELETE",
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not delete slot", data.error || "Please try again.");
      setDeleteId(null);
      return;
    }
    toast.success("Slot removed");
    setDeleteId(null);
    if (editing?.id === deleteId) close();
    router.refresh();
  }

  const canAdd =
    termId &&
    (assignedSubjects.length > 0 || activities.length > 0);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>
            Timetable{termName ? ` · ${termName}` : ""} ({slots.length})
          </CardTitle>
          {canWrite && canAdd ? (
            <Button type="button" size="sm" onClick={startCreate}>
              <Plus className="h-3.5 w-3.5" />
              Add slot
            </Button>
          ) : null}
        </CardHeader>
        <CardBody className="pt-1.5">
          {!termId ? (
            <p className="text-xs text-[var(--muted-foreground)]">
              This academic year has no terms yet, so a timetable cannot be
              scheduled.
            </p>
          ) : assignedSubjects.length === 0 &&
            activities.length === 0 &&
            canWrite ? (
            <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
              Assign teachers to subjects and/or create activities before
              scheduling.
            </p>
          ) : assignedSubjects.length === 0 && canWrite ? (
            <p className="mb-2 text-[11px] text-[var(--muted-foreground)]">
              Assign teachers to subjects above to schedule lessons. Activities
              can still be added.
            </p>
          ) : null}

          {termId ? (
            <TimetableGrid
              slots={slots}
              onSlotClick={
                canWrite
                  ? (slot) => {
                      const full = slots.find((s) => s.id === slot.id);
                      if (full) startEdit(full);
                    }
                  : undefined
              }
              emptyLabel=""
            />
          ) : null}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={busy ? () => undefined : close}
        title={editing ? "Edit timetable slot" : "Add timetable slot"}
        description="Pick a day and time range, then a subject or activity. Overlaps are blocked."
        size="sm"
      >
        <form onSubmit={onSave} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Type</label>
            <select
              className={selectClassName}
              value={form.kind}
              onChange={(e) =>
                setForm({
                  ...form,
                  kind: e.target.value as "subject" | "activity",
                })
              }
            >
              <option value="subject" disabled={assignedSubjects.length === 0}>
                Subject
              </option>
              <option value="activity" disabled={activities.length === 0}>
                Activity
              </option>
            </select>
          </div>

          {form.kind === "subject" ? (
            <div className="space-y-1">
              <label className={labelClassName}>Subject</label>
              <select
                className={selectClassName}
                value={form.subjectId}
                onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
                required
              >
                <option value="" disabled>
                  Select subject
                </option>
                {assignedSubjects.map((s) => (
                  <option key={s.subjectId} value={s.subjectId}>
                    {s.code} — {s.name} ({s.staffLabel})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <label className={labelClassName}>Activity</label>
                <select
                  className={selectClassName}
                  value={form.activityId}
                  onChange={(e) =>
                    setForm({ ...form, activityId: e.target.value })
                  }
                  required
                >
                  <option value="" disabled>
                    Select activity
                  </option>
                  {activities.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>Lead staff (optional)</label>
                <select
                  className={selectClassName}
                  value={form.staffId}
                  onChange={(e) => setForm({ ...form, staffId: e.target.value })}
                >
                  <option value="">None</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          <div className="space-y-1">
            <label className={labelClassName}>Day</label>
            <select
              className={selectClassName}
              value={form.dayOfWeek}
              onChange={(e) => onDayChange(e.target.value)}
            >
              {TIMETABLE_DAYS.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={labelClassName}>Start</label>
              <Input
                type="time"
                value={form.startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className={labelClassName}>End</label>
              <Input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className={labelClassName}>Room (optional)</label>
            <Input
              value={form.room}
              onChange={(e) => setForm({ ...form, room: e.target.value })}
              placeholder="Room 3"
            />
          </div>

          <div className="flex justify-between gap-1.5">
            {editing ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setDeleteId(editing.id)}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={close}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                {busy ? "Saving…" : editing ? "Update" : "Add"}
              </Button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => (busy ? undefined : setDeleteId(null))}
        onConfirm={onDelete}
        title="Remove timetable slot?"
        description="This frees that time for the class and any assigned teacher."
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
      />
    </>
  );
}
