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
});

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

  try {
    const guardian = await prisma.guardian.update({
      where: { id },
      data: {
        fullName: parsed.data.fullName.trim(),
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        occupation: parsed.data.occupation || null,
        address: parsed.data.address || null,
        photoUrl: parsed.data.photoUrl || null,
      },
    });
    return NextResponse.json(guardian);
  } catch {
    return NextResponse.json({ error: "Could not update parent." }, { status: 400 });
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
    include: { _count: { select: { students: true } } },
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
