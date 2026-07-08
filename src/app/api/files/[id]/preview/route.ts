import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { decryptBuffer } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isPreviewSafe } from "@/lib/file-policy";
import { jsonError } from "@/lib/responses";
import { downloadTelegramFile } from "@/lib/telegram";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    const { id } = await context.params;
    const file = await prisma.fileRecord.findFirst({ where: { id, ownerId: session.userId, deletedAt: null } });
    if (!file || !file.telegramFileId) return jsonError("File not found", 404);
    if (!isPreviewSafe(file.mimeType)) return jsonError("Preview disabled for this file type", 415);

    // Content for a given file id never changes (checksum is fixed at upload), so it's safe to
    // cache hard and skip the Telegram round trip entirely on repeat requests.
    const etag = `"${file.checksum}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { etag, "cache-control": "private, max-age=31536000, immutable" } });
    }

    let buffer = await downloadTelegramFile(file.telegramFileId);
    if (file.encryptionStatus) {
      if (!file.encryptionNonce || !file.encryptionAuthTag) return jsonError("Missing encryption metadata", 500);
      buffer = decryptBuffer(buffer, file.encryptionNonce, file.encryptionAuthTag);
    }
    await audit({ userId: session.userId, action: "preview", targetId: id, request });
return new Response(buffer, {
      headers: {
        "content-type": file.mimeType,
        "content-disposition": `inline; filename="${encodeURIComponent(file.originalName)}"`,
        "x-content-type-options": "nosniff",
        "content-security-policy": "default-src 'none'; img-src 'self' blob: data:; media-src 'self' blob: data:; style-src 'unsafe-inline'",
        "cache-control": "private, max-age=31536000, immutable",
        etag,
      },
    });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Preview failed", 500);
  }
}
