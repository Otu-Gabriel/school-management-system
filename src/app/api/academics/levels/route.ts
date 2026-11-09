import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { makeRoomForCreate } from "@/lib/sort-order";

const schema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  stageId: z.string().optional().nullable(),
  sortOrder: z.number().default(0),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid level data" }, { status: 400 });
  }

  try {
    const level = await prisma.$transaction(async (tx) => {
      const sortOrder = await makeRoomForCreate(
        tx,
        "gradeLevel",
        parsed.data.sortOrder || 1
      );
      return tx.gradeLevel.create({
        data: {
          code: parsed.data.code.trim().toUpperCase(),
          name: parsed.data.name.trim(),
          stageId: parsed.data.stageId || null,
          sortOrder,
        },
      });
    });
    return NextResponse.json(level, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create level. Code may already exist." },
      { status: 400 }
    );
  }
}
