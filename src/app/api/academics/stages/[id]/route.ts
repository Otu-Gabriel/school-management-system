import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { compactOrders, moveToOrder } from "@/lib/sort-order";

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "stages.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid stage data" }, { status: 400 });
  }

  try {
    const existing = await prisma.stage.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const stage = await prisma.$transaction(async (tx) => {
      const sortOrder = await moveToOrder(
        tx,
        "stage",
        id,
        parsed.data.sortOrder ?? existing.sortOrder,
        existing.sortOrder
      );
      return tx.stage.update({
        where: { id },
        data: {
          code: parsed.data.code.trim().toUpperCase(),
          name: parsed.data.name.trim(),
          description: parsed.data.description || null,
          sortOrder,
          isActive: parsed.data.isActive ?? true,
        },
      });
    });
    return NextResponse.json(stage);
  } catch {
    return NextResponse.json(
      { error: "Could not update stage. Code or name may already exist." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "stages.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const stage = await prisma.stage.findUnique({
    where: { id },
    include: { _count: { select: { gradeLevels: true, subjects: true } } },
  });

  if (!stage) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (stage._count.gradeLevels > 0 || stage._count.subjects > 0) {
    return NextResponse.json(
      {
        error:
          "This stage is linked to levels or subjects. Unlink them or deactivate the stage instead.",
      },
      { status: 400 }
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.stage.delete({ where: { id } });
    await compactOrders(tx, "stage");
  });
  return NextResponse.json({ ok: true });
}
