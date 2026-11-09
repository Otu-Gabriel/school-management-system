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
  email: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().min(1),
  positionId: z.string().min(1),
  roleId: z.string().optional().nullable(),
  password: z.string().optional(),
  createLogin: z.boolean().default(true),
  photoUrl: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "staff.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid staff data" }, { status: 400 });
  }

  const data = parsed.data;

  if (!data.departmentId || !data.positionId) {
    return NextResponse.json(
      { error: "Department and position are required" },
      { status: 400 }
    );
  }

  if (data.createLogin) {
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
    if (!data.roleId) {
      return NextResponse.json(
        { error: "Select a role for the login account" },
        { status: 400 }
      );
    }

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
      let userId: string | undefined;

      if (data.createLogin) {
        const passwordHash = await hash(data.password!, 12);
        const user = await tx.user.create({
          data: {
            email: data.email ? data.email.toLowerCase() : null,
            phone: data.phone || null,
            passwordHash,
            roleId: data.roleId!,
            imageUrl: data.photoUrl || null,
          },
        });
        userId = user.id;
      }

      return tx.staff.create({
        data: {
          userId,
          staffNo: data.staffNo,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || null,
          phone: data.phone || null,
          departmentId: data.departmentId || null,
          positionId: data.positionId || null,
          photoUrl: data.photoUrl || null,
          hireDate: new Date(),
        },
      });
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create staff. Staff number or login may already exist." },
      { status: 400 }
    );
  }
}
