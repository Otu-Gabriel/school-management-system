import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { ensurePlacement } from "@/lib/placements";
import { getCurrentAcademicContext } from "@/lib/school";

const schema = z.object({
  admissionNo: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  otherNames: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  dateOfBirth: z.string().optional(),
  classSectionId: z.string().optional(),
  academicYearId: z.string().nullable().optional(),
  photoUrl: z.string().optional(),
  guardianName: z.string().min(1),
  guardianPhone: z.string().optional(),
  guardianEmail: z.string().optional(),
  relationship: z
    .enum(["FATHER", "MOTHER", "UNCLE", "AUNT", "GUARDIAN", "OTHER"])
    .default("GUARDIAN"),
});

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "students.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const classSectionId = searchParams.get("classSectionId") || "";
  const status = searchParams.get("status") || "";
  const lite = searchParams.get("lite") === "1";

  const where = {
    ...(classSectionId ? { currentClassSectionId: classSectionId } : {}),
    ...(status ? { status: status as "ACTIVE" } : {}),
  };

  if (lite) {
    const students = await prisma.student.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        admissionNo: true,
        firstName: true,
        lastName: true,
      },
    });
    return NextResponse.json({
      students: students.map((s) => ({
        id: s.id,
        admissionNo: s.admissionNo,
        firstName: s.firstName,
        lastName: s.lastName,
        name: `${s.firstName} ${s.lastName}`,
      })),
    });
  }

  const students = await prisma.student.findMany({
    where,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      currentClassSection: { include: { gradeLevel: true } },
    },
  });

  return NextResponse.json({ students });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "students.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid student data" }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const context = await getCurrentAcademicContext();
    const student = await prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          admissionNo: data.admissionNo,
          firstName: data.firstName,
          lastName: data.lastName,
          otherNames: data.otherNames || null,
          gender: data.gender,
          dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
          admissionDate: new Date(),
          photoUrl: data.photoUrl || null,
          currentClassSectionId: data.classSectionId || null,
        },
      });

      const guardian = await tx.guardian.create({
        data: {
          fullName: data.guardianName,
          phone: data.guardianPhone || null,
          email: data.guardianEmail || null,
        },
      });

      await tx.studentGuardian.create({
        data: {
          studentId: created.id,
          guardianId: guardian.id,
          relationship: data.relationship,
          isPrimary: true,
        },
      });

      if (data.classSectionId) {
        const yearId = data.academicYearId || context.year?.id || null;
        if (yearId) {
          await ensurePlacement(tx, {
            studentId: created.id,
            classSectionId: data.classSectionId,
            academicYearId: yearId,
            termId: context.term?.id || null,
            status: "ENROLLED",
            reason: "Initial enrolment",
          });
        }
      }

      return created;
    });

    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create student. Admission number may already exist." },
      { status: 400 }
    );
  }
}
