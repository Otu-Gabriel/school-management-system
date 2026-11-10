import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { parsePage, parsePageSize } from "@/lib/table";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "audit.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = parsePage(searchParams.get("page") || undefined);
  const pageSize = parsePageSize(searchParams.get("perPage") || undefined);
  const q = searchParams.get("q")?.trim() || "";
  const skip = (page - 1) * pageSize;

  const where = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" as const } },
          { entityType: { contains: q, mode: "insensitive" as const } },
          { entityId: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            staff: { select: { firstName: true, lastName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  return NextResponse.json({ total, page, pageSize, logs });
}
