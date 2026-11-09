import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
  permissionIds: z.array(z.string()).min(1),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "roles.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });

  return NextResponse.json(roles);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "roles.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid role data" }, { status: 400 });
  }

  try {
    const role = await prisma.$transaction(async (tx) => {
      const created = await tx.role.create({
        data: {
          name: parsed.data.name,
          description: parsed.data.description || null,
          isSystem: false,
        },
      });

      await tx.rolePermission.createMany({
        data: parsed.data.permissionIds.map((permissionId) => ({
          roleId: created.id,
          permissionId,
        })),
      });

      return created;
    });

    return NextResponse.json(role, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create role. Name may already exist." },
      { status: 400 }
    );
  }
}
