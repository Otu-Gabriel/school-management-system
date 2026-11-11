import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { Gender, GuardianRelationship } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { csvToObjects } from "@/lib/csv";
import { ensurePlacement } from "@/lib/placements";

function asGender(value?: string): Gender | undefined {
  const key = value?.trim().toUpperCase();
  if (key === "MALE" || key === "FEMALE" || key === "OTHER") return key;
  return undefined;
}

function asRelationship(value?: string): GuardianRelationship {
  const key = value?.trim().toUpperCase();
  if (
    key === "FATHER" ||
    key === "MOTHER" ||
    key === "UNCLE" ||
    key === "AUNT" ||
    key === "GUARDIAN" ||
    key === "OTHER"
  ) {
    return key;
  }
  return "GUARDIAN";
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "students.import")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const text = await file.text();
  const rows = csvToObjects(text);
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const admissionNo = row.admissionNo?.trim();
    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();
    const guardianName = row.guardianName?.trim();

    if (!admissionNo || !firstName || !lastName || !guardianName) {
      skipped += 1;
      errors.push(`Row ${index + 2}: missing required fields`);
      continue;
    }

    try {
      const existing = await prisma.student.findUnique({
        where: { admissionNo },
      });
      if (existing) {
        skipped += 1;
        continue;
      }

      let classSectionId: string | undefined;
      if (row.class?.trim() && year) {
        const [code, ...nameParts] = row.class.trim().split(/\s+/);
        const className = nameParts.join(" ") || code;
        const found = await prisma.classSection.findFirst({
          where: {
            academicYearId: year.id,
            OR: [
              { name: className, gradeLevel: { code } },
              { name: row.class.trim() },
            ],
          },
        });
        classSectionId = found?.id;
      }

      await prisma.$transaction(async (tx) => {
        const student = await tx.student.create({
          data: {
            admissionNo,
            firstName,
            lastName,
            otherNames: row.otherNames || null,
            gender: asGender(row.gender),
            dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
            admissionDate: new Date(),
            currentClassSectionId: classSectionId || null,
          },
        });

        const guardian = await tx.guardian.create({
          data: {
            fullName: guardianName,
            phone: row.guardianPhone || null,
            email: row.guardianEmail || null,
          },
        });

        await tx.studentGuardian.create({
          data: {
            studentId: student.id,
            guardianId: guardian.id,
            relationship: asRelationship(row.relationship),
            isPrimary: true,
          },
        });

        if (classSectionId && year) {
          await ensurePlacement(tx, {
            studentId: student.id,
            classSectionId,
            academicYearId: year.id,
            status: "ENROLLED",
            reason: "Imported enrolment",
          });
        }
      });

      created += 1;
    } catch (error) {
      skipped += 1;
      errors.push(`Row ${index + 2}: could not import`);
      console.error(error);
    }
  }

  return NextResponse.json({
    created,
    skipped,
    errors: errors.slice(0, 10),
  });
}
