import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { ensureSystemFolders, listAllFolders } from "@/lib/folders";
import { jsonError } from "@/lib/responses";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  parentId: z.string().nullable().optional(),
});

export async function GET() {
  const session = await requireAdmin();
  await ensureSystemFolders(session.userId);
  const folders = await listAllFolders(session.userId);
  return NextResponse.json({ folders });
}

export async function POST(request: Request) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const data = createSchema.parse(await request.json());
    const name = data.name.trim();
    if (!name) return jsonError("Folder name is required", 400);
    const parentId = data.parentId ?? null;

    if (parentId) {
      const parent = await prisma.folder.findFirst({ where: { id: parentId, ownerId: session.userId } });
      if (!parent) return jsonError("Parent folder not found", 404);
    }

    const duplicate = await prisma.folder.findFirst({ where: { ownerId: session.userId, parentId, name } });
    if (duplicate) return jsonError("A folder with this name already exists here", 409);

    const folder = await prisma.folder.create({ data: { ownerId: session.userId, name, parentId } });
    await audit({ userId: session.userId, action: "rename", request, targetId: folder.id, metadata: { type: "folder_created", name } });
    return NextResponse.json({ folder: { id: folder.id, name: folder.name, parentId: folder.parentId, createdAt: folder.createdAt.toISOString() } });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Folder creation failed", 400);
  }
}
