import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const term = await prisma.term.findUnique({
    where: { id },
    include: { academicYear: true },
  });
  if (!term) {
    return NextResponse.json({ error: "Term not found" }, { status: 404 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.academicYear.updateMany({ data: { isCurrent: false } });
    await tx.term.updateMany({ data: { isCurrent: false } });
    await tx.academicYear.update({
      where: { id: term.academicYearId },
      data: { isCurrent: true, isArchived: false },
    });
    await tx.term.update({
      where: { id },
      data: { isCurrent: true, isLocked: false },
    });
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "term.setCurrent",
    entityType: "Term",
    entityId: id,
    newValues: {
      term: term.name,
      year: term.academicYear.name,
    },
  });

  return NextResponse.json({ ok: true });
}
