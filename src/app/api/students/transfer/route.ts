import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { transferStudentPlacement } from "@/lib/placements";
import { getCurrentAcademicContext } from "@/lib/school";

const schema = z.object({
  studentId: z.string().min(1),
  toClassSectionId: z.string().min(1),
  reason: z.string().min(3),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    !(
      can(session.user.permissions, "students.transfer") ||
      can(session.user.permissions, "students.write")
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Student, destination class, and reason are required." },
      { status: 400 }
    );
  }

  const context = await getCurrentAcademicContext();
  const target = await prisma.classSection.findUnique({
    where: { id: parsed.data.toClassSectionId },
    include: { gradeLevel: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Destination class not found." }, { status: 404 });
  }
  if (!target.isActive) {
    return NextResponse.json(
      { error: "Destination class is archived/inactive." },
      { status: 400 }
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      return transferStudentPlacement(tx, {
        studentId: parsed.data.studentId,
        toClassSectionId: parsed.data.toClassSectionId,
        reason: parsed.data.reason.trim(),
        status: "TRANSFERRED",
        termId: context.term?.id || null,
      });
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await writeAuditLog({
      userId: session.user.id,
      action: "student.transfer",
      entityType: "Student",
      entityId: parsed.data.studentId,
      newValues: {
        toClassSectionId: parsed.data.toClassSectionId,
        class: `${target.gradeLevel.code} ${target.name}`,
        reason: parsed.data.reason,
        termId: context.term?.id || null,
      },
    });

    return NextResponse.json({ ok: true, placement: result.placement });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not transfer student." },
      { status: 400 }
    );
  }
}
