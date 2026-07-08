import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { encryptBuffer, sha256, shouldEncryptFiles } from "@/lib/crypto";
import { destinationFor } from "@/lib/destination";
import { env } from "@/lib/env";
import { inspectUpload } from "@/lib/file-policy";
import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/responses";
import { serializeFile } from "@/lib/serialize";
import { uploadTelegramDocument } from "@/lib/telegram";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? session.userId;
    const limited = rateLimit(`upload:${session.userId}:${ip}`, env.UPLOAD_RATE_LIMIT, 60_000);
    if (!limited.allowed) return jsonError("Upload rate limit exceeded", 429);

    const form = await request.formData();
    const files = form.getAll("files").filter((value): value is File => value instanceof File);
    if (!files.length) return jsonError("No files supplied", 400);
    const requestedFolderId = String(form.get("folderId") ?? "").trim() || null;
    const requestedDisplayName = String(form.get("displayName") ?? "").trim() || null;

    let customFolderId: string | null = null;
    if (requestedFolderId) {
      const folder = await prisma.folder.findFirst({ where: { id: requestedFolderId, ownerId: session.userId } });
      if (!folder) return jsonError("Selected destination folder was not found", 400);
      customFolderId = folder.id;
    }

    const results = [];
    for (const file of files) {
      await audit({ userId: session.userId, action: "upload_started", request, metadata: { name: file.name, size: file.size } });
      if (file.size > env.MAX_UPLOAD_SIZE_MB * 1024 * 1024) {
        results.push({ name: file.name, status: "failed", error: "File exceeds maximum upload size" });
        await audit({ userId: session.userId, action: "upload_failed", request, metadata: { name: file.name, reason: "oversized" } });
        continue;
      }

      const raw = Buffer.from(await file.arrayBuffer());
      const inspected = await inspectUpload(raw, file.name, file.type);
      const checksum = sha256(raw);
      const duplicate = await prisma.fileRecord.findFirst({
        where: { ownerId: session.userId, checksum, deletedAt: null },
      });
      if (duplicate) {
        results.push({ name: file.name, status: "duplicate", duplicateId: duplicate.id });
        continue;
      }

      const destination = await destinationFor(inspected.category);
      if (!destination.chatId) {
        results.push({ name: file.name, status: "failed", error: `Missing Telegram destination for ${destination.label}` });
        continue;
      }

      const encrypted = shouldEncryptFiles() ? encryptBuffer(raw) : null;
      const uploadBuffer = encrypted?.data ?? raw;
      let telegram;
      try {
        telegram = await uploadTelegramDocument({
          chatId: destination.chatId,
          buffer: uploadBuffer,
          filename: inspected.originalName,
          mimeType: inspected.mimeType,
          caption: "M41NITOR upload successful 🥰",
        });
      } catch (error) {
        await prisma.uploadRecovery.create({
          data: {
            ownerId: session.userId,
            originalName: inspected.originalName,
            checksum,
            category: inspected.category,
            telegramChatId: destination.chatId,
            reason: error instanceof Error ? error.message : "Telegram upload failed 🥲",
            payload: { phase: "telegram_upload" },
          },
        });
        throw error;
      }

      try {
        const record = await prisma.fileRecord.create({
          data: {
            ownerId: session.userId,
            originalName: inspected.originalName,
            displayName: requestedDisplayName || inspected.displayName,
            extension: inspected.extension,
            mimeType: inspected.mimeType,
            fileSize: BigInt(file.size),
            category: inspected.category,
            checksum,
            telegramDestinationId: destination.id,
            telegramChatIdRef: destination.chatId,
            telegramMessageId: telegram.messageId,
            telegramFileId: telegram.fileId,
            telegramUniqueFileId: telegram.uniqueFileId,
            telegramMediaType: telegram.mediaType,
            uploadStatus: "completed",
            encryptionStatus: Boolean(encrypted),
            encryptionVersion: encrypted?.version,
            encryptionNonce: encrypted?.nonce,
            encryptionAuthTag: encrypted?.authTag,
            customFolderId,
            tags: String(form.get("tags") ?? "")
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
            description: String(form.get("description") ?? "") || null,
          },
        });
        await audit({ userId: session.userId, action: "upload_completed", targetId: record.id, request });
        results.push({ name: file.name, status: "completed", file: serializeFile(record) });
      } catch (error) {
        await prisma.uploadRecovery.create({
          data: {
            ownerId: session.userId,
            originalName: inspected.originalName,
            checksum,
            category: inspected.category,
            telegramChatId: destination.chatId,
            telegramMessageId: telegram.messageId,
            telegramFileId: telegram.fileId,
            reason: error instanceof Error ? error.message : "Metadata save failed",
            payload: { phase: "metadata_save" },
          },
        });
        results.push({ name: file.name, status: "recovery_required", error: "Telegram upload succeeded but metadata save failed" });
      }
    }
    return NextResponse.json({ results });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Upload failed", 500);
  }
}
