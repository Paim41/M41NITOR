import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { serializeFile } from "@/lib/serialize";
import { jsonError } from "@/lib/responses";
import { collectDescendantIds, ensureSystemFolders } from "@/lib/folders";
import { categories, type FileCategory } from "@/lib/types";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  trash: z.string().optional(),
  sort: z.string().optional(),
  folderId: z.string().optional(),
});

const patchSchema = z.object({
  id: z.string(),
  displayName: z.string().min(1).max(180).optional(),
  description: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(64)).optional(),
  isFavourite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  restore: z.boolean().optional(),
  customFolderId: z.string().nullable().optional(),
});

export async function GET(request: Request) {
  const session = await requireAdmin();
  const url = new URL(request.url);
  const parsed = querySchema.parse(Object.fromEntries(url.searchParams));
  const q = parsed.q?.trim();
  const category = categories.includes(parsed.category as FileCategory) ? parsed.category as FileCategory : undefined;
  const orderBy =
    parsed.sort === "oldest" ? { createdAt: "asc" as const } :
    parsed.sort === "largest" ? { fileSize: "desc" as const } :
    parsed.sort === "smallest" ? { fileSize: "asc" as const } :
    parsed.sort === "name" ? { displayName: "asc" as const } :
    { createdAt: "desc" as const };
  const roots = await ensureSystemFolders(session.userId);
  const scopedFolderIds = parsed.folderId ? await collectDescendantIds(session.userId, parsed.folderId) : undefined;
  const privateFolderIds = parsed.folderId ? [] : await collectDescendantIds(session.userId, roots.privateContent.id);

  const files = await prisma.fileRecord.findMany({
    where: {
      ownerId: session.userId,
      deletedAt: parsed.trash === "true" ? { not: null } : null,
      category,
      customFolderId: scopedFolderIds ? { in: scopedFolderIds } : undefined,
      ...(privateFolderIds.length
        ? { NOT: { customFolderId: { in: privateFolderIds } } }
        : {}),
      OR: q
        ? [
            { originalName: { contains: q, mode: "insensitive" } },
            { displayName: { contains: q, mode: "insensitive" } },
            { extension: { contains: q, mode: "insensitive" } },
            { mimeType: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { checksum: { contains: q, mode: "insensitive" } },
            { tags: { has: q } },
          ]
        : undefined,
    },
    orderBy,
    take: 200,
  });
  return NextResponse.json({ files: files.map(serializeFile) });
}

export async function PATCH(request: Request) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const data = patchSchema.parse(await request.json());
    const file = await prisma.fileRecord.update({
      where: { id: data.id, ownerId: session.userId },
      data: {
        displayName: data.displayName,
        description: data.description,
        tags: data.tags,
        isFavourite: data.isFavourite,
        isArchived: data.isArchived,
        customFolderId: data.customFolderId,
        deletedAt: data.restore ? null : undefined,
      },
    });
    return NextResponse.json({ file: serializeFile(file) });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "File update failed", 400);
  }
}
