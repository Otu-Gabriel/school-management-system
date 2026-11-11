"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export function ReportsActions({
  studentId,
  classSectionId,
  academicYearId,
  termId,
  published,
  canWrite,
  canPublish,
}: {
  studentId: string;
  classSectionId: string;
  academicYearId: string;
  termId: string;
  published: boolean;
  canWrite: boolean;
  canPublish: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function ensureAndPublish(publish: boolean) {
    if (!canWrite && !canPublish) return;
    setBusy(true);
    const res = await fetch("/api/academics/reports", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId,
        classSectionId,
        academicYearId,
        termId,
        publish,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not update report", data.error || "Please try again.");
      return;
    }
    toast.success(publish ? "Report published" : "Report unpublished");
    router.refresh();
  }

  if (!canPublish) return null;

  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      disabled={busy}
      onClick={() => void ensureAndPublish(!published)}
    >
      {busy ? "…" : published ? "Unpublish" : "Publish"}
    </Button>
  );
}
