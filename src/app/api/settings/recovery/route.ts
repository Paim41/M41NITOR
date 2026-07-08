import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/responses";

export const runtime = "nodejs";

const recoverySchema = z.object({
  id: z.string(),
  action: z.enum(["mark_reviewed", "remove_abandoned"]),
});

export async function GET() {
  const session = await requireAdmin();
  const recoveries = await prisma.uploadRecovery.findMany({
    where: { ownerId: session.userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    recoveries: recoveries.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const body = recoverySchema.parse(await request.json());
    if (body.action === "remove_abandoned") {
      await prisma.uploadRecovery.delete({ where: { id: body.id, ownerId: session.userId } });
    } else {
      await prisma.uploadRecovery.update({ where: { id: body.id, ownerId: session.userId }, data: { status: "failed" } });
    }
    await audit({ userId: session.userId, action: "recovery_action", targetId: body.id, request, metadata: { action: body.action } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Recovery action failed", 400);
  }
}
