import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "departments.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid department" }, { status: 400 });
  }

  try {
    const department = await prisma.department.update({
      where: { id },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive,
      },
    });
    return NextResponse.json(department);
  } catch {
    return NextResponse.json(
      { error: "Could not update department" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "departments.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const department = await prisma.department.findUnique({
    where: { id },
    include: { _count: { select: { staff: true, positions: true } } },
  });

  if (!department) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (department._count.staff > 0 || department._count.positions > 0) {
    return NextResponse.json(
      { error: "Remove linked staff/positions first, or deactivate instead" },
      { status: 400 }
    );
  }

  await prisma.department.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
