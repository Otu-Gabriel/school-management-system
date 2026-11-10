import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/authz";
import { can } from "@/lib/permissions";
import { Topbar } from "@/components/layout/topbar";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { AvatarCell } from "@/components/table/avatar-cell";
import { ImportExportButtons } from "@/components/table/import-export";
import { PageSizeBootstrap } from "@/components/table/page-size-bootstrap";
import { TableFilters } from "@/components/table/table-filters";
import { TablePagination } from "@/components/table/table-pagination";
import { RecordActions } from "@/components/table/record-actions";
import { getTotalPages, parsePage, parsePageSize } from "@/lib/table";
import {
  getAccessibleClassIds,
  getAccessibleClassOptions,
} from "@/lib/access-scope";

const STUDENT_TEMPLATE = [
  "admissionNo,firstName,lastName,otherNames,gender,dateOfBirth,class,guardianName,guardianPhone,guardianEmail,relationship",
  "ADM001,Ama,Mensah,,FEMALE,2015-03-12,P1 A,Kwame Mensah,0240000000,,FATHER",
].join("\n");

function param(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requirePermission("students.read");
  const params = await searchParams;
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.perPage);
  const q = param(params.q)?.trim() || "";
  const status = param(params.status) || "";
  const classSectionId = param(params.classSectionId) || "";
  const gender = param(params.gender) || "";
  const skip = (page - 1) * pageSize;

  const accessibleClassIds = await getAccessibleClassIds(
    session.user.id,
    session.user.permissions
  );
  const scopedClassOptions = await getAccessibleClassOptions(
    session.user.id,
    session.user.permissions
  );

  // Teachers without school-wide access only see students in their classes.
  const classScope: Prisma.StudentWhereInput =
    accessibleClassIds === null
      ? classSectionId
        ? { currentClassSectionId: classSectionId }
        : {}
      : {
          currentClassSectionId: classSectionId
            ? accessibleClassIds.includes(classSectionId)
              ? classSectionId
              : "__none__"
            : { in: accessibleClassIds.length ? accessibleClassIds : ["__none__"] },
        };

  const where: Prisma.StudentWhereInput = {
    AND: [
      q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { admissionNo: { contains: q, mode: "insensitive" } },
            ],
          }
        : {},
      status ? { status: status as never } : {},
      classScope,
      gender ? { gender: gender as never } : {},
    ],
  };

  const [total, students] = await Promise.all([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      include: {
        currentClassSection: { include: { gradeLevel: true } },
        guardians: { include: { guardian: true } },
      },
      skip,
      take: pageSize,
    }),
  ]);

  const totalPages = getTotalPages(total, pageSize);
  const canWrite = can(session.user.permissions, "students.write");
  const canImport = can(session.user.permissions, "students.import");
  const canExport = can(session.user.permissions, "students.export");
  const classes = scopedClassOptions;

  return (
    <>
      <Topbar title="Students" backHref="/admin" backLabel="Dashboard" />
      <main className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <Suspense fallback={null}>
          <PageSizeBootstrap />
        </Suspense>

        <PageHeader
          description={
            accessibleClassIds === null
              ? "Manage pupil records for Primary through JHS."
              : "Showing students in classes you teach or lead as class teacher."
          }
          actions={
            <>
              {canWrite ? (
                <Link href="/admin/students/new">
                  <Button size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    Add student
                  </Button>
                </Link>
              ) : null}
              {(canImport || canExport) && (
                <ImportExportButtons
                  resource="students"
                  exportPath="/api/students/export"
                  importPath="/api/students/import"
                  templateCsv={STUDENT_TEMPLATE}
                  templateName="students-template.csv"
                  canImport={canImport}
                  canExport={canExport}
                />
              )}
            </>
          }
        />

        <Suspense fallback={null}>
          <TableFilters
            fields={[
              {
                key: "q",
                label: "Search",
                type: "text",
                placeholder: "Name or admission no…",
              },
              {
                key: "status",
                label: "Status",
                type: "select",
                options: [
                  { value: "ACTIVE", label: "Active" },
                  { value: "TRANSFERRED", label: "Transferred" },
                  { value: "WITHDRAWN", label: "Withdrawn" },
                  { value: "GRADUATED", label: "Graduated" },
                  { value: "ALUMNI", label: "Alumni" },
                ],
              },
              {
                key: "classSectionId",
                label: "Class",
                type: "select",
                options: classes.map((c) => ({
                  value: c.id,
                  label: c.label,
                })),
              },
              {
                key: "gender",
                label: "Gender",
                type: "select",
                options: [
                  { value: "MALE", label: "Male" },
                  { value: "FEMALE", label: "Female" },
                  { value: "OTHER", label: "Other" },
                ],
              },
            ]}
          />
        </Suspense>

        <Card>
          <CardHeader>
            <CardTitle>
              {accessibleClassIds === null ? "All students" : "My students"} (
              {total})
            </CardTitle>
          </CardHeader>
          <CardBody className="pt-1.5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[var(--muted-foreground)]">
                  <tr>
                    <th className="pb-2 font-medium">Photo</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Admission No</th>
                    <th className="pb-2 font-medium">Class</th>
                    <th className="pb-2 font-medium">Primary guardian</th>
                    <th className="pb-2 font-medium">Status</th>
                    {canWrite ? (
                      <th className="pb-2 font-medium text-right">Actions</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {students.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canWrite ? 7 : 6}
                        className="py-6 text-[var(--muted-foreground)]"
                      >
                        No students match your filters.
                      </td>
                    </tr>
                  ) : (
                    students.map((s) => {
                      const primary =
                        s.guardians.find((g) => g.isPrimary)?.guardian ||
                        s.guardians[0]?.guardian;
                      const fullName = `${s.firstName} ${s.lastName}`;
                      return (
                        <tr key={s.id} className="border-t border-[var(--border)]">
                          <td className="py-2 pr-2">
                            <AvatarCell src={s.photoUrl} name={fullName} />
                          </td>
                          <td className="py-2 font-medium">{fullName}</td>
                          <td className="py-2">{s.admissionNo}</td>
                          <td className="py-2">
                            {s.currentClassSection
                              ? `${s.currentClassSection.gradeLevel.code} ${s.currentClassSection.name}`
                              : "—"}
                          </td>
                          <td className="py-2">{primary?.fullName || "—"}</td>
                          <td className="py-2">{s.status}</td>
                          {canWrite ? (
                            <td className="py-2">
                              <RecordActions
                                editHref={`/admin/students/${s.id}/edit`}
                                deleteUrl={`/api/students/${s.id}`}
                                deleteLabel={`Delete ${fullName}? Enrollments and guardian links will be removed.`}
                                successMessage="Student deleted"
                              />
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Suspense fallback={null}>
              <TablePagination
                page={page}
                pageSize={pageSize}
                total={total}
                totalPages={totalPages}
              />
            </Suspense>
          </CardBody>
        </Card>
      </main>
    </>
  );
}
