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
  gradeLevelIds: z.array(z.string()).optional(),
});

async function validateLevelIds(stageId: string | null, gradeLevelIds: string[]) {
  if (gradeLevelIds.length === 0) return { ok: true as const };

  const levels = await prisma.gradeLevel.findMany({
    where: { id: { in: gradeLevelIds } },
  });
  if (levels.length !== gradeLevelIds.length) {
    return { ok: false as const, error: "One or more selected levels were not found" };
  }

  if (stageId) {
    const stage = await prisma.stage.findUnique({ where: { id: stageId } });
    if (stage && stage.code !== "ALL") {
      const invalid = levels.filter((l) => l.stageId !== stageId);
      if (invalid.length > 0) {
        return {
          ok: false as const,
          error: "Selected levels must belong to the subject's stage",
        };
      }
    }
  }

  return { ok: true as const };
}

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
      allowedLevels: { include: { gradeLevel: true } },
      _count: { select: { teacherSubjects: true, timetableSlots: true } },
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

  const stageId = parsed.data.stageId || null;
  const gradeLevelIds = [...new Set(parsed.data.gradeLevelIds || [])];
  const levelCheck = await validateLevelIds(stageId, gradeLevelIds);
  if (!levelCheck.ok) {
    return NextResponse.json({ error: levelCheck.error }, { status: 400 });
  }

  try {
    const subject = await prisma.subject.create({
      data: {
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        stageId,
        isCore: parsed.data.isCore ?? true,
        allowedLevels: {
          create: gradeLevelIds.map((gradeLevelId) => ({ gradeLevelId })),
        },
      },
      include: {
        stage: true,
        allowedLevels: { include: { gradeLevel: true } },
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
