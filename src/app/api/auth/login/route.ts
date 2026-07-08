import { NextResponse } from "next/server";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { authConfigured, createSessionResponse, sessionExpiresAt, verifyAdminCredentials } from "@/lib/auth";
import { env } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { jsonError } from "@/lib/responses";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  if (!authConfigured()) {
    return jsonError("Administrator credentials and SESSION_SECRET are not configured", 503);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = rateLimit(`login:${ip}`, env.LOGIN_RATE_LIMIT, 60_000);
  if (!limited.allowed) return jsonError("Too many login attempts", 429);

  const body = loginSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError("Invalid login payload", 400);

  await audit({ action: "login_attempt", request, metadata: { email: body.data.email } });
  const user = await verifyAdminCredentials(body.data.email, body.data.password);
  if (!user) return jsonError("Invalid email or password", 401);
  await audit({ userId: user.id, action: "login_success", request });
  return createSessionResponse({ userId: user.id, email: user.email, exp: sessionExpiresAt() });
}

export async function GET() {
  return NextResponse.json({ configured: authConfigured() });
}
