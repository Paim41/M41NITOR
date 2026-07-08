import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { destinationLabels } from "@/lib/destination";
import { collectDescendantIds, ensureSystemFolders } from "@/lib/folders";
import { categories } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  const session = await requireAdmin();
  const roots = await ensureSystemFolders(session.userId);
  const privateFolderIds = await collectDescendantIds(session.userId, roots.privateContent.id);
  const [files, failedUploads, recoveries] = await Promise.all([
    prisma.fileRecord.findMany({
      where: {
        ownerId: session.userId,
        deletedAt: null,
        NOT: { customFolderId: { in: privateFolderIds } },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.fileRecord.count({ where: { ownerId: session.userId, uploadStatus: "failed" } }),
    prisma.uploadRecovery.count({ where: { ownerId: session.userId } }),
  ]);
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalSize = files.reduce((sum, file) => sum + file.fileSize, BigInt(0));
  const byCategory = Object.fromEntries(categories.map((category) => [category, files.filter((file) => file.category === category).length]));
  return NextResponse.json({
    totalFiles: files.length,
    logicalSize: totalSize.toString(),
    uploadsToday: files.filter((file) => file.createdAt >= startOfDay).length,
    failedUploads,
    duplicateFilesPrevented: 0,
    waitingInQueue: recoveries,
    telegramConnectionStatus: "configured via health check",
    categories: categories.map((category) => ({ category, label: destinationLabels[category], count: byCategory[category] })),
    recent: files.slice(0, 8).map((file) => ({
      id: file.id,
      name: file.displayName,
      category: file.category,
      size: file.fileSize.toString(),
      createdAt: file.createdAt.toISOString(),
    })),
    largest: [...files]
      .sort((a, b) => Number(b.fileSize - a.fileSize))
      .slice(0, 5)
      .map((file) => ({ id: file.id, name: file.displayName, size: file.fileSize.toString() })),
  });
}
