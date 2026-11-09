import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (!can(session.user.permissions, "departments.manage") &&
      !can(session.user.permissions, "staff.write") &&
      !can(session.user.permissions, "staff.read"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const departments = await prisma.department.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { staff: true, positions: true } } },
  });
  return NextResponse.json(departments);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "departments.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid department" }, { status: 400 });
  }

  try {
    const department = await prisma.department.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json(department, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create department. Name may already exist." },
      { status: 400 }
    );
  }
}
