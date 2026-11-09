import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { makeRoomForCreate } from "@/lib/sort-order";

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (!can(session.user.permissions, "stages.manage") &&
      !can(session.user.permissions, "academics.read") &&
      !can(session.user.permissions, "academics.write") &&
      !can(session.user.permissions, "subjects.read") &&
      !can(session.user.permissions, "subjects.write"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const stages = await prisma.stage.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { gradeLevels: true, subjects: true } },
    },
  });
  return NextResponse.json(stages);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "stages.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid stage data" }, { status: 400 });
  }

  try {
    const stage = await prisma.$transaction(async (tx) => {
      const sortOrder = await makeRoomForCreate(
        tx,
        "stage",
        parsed.data.sortOrder ?? 1
      );
      return tx.stage.create({
        data: {
          code: parsed.data.code.trim().toUpperCase(),
          name: parsed.data.name.trim(),
          description: parsed.data.description || null,
          sortOrder,
          isActive: parsed.data.isActive ?? true,
        },
      });
    });
    return NextResponse.json(stage, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create stage. Code or name may already exist." },
      { status: 400 }
    );
  }
}
