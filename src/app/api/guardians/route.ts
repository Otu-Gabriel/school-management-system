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
  studentId: z.string().optional().nullable(),
  relationship: z
    .enum(["FATHER", "MOTHER", "UNCLE", "AUNT", "GUARDIAN", "OTHER"])
    .optional(),
  isPrimary: z.boolean().optional(),
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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (!can(session.user.permissions, "guardians.read") &&
      !can(session.user.permissions, "guardians.write"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const guardians = await prisma.guardian.findMany({
    orderBy: { fullName: "asc" },
    include: {
      students: { include: { student: true } },
      user: { include: { role: true } },
    },
  });
  return NextResponse.json(guardians);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "guardians.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid parent data" }, { status: 400 });
  }

  const data = parsed.data;
  const createLogin = data.createLogin ?? false;

  if (createLogin) {
    if (!data.password || data.password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }
    if (!data.email && !data.phone) {
      return NextResponse.json(
        { error: "Email or phone is required to create a login" },
        { status: 400 }
      );
    }
    const role = await resolveParentRoleId(data.roleId);
    if ("error" in role) {
      return NextResponse.json({ error: role.error }, { status: 400 });
    }
    data.roleId = role.roleId;
  }

  try {
    const guardian = await prisma.$transaction(async (tx) => {
      let userId: string | undefined;

      if (createLogin) {
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
      }

      const created = await tx.guardian.create({
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

      if (data.studentId) {
        await tx.studentGuardian.create({
          data: {
            studentId: data.studentId,
            guardianId: created.id,
            relationship: data.relationship || "GUARDIAN",
            isPrimary: data.isPrimary ?? false,
          },
        });
      }

      return created;
    });

    return NextResponse.json(guardian, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          "Could not create parent. Login email/phone may already exist, or they may already be linked to that student.",
      },
      { status: 400 }
    );
  }
}
