import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  stageId: z.string().optional().nullable(),
  isCore: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "subjects.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subject data" }, { status: 400 });
  }

  try {
    const subject = await prisma.subject.update({
      where: { id },
      data: {
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        stageId: parsed.data.stageId || null,
        isCore: parsed.data.isCore ?? true,
      },
    });
    return NextResponse.json(subject);
  } catch {
    return NextResponse.json(
      { error: "Could not update subject. Code may already exist." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "subjects.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { teacherSubjects: true } } },
  });

  if (!subject) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (subject._count.teacherSubjects > 0) {
    return NextResponse.json(
      { error: "Remove teaching assignments for this subject first" },
      { status: 400 }
    );
  }

  await prisma.subject.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
