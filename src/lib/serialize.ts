import type { FileRecord } from "@prisma/client";
import type { SafeFileRecord } from "./types";

export function serializeFile(record: FileRecord): SafeFileRecord {
  return {
    id: record.id,
    originalName: record.originalName,
    displayName: record.displayName,
    extension: record.extension,
    mimeType: record.mimeType,
    fileSize: record.fileSize.toString(),
    category: record.category,
    checksum: record.checksum,
    customFolderId: record.customFolderId,
    telegramChatIdRef: record.telegramChatIdRef,
    telegramMessageId: record.telegramMessageId,
    telegramFileId: record.telegramFileId,
    telegramUniqueFileId: record.telegramUniqueFileId,
    telegramMediaType: record.telegramMediaType,
    uploadStatus: record.uploadStatus,
    encryptionStatus: record.encryptionStatus,
    encryptionVersion: record.encryptionVersion,
    tags: record.tags,
    description: record.description,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    deletedAt: record.deletedAt?.toISOString() ?? null,
    isFavourite: record.isFavourite,
    isArchived: record.isArchived,
    availability: record.availability,
  };
}
