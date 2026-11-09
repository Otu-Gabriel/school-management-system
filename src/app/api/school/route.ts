import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school";

const schema = z.object({
  name: z.string().min(2),
  shortName: z.string().optional().nullable(),
  logoUrl: z
    .union([z.string().url(), z.literal(""), z.null()])
    .optional(),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z
    .union([z.string().email(), z.literal(""), z.null()])
    .optional(),
  primaryColor: z.string().min(4),
  secondaryColor: z.string().min(4),
  accentColor: z.string().min(4),
});

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "settings.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const school = await getSchoolSettings();
  const data = parsed.data;

  const updated = await prisma.schoolSettings.update({
    where: { id: school.id },
    data: {
      name: data.name,
      shortName: data.shortName || null,
      logoUrl: data.logoUrl || null,
      address: data.address || null,
      phone: data.phone || null,
      email: data.email || null,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
      accentColor: data.accentColor,
    },
  });

  return NextResponse.json(updated);
}
