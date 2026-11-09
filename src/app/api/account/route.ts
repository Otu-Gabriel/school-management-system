import { compare, hash } from "bcryptjs";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.union([z.string().email(), z.literal("")]).optional(),
  phone: z.string().optional().nullable(),
  imageUrl: z.union([z.string().url(), z.literal(""), z.null()]).optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  fullName: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: true,
      staff: true,
      guardian: true,
      student: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    email: user.email,
    phone: user.phone,
    imageUrl: user.imageUrl,
    roleName: user.role?.name || null,
    staff: user.staff
      ? {
          firstName: user.staff.firstName,
          lastName: user.staff.lastName,
        }
      : null,
    guardian: user.guardian
      ? {
          fullName: user.guardian.fullName,
        }
      : null,
    student: user.student
      ? {
          firstName: user.student.firstName,
          lastName: user.student.lastName,
        }
      : null,
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  }

  const data = parsed.data;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { staff: true, guardian: true, student: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (data.newPassword) {
    if (!data.currentPassword) {
      return NextResponse.json(
        { error: "Current password is required to set a new password" },
        { status: 400 }
      );
    }
    if (data.newPassword.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters" },
        { status: 400 }
      );
    }
    const valid = await compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: user.id },
        data: {
          email: data.email === undefined ? undefined : data.email || null,
          phone: data.phone === undefined ? undefined : data.phone || null,
          imageUrl:
            data.imageUrl === undefined ? undefined : data.imageUrl || null,
          passwordHash: data.newPassword
            ? await hash(data.newPassword, 12)
            : undefined,
        },
        include: { staff: true, guardian: true, student: true },
      });

      if (user.staff && (data.firstName || data.lastName)) {
        await tx.staff.update({
          where: { id: user.staff.id },
          data: {
            firstName: data.firstName || user.staff.firstName,
            lastName: data.lastName || user.staff.lastName,
            email: nextUser.email,
            phone: nextUser.phone,
            photoUrl: nextUser.imageUrl,
          },
        });
      }

      if (user.guardian && data.fullName) {
        await tx.guardian.update({
          where: { id: user.guardian.id },
          data: {
            fullName: data.fullName,
            email: nextUser.email,
            phone: nextUser.phone,
            photoUrl: nextUser.imageUrl,
          },
        });
      }

      if (user.student && (data.firstName || data.lastName)) {
        await tx.student.update({
          where: { id: user.student.id },
          data: {
            firstName: data.firstName || user.student.firstName,
            lastName: data.lastName || user.student.lastName,
            photoUrl: nextUser.imageUrl,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: user.id },
        include: { staff: true, guardian: true, student: true },
      });
    });

    const displayName = updated?.staff
      ? `${updated.staff.firstName} ${updated.staff.lastName}`
      : updated?.guardian?.fullName ||
        (updated?.student
          ? `${updated.student.firstName} ${updated.student.lastName}`
          : updated?.email || updated?.phone || "User");

    return NextResponse.json({
      ok: true,
      name: displayName,
      email: updated?.email,
      phone: updated?.phone,
      image: updated?.imageUrl,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update account. Email or phone may already be in use." },
      { status: 400 }
    );
  }
}
