import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";

const createSchema = z
  .object({
    studentIds: z.array(z.string().min(1)).optional(),
    feeTypeId: z.string().min(1),
    academicYearId: z.string().min(1),
    termId: z.string().optional().nullable(),
    amount: z.number().min(0).optional(),
    dueDate: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
    classSectionId: z.string().optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (!data.classSectionId && (!data.studentIds || data.studentIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide students or a class to bill",
        path: ["studentIds"],
      });
    }
  });

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "fees.read")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get("studentId") || undefined;
  const academicYearId = searchParams.get("academicYearId") || undefined;
  const status = searchParams.get("status") || undefined;

  const invoices = await prisma.feeInvoice.findMany({
    where: {
      studentId,
      academicYearId,
      ...(status
        ? { status: status as "OPEN" | "PARTIAL" | "PAID" | "WAIVED" }
        : {}),
    },
    include: {
      student: true,
      feeType: true,
      term: true,
      academicYear: true,
      payments: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  return NextResponse.json(
    invoices.map((inv) => {
      const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
      return { ...inv, paid, balance: Math.max(0, inv.amount - paid) };
    })
  );
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "fees.write")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invoice data" }, { status: 400 });
  }

  const data = parsed.data;
  const feeType = await prisma.feeType.findUnique({
    where: { id: data.feeTypeId },
  });
  if (!feeType || !feeType.isActive) {
    return NextResponse.json({ error: "Fee type not found" }, { status: 400 });
  }

  let studentIds = [...new Set(data.studentIds || [])];
  if (data.classSectionId) {
    const enrolled = await prisma.enrollment.findMany({
      where: {
        classSectionId: data.classSectionId,
        academicYearId: data.academicYearId,
        isCurrent: true,
      },
      select: { studentId: true },
    });
    studentIds = [...new Set(enrolled.map((e) => e.studentId))];
    if (studentIds.length === 0) {
      return NextResponse.json(
        { error: "No current students in that class" },
        { status: 400 }
      );
    }
  }

  const amount = data.amount ?? feeType.defaultAmount ?? 0;
  if (amount <= 0) {
    return NextResponse.json(
      { error: "Amount must be greater than zero" },
      { status: 400 }
    );
  }

  const dueDate = data.dueDate ? new Date(data.dueDate) : null;
  const created = await prisma.feeInvoice.createMany({
    data: studentIds.map((studentId) => ({
      studentId,
      feeTypeId: data.feeTypeId,
      academicYearId: data.academicYearId,
      termId: data.termId || null,
      amount,
      dueDate,
      note: data.note || null,
      status: "OPEN" as const,
    })),
  });

  return NextResponse.json({ ok: true, count: created.count }, { status: 201 });
}
