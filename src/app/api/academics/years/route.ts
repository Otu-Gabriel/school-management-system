import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(2),
  startDate: z.string(),
  endDate: z.string(),
  termCount: z.number().min(1).max(4).default(3),
  setCurrent: z.boolean().default(true),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "academics.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid year data" }, { status: 400 });
  }

  const data = parsed.data;
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);

  try {
    const year = await prisma.$transaction(async (tx) => {
      if (data.setCurrent) {
        await tx.academicYear.updateMany({ data: { isCurrent: false } });
        await tx.term.updateMany({ data: { isCurrent: false } });
      }

      const created = await tx.academicYear.create({
        data: {
          name: data.name,
          startDate: start,
          endDate: end,
          isCurrent: data.setCurrent,
        },
      });

      const span = end.getTime() - start.getTime();
      for (let i = 1; i <= data.termCount; i++) {
        const termStart = new Date(start.getTime() + (span * (i - 1)) / data.termCount);
        const termEnd = new Date(start.getTime() + (span * i) / data.termCount);
        await tx.term.create({
          data: {
            academicYearId: created.id,
            name: `Term ${i}`,
            termNumber: i,
            startDate: termStart,
            endDate: termEnd,
            isCurrent: data.setCurrent && i === 1,
          },
        });
      }

      return created;
    });

    return NextResponse.json(year, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Could not create academic year. Name may already exist." },
      { status: 400 }
    );
  }
}
