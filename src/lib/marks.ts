import { prisma } from "@/lib/prisma";

export type SchemeWeights = {
  classScoreWeight: number;
  examWeight: number;
};

export const DEFAULT_SCHEME: SchemeWeights = {
  classScoreWeight: 30,
  examWeight: 70,
};

export const DEFAULT_GRADE_BANDS = [
  { label: "A", minScore: 80, maxScore: 100, sortOrder: 1 },
  { label: "B", minScore: 70, maxScore: 79.99, sortOrder: 2 },
  { label: "C", minScore: 60, maxScore: 69.99, sortOrder: 3 },
  { label: "D", minScore: 50, maxScore: 59.99, sortOrder: 4 },
  { label: "E", minScore: 40, maxScore: 49.99, sortOrder: 5 },
  { label: "F", minScore: 0, maxScore: 39.99, sortOrder: 6 },
] as const;

export function computeTotal(
  classScore: number | null | undefined,
  examScore: number | null | undefined,
  scheme: SchemeWeights
) {
  if (classScore == null && examScore == null) return null;
  const ca = classScore ?? 0;
  const exam = examScore ?? 0;
  const total =
    (ca * scheme.classScoreWeight + exam * scheme.examWeight) / 100;
  return Math.round(total * 100) / 100;
}

export function gradeForScore(
  total: number | null | undefined,
  bands: Array<{ label: string; minScore: number; maxScore: number }>
) {
  if (total == null || Number.isNaN(total)) return null;
  const hit = bands.find((b) => total >= b.minScore && total <= b.maxScore);
  return hit?.label ?? null;
}

export async function getSchemeForStage(stageId: string | null | undefined) {
  if (!stageId) return DEFAULT_SCHEME;
  const scheme = await prisma.assessmentScheme.findUnique({
    where: { stageId },
  });
  if (!scheme) return DEFAULT_SCHEME;
  return {
    classScoreWeight: scheme.classScoreWeight,
    examWeight: scheme.examWeight,
  };
}

export async function getBandsForStage(stageId: string | null | undefined) {
  if (!stageId) return [...DEFAULT_GRADE_BANDS];
  const bands = await prisma.gradeBand.findMany({
    where: { stageId },
    orderBy: { sortOrder: "asc" },
  });
  if (bands.length === 0) return [...DEFAULT_GRADE_BANDS];
  return bands;
}

export async function resolveMarkTotals(input: {
  stageId: string | null | undefined;
  classScore: number | null | undefined;
  examScore: number | null | undefined;
}) {
  const [scheme, bands] = await Promise.all([
    getSchemeForStage(input.stageId),
    getBandsForStage(input.stageId),
  ]);
  const total = computeTotal(input.classScore, input.examScore, scheme);
  const gradeLabel = gradeForScore(total, bands);
  return { scheme, bands, total, gradeLabel };
}

export function invoicePaidTotal(
  payments: Array<{ amount: number }>
): number {
  return payments.reduce((sum, p) => sum + p.amount, 0);
}

export function deriveInvoiceStatus(
  amount: number,
  paid: number,
  current: "OPEN" | "PARTIAL" | "PAID" | "WAIVED"
): "OPEN" | "PARTIAL" | "PAID" | "WAIVED" {
  if (current === "WAIVED") return "WAIVED";
  if (paid <= 0) return "OPEN";
  if (paid + 0.001 >= amount) return "PAID";
  return "PARTIAL";
}
