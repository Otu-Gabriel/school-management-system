import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "positions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid position" }, { status: 400 });
  }

  try {
    const position = await prisma.position.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        departmentId: parsed.data.departmentId || null,
        isActive: parsed.data.isActive,
      },
    });
    return NextResponse.json(position);
  } catch {
    return NextResponse.json(
      { error: "Could not update position" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "positions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const position = await prisma.position.findUnique({
    where: { id },
    include: { _count: { select: { staff: true } } },
  });

  if (!position) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (position._count.staff > 0) {
    return NextResponse.json(
      { error: "Reassign staff before deleting this position" },
      { status: 400 }
    );
  }

  await prisma.position.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
