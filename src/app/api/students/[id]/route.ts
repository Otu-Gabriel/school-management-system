import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensurePlacement, openPlacement } from "@/lib/placements";
import { getCurrentAcademicContext } from "@/lib/school";

const schema = z.object({
  admissionNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  otherNames: z.string().optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  dateOfBirth: z.string().optional().nullable(),
  classSectionId: z.string().optional().nullable(),
  academicYearId: z.string().nullable().optional(),
  photoUrl: z.string().optional().nullable(),
  status: z
    .enum(["ACTIVE", "TRANSFERRED", "WITHDRAWN", "GRADUATED", "ALUMNI"])
    .optional(),
  guardianName: z.string().min(1).optional(),
  guardianPhone: z.string().optional().nullable(),
  guardianEmail: z.string().optional().nullable(),
  relationship: z
    .enum(["FATHER", "MOTHER", "UNCLE", "AUNT", "GUARDIAN", "OTHER"])
    .optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "students.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid student data" }, { status: 400 });
  }

  const data = parsed.data;
  const existing = await prisma.student.findUnique({
    where: { id },
    include: {
      guardians: { include: { guardian: true }, orderBy: { isPrimary: "desc" } },
    },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const student = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: {
          admissionNo: data.admissionNo.trim(),
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          otherNames: data.otherNames || null,
          gender: data.gender || null,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          photoUrl: data.photoUrl || null,
          currentClassSectionId: data.classSectionId || null,
          status: data.status || existing.status,
        },
      });

      const primaryLink = existing.guardians.find((g) => g.isPrimary) || existing.guardians[0];
      if (data.guardianName && primaryLink) {
        await tx.guardian.update({
          where: { id: primaryLink.guardianId },
          data: {
            fullName: data.guardianName.trim(),
            phone: data.guardianPhone || null,
            email: data.guardianEmail || null,
          },
        });
        if (data.relationship) {
          await tx.studentGuardian.update({
            where: { id: primaryLink.id },
            data: { relationship: data.relationship },
          });
        }
      } else if (data.guardianName && !primaryLink) {
        const guardian = await tx.guardian.create({
          data: {
            fullName: data.guardianName.trim(),
            phone: data.guardianPhone || null,
            email: data.guardianEmail || null,
          },
        });
        await tx.studentGuardian.create({
          data: {
            studentId: id,
            guardianId: guardian.id,
            relationship: data.relationship || "GUARDIAN",
            isPrimary: true,
          },
        });
      }

      if (data.classSectionId) {
        const context = await getCurrentAcademicContext();
        const yearId = data.academicYearId || context.year?.id || null;
        if (yearId) {
          if (
            existing.currentClassSectionId &&
            existing.currentClassSectionId !== data.classSectionId
          ) {
            await openPlacement(tx, {
              studentId: id,
              classSectionId: data.classSectionId,
              academicYearId: yearId,
              termId: context.term?.id || null,
              status: "TRANSFERRED",
              reason: "Class changed from student profile",
            });
          } else {
            await ensurePlacement(tx, {
              studentId: id,
              classSectionId: data.classSectionId,
              academicYearId: yearId,
              termId: context.term?.id || null,
              status: "ENROLLED",
            });
          }
        }
      }

      return updated;
    });

    return NextResponse.json(student);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not update student. Admission number may already exist." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "students.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const existing = await prisma.student.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.student.delete({ where: { id } });
      if (existing.userId) {
        await tx.user.delete({ where: { id: existing.userId } }).catch(() => null);
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not delete student." },
      { status: 400 }
    );
  }
}
