import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import {
  formatDateOnly,
  isDateWithinInclusive,
  parseDateOnly,
} from "@/lib/dates";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  date: z.string().min(8),
  type: z.enum(["CLOSED", "OPEN"]).default("CLOSED"),
  name: z.string().optional().nullable(),
  termId: z.string().min(1),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const academicYearId = searchParams.get("academicYearId");
  const termId = searchParams.get("termId");

  const items = await prisma.calendarException.findMany({
    where: {
      ...(termId ? { termId } : {}),
      ...(academicYearId && !termId
        ? { OR: [{ academicYearId }, { academicYearId: null }] }
        : {}),
    },
    orderBy: { date: "asc" },
    include: {
      term: { select: { id: true, name: true, termNumber: true } },
    },
  });

  return NextResponse.json(
    items.map((item) => ({
      ...item,
      date: formatDateOnly(item.date),
    }))
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid calendar entry" }, { status: 400 });
  }

  const term = await prisma.term.findUnique({
    where: { id: parsed.data.termId },
  });
  if (!term) {
    return NextResponse.json({ error: "Term not found" }, { status: 404 });
  }

  const day = parseDateOnly(parsed.data.date);
  if (!isDateWithinInclusive(day, term.startDate, term.endDate)) {
    return NextResponse.json(
      {
        error: `Date must fall within ${term.name} (${formatDateOnly(term.startDate)} – ${formatDateOnly(term.endDate)}).`,
      },
      { status: 400 }
    );
  }

  try {
    const item = await prisma.calendarException.upsert({
      where: { date: day },
      create: {
        date: day,
        type: parsed.data.type,
        name: parsed.data.name || null,
        academicYearId: term.academicYearId,
        termId: term.id,
      },
      update: {
        type: parsed.data.type,
        name: parsed.data.name || null,
        academicYearId: term.academicYearId,
        termId: term.id,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "calendarException.save",
      entityType: "CalendarException",
      entityId: item.id,
      newValues: {
        date: parsed.data.date,
        type: parsed.data.type,
        name: parsed.data.name,
        termId: term.id,
        term: term.name,
      },
    });

    return NextResponse.json(
      { ...item, date: formatDateOnly(item.date) },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not save calendar exception." },
      { status: 400 }
    );
  }
}
