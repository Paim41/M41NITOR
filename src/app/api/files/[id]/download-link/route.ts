import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/responses";
import { createDownloadToken } from "@/lib/signed-url";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const { id } = await context.params;
    const file = await prisma.fileRecord.findFirst({ where: { id, ownerId: session.userId, deletedAt: null } });
    if (!file) return jsonError("File not found", 404);
    const token = createDownloadToken({ fileId: file.id, userId: session.userId, mode: "download", exp: Date.now() + 5 * 60_000 });
    await audit({ userId: session.userId, action: "download", targetId: id, request, metadata: { linkIssued: true } });
    return NextResponse.json({ url: `/api/download/${token}`, expiresInSeconds: 300 });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError("Unable to create download link", 400);
  }
}
