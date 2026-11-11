import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_CATALOG,
} from "../src/lib/permission-catalog";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL || "admin@school.local";
  const password = process.env.SEED_ADMIN_PASSWORD || "Admin@12345";
  const phone = process.env.SEED_ADMIN_PHONE || null;
  const passwordHash = await hash(password, 12);

  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: {
        name: permission.name,
        description: permission.description,
        module: permission.module,
      },
      create: permission,
    });
  }

  const permissionRows = await prisma.permission.findMany();
  const permissionByCode = Object.fromEntries(
    permissionRows.map((p) => [p.code, p.id])
  );

  for (const [roleName, codes] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {
        description: `${roleName} role`,
        isSystem: true,
      },
      create: {
        name: roleName,
        description: `${roleName} role`,
        isSystem: true,
      },
    });

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    await prisma.rolePermission.createMany({
      data: codes
        .map((code) => permissionByCode[code])
        .filter(Boolean)
        .map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
      skipDuplicates: true,
    });
  }

  const adminRole = await prisma.role.findUniqueOrThrow({
    where: { name: "Administrator" },
  });

  const school = await prisma.schoolSettings.upsert({
    where: { id: "default-school" },
    update: {
      weekendClosed: "0,6",
    },
    create: {
      id: "default-school",
      name: "Greenfield Primary & JHS",
      shortName: "Greenfield",
      primaryColor: "#2563EB",
      secondaryColor: "#1E40AF",
      accentColor: "#F59E0B",
      email: "info@greenfield.local",
      phone: "+233000000000",
      address: "Accra, Ghana",
      weekendClosed: "0,6",
    },
  });

  const adminDept = await prisma.department.upsert({
    where: { name: "Administration" },
    update: { isActive: true },
    create: {
      name: "Administration",
      description: "School leadership and office",
    },
  });

  const primaryDept = await prisma.department.upsert({
    where: { name: "Primary" },
    update: { isActive: true },
    create: { name: "Primary", description: "Primary section" },
  });

  await prisma.department.upsert({
    where: { name: "JHS" },
    update: { isActive: true },
    create: { name: "JHS", description: "Junior High section" },
  });

  const adminPosition = await prisma.position.upsert({
    where: {
      name_departmentId: {
        name: "Administrator",
        departmentId: adminDept.id,
      },
    },
    update: { isActive: true },
    create: {
      name: "Administrator",
      departmentId: adminDept.id,
      description: "System administrator",
    },
  });

  await prisma.position.upsert({
    where: {
      name_departmentId: {
        name: "Class Teacher",
        departmentId: primaryDept.id,
      },
    },
    update: { isActive: true },
    create: {
      name: "Class Teacher",
      departmentId: primaryDept.id,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
      phone,
    },
    create: {
      email,
      phone,
      passwordHash,
      roleId: adminRole.id,
      isActive: true,
    },
  });

  await prisma.staff.upsert({
    where: { staffNo: "STF-0001" },
    update: {
      userId: adminUser.id,
      firstName: "School",
      lastName: "Administrator",
      email,
      phone: phone || undefined,
      departmentId: adminDept.id,
      positionId: adminPosition.id,
    },
    create: {
      userId: adminUser.id,
      staffNo: "STF-0001",
      firstName: "School",
      lastName: "Administrator",
      email,
      phone: phone || undefined,
      departmentId: adminDept.id,
      positionId: adminPosition.id,
      hireDate: new Date(),
    },
  });

  const year = await prisma.academicYear.upsert({
    where: { name: "2026/2027" },
    update: {
      isCurrent: true,
      isArchived: false,
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-07-31T00:00:00.000Z"),
    },
    create: {
      name: "2026/2027",
      startDate: new Date("2026-09-01T00:00:00.000Z"),
      endDate: new Date("2027-07-31T00:00:00.000Z"),
      isCurrent: true,
      isArchived: false,
    },
  });

  await prisma.academicYear.updateMany({
    where: { id: { not: year.id } },
    data: { isCurrent: false },
  });

  const terms = [
    { name: "Term 1", termNumber: 1, start: "2026-09-01", end: "2026-12-15" },
    { name: "Term 2", termNumber: 2, start: "2027-01-08", end: "2027-04-10" },
    { name: "Term 3", termNumber: 3, start: "2027-04-28", end: "2027-07-31" },
  ];

  const today = new Date();
  const todayUtc = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );
  const currentTermNumber =
    terms.find((term) => {
      const start = Date.parse(term.start + "T00:00:00.000Z");
      const end = Date.parse(term.end + "T00:00:00.000Z");
      return todayUtc >= start && todayUtc <= end;
    })?.termNumber || 1;

  await prisma.term.updateMany({ data: { isCurrent: false } });

  const seededTerms: { id: string; termNumber: number }[] = [];
  for (const term of terms) {
    const row = await prisma.term.upsert({
      where: {
        academicYearId_termNumber: {
          academicYearId: year.id,
          termNumber: term.termNumber,
        },
      },
      update: {
        name: term.name,
        startDate: new Date(term.start + "T00:00:00.000Z"),
        endDate: new Date(term.end + "T00:00:00.000Z"),
        isCurrent: term.termNumber === currentTermNumber,
        isLocked: false,
      },
      create: {
        academicYearId: year.id,
        name: term.name,
        termNumber: term.termNumber,
        startDate: new Date(term.start + "T00:00:00.000Z"),
        endDate: new Date(term.end + "T00:00:00.000Z"),
        isCurrent: term.termNumber === currentTermNumber,
        isLocked: false,
      },
    });
    seededTerms.push({ id: row.id, termNumber: row.termNumber });
  }

  const term1 = seededTerms.find((t) => t.termNumber === 1);
  if (term1) {
    // Sample holiday inside Term 1 (Kwame Nkrumah Memorial Day).
    await prisma.calendarException.upsert({
      where: { date: new Date("2026-09-21T00:00:00.000Z") },
      update: {
        type: "CLOSED",
        name: "Kwame Nkrumah Memorial Day",
        academicYearId: year.id,
        termId: term1.id,
      },
      create: {
        date: new Date("2026-09-21T00:00:00.000Z"),
        type: "CLOSED",
        name: "Kwame Nkrumah Memorial Day",
        academicYearId: year.id,
        termId: term1.id,
      },
    });
  }

  // Remove older sample holiday that sat outside a term window.
  await prisma.calendarException.deleteMany({
    where: { date: new Date("2025-12-25T00:00:00.000Z") },
  });
  await prisma.calendarException.deleteMany({
    where: { date: new Date("2026-12-25T00:00:00.000Z") },
  });

  const primaryStage = await prisma.stage.upsert({
    where: { code: "PRIMARY" },
    update: { name: "Primary", isActive: true, sortOrder: 1 },
    create: {
      code: "PRIMARY",
      name: "Primary",
      description: "Primary section",
      sortOrder: 1,
    },
  });

  const jhsStage = await prisma.stage.upsert({
    where: { code: "JHS" },
    update: { name: "JHS", isActive: true, sortOrder: 2 },
    create: {
      code: "JHS",
      name: "JHS",
      description: "Junior High section",
      sortOrder: 2,
    },
  });

  const allStage = await prisma.stage.upsert({
    where: { code: "ALL" },
    update: { name: "All stages", isActive: true, sortOrder: 0 },
    create: {
      code: "ALL",
      name: "All stages",
      description: "Applies across Primary and JHS",
      sortOrder: 0,
    },
  });

  const levels = [
    { code: "P1", name: "Primary 1", stageId: primaryStage.id, sortOrder: 1 },
    { code: "P2", name: "Primary 2", stageId: primaryStage.id, sortOrder: 2 },
    { code: "P3", name: "Primary 3", stageId: primaryStage.id, sortOrder: 3 },
    { code: "P4", name: "Primary 4", stageId: primaryStage.id, sortOrder: 4 },
    { code: "P5", name: "Primary 5", stageId: primaryStage.id, sortOrder: 5 },
    { code: "P6", name: "Primary 6", stageId: primaryStage.id, sortOrder: 6 },
    { code: "JHS1", name: "Junior High 1", stageId: jhsStage.id, sortOrder: 7 },
    { code: "JHS2", name: "Junior High 2", stageId: jhsStage.id, sortOrder: 8 },
    { code: "JHS3", name: "Junior High 3", stageId: jhsStage.id, sortOrder: 9 },
  ];

  for (const level of levels) {
    await prisma.gradeLevel.upsert({
      where: { code: level.code },
      update: level,
      create: level,
    });
  }

  const subjects = [
    { code: "ENG", name: "English Language", stageId: allStage.id, isCore: true },
    { code: "MATH", name: "Mathematics", stageId: allStage.id, isCore: true },
    { code: "SCI", name: "Science", stageId: allStage.id, isCore: true },
    {
      code: "OWOP",
      name: "Our World Our People",
      stageId: primaryStage.id,
      isCore: true,
    },
    {
      code: "RME",
      name: "Religious & Moral Education",
      stageId: allStage.id,
      isCore: true,
    },
    { code: "HIST", name: "History", stageId: jhsStage.id, isCore: true },
    { code: "CREA", name: "Creative Arts", stageId: allStage.id, isCore: false },
    { code: "COMP", name: "Computing", stageId: allStage.id, isCore: false },
    { code: "FREN", name: "French", stageId: jhsStage.id, isCore: false },
    { code: "PE", name: "Physical Education", stageId: allStage.id, isCore: false },
  ];

  for (const subject of subjects) {
    await prisma.subject.upsert({
      where: { code: subject.code },
      update: subject,
      create: subject,
    });
  }

  // Level multi-select example: Computing only for upper primary (no class opt-out).
  const allGradeLevels = await prisma.gradeLevel.findMany();
  const byCode = Object.fromEntries(allGradeLevels.map((l) => [l.code, l.id]));
  const computing = await prisma.subject.findUnique({ where: { code: "COMP" } });
  if (computing) {
    const computingLevels = ["P4", "P5", "P6"]
      .map((code) => byCode[code])
      .filter(Boolean);
    await prisma.subjectLevel.deleteMany({ where: { subjectId: computing.id } });
    if (computingLevels.length > 0) {
      await prisma.subjectLevel.createMany({
        data: computingLevels.map((gradeLevelId) => ({
          subjectId: computing.id,
          gradeLevelId,
        })),
        skipDuplicates: true,
      });
    }
  }

  const activities = [
    { code: "WORSHIP", name: "Worship / Assembly", stageId: allStage.id },
    { code: "BREAKFAST", name: "Breakfast", stageId: allStage.id },
    { code: "BREAK", name: "Break", stageId: allStage.id },
    { code: "LUNCH", name: "Lunch", stageId: allStage.id },
  ];

  for (const activity of activities) {
    await prisma.activity.upsert({
      where: { code: activity.code },
      update: activity,
      create: activity,
    });
  }

  console.log("Seed complete");
  console.log(`School: ${school.name}`);
  console.log(`Admin login: ${email} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
