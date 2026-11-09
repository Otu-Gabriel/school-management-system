import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  description: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    (!can(session.user.permissions, "positions.manage") &&
      !can(session.user.permissions, "staff.write") &&
      !can(session.user.permissions, "staff.read"))
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get("departmentId");

  const positions = await prisma.position.findMany({
    where: departmentId ? { departmentId } : undefined,
    orderBy: { name: "asc" },
    include: {
      department: true,
      _count: { select: { staff: true } },
    },
  });

  return NextResponse.json(positions);
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "positions.manage")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid position" }, { status: 400 });
  }

  try {
    const position = await prisma.position.create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        departmentId: parsed.data.departmentId || null,
        isActive: parsed.data.isActive ?? true,
      },
    });
    return NextResponse.json(position, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create position. It may already exist." },
      { status: 400 }
    );
  }
}
