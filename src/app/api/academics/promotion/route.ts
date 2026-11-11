import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentAcademicContext } from "@/lib/school";
import {
  findEquivalentClass,
  isLastTermOfYear,
} from "@/lib/class-year";
import { openPlacement } from "@/lib/placements";

const exceptionSchema = z.object({
  studentId: z.string().min(1),
  destinationClassSectionId: z.string().min(1),
  action: z.enum(["PROMOTE", "REPEAT", "CONTINUE"]),
  reason: z.string().optional().nullable(),
});

const schema = z.object({
  sourceClassSectionId: z.string().min(1),
  destinationYearId: z.string().min(1),
  destinationClassSectionId: z.string().optional().nullable(),
  action: z.enum(["PROMOTE", "REPEAT"]),
  studentIds: z.array(z.string().min(1)).default([]),
  exceptions: z.array(exceptionSchema).default([]),
  /** Students in source class not listed above continue into equivalent class. */
  continueRemaining: z.boolean().default(true),
  createMissingClass: z.boolean().default(false),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    !(
      can(session.user.permissions, "students.promote") ||
      can(session.user.permissions, "students.write")
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const context = await getCurrentAcademicContext();
  const windowOpen = context.year
    ? isLastTermOfYear(context.year.terms)
    : false;

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: {
      terms: { orderBy: { termNumber: "asc" } },
      classSections: {
        where: { isActive: true },
        include: { gradeLevel: true },
        orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
      },
    },
  });

  const sourceClasses = context.year
    ? await prisma.classSection.findMany({
        where: { academicYearId: context.year.id, isActive: true },
        include: {
          gradeLevel: true,
          _count: { select: { currentStudents: true } },
        },
        orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
      })
    : [];

  return NextResponse.json({
    windowOpen,
    currentYear: context.year
      ? {
          id: context.year.id,
          name: context.year.name,
          termName: context.term?.name || null,
          termNumber: context.term?.termNumber || null,
        }
      : null,
    sourceClasses,
    years: years.map((year) => ({
      id: year.id,
      name: year.name,
      isCurrent: year.isCurrent,
      classes: year.classSections.map((c) => ({
        id: c.id,
        name: c.name,
        gradeLevelId: c.gradeLevelId,
        gradeLevelCode: c.gradeLevel.code,
        label: `${c.gradeLevel.code} ${c.name}`,
      })),
    })),
    canCreateClass: can(session.user.permissions, "academics.write"),
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (
    !session?.user ||
    !(
      can(session.user.permissions, "students.promote") ||
      can(session.user.permissions, "students.write")
    )
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const context = await getCurrentAcademicContext();
  if (!context.year || !context.term) {
    return NextResponse.json(
      { error: "Set a current academic year and term first." },
      { status: 400 }
    );
  }
  if (!isLastTermOfYear(context.year.terms)) {
    return NextResponse.json(
      {
        error:
          "Promotion and repetition are only allowed when the current term is the last term of the year.",
      },
      { status: 400 }
    );
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid promotion data" }, { status: 400 });
  }

  const data = parsed.data;
  const canCreate = can(session.user.permissions, "academics.write");

  // Bulk must target exactly one destination class.
  const bulkDestinations = new Set(
    data.studentIds.map(() => data.destinationClassSectionId)
  );
  if (bulkDestinations.size !== 1) {
    return NextResponse.json(
      { error: "Bulk promotion must use a single destination class." },
      { status: 400 }
    );
  }

  const exceptionIds = new Set(data.exceptions.map((e) => e.studentId));
  const bulkIds = data.studentIds.filter((id) => !exceptionIds.has(id));

  if (bulkIds.length === 0 && data.exceptions.length === 0 && !data.continueRemaining) {
    return NextResponse.json(
      { error: "Select students for bulk movement, exceptions, or continue remaining." },
      { status: 400 }
    );
  }

  if (bulkIds.length > 0 && !data.destinationClassSectionId) {
    return NextResponse.json(
      { error: "Bulk destination class is required." },
      { status: 400 }
    );
  }

  const sourceClass = await prisma.classSection.findUnique({
    where: { id: data.sourceClassSectionId },
    include: { gradeLevel: true },
  });
  if (!sourceClass || sourceClass.academicYearId !== context.year.id) {
    return NextResponse.json(
      { error: "Source class must belong to the current academic year." },
      { status: 400 }
    );
  }

  const destinationYear = await prisma.academicYear.findUnique({
    where: { id: data.destinationYearId },
  });
  if (!destinationYear) {
    return NextResponse.json(
      { error: "Destination academic year not found." },
      { status: 404 }
    );
  }

  if (bulkIds.length > 0 && data.destinationClassSectionId) {
    const destinationClass = await prisma.classSection.findUnique({
      where: { id: data.destinationClassSectionId },
    });
    if (!destinationClass) {
      return NextResponse.json(
        {
          error: canCreate
            ? "Destination class not found."
            : "Destination class not found. Ask an administrator to create the class for that year.",
        },
        { status: canCreate ? 404 : 400 }
      );
    }
    if (destinationClass.academicYearId !== data.destinationYearId) {
      return NextResponse.json(
        { error: "Destination class must belong to the selected destination year." },
        { status: 400 }
      );
    }
  }

  const sourceStudents = await prisma.student.findMany({
    where: {
      currentClassSectionId: data.sourceClassSectionId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
  const sourceStudentIds = new Set(sourceStudents.map((s) => s.id));

  for (const id of [...bulkIds, ...exceptionIds]) {
    if (!sourceStudentIds.has(id)) {
      return NextResponse.json(
        { error: "One or more students are not in the source class." },
        { status: 400 }
      );
    }
  }

  try {
    const summary = await prisma.$transaction(async (tx) => {
      let promoted = 0;
      let repeated = 0;
      let continued = 0;

      async function resolveDestination(classId: string) {
        const found = await tx.classSection.findUnique({ where: { id: classId } });
        if (found) {
          if (!found.isActive) {
            throw new Error("Destination class is archived/inactive.");
          }
          if (found.academicYearId !== data.destinationYearId) {
            throw new Error("Destination class year mismatch.");
          }
          return found;
        }
        if (data.createMissingClass && canCreate) {
          const created = await findEquivalentClass(tx, {
            fromClassId: data.sourceClassSectionId,
            targetYearId: data.destinationYearId,
            createIfMissing: true,
          });
          if (!created) throw new Error("Could not create destination class.");
          return created;
        }
        if (!canCreate) {
          throw new Error(
            "Destination class missing. Ask administration to create it."
          );
        }
        throw new Error("Destination class not found.");
      }

      if (bulkIds.length > 0) {
        if (!data.destinationClassSectionId) {
          throw new Error("Bulk destination class is required.");
        }
        const bulkDest = await resolveDestination(data.destinationClassSectionId);
        for (const studentId of bulkIds) {
          await openPlacement(tx, {
            studentId,
            classSectionId: bulkDest.id,
            academicYearId: data.destinationYearId,
            termId: null,
            status: data.action === "PROMOTE" ? "PROMOTED" : "REPEATED",
            reason:
              data.action === "PROMOTE"
                ? `Bulk promotion from ${sourceClass.gradeLevel.code} ${sourceClass.name}`
                : `Bulk repetition in ${sourceClass.gradeLevel.code} ${sourceClass.name}`,
          });
          if (data.action === "PROMOTE") promoted += 1;
          else repeated += 1;
        }
      }

      for (const item of data.exceptions) {
        const dest = await resolveDestination(item.destinationClassSectionId);
        await openPlacement(tx, {
          studentId: item.studentId,
          classSectionId: dest.id,
          academicYearId: data.destinationYearId,
          termId: null,
          status:
            item.action === "PROMOTE"
              ? "PROMOTED"
              : item.action === "REPEAT"
                ? "REPEATED"
                : "CONTINUED",
          reason: item.reason || `Manual exception (${item.action})`,
        });
        if (item.action === "PROMOTE") promoted += 1;
        else if (item.action === "REPEAT") repeated += 1;
        else continued += 1;
      }

      if (data.continueRemaining) {
        const handled = new Set([...bulkIds, ...exceptionIds]);
        const remaining = sourceStudents
          .map((s) => s.id)
          .filter((id) => !handled.has(id));

        for (const studentId of remaining) {
          const equivalent = await findEquivalentClass(tx, {
            fromClassId: data.sourceClassSectionId,
            targetYearId: data.destinationYearId,
            createIfMissing: data.createMissingClass && canCreate,
          });
          if (!equivalent) {
            if (!canCreate) {
              throw new Error(
                "Equivalent class missing for remaining students. Ask administration to create classes for the new year."
              );
            }
            throw new Error(
              "Equivalent class missing for remaining students. Enable create-missing or create the class first."
            );
          }
          await openPlacement(tx, {
            studentId,
            classSectionId: equivalent.id,
            academicYearId: data.destinationYearId,
            termId: null,
            status: "CONTINUED",
            reason: `Continued in ${equivalent.name} for ${destinationYear.name}`,
          });
          continued += 1;
        }
      }

      return { promoted, repeated, continued };
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "students.promote",
      entityType: "ClassSection",
      entityId: data.sourceClassSectionId,
      newValues: {
        action: data.action,
        destinationYearId: data.destinationYearId,
        destinationClassSectionId: data.destinationClassSectionId,
        ...summary,
      },
    });

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not complete promotion.",
      },
      { status: 400 }
    );
  }
}
