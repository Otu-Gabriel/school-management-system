"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { labelClassName, textareaClassName } from "@/lib/field-styles";

type FormState = {
  date: string;
  schoolName: string;
  recipientTitle: string;
  recipientName: string;
  schoolAddress: string;
  schoolTown: string;
  productName: string;
  yourName: string;
  yourRole: string;
  companyName: string;
  phone: string;
  email: string;
  whatsapp: string;
  website: string;
  meetingNote: string;
  extraOffer: string;
};

function todayIsoLocal() {
  const d = new Date();
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const DEFAULTS: FormState = {
  date: todayIsoLocal(),
  schoolName: "",
  recipientTitle: "Headteacher",
  recipientName: "",
  schoolAddress: "",
  schoolTown: "",
  productName: "School Management System",
  yourName: "",
  yourRole: "Software Developer",
  companyName: "",
  phone: "",
  email: "",
  whatsapp: "",
  website: "",
  meetingNote: "a short demonstration meeting (in person or online)",
  extraOffer:
    "We can set up the system for your school, import existing records where available, train your admin team, and support you during the first term of use.",
};

export function ProposalKit() {
  const [form, setForm] = useState<FormState>(DEFAULTS);

  const recipientLine = useMemo(() => {
    const title = form.recipientTitle.trim();
    const name = form.recipientName.trim();
    if (title && name) return `${title} ${name}`;
    if (name) return name;
    if (title) return title;
    return "Sir/Madam";
  }, [form.recipientTitle, form.recipientName]);

  const school = form.schoolName.trim() || "[School Name]";
  const product = form.productName.trim() || "School Management System";

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto grid max-w-6xl gap-4 p-3 sm:p-4 lg:grid-cols-[22rem_1fr] print:block print:max-w-none print:p-0">
        <Card className="no-print h-fit lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>Proposal letter details</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-[11px] text-[var(--muted-foreground)]">
              Private page — fill the school details, preview on the right, then
              print.
            </p>

            <div className="space-y-1">
              <label className={labelClassName}>Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClassName}>School name</label>
              <Input
                value={form.schoolName}
                onChange={(e) => set("schoolName", e.target.value)}
                placeholder="Greenfield Primary & JHS"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className={labelClassName}>Recipient title</label>
                <Input
                  value={form.recipientTitle}
                  onChange={(e) => set("recipientTitle", e.target.value)}
                  placeholder="Headteacher"
                />
              </div>
              <div className="space-y-1">
                <label className={labelClassName}>Recipient name</label>
                <Input
                  value={form.recipientName}
                  onChange={(e) => set("recipientName", e.target.value)}
                  placeholder="Mrs. Mensah"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClassName}>School address</label>
              <Input
                value={form.schoolAddress}
                onChange={(e) => set("schoolAddress", e.target.value)}
                placeholder="P.O. Box …"
              />
            </div>

            <div className="space-y-1">
              <label className={labelClassName}>Town / city</label>
              <Input
                value={form.schoolTown}
                onChange={(e) => set("schoolTown", e.target.value)}
                placeholder="Accra"
              />
            </div>

            <div className="space-y-1">
              <label className={labelClassName}>Product name</label>
              <Input
                value={form.productName}
                onChange={(e) => set("productName", e.target.value)}
              />
            </div>

            <div className="border-t border-[var(--border)] pt-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Your details
              </p>
              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className={labelClassName}>Your full name</label>
                  <Input
                    value={form.yourName}
                    onChange={(e) => set("yourName", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Your role</label>
                  <Input
                    value={form.yourRole}
                    onChange={(e) => set("yourRole", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Company / brand</label>
                  <Input
                    value={form.companyName}
                    onChange={(e) => set("companyName", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className={labelClassName}>Phone</label>
                    <Input
                      value={form.phone}
                      onChange={(e) => set("phone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className={labelClassName}>WhatsApp</label>
                    <Input
                      value={form.whatsapp}
                      onChange={(e) => set("whatsapp", e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Email</label>
                  <Input
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClassName}>Website</label>
                  <Input
                    value={form.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className={labelClassName}>Meeting line</label>
              <Input
                value={form.meetingNote}
                onChange={(e) => set("meetingNote", e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className={labelClassName}>Implementation offer</label>
              <textarea
                className={textareaClassName}
                rows={4}
                value={form.extraOffer}
                onChange={(e) => set("extraOffer", e.target.value)}
              />
            </div>

            <Button
              type="button"
              className="w-full"
              onClick={() => window.print()}
            >
              Print proposal letter
            </Button>
          </CardBody>
        </Card>

        <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 sm:p-5 print:overflow-visible print:rounded-none print:border-0 print:bg-white print:p-0">
          <div className="no-print mb-3 flex items-center justify-between">
            <p className="text-xs text-[var(--muted-foreground)]">Live preview</p>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>

          <article
            id="proposal-letter"
            className="proposal-sheet mx-auto max-w-[720px] bg-white px-8 py-10 text-[13px] leading-relaxed text-neutral-900 shadow-sm sm:px-12 sm:py-12 print:max-w-none print:px-0 print:py-0 print:shadow-none"
          >
            <header className="mb-8 border-b border-neutral-200 pb-4">
              <p className="text-base font-bold tracking-tight">
                {form.companyName.trim() || form.yourName.trim() || "Proposal"}
              </p>
              {(form.yourRole || form.phone || form.email) && (
                <p className="mt-1 text-[11px] text-neutral-600">
                  {[form.yourRole, form.phone, form.email]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </header>

            <p className="mb-6">{formatDate(form.date)}</p>

            <div className="mb-6 space-y-0.5">
              <p>{recipientLine}</p>
              <p className="font-semibold">{school}</p>
              {form.schoolAddress.trim() ? <p>{form.schoolAddress}</p> : null}
              {form.schoolTown.trim() ? <p>{form.schoolTown}</p> : null}
            </div>

            <p className="mb-4 font-semibold">
              Subject: Proposal — {product} for {school}
            </p>

            <p className="mb-4">Dear {recipientLine},</p>

            <p className="mb-4">
              I am writing to propose a modern {product} built for Ghanaian
              Primary and JHS schools.
            </p>

            <p className="mb-4">
              Many schools still manage admissions, classes, staff, and parent
              records with paper or scattered spreadsheets. That slows work,
              creates errors, and makes it hard to get a clear picture of the
              school.
            </p>

            <p className="mb-3">
              Our system is a secure web portal that helps {school}:
            </p>

            <ul className="mb-4 list-disc space-y-1 pl-5">
              <li>Manage students, staff, and parents in one place</li>
              <li>
                Organise academic years, stages, levels, classes, and subjects
              </li>
              <li>Assign teachers to classes and subjects</li>
              <li>
                Control access with roles and permissions (Admin, Registrar,
                Teacher, etc.)
              </li>
              <li>
                Keep school branding (name, logo, colours) consistent across the
                portal
              </li>
              <li>Publish school notices and manage school settings</li>
              <li>Import and export student and staff records</li>
            </ul>

            <p className="mb-2 font-semibold">
              Extended modules covered by this proposal
            </p>
            <p className="mb-3">
              Beyond core records and academics, the full package for {school}{" "}
              is designed to include:
            </p>
            <ul className="mb-4 list-disc space-y-1 pl-5">
              <li>
                <span className="font-medium">Attendance</span> — daily/class
                attendance, absences, and attendance reports
              </li>
              <li>
                <span className="font-medium">Exams &amp; marks</span> —
                continuous assessment and end-of-term scores
              </li>
              <li>
                <span className="font-medium">Report cards / results slips</span>{" "}
                — generate and print results per student
              </li>
              <li>
                <span className="font-medium">Fees &amp; billing</span> — fee
                structure, invoices, payments, balances, and receipts
              </li>
              <li>
                <span className="font-medium">Promotion &amp; class movement</span>{" "}
                — promote, repeat, or transfer students at term/year end
              </li>
              <li>
                <span className="font-medium">Parent portal</span> — parents view
                child information, fees, results, and notices
              </li>
              <li>
                <span className="font-medium">Teacher portal</span> — teachers
                manage their classes, attendance, and marks
              </li>
              <li>
                <span className="font-medium">Timetable</span> — class and teacher
                schedules
              </li>
              <li>
                <span className="font-medium">SMS / WhatsApp alerts</span> —
                fee reminders, absence alerts, and school notices
              </li>
              <li>
                <span className="font-medium">ID cards</span> — printable student
                and staff identity cards
              </li>
              <li>
                <span className="font-medium">Certificates</span> — leaving,
                completion, and character certificates
              </li>
              <li>
                <span className="font-medium">Admissions pipeline</span> —
                applications and intake before full enrollment
              </li>
              <li>
                <span className="font-medium">Document vault</span> — store birth
                certificates, photos, transcripts, and related files
              </li>
              <li>
                <span className="font-medium">Audit logs</span> — track important
                system actions for accountability
              </li>
            </ul>

            <p className="mb-2 font-semibold">Benefits for {school}</p>
            <ul className="mb-4 list-disc space-y-1 pl-5">
              <li>Faster registration and record updates</li>
              <li>Clearer class, staffing, fees, and results structure</li>
              <li>Better accountability through permission-based access</li>
              <li>Less paperwork and fewer lost files</li>
              <li>Access from office computers or phones (with login)</li>
              <li>Stronger parent–school communication</li>
            </ul>

            <p className="mb-2 font-semibold">Implementation</p>
            <p className="mb-4">{form.extraOffer.trim()}</p>

            <p className="mb-4">
              I would welcome {form.meetingNote.trim() || "a short meeting"} to
              demonstrate the system and discuss a package that fits your school
              size and budget.
            </p>

            <p className="mb-8">
              Thank you for your time. I look forward to hearing from you.
            </p>

            <p className="mb-1">Yours sincerely,</p>
            <p className="mt-8 font-semibold">
              {form.yourName.trim() || "[Your Full Name]"}
            </p>
            {form.yourRole.trim() ? <p>{form.yourRole}</p> : null}
            {form.companyName.trim() ? <p>{form.companyName}</p> : null}
            <p className="mt-2 text-[12px] text-neutral-700">
              {[form.phone, form.email, form.whatsapp && `WhatsApp: ${form.whatsapp}`, form.website]
                .filter(Boolean)
                .join(" | ")}
            </p>
          </article>
        </div>
      </div>

    </div>
  );
}
