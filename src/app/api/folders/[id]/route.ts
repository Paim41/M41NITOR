import { NextResponse } from "next/server";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { collectDescendantIds, isProtectedRootFolder } from "@/lib/folders";
import { jsonError } from "@/lib/responses";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const { id } = await context.params;
    const folder = await prisma.folder.findFirst({ where: { id, ownerId: session.userId } });
    if (!folder) return jsonError("Folder not found", 404);
    if (isProtectedRootFolder(folder.name, folder.parentId)) {
      return jsonError("This system folder cannot be deleted", 403);
    }

    const idsToDelete = await collectDescendantIds(session.userId, id);

    // Files inside the deleted branch are preserved — unlinked back to "All Files" rather than destroyed.
    await prisma.fileRecord.updateMany({
      where: { ownerId: session.userId, customFolderId: { in: idsToDelete } },
      data: { customFolderId: null },
    });

    // Folder.parentId is a plain string column (no DB-level FK), so a single
    // bulk delete across the whole collected branch is safe in any order.
    await prisma.folder.deleteMany({ where: { id: { in: idsToDelete }, ownerId: session.userId } });

    await audit({ userId: session.userId, action: "permanent_delete", request, targetId: id, metadata: { type: "folder_deleted", name: folder.name, count: idsToDelete.length } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Folder delete failed", 400);
  }
}
