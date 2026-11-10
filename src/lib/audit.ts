import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
};

export async function writeAuditLog(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entityType: input.entityType || null,
        entityId: input.entityId || null,
        oldValues: input.oldValues
          ? (input.oldValues as object)
          : undefined,
        newValues: input.newValues
          ? (input.newValues as object)
          : undefined,
      },
    });
  } catch (error) {
    // Never block the main action if audit logging fails.
    console.error("Audit log failed", error);
  }
}
