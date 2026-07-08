export const categories = ["image", "video", "audio", "document", "archive", "other"] as const;

export type FileCategory = (typeof categories)[number];

export type SafeFileRecord = {
  id: string;
  originalName: string;
  displayName: string;
  extension: string;
  mimeType: string;
  fileSize: string;
  category: FileCategory;
  checksum: string;
  customFolderId: string | null;
  telegramChatIdRef: string;
  telegramMessageId: number | null;
  telegramFileId: string | null;
  telegramUniqueFileId: string | null;
  telegramMediaType: string | null;
  uploadStatus: string;
  encryptionStatus: boolean;
  encryptionVersion: number | null;
  tags: string[];
  description: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isFavourite: boolean;
  isArchived: boolean;
  availability: string;
};
