import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const putSchema = z.object({
  stageId: z.string().min(1),
  classScoreWeight: z.number().min(0).max(100),
  examWeight: z.number().min(0).max(100),
  bands: z
    .array(
      z.object({
        label: z.string().min(1).max(5),
        minScore: z.number().min(0).max(100),
        maxScore: z.number().min(0).max(100),
        sortOrder: z.number().int().optional(),
      })
    )
    .optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (!can(session.user.permissions, "marks.read") &&
      !can(session.user.permissions, "academics.read"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stages = await prisma.stage.findMany({
    where: { isActive: true, NOT: { code: "ALL" } },
    orderBy: { sortOrder: "asc" },
    include: {
      assessmentScheme: true,
      gradeBands: { orderBy: { sortOrder: "asc" } },
    },
  });

  return NextResponse.json(
    stages.map((stage) => ({
      stageId: stage.id,
      stageCode: stage.code,
      stageName: stage.name,
      scheme: stage.assessmentScheme,
      bands: stage.gradeBands,
    }))
  );
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    !(
      can(session.user.permissions, "marks.write") ||
      can(session.user.permissions, "academics.write")
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = putSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scheme data" }, { status: 400 });
  }

  const { stageId, classScoreWeight, examWeight, bands } = parsed.data;
  if (Math.abs(classScoreWeight + examWeight - 100) > 0.01) {
    return NextResponse.json(
      { error: "Class score and exam weights must add up to 100" },
      { status: 400 }
    );
  }

  const stage = await prisma.stage.findUnique({ where: { id: stageId } });
  if (!stage) {
    return NextResponse.json({ error: "Stage not found" }, { status: 404 });
  }

  const result = await prisma.$transaction(async (tx) => {
    const scheme = await tx.assessmentScheme.upsert({
      where: { stageId },
      update: { classScoreWeight, examWeight },
      create: { stageId, classScoreWeight, examWeight },
    });

    if (bands) {
      await tx.gradeBand.deleteMany({ where: { stageId } });
      if (bands.length > 0) {
        await tx.gradeBand.createMany({
          data: bands.map((band, index) => ({
            stageId,
            label: band.label.trim().toUpperCase(),
            minScore: band.minScore,
            maxScore: band.maxScore,
            sortOrder: band.sortOrder ?? index + 1,
          })),
        });
      }
    }

    const nextBands = await tx.gradeBand.findMany({
      where: { stageId },
      orderBy: { sortOrder: "asc" },
    });

    return { scheme, bands: nextBands };
  });

  return NextResponse.json(result);
}
