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

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (!can(session.user.permissions, "fees.read") &&
      !can(session.user.permissions, "wards.read"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const types = await prisma.feeType.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { invoices: true } } },
  });
  return NextResponse.json(types);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "fees.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid fee type" }, { status: 400 });
  }

  try {
    const type = await prisma.feeType.create({
      data: {
        code: parsed.data.code.trim().toUpperCase(),
        name: parsed.data.name.trim(),
        defaultAmount: parsed.data.defaultAmount ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json(type, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create fee type. Code may already exist." },
      { status: 400 }
    );
  }
}
