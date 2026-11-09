import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/csv";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "staff.export")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await prisma.staff.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    include: {
      user: { include: { role: true } },
      department: true,
      position: true,
    },
  });

  const csv = toCsv(
    [
      "staffNo",
      "firstName",
      "lastName",
      "email",
      "phone",
      "position",
      "department",
      "status",
      "role",
    ],
    staff.map((member) => [
      member.staffNo,
      member.firstName,
      member.lastName,
      member.email,
      member.phone,
      member.position?.name || "",
      member.department?.name || "",
      member.status,
      member.user?.role?.name || "",
    ])
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="staff.csv"`,
    },
  });
}
