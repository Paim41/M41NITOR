-- CreateEnum
CREATE TYPE "FileCategory" AS ENUM ('image', 'video', 'audio', 'document', 'archive', 'other');

-- CreateEnum
CREATE TYPE "UploadStatus" AS ENUM ('queued', 'validating', 'uploading', 'uploaded_to_telegram', 'metadata_saved', 'completed', 'failed', 'recovery_required');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('login_attempt', 'login_success', 'logout', 'upload_started', 'upload_completed', 'upload_failed', 'download', 'preview', 'rename', 'tag_update', 'soft_delete', 'restore', 'permanent_delete', 'telegram_configuration_update', 'encryption_configuration_update', 'recovery_action');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramDestination" (
    "id" TEXT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "label" TEXT NOT NULL,
    "encryptedChatId" TEXT,
    "chatIdSource" TEXT NOT NULL DEFAULT 'environment',
    "preserveQuality" BOOLEAN NOT NULL DEFAULT true,
    "useMediaPreview" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramDestination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecuritySetting" (
    "id" TEXT NOT NULL,
    "singleton" TEXT NOT NULL DEFAULT 'default',
    "maxUploadSizeMb" INTEGER NOT NULL DEFAULT 50,
    "allowedMimeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedMimeTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "allowedExtensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedExtensions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "encryptionEnabled" BOOLEAN NOT NULL DEFAULT false,
    "chunkingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecuritySetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileRecord" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "category" "FileCategory" NOT NULL,
    "checksum" TEXT NOT NULL,
    "telegramDestinationId" TEXT,
    "telegramChatIdRef" TEXT NOT NULL,
    "telegramMessageId" INTEGER,
    "telegramFileId" TEXT,
    "telegramUniqueFileId" TEXT,
    "telegramMediaType" TEXT,
    "uploadStatus" "UploadStatus" NOT NULL DEFAULT 'queued',
    "encryptionStatus" BOOLEAN NOT NULL DEFAULT false,
    "encryptionVersion" INTEGER,
    "encryptionNonce" TEXT,
    "encryptionAuthTag" TEXT,
    "customFolderId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "deletedAt" TIMESTAMP(3),
    "isFavourite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "availability" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileChunk" (
    "id" TEXT NOT NULL,
    "fileRecordId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "telegramMessageId" INTEGER NOT NULL,
    "telegramFileId" TEXT,
    "telegramUniqueFileId" TEXT,
    "encryptionNonce" TEXT,
    "encryptionAuthTag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FileChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UploadRecovery" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "checksum" TEXT,
    "category" "FileCategory",
    "telegramChatId" TEXT,
    "telegramMessageId" INTEGER,
    "telegramFileId" TEXT,
    "status" "UploadStatus" NOT NULL DEFAULT 'recovery_required',
    "reason" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UploadRecovery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" "AuditAction" NOT NULL,
    "targetId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramDestination_category_key" ON "TelegramDestination"("category");

-- CreateIndex
CREATE UNIQUE INDEX "SecuritySetting_singleton_key" ON "SecuritySetting"("singleton");

-- CreateIndex
CREATE INDEX "FileRecord_ownerId_category_createdAt_idx" ON "FileRecord"("ownerId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "FileRecord_checksum_idx" ON "FileRecord"("checksum");

-- CreateIndex
CREATE INDEX "FileRecord_deletedAt_idx" ON "FileRecord"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileChunk_fileRecordId_chunkIndex_key" ON "FileChunk"("fileRecordId", "chunkIndex");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_telegramDestinationId_fkey" FOREIGN KEY ("telegramDestinationId") REFERENCES "TelegramDestination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileRecord" ADD CONSTRAINT "FileRecord_customFolderId_fkey" FOREIGN KEY ("customFolderId") REFERENCES "Folder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileChunk" ADD CONSTRAINT "FileChunk_fileRecordId_fkey" FOREIGN KEY ("fileRecordId") REFERENCES "FileRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
