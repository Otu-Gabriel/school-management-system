import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "students.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const students = await prisma.student.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      currentClassSection: { include: { gradeLevel: true } },
      guardians: {
        include: { guardian: true },
        orderBy: { isPrimary: "desc" },
      },
    },
  });

  const csv = toCsv(
    [
      "admissionNo",
      "firstName",
      "lastName",
      "otherNames",
      "gender",
      "dateOfBirth",
      "status",
      "class",
      "guardianName",
      "guardianPhone",
      "guardianEmail",
      "relationship",
    ],
    students.map((s) => {
      const primary =
        s.guardians.find((g) => g.isPrimary)?.guardian || s.guardians[0]?.guardian;
      const link = s.guardians.find((g) => g.isPrimary) || s.guardians[0];
      return [
        s.admissionNo,
        s.firstName,
        s.lastName,
        s.otherNames,
        s.gender,
        s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : "",
        s.status,
        s.currentClassSection
          ? `${s.currentClassSection.gradeLevel.code} ${s.currentClassSection.name}`
          : "",
        primary?.fullName || "",
        primary?.phone || "",
        primary?.email || "",
        link?.relationship || "",
      ];
    })
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="students.csv"`,
    },
  });
}
