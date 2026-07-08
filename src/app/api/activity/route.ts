import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAdmin();
  const logs = await prisma.auditLog.findMany({
    where: { OR: [{ userId: session.userId }, { userId: null }] },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    logs: logs.map((log) => ({
      id: log.id,
      action: log.action,
      targetId: log.targetId,
      ipAddress: log.ipAddress,
      metadata: log.metadata,
      createdAt: log.createdAt.toISOString(),
    })),
  });
}
