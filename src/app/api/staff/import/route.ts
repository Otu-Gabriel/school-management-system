import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { csvToObjects } from "@/lib/csv";

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "staff.import")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "CSV file is required" }, { status: 400 });
  }

  const rows = csvToObjects(await file.text());
  if (rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const [departments, positions] = await Promise.all([
    prisma.department.findMany(),
    prisma.position.findMany(),
  ]);

  const departmentByName = new Map(
    departments.map((d) => [d.name.toLowerCase(), d])
  );
  const positionsByKey = new Map(
    positions.map((p) => [
      `${p.name.toLowerCase()}::${p.departmentId || ""}`,
      p,
    ])
  );
  const positionsByName = new Map(
    positions.map((p) => [p.name.toLowerCase(), p])
  );

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const staffNo = row.staffNo?.trim();
    const firstName = row.firstName?.trim();
    const lastName = row.lastName?.trim();
    const departmentName = row.department?.trim();
    const positionName = row.position?.trim();

    if (!staffNo || !firstName || !lastName) {
      skipped += 1;
      continue;
    }

    try {
      const existing = await prisma.staff.findUnique({ where: { staffNo } });
      if (existing) {
        skipped += 1;
        continue;
      }

      const department = departmentName
        ? departmentByName.get(departmentName.toLowerCase())
        : null;

      let position = null;
      if (positionName) {
        if (department) {
          position =
            positionsByKey.get(
              `${positionName.toLowerCase()}::${department.id}`
            ) || null;
        }
        if (!position) {
          position = positionsByName.get(positionName.toLowerCase()) || null;
        }
      }

      await prisma.staff.create({
        data: {
          staffNo,
          firstName,
          lastName,
          email: row.email || null,
          phone: row.phone || null,
          departmentId: department?.id || null,
          positionId: position?.id || null,
          hireDate: new Date(),
        },
      });
      created += 1;
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({ created, skipped });
}
