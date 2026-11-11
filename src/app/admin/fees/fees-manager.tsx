"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { labelClassName, selectClassName } from "@/lib/field-styles";

type FeeTypeItem = {
  id: string;
  code: string;
  name: string;
  defaultAmount: number | null;
  isActive: boolean;
};

type InvoiceItem = {
  id: string;
  studentName: string;
  admissionNo: string;
  feeTypeName: string;
  termName: string;
  amount: number;
  paid: number;
  balance: number;
  status: string;
};

export function FeesManager({
  canWrite,
  canCollect,
  academicYearId,
  terms,
  feeTypes,
  classes,
  invoices,
}: {
  canWrite: boolean;
  canCollect: boolean;
  academicYearId: string;
  terms: Array<{ id: string; name: string }>;
  feeTypes: FeeTypeItem[];
  classes: Array<{ id: string; label: string }>;
  invoices: InvoiceItem[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [typeOpen, setTypeOpen] = useState(false);
  const [billOpen, setBillOpen] = useState(false);
  const [payOpen, setPayOpen] = useState<InvoiceItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [typeForm, setTypeForm] = useState({
    code: "",
    name: "",
    defaultAmount: "",
  });
  const [billForm, setBillForm] = useState({
    feeTypeId: feeTypes.find((t) => t.isActive)?.id || "",
    classSectionId: classes[0]?.id || "",
    termId: terms[0]?.id || "",
    amount: "",
  });
  const [payForm, setPayForm] = useState({
    amount: "",
    method: "CASH",
    reference: "",
  });

  async function saveType(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/fees/types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: typeForm.code,
        name: typeForm.name,
        defaultAmount:
          typeForm.defaultAmount === "" ? null : Number(typeForm.defaultAmount),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not create fee type", data.error || "Try again.");
      return;
    }
    toast.success("Fee type created");
    setTypeOpen(false);
    setTypeForm({ code: "", name: "", defaultAmount: "" });
    router.refresh();
  }

  async function billClass(e: React.FormEvent) {
    e.preventDefault();
    if (!academicYearId) return;
    setBusy(true);
    const selectedType = feeTypes.find((t) => t.id === billForm.feeTypeId);
    const res = await fetch("/api/fees/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        classSectionId: billForm.classSectionId,
        feeTypeId: billForm.feeTypeId,
        academicYearId,
        termId: billForm.termId || null,
        amount:
          billForm.amount === ""
            ? selectedType?.defaultAmount ?? undefined
            : Number(billForm.amount),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not bill class", data.error || "Try again.");
      return;
    }
    toast.success(`Created ${data.count} invoice(s)`);
    setBillOpen(false);
    router.refresh();
  }

  async function collectPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payOpen) return;
    setBusy(true);
    const res = await fetch("/api/fees/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invoiceId: payOpen.id,
        amount: Number(payForm.amount),
        method: payForm.method,
        reference: payForm.reference || null,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      toast.error("Could not record payment", data.error || "Try again.");
      return;
    }
    toast.success("Payment recorded");
    setPayOpen(null);
    setPayForm({ amount: "", method: "CASH", reference: "" });
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        {canWrite ? (
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => setTypeOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Fee type
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setBillOpen(true)}
              disabled={!academicYearId || classes.length === 0}
            >
              Bill class
            </Button>
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fee types ({feeTypes.length})</CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Default</th>
                  <th className="pb-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {feeTypes.map((type) => (
                  <tr key={type.id} className="border-t border-[var(--border)]">
                    <td className="py-2 font-medium">{type.code}</td>
                    <td className="py-2">{type.name}</td>
                    <td className="py-2">
                      {type.defaultAmount == null
                        ? "—"
                        : type.defaultAmount.toFixed(2)}
                    </td>
                    <td className="py-2">
                      {type.isActive ? "Active" : "Inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices ({invoices.length})</CardTitle>
        </CardHeader>
        <CardBody className="pt-1.5">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[var(--muted-foreground)]">
                <tr>
                  <th className="pb-2 font-medium">Admission</th>
                  <th className="pb-2 font-medium">Student</th>
                  <th className="pb-2 font-medium">Fee</th>
                  <th className="pb-2 font-medium">Term</th>
                  <th className="pb-2 font-medium">Amount</th>
                  <th className="pb-2 font-medium">Paid</th>
                  <th className="pb-2 font-medium">Balance</th>
                  <th className="pb-2 font-medium">Status</th>
                  {canCollect ? (
                    <th className="pb-2 font-medium text-right">Collect</th>
                  ) : null}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td
                      colSpan={canCollect ? 9 : 8}
                      className="py-6 text-[var(--muted-foreground)]"
                    >
                      No invoices for this filter.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-[var(--border)]">
                      <td className="py-2">{inv.admissionNo}</td>
                      <td className="py-2 font-medium">{inv.studentName}</td>
                      <td className="py-2">{inv.feeTypeName}</td>
                      <td className="py-2">{inv.termName}</td>
                      <td className="py-2">{inv.amount.toFixed(2)}</td>
                      <td className="py-2">{inv.paid.toFixed(2)}</td>
                      <td className="py-2">{inv.balance.toFixed(2)}</td>
                      <td className="py-2">{inv.status}</td>
                      {canCollect ? (
                        <td className="py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={inv.balance <= 0 || inv.status === "WAIVED"}
                            onClick={() => {
                              setPayOpen(inv);
                              setPayForm({
                                amount: String(inv.balance),
                                method: "CASH",
                                reference: "",
                              });
                            }}
                          >
                            Pay
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={typeOpen}
        onClose={() => setTypeOpen(false)}
        title="Add fee type"
        size="sm"
      >
        <form onSubmit={saveType} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Code</label>
            <Input
              value={typeForm.code}
              onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Name</label>
            <Input
              value={typeForm.name}
              onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Default amount</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={typeForm.defaultAmount}
              onChange={(e) =>
                setTypeForm({ ...typeForm, defaultAmount: e.target.value })
              }
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={() => setTypeOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Create"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={billOpen}
        onClose={() => setBillOpen(false)}
        title="Bill class"
        description="Creates one invoice per current student in the class."
        size="sm"
      >
        <form onSubmit={billClass} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Class</label>
            <select
              className={selectClassName}
              value={billForm.classSectionId}
              onChange={(e) =>
                setBillForm({ ...billForm, classSectionId: e.target.value })
              }
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Fee type</label>
            <select
              className={selectClassName}
              value={billForm.feeTypeId}
              onChange={(e) =>
                setBillForm({ ...billForm, feeTypeId: e.target.value })
              }
            >
              {feeTypes
                .filter((t) => t.isActive)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Term (optional)</label>
            <select
              className={selectClassName}
              value={billForm.termId}
              onChange={(e) =>
                setBillForm({ ...billForm, termId: e.target.value })
              }
            >
              <option value="">Whole year</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Amount override</label>
            <Input
              type="number"
              min={0}
              step={0.01}
              value={billForm.amount}
              onChange={(e) =>
                setBillForm({ ...billForm, amount: e.target.value })
              }
              placeholder="Use fee type default"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={() => setBillOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Billing…" : "Create invoices"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!payOpen}
        onClose={() => setPayOpen(null)}
        title="Record payment"
        description={
          payOpen
            ? `${payOpen.studentName} · balance ${payOpen.balance.toFixed(2)}`
            : undefined
        }
        size="sm"
      >
        <form onSubmit={collectPayment} className="space-y-3">
          <div className="space-y-1">
            <label className={labelClassName}>Amount</label>
            <Input
              type="number"
              min={0.01}
              step={0.01}
              value={payForm.amount}
              onChange={(e) =>
                setPayForm({ ...payForm, amount: e.target.value })
              }
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Method</label>
            <select
              className={selectClassName}
              value={payForm.method}
              onChange={(e) =>
                setPayForm({ ...payForm, method: e.target.value })
              }
            >
              <option value="CASH">Cash</option>
              <option value="MOMO">Mobile money</option>
              <option value="BANK">Bank</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className={labelClassName}>Reference</label>
            <Input
              value={payForm.reference}
              onChange={(e) =>
                setPayForm({ ...payForm, reference: e.target.value })
              }
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-1.5">
            <Button type="button" size="sm" variant="secondary" onClick={() => setPayOpen(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={busy}>
              {busy ? "Saving…" : "Record"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
