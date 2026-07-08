import { Prisma, type AuditAction } from "@prisma/client";
import { prisma } from "./db";

type AuditInput = {
  userId?: string;
  action: AuditAction;
  targetId?: string;
  request?: Request;
  metadata?: Record<string, unknown>;
};

export async function audit({ userId, action, targetId, request, metadata }: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        targetId,
        ipAddress: request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
        userAgent: request?.headers.get("user-agent"),
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue : undefined,
      },
    });
  } catch {
    // Audit logging must never leak secrets or block the primary operation.
  }
}
