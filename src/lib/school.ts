import { prisma } from "@/lib/prisma";

export async function getSchoolSettings() {
  const existing = await prisma.schoolSettings.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (existing) return existing;

  return prisma.schoolSettings.create({
    data: {
      name: "My School",
      shortName: "School",
      primaryColor: "#2563EB",
      secondaryColor: "#1E40AF",
      accentColor: "#F59E0B",
      weekendClosed: "0,6",
    },
  });
}

export async function getCurrentAcademicContext() {
  const year = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    include: {
      terms: {
        orderBy: { termNumber: "asc" },
      },
    },
  });

  const term = year?.terms.find((t) => t.isCurrent) || null;

  return { year, term };
}
