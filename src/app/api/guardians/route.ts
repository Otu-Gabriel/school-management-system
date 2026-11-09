import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
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
});

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

  try {
    const guardian = await prisma.$transaction(async (tx) => {
      const created = await tx.guardian.create({
        data: {
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
      { error: "Could not create parent. They may already be linked to that student." },
      { status: 400 }
    );
  }
}
