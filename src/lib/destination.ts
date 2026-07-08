import type { FileCategory } from "./types";
import { env } from "./env";
import { prisma } from "./db";

const envMap: Record<FileCategory, string | undefined> = {
  image: env.TELEGRAM_PHOTO_CHAT_ID,
  video: env.TELEGRAM_VIDEO_CHAT_ID,
  audio: env.TELEGRAM_AUDIO_CHAT_ID,
  document: env.TELEGRAM_DOCUMENT_CHAT_ID,
  archive: env.TELEGRAM_ARCHIVE_CHAT_ID,
  other: env.TELEGRAM_OTHER_CHAT_ID,
};

export const destinationLabels: Record<FileCategory, string> = {
  image: "Images",
  video: "Videos",
  audio: "Audio",
  document: "Documents",
  archive: "Archives",
  other: "Other",
};

export async function destinationFor(category: FileCategory) {
  const dbDestination = await prisma.telegramDestination.findUnique({ where: { category } });
  return {
    id: dbDestination?.id,
    category,
    label: dbDestination?.label ?? destinationLabels[category],
    chatId: dbDestination?.encryptedChatId ?? envMap[category],
    source: dbDestination?.encryptedChatId ? "database" : "environment",
    preserveQuality: dbDestination?.preserveQuality ?? true,
    useMediaPreview: dbDestination?.useMediaPreview ?? false,
  };
}

export async function upsertDestination(category: FileCategory, chatId: string, label?: string) {
  return prisma.telegramDestination.upsert({
    where: { category },
    update: { encryptedChatId: chatId, label: label ?? destinationLabels[category], chatIdSource: "database" },
    create: { category, encryptedChatId: chatId, label: label ?? destinationLabels[category], chatIdSource: "database" },
  });
}
