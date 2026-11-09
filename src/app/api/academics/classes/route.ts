import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  academicYearId: z.string().min(1),
  gradeLevelId: z.string().min(1),
  name: z.string().min(1),
  section: z.string().optional(),
  classTeacherId: z.string().optional(),
  room: z.string().optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid class data" }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const created = await prisma.classSection.create({
      data: {
        academicYearId: data.academicYearId,
        gradeLevelId: data.gradeLevelId,
        name: data.name,
        section: data.section || null,
        classTeacherId: data.classTeacherId || null,
        room: data.room || null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Could not create class. It may already exist for this level." },
      { status: 400 }
    );
  }
}
