import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  fullName: z.string().min(2),
  phone: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  createLogin: z.boolean().optional(),
  password: z.string().optional().nullable(),
  roleId: z.string().optional().nullable(),
});

async function resolveParentRoleId(roleId?: string | null) {
  if (roleId) {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: true },
    });
    if (!role) return { error: "Selected role was not found" as const };
    if (role.permissions.length === 0) {
      return {
        error: "Selected role has no permissions. Assign permissions first." as const,
      };
    }
    return { roleId: role.id };
  }

  const parentRole = await prisma.role.findUnique({
    where: { name: "Parent" },
    include: { permissions: true },
  });
  if (!parentRole) {
    return { error: "Parent role was not found. Seed roles first." as const };
  }
  if (parentRole.permissions.length === 0) {
    return {
      error: "Parent role has no permissions. Assign wards.read first." as const,
    };
  }
  return { roleId: parentRole.id };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "guardians.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parent data" }, { status: 400 });
  }

  const data = parsed.data;
  const existing = await prisma.guardian.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const wantsLogin = data.createLogin ?? Boolean(existing.userId);

  if (wantsLogin && !existing.userId) {
    if (!data.password || data.password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters to create a login" },
        { status: 400 }
      );
    }
    if (!data.email && !data.phone) {
      return NextResponse.json(
        { error: "Email or phone is required to create a login" },
        { status: 400 }
      );
    }
  }

  let resolvedRoleId = data.roleId || existing.user?.roleId || null;
  if (wantsLogin) {
    const role = await resolveParentRoleId(resolvedRoleId);
    if ("error" in role) {
      return NextResponse.json({ error: role.error }, { status: 400 });
    }
    resolvedRoleId = role.roleId;
  }

  try {
    const guardian = await prisma.$transaction(async (tx) => {
      let userId = existing.userId;

      if (wantsLogin && !userId) {
        const user = await tx.user.create({
          data: {
            email: data.email ? data.email.toLowerCase() : null,
            phone: data.phone || null,
            passwordHash: await hash(data.password!, 12),
            roleId: resolvedRoleId!,
            imageUrl: data.photoUrl || null,
          },
        });
        userId = user.id;
      } else if (userId) {
        await tx.user.update({
          where: { id: userId },
          data: {
            email: data.email ? data.email.toLowerCase() : null,
            phone: data.phone || null,
            imageUrl: data.photoUrl || existing.user?.imageUrl || null,
            ...(resolvedRoleId ? { roleId: resolvedRoleId } : {}),
            ...(data.password && data.password.length >= 6
              ? { passwordHash: await hash(data.password, 12) }
              : {}),
          },
        });
      }

      return tx.guardian.update({
        where: { id },
        data: {
          userId,
          fullName: data.fullName.trim(),
          phone: data.phone || null,
          email: data.email || null,
          occupation: data.occupation || null,
          address: data.address || null,
          photoUrl: data.photoUrl || null,
        },
      });
    });

    return NextResponse.json(guardian);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          "Could not update parent. Login email/phone may already exist.",
      },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "guardians.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.guardian.findUnique({
    where: { id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.guardian.delete({ where: { id } });
      if (existing.userId) {
        await tx.user.delete({ where: { id: existing.userId } }).catch(() => null);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not delete parent." },
      { status: 400 }
    );
  }
}
