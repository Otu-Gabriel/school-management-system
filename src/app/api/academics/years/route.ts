import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parseDateOnly } from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";

const termSchema = z.object({
  name: z.string().min(1),
  termNumber: z.number().int().min(1).max(6),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
});

const schema = z.object({
  name: z.string().min(2),
  startDate: z.string().min(8),
  endDate: z.string().min(8),
  setCurrent: z.boolean().default(true),
  currentTermNumber: z.number().int().min(1).max(6).default(1),
  terms: z.array(termSchema).min(1).max(6),
});

function validateYearAndTerms(input: z.infer<typeof schema>) {
  const yearStart = parseDateOnly(input.startDate);
  const yearEnd = parseDateOnly(input.endDate);
  if (yearStart.getTime() >= yearEnd.getTime()) {
    return "Year end date must be after start date.";
  }

  const sorted = [...input.terms].sort((a, b) => a.termNumber - b.termNumber);
  for (let i = 0; i < sorted.length; i += 1) {
    const term = sorted[i];
    const start = parseDateOnly(term.startDate);
    const end = parseDateOnly(term.endDate);
    if (start.getTime() >= end.getTime()) {
      return `${term.name}: end date must be after start date.`;
    }
    if (start.getTime() < yearStart.getTime() || end.getTime() > yearEnd.getTime()) {
      return `${term.name}: dates must fall within the academic year.`;
    }
    if (i > 0) {
      const prevEnd = parseDateOnly(sorted[i - 1].endDate);
      if (start.getTime() <= prevEnd.getTime()) {
        return `${term.name}: overlaps previous term. Terms must not overlap.`;
      }
    }
  }

  if (!sorted.some((t) => t.termNumber === input.currentTermNumber)) {
    return "Current term number must match one of the terms.";
  }

  return null;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });
  return NextResponse.json(years);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid year/term data" }, { status: 400 });
  }

  const validationError = validateYearAndTerms(parsed.data);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const year = await prisma.$transaction(async (tx) => {
      if (data.setCurrent) {
        await tx.academicYear.updateMany({ data: { isCurrent: false } });
        await tx.term.updateMany({ data: { isCurrent: false } });
      }

      const created = await tx.academicYear.create({
        data: {
          name: data.name.trim(),
          startDate: parseDateOnly(data.startDate),
          endDate: parseDateOnly(data.endDate),
          isCurrent: data.setCurrent,
        },
      });

      for (const term of data.terms) {
        await tx.term.create({
          data: {
            academicYearId: created.id,
            name: term.name.trim(),
            termNumber: term.termNumber,
            startDate: parseDateOnly(term.startDate),
            endDate: parseDateOnly(term.endDate),
            isCurrent:
              data.setCurrent && term.termNumber === data.currentTermNumber,
          },
        });
      }

      return created;
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "academicYear.create",
      entityType: "AcademicYear",
      entityId: year.id,
      newValues: {
        name: year.name,
        terms: data.terms.length,
        currentTermNumber: data.currentTermNumber,
      },
    });

    return NextResponse.json(year, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create academic year. Name may already exist." },
      { status: 400 }
    );
  }
}
