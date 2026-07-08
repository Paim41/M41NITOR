import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export const runtime = "nodejs";

export async function GET() {
  const checks: Record<string, unknown> = {
    app: "ok",
    telegramApiBaseUrl: env.TELEGRAM_API_BASE_URL,
    telegramTokenConfigured: Boolean(env.TELEGRAM_BOT_TOKEN),
    database: "unknown",
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (error) {
    checks.database = error instanceof Error ? error.message : "unavailable";
  }
  return NextResponse.json(checks, { status: checks.database === "ok" ? 200 : 503 });
}
