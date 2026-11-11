import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { classHasStudentReferences } from "@/lib/class-year";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  section: z.string().optional().nullable(),
  classTeacherId: z.string().optional().nullable(),
  room: z.string().optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  isActive: z.boolean().optional(),
  gradeLevelId: z.string().min(1).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid class data" }, { status: 400 });
  }

  const existing = await prisma.classSection.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  try {
    const updated = await prisma.classSection.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined
          ? { name: parsed.data.name.trim() }
          : {}),
        ...(parsed.data.section !== undefined
          ? { section: parsed.data.section || null }
          : {}),
        ...(parsed.data.classTeacherId !== undefined
          ? { classTeacherId: parsed.data.classTeacherId || null }
          : {}),
        ...(parsed.data.room !== undefined
          ? { room: parsed.data.room || null }
          : {}),
        ...(parsed.data.capacity !== undefined
          ? { capacity: parsed.data.capacity || null }
          : {}),
        ...(parsed.data.isActive !== undefined
          ? { isActive: parsed.data.isActive }
          : {}),
        ...(parsed.data.gradeLevelId !== undefined
          ? { gradeLevelId: parsed.data.gradeLevelId }
          : {}),
      },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: parsed.data.isActive === false
        ? "classSection.archive"
        : parsed.data.isActive === true
          ? "classSection.restore"
          : "classSection.update",
      entityType: "ClassSection",
      entityId: id,
      newValues: parsed.data,
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Could not update class. Name may already exist for this level." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.classSection.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Class not found" }, { status: 404 });
  }

  const referenced = await classHasStudentReferences(id);
  if (referenced) {
    return NextResponse.json(
      {
        error:
          "This class has current or historical student records. Archive it instead of deleting.",
      },
      { status: 400 }
    );
  }

  // Also block if teaching assignments exist
  const assignments = await prisma.teacherSubject.count({
    where: { classSectionId: id },
  });
  if (assignments > 0) {
    return NextResponse.json(
      {
        error:
          "This class has teaching assignments. Archive it instead of deleting.",
      },
      { status: 400 }
    );
  }

  await prisma.classSection.delete({ where: { id } });
  await writeAuditLog({
    userId: session.user.id,
    action: "classSection.delete",
    entityType: "ClassSection",
    entityId: id,
    oldValues: { name: existing.name },
  });

  return NextResponse.json({ ok: true });
}
