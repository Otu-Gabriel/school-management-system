import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const schema = z.object({
  academicYearId: z.string().min(1),
  gradeLevelId: z.string().min(1),
  name: z.string().min(1),
  section: z.string().optional().nullable(),
  classTeacherId: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const academicYearId = searchParams.get("academicYearId") || "";
  const includeInactive = searchParams.get("includeInactive") === "1";

  const classes = await prisma.classSection.findMany({
    where: {
      ...(academicYearId ? { academicYearId } : { academicYear: { isCurrent: true } }),
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      gradeLevel: true,
      classTeacher: true,
      _count: { select: { currentStudents: true } },
    },
    orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
  });

  return NextResponse.json(classes);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid class data" }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const created = await prisma.classSection.create({
      data: {
        academicYearId: data.academicYearId,
        gradeLevelId: data.gradeLevelId,
        name: data.name.trim(),
        section: data.section || null,
        classTeacherId: data.classTeacherId || null,
        room: data.room || null,
        capacity: data.capacity || null,
        isActive: true,
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "classSection.create",
      entityType: "ClassSection",
      entityId: created.id,
      newValues: {
        name: created.name,
        academicYearId: created.academicYearId,
        gradeLevelId: created.gradeLevelId,
      },
    });

    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create class. It may already exist for this level." },
      { status: 400 }
    );
  }
}
