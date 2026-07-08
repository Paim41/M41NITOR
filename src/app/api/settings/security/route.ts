import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { assertCsrf, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/responses";

export const runtime = "nodejs";

const settingsSchema = z.object({
  maxUploadSizeMb: z.number().positive().max(4096).optional(),
  allowedMimeTypes: z.array(z.string()).optional(),
  blockedMimeTypes: z.array(z.string()).optional(),
  allowedExtensions: z.array(z.string()).optional(),
  blockedExtensions: z.array(z.string()).optional(),
  encryptionEnabled: z.boolean().optional(),
  chunkingEnabled: z.boolean().optional(),
});

export async function GET() {
  await requireAdmin();
  const settings = await prisma.securitySetting.upsert({
    where: { singleton: "default" },
    update: {},
    create: { singleton: "default", maxUploadSizeMb: env.MAX_UPLOAD_SIZE_MB, encryptionEnabled: env.FILE_ENCRYPTION_ENABLED === "true" },
  });
  return NextResponse.json({
    settings,
    encryptionWarning: "Losing FILE_ENCRYPTION_KEY makes encrypted files unrecoverable.",
    chunkingWarning: "Experimental chunking increases upload time, download time and failure risk.",
  });
}

export async function PUT(request: Request) {
  try {
    const session = await requireAdmin();
    await assertCsrf(request);
    const body = settingsSchema.parse(await request.json());
    const settings = await prisma.securitySetting.upsert({
      where: { singleton: "default" },
      update: body,
      create: { singleton: "default", maxUploadSizeMb: body.maxUploadSizeMb ?? env.MAX_UPLOAD_SIZE_MB, ...body },
    });
    await audit({ userId: session.userId, action: "encryption_configuration_update", request });
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof Response) return error;
    return jsonError(error instanceof Error ? error.message : "Security settings update failed", 400);
  }
}
