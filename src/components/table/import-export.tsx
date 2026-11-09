"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";

export function ImportExportButtons({
  resource,
  exportPath,
  importPath,
  templateCsv,
  templateName,
  canImport = true,
  canExport = true,
}: {
  resource: string;
  exportPath: string;
  importPath: string;
  templateCsv: string;
  templateName: string;
  canImport?: boolean;
  canExport?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onExport() {
    setBusy("export");
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(exportPath);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${resource}-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Export downloaded.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setBusy(null);
    }
  }

  async function onImport(file: File) {
    setBusy("import");
    setMessage(null);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch(importPath, { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMessage(
        `Imported ${data.created ?? 0} record(s)${
          data.skipped ? `, skipped ${data.skipped}` : ""
        }.`
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {canExport ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={onExport}
          >
            <Download className="h-4 w-4" />
            {busy === "export" ? "Exporting…" : "Export CSV"}
          </Button>
        ) : null}
        {canImport ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy !== null}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {busy === "import" ? "Importing…" : "Import CSV"}
          </Button>
        ) : null}
        {canImport ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => downloadCsv(templateName, templateCsv)}
          >
            Template
          </Button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onImport(file);
          }}
        />
      </div>
      {message && <p className="text-[11px] text-[var(--brand-primary)]">{message}</p>}
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
