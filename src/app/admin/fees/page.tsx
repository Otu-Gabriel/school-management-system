import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { TableFilters } from "@/components/table/table-filters";
import { FeesManager } from "./fees-manager";

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function FeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("fees.read");
  const canWrite = can(session.user.permissions, "fees.write");
  const canCollect = can(session.user.permissions, "fees.collect");
  const params = await searchParams;
  const yearIdParam = param(params.yearId) || "";
  const status = param(params.status) || "";
  const q = param(params.q)?.trim() || "";

  const years = await prisma.academicYear.findMany({
    orderBy: { startDate: "desc" },
    include: { terms: { orderBy: { termNumber: "asc" } } },
  });
  const selectedYear =
    years.find((y) => y.id === yearIdParam) ||
    years.find((y) => y.isCurrent) ||
    years[0] ||
    null;

  const [feeTypes, classes, invoices] = await Promise.all([
    prisma.feeType.findMany({ orderBy: { name: "asc" } }),
    selectedYear
      ? prisma.classSection.findMany({
          where: { academicYearId: selectedYear.id, isActive: true },
          include: { gradeLevel: true },
          orderBy: [{ gradeLevel: { sortOrder: "asc" } }, { name: "asc" }],
        })
      : Promise.resolve([]),
    selectedYear
      ? prisma.feeInvoice.findMany({
          where: {
            academicYearId: selectedYear.id,
            ...(status
              ? { status: status as "OPEN" | "PARTIAL" | "PAID" | "WAIVED" }
              : {}),
            ...(q
              ? {
                  student: {
                    OR: [
                      { admissionNo: { contains: q, mode: "insensitive" } },
                      { firstName: { contains: q, mode: "insensitive" } },
                      { lastName: { contains: q, mode: "insensitive" } },
                    ],
                  },
                }
              : {}),
          },
          include: {
            student: true,
            feeType: true,
            term: true,
            payments: true,
          },
          orderBy: { createdAt: "desc" },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <Topbar title="Fees" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <PageHeader description="Bill students by fee type and record cash/MoMo/bank payments manually." />

        <Suspense fallback={null}>
          <TableFilters
            defaultOpen
            defaults={{ yearId: selectedYear?.id || "" }}
            fields={[
              {
                key: "yearId",
                label: "Year",
                type: "select",
                allowEmpty: false,
                options: years.map((y) => ({
                  value: y.id,
                  label: `${y.name}${y.isCurrent ? " (current)" : ""}`,
                })),
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  { value: "OPEN", label: "Open" },
                  { value: "PARTIAL", label: "Partial" },
                  { value: "PAID", label: "Paid" },
                  { value: "WAIVED", label: "Waived" },
                ],
              },
              {
                key: "q",
                label: "Student",
                type: "text",
                placeholder: "Admission or name…",
              },
            ]}
          />
        </Suspense>

        <FeesManager
          canWrite={canWrite}
          canCollect={canCollect}
          academicYearId={selectedYear?.id || ""}
          terms={(selectedYear?.terms || []).map((t) => ({
            id: t.id,
            name: t.name,
          }))}
          feeTypes={feeTypes.map((t) => ({
            id: t.id,
            code: t.code,
            name: t.name,
            defaultAmount: t.defaultAmount,
            isActive: t.isActive,
          }))}
          classes={classes.map((c) => ({
            id: c.id,
            label: `${c.gradeLevel.code} ${c.name}`,
          }))}
          invoices={invoices.map((inv) => {
            const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
            return {
              id: inv.id,
              studentName: `${inv.student.firstName} ${inv.student.lastName}`,
              admissionNo: inv.student.admissionNo,
              feeTypeName: inv.feeType.name,
              termName: inv.term?.name || "—",
              amount: inv.amount,
              paid,
              balance: Math.max(0, inv.amount - paid),
              status: inv.status,
            };
          })}
        />
      </main>
    </>
  );
}
