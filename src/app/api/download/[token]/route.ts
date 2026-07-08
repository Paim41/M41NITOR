import { audit } from "@/lib/audit";
import { decryptBuffer } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/responses";
import { verifyDownloadToken } from "@/lib/signed-url";
import { downloadTelegramFile } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await context.params;
    const payload = verifyDownloadToken(token);
    if (!payload) return jsonError("Download link expired or invalid", 403);
    const file = await prisma.fileRecord.findFirst({ where: { id: payload.fileId, ownerId: payload.userId, deletedAt: null } });
    if (!file || !file.telegramFileId) return jsonError("File not found", 404);
    let buffer = await downloadTelegramFile(file.telegramFileId);
    if (file.encryptionStatus) {
      if (!file.encryptionNonce || !file.encryptionAuthTag) return jsonError("Missing encryption metadata", 500);
      buffer = decryptBuffer(buffer, file.encryptionNonce, file.encryptionAuthTag);
    }
    await audit({ userId: payload.userId, action: "download", targetId: file.id, request });
    return new Response(buffer, {
      headers: {
        "content-type": file.mimeType,
        "content-length": String(buffer.length),
        "content-disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Download failed", 500);
  }
}
