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
          error: "Selected levels must belong to the activity's stage",
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
    (!can(session.user.permissions, "activities.read") &&
      !can(session.user.permissions, "academics.read") &&
      !can(session.user.permissions, "assignments.write"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activities = await prisma.activity.findMany({
    orderBy: [{ name: "asc" }],
    include: {
      stage: true,
      allowedLevels: { include: { gradeLevel: true } },
      _count: { select: { timetableSlots: true } },
    },
  });
  return NextResponse.json(activities);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "activities.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activity data" }, { status: 400 });
  }

  const stageId = parsed.data.stageId || null;
  const gradeLevelIds = [...new Set(parsed.data.gradeLevelIds || [])];
  const levelCheck = await validateLevelIds(stageId, gradeLevelIds);
  if (!levelCheck.ok) {
    return NextResponse.json({ error: levelCheck.error }, { status: 400 });
  }

  try {
    const activity = await prisma.activity.create({
      data: {
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        stageId,
        allowedLevels: {
          create: gradeLevelIds.map((gradeLevelId) => ({ gradeLevelId })),
        },
      },
      include: {
        stage: true,
        allowedLevels: { include: { gradeLevel: true } },
      },
    });
    return NextResponse.json(activity, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create activity. Code may already exist." },
      { status: 400 }
    );
  }
}
