"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { labelClassName } from "@/lib/field-styles";

type Band = {
  label: string;
  minScore: number;
  maxScore: number;
  sortOrder: number;
};

type StageScheme = {
  stageId: string;
  stageCode: string;
  stageName: string;
  classScoreWeight: number;
  examWeight: number;
  bands: Band[];
};

export function GradingManager({
  stages,
  canWrite,
}: {
  stages: StageScheme[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [drafts, setDrafts] = useState<StageScheme[]>(stages);
  const [savingId, setSavingId] = useState<string | null>(null);

  function updateStage(stageId: string, patch: Partial<StageScheme>) {
    setDrafts((prev) =>
      prev.map((s) => (s.stageId === stageId ? { ...s, ...patch } : s))
    );
  }

  function updateBand(
    stageId: string,
    index: number,
    patch: Partial<Band>
  ) {
    setDrafts((prev) =>
      prev.map((s) => {
        if (s.stageId !== stageId) return s;
        const bands = s.bands.map((b, i) =>
          i === index ? { ...b, ...patch } : b
        );
        return { ...s, bands };
      })
    );
  }

  async function save(stage: StageScheme) {
    setSavingId(stage.stageId);
    const res = await fetch("/api/academics/schemes", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stageId: stage.stageId,
        classScoreWeight: Number(stage.classScoreWeight),
        examWeight: Number(stage.examWeight),
        bands: stage.bands,
      }),
    });
    const data = await res.json();
    setSavingId(null);
    if (!res.ok) {
      toast.error("Could not save grading", data.error || "Please try again.");
      return;
    }
    toast.success(`${stage.stageName} grading saved`);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {drafts.map((stage) => (
        <Card key={stage.stageId}>
          <CardHeader>
            <CardTitle>
              {stage.stageName} ({stage.stageCode})
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 pt-1.5">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <label className={labelClassName}>Class score weight %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={!canWrite}
                  value={stage.classScoreWeight}
                  onChange={(e) =>
                    updateStage(stage.stageId, {
                      classScoreWeight: Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>Exam weight %</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  disabled={!canWrite}
                  value={stage.examWeight}
                  onChange={(e) =>
                    updateStage(stage.stageId, {
                      examWeight: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Grade</th>
                    <th className="pb-2 font-medium">Min</th>
                    <th className="pb-2 font-medium">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {stage.bands.map((band, index) => (
                    <tr
                      key={`${stage.stageId}-${band.label}-${index}`}
                      className="border-t border-[var(--border)]"
                    >
                      <td className="py-1.5 pr-2">
                        <Input
                          value={band.label}
                          disabled={!canWrite}
                          onChange={(e) =>
                            updateBand(stage.stageId, index, {
                              label: e.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          disabled={!canWrite}
                          value={band.minScore}
                          onChange={(e) =>
                            updateBand(stage.stageId, index, {
                              minScore: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                      <td className="py-1.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          disabled={!canWrite}
                          value={band.maxScore}
                          onChange={(e) =>
                            updateBand(stage.stageId, index, {
                              maxScore: Number(e.target.value),
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canWrite ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  disabled={savingId === stage.stageId}
                  onClick={() => void save(stage)}
                >
                  {savingId === stage.stageId ? "Saving…" : "Save"}
                </Button>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
