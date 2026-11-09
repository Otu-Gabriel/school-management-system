import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  staffNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  departmentId: z.string().min(1),
  positionId: z.string().min(1),
  roleId: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  createLogin: z.boolean().optional(),
  photoUrl: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "ON_LEAVE", "LEFT"]).optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "staff.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff data" }, { status: 400 });
  }

  const data = parsed.data;
  const existing = await prisma.staff.findUnique({
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
    if (!data.roleId) {
      return NextResponse.json(
        { error: "Select a role for the login account" },
        { status: 400 }
      );
    }
  }

  if (wantsLogin && data.roleId) {
    const role = await prisma.role.findUnique({
      where: { id: data.roleId },
      include: { permissions: true },
    });
    if (!role) {
      return NextResponse.json({ error: "Selected role was not found" }, { status: 400 });
    }
    if (role.permissions.length === 0) {
      return NextResponse.json(
        { error: "Selected role has no permissions. Assign permissions first." },
        { status: 400 }
      );
    }
  }

  try {
    const staff = await prisma.$transaction(async (tx) => {
      let userId = existing.userId;

      if (wantsLogin && !userId) {
        const user = await tx.user.create({
          data: {
            email: data.email ? data.email.toLowerCase() : null,
            phone: data.phone || null,
            passwordHash: await hash(data.password!, 12),
            roleId: data.roleId!,
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
            ...(data.roleId ? { roleId: data.roleId } : {}),
            ...(data.password && data.password.length >= 6
              ? { passwordHash: await hash(data.password, 12) }
              : {}),
          },
        });
      }

      return tx.staff.update({
        where: { id },
        data: {
          userId,
          staffNo: data.staffNo.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          email: data.email || null,
          phone: data.phone || null,
          departmentId: data.departmentId,
          positionId: data.positionId,
          photoUrl: data.photoUrl || null,
          status: data.status || existing.status,
        },
      });
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update staff. Staff number or login may already exist." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "staff.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.staff.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.staff.delete({ where: { id } });
      if (existing.userId) {
        await tx.user.delete({ where: { id: existing.userId } }).catch(() => null);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not delete staff. Remove related records first." },
      { status: 400 }
    );
  }
}
