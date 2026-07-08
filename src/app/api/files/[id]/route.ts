import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteTelegramMessage } from "@/lib/telegram";
import { jsonError } from "@/lib/responses";

export const runtime = "nodejs";

const deleteSchema = z.object({
  permanent: z.boolean().default(false),
  confirmationName: z.string().optional(),
});

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const { id } = await context.params;
    const body = deleteSchema.parse(await request.json().catch(() => ({})));
    const file = await prisma.fileRecord.findFirst({ where: { id, ownerId: session.userId } });
    if (!file) return jsonError("File not found", 404);
    if (!body.permanent) {
      await prisma.fileRecord.update({ where: { id }, data: { deletedAt: new Date() } });
      await audit({ userId: session.userId, action: "soft_delete", targetId: id, request });
      return NextResponse.json({ ok: true, deleted: "soft" });
    }
    if (body.confirmationName !== file.displayName && body.confirmationName !== file.originalName) {
      return jsonError("Type the filename to permanently delete this file", 400);
    }
    if (file.telegramMessageId) {
      try {
        await deleteTelegramMessage(file.telegramChatIdRef, file.telegramMessageId);
      } catch {
        await prisma.fileRecord.update({ where: { id }, data: { availability: "telegram_message_missing" } });
      }
    }
    await prisma.fileRecord.delete({ where: { id } });
    await audit({ userId: session.userId, action: "permanent_delete", targetId: id, request, metadata: { name: file.originalName } });
    return NextResponse.json({ ok: true, deleted: "permanent" });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Delete failed", 400);
  }
}
