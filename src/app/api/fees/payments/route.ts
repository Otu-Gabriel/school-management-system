import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { deriveInvoiceStatus, invoicePaidTotal } from "@/lib/marks";

const schema = z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive(),
  method: z.enum(["CASH", "MOMO", "BANK", "OTHER"]).optional(),
  paidOn: z.string().optional(),
  reference: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !can(session.user.permissions, "fees.collect")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment data" }, { status: 400 });
  }

  const invoice = await prisma.feeInvoice.findUnique({
    where: { id: parsed.data.invoiceId },
    include: { payments: true },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (invoice.status === "WAIVED") {
    return NextResponse.json(
      { error: "Cannot collect on a waived invoice" },
      { status: 400 }
    );
  }

  const alreadyPaid = invoicePaidTotal(invoice.payments);
  const balance = Math.max(0, invoice.amount - alreadyPaid);
  if (parsed.data.amount > balance + 0.001) {
    return NextResponse.json(
      { error: `Payment exceeds balance of ${balance.toFixed(2)}` },
      { status: 400 }
    );
  }

  const payment = await prisma.$transaction(async (tx) => {
    const created = await tx.feePayment.create({
      data: {
        invoiceId: invoice.id,
        amount: parsed.data.amount,
        method: parsed.data.method || "CASH",
        paidOn: parsed.data.paidOn ? new Date(parsed.data.paidOn) : new Date(),
        reference: parsed.data.reference || null,
        receivedByUserId: session.user.id,
      },
    });

    const payments = await tx.feePayment.findMany({
      where: { invoiceId: invoice.id },
    });
    const paid = invoicePaidTotal(payments);
    const status = deriveInvoiceStatus(invoice.amount, paid, invoice.status);

    await tx.feeInvoice.update({
      where: { id: invoice.id },
      data: { status },
    });

    return created;
  });

  return NextResponse.json(payment, { status: 201 });
}
