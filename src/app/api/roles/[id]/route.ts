import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  permissionIds: z.array(z.string()).min(1),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "roles.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role data" }, { status: 400 });
  }

  const existing = await prisma.role.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      const updated = await tx.role.update({
        where: { id },
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
        },
      });

      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({
        data: parsed.data.permissionIds.map((permissionId) => ({
          roleId: id,
          permissionId,
        })),
      });

      return updated;
    });

    return NextResponse.json(role);
  } catch {
    return NextResponse.json(
      { error: "Could not update role. Name may already exist." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "roles.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }
  if (role.isSystem) {
    return NextResponse.json(
      { error: "System roles cannot be deleted" },
      { status: 400 }
    );
  }
  if (role._count.users > 0) {
    return NextResponse.json(
      { error: "Reassign users before deleting this role" },
      { status: 400 }
    );
  }

  await prisma.role.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
