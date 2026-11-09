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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (!can(session.user.permissions, "subjects.read") &&
      !can(session.user.permissions, "assignments.read") &&
      !can(session.user.permissions, "assignments.write"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const subjects = await prisma.subject.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      stage: true,
      _count: { select: { teacherSubjects: true } },
    },
  });
  return NextResponse.json(subjects);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "subjects.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subject data" }, { status: 400 });
  }

  try {
    const subject = await prisma.subject.create({
      data: {
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        stageId: parsed.data.stageId || null,
        isCore: parsed.data.isCore ?? true,
      },
    });
    return NextResponse.json(subject, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create subject. Code may already exist." },
      { status: 400 }
    );
  }
}
