import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  defaultAmount: z.number().min(0).nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "fees.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fee type" }, { status: 400 });
  }

  try {
    const type = await prisma.feeType.update({
      where: { id },
      data: {
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        defaultAmount: parsed.data.defaultAmount ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json(type);
  } catch {
    return NextResponse.json(
      { error: "Could not update fee type" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "fees.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const type = await prisma.feeType.findUnique({
    where: { id },
    include: { _count: { select: { invoices: true } } },
  });
  if (!type) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (type._count.invoices > 0) {
    return NextResponse.json(
      { error: "Fee type has invoices. Deactivate it instead." },
      { status: 400 }
    );
  }

  await prisma.feeType.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
