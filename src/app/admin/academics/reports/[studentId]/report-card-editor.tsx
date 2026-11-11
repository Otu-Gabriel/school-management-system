"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { labelClassName } from "@/lib/field-styles";

export function ReportCardEditor({
  studentId,
  classSectionId,
  academicYearId,
  termId,
  teacherRemark,
  published,
  canWrite,
  canPublish,
}: {
  studentId: string;
  classSectionId: string;
  academicYearId: string;
  termId: string;
  teacherRemark: string;
  published: boolean;
  canWrite: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [remark, setRemark] = useState(teacherRemark);
  const [busy, setBusy] = useState(false);

  async function save(publish?: boolean) {
    setBusy(true);
    const res = await fetch("/api/academics/reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        classSectionId,
        academicYearId,
        termId,
        teacherRemark: remark,
        ...(publish === undefined ? {} : { publish }),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not save report", data.error || "Please try again.");
      return;
    }
    toast.success(
      publish ? "Report published" : publish === false ? "Unpublished" : "Remark saved"
    );
    router.refresh();
  }

  if (!canWrite && !canPublish) {
    return (
      <Button type="button" size="sm" variant="secondary" onClick={() => window.print()}>
        Print
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 sm:w-80">
      {canWrite ? (
        <div className="space-y-1">
          <label className={labelClassName}>Teacher remark</label>
          <Input
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Remark for report card"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {canWrite ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() => void save()}
          >
            Save remark
          </Button>
        ) : null}
        {canPublish ? (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => void save(!published)}
          >
            {published ? "Unpublish" : "Publish"}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => window.print()}
        >
          Print
        </Button>
      </div>
    </div>
  );
}
